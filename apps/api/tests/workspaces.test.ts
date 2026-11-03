import { randomBytes } from "node:crypto";
import { member, organization, user as userTable } from "@ai-interview/db/schema";
import { makeSignature } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { getAuth } from "../src/modules/auth/auth";
import { createTestDatabase } from "./database";
import type { ApiBindings } from "../src/env";
import { generateWorkspaceId } from "../src/modules/workspaces/service";

const origin = "https://sainoa.example";
const secret = randomBytes(32).toString("hex");
let platform: Awaited<ReturnType<typeof createTestDatabase>>;
let env: ApiBindings;
let auth: ReturnType<typeof getAuth>;

beforeAll(async () => {
  platform = await createTestDatabase();
  env = {
    ...platform.env,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: origin,
    GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-secret",
  };
});

beforeEach(async () => {
  await platform.database.delete(organization);
  await platform.database.delete(userTable);
  auth = getAuth(env);
});

afterAll(() => platform.dispose());
afterEach(() => vi.restoreAllMocks());

async function account(email: string) {
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser(
    { email, emailVerified: true, name: email.split("@")[0] },
    { method: "oauth" },
  );
  const session = await context.internalAdapter.createSession(user.id, false);
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${await makeSignature(session.token, secret)}`)}`;
  const [workspace] = await platform.database
    .select()
    .from(organization)
    .innerJoin(member, eq(organization.id, member.organizationId))
    .where(eq(member.userId, user.id));
  return { cookie, user, workspace: workspace.organization };
}

function call(path: string, cookie?: string, body?: object) {
  return app.request(
    new Request(`${origin}/api/${path}`, {
      body: body ? JSON.stringify(body) : undefined,
      headers: { "content-type": "application/json", origin, ...(cookie ? { cookie } : {}) },
      method: body ? "POST" : "GET",
    }),
    undefined,
    env,
  );
}

async function status(...args: Parameters<typeof call>) {
  const response = await call(...args);
  return response.status;
}

async function data(...args: Parameters<typeof call>) {
  const response = await call(...args);
  return response.json();
}

describe("workspaces", () => {
  it("creates one collaborative initial workspace and remembers it on registration", async () => {
    const owner = await account("owner@example.com");
    expect(owner.workspace.id).toMatch(/^(?=.*[a-z])(?=.*\d)[a-z0-9]{8}$/u);
    expect(owner.workspace.slug).toBe(owner.workspace.id);
    const response = await call("workspaces", owner.cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lastWorkspaceId: owner.workspace.id,
      workspaces: [{ id: owner.workspace.id, name: "owner的工作区", role: "owner" }],
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("requires authentication and isolates workspace lists", async () => {
    const a = await account("a@example.com");
    const b = await account("b@example.com");
    expect(await status("workspaces")).toBe(401);
    const listed = await data("workspaces", a.cookie);
    expect(listed.workspaces.map((workspace: { id: string }) => workspace.id)).toEqual([
      a.workspace.id,
    ]);
    expect(
      await status(
        `auth/organization/get-full-organization?organizationId=${b.workspace.id}`,
        a.cookie,
      ),
    ).toBeGreaterThanOrEqual(400);
  });

  it("persists activation across sessions without using the session's active organization", async () => {
    const owner = await account("owner@example.com");
    const created = await call("auth/organization/create", owner.cookie, {
      keepCurrentActiveOrganization: true,
      name: "Second",
      slug: "second",
    });
    expect(created.status).toBe(200);
    const second = await created.json();
    expect(second.id).toMatch(/^(?=.*[a-z])(?=.*\d)[a-z0-9]{8}$/u);
    expect(second.id).not.toBe(owner.workspace.id);
    expect(second.slug).toBe(second.id);
    expect(await status(`workspaces/${second.id}/activate`, owner.cookie, {})).toBe(200);
    const context = await auth.$context;
    const session = await context.internalAdapter.createSession(owner.user.id, false);
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${await makeSignature(session.token, secret)}`)}`;
    expect(await data("workspaces", cookie)).toMatchObject({ lastWorkspaceId: second.id });
    expect(await status(`workspaces/${owner.workspace.id}/activate`, owner.cookie, {})).toBe(200);
    const full = await data(
      `auth/organization/get-full-organization?organizationId=${second.id}`,
      cookie,
    );
    expect(full.id).toBe(second.id);
  });

  it("regenerates a workspace ID when the ID or slug exists in another case", async () => {
    await platform.database.insert(organization).values([
      { createdAt: new Date(), id: "ABCD1234", name: "Existing ID", slug: "existing-id" },
      { createdAt: new Date(), id: "other-id", name: "Existing slug", slug: "EFGH5678" },
    ]);
    const random = vi.spyOn(crypto, "getRandomValues");
    random.mockReturnValueOnce(new Uint8Array([10, 11, 12, 13, 1, 2, 3, 4]));
    random.mockReturnValueOnce(new Uint8Array([14, 15, 16, 17, 5, 6, 7, 8]));
    random.mockReturnValueOnce(new Uint8Array([18, 19, 20, 21, 1, 2, 3, 4]));
    expect(await generateWorkspaceId(platform.database)).toBe("ijkl1234");
    expect(random).toHaveBeenCalledTimes(3);
  });

  it("accepts workspace activation regardless of ID letter case", async () => {
    const owner = await account("owner@example.com");
    const response = await call(
      `workspaces/${owner.workspace.id.toUpperCase()}/activate`,
      owner.cookie,
      {},
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workspaceId: owner.workspace.id });
  });

  it("does not record a workspace the user cannot access", async () => {
    const a = await account("a@example.com");
    const b = await account("b@example.com");
    expect(await status(`workspaces/${b.workspace.id}/activate`, a.cookie, {})).toBe(404);
    expect(await data("workspaces", a.cookie)).toMatchObject({ lastWorkspaceId: a.workspace.id });
  });

  it("rejects cross-origin form activation", async () => {
    const owner = await account("owner@example.com");
    const response = await app.request(
      new Request(`${origin}/api/workspaces/${owner.workspace.id}/activate`, {
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie: owner.cookie,
          origin: "https://untrusted.example",
        },
        method: "POST",
      }),
      undefined,
      env,
    );
    expect(response.status).toBe(403);
  });

  it("binds invitations to an email and requires acceptance before joining", async () => {
    const owner = await account("owner@example.com");
    const invited = await account("invited@example.com");
    const other = await account("other@example.com");
    const response = await call("auth/organization/invite-member", owner.cookie, {
      email: invited.user.email,
      organizationId: owner.workspace.id,
      role: "member",
    });
    expect(response.status).toBe(200);
    const invitation = await response.json();
    expect(
      await status("auth/organization/accept-invitation", other.cookie, {
        invitationId: invitation.id,
      }),
    ).toBeGreaterThanOrEqual(400);
    expect(
      await status("auth/organization/accept-invitation", invited.cookie, {
        invitationId: invitation.id,
      }),
    ).toBe(200);
    const joined = await data("workspaces", invited.cookie);
    expect(joined.workspaces).toHaveLength(2);
    expect(joined.workspaces).toContainEqual({
      id: owner.workspace.id,
      name: owner.workspace.name,
      role: "member",
    });
    expect(
      await status("auth/organization/invite-member", invited.cookie, {
        email: "not-allowed@example.com",
        organizationId: owner.workspace.id,
        role: "member",
      }),
    ).toBe(403);
    expect(
      await status("auth/organization/delete", invited.cookie, {
        organizationId: owner.workspace.id,
      }),
    ).toBe(403);
    expect(
      await status("auth/organization/update", invited.cookie, {
        data: { name: "Forbidden" },
        organizationId: owner.workspace.id,
      }),
    ).toBe(403);
  });

  it("keeps an owner until ownership is handed over", async () => {
    const owner = await account("owner@example.com");
    const next = await account("next@example.com");
    const invitation = await data("auth/organization/invite-member", owner.cookie, {
      email: next.user.email,
      organizationId: owner.workspace.id,
      role: "admin",
    });
    const accepted = await data("auth/organization/accept-invitation", next.cookie, {
      invitationId: invitation.id,
    });
    expect(
      await status("auth/organization/invite-member", next.cookie, {
        email: "admin-invited@example.com",
        organizationId: owner.workspace.id,
        role: "member",
      }),
    ).toBe(200);
    expect(
      await status("auth/organization/leave", owner.cookie, { organizationId: owner.workspace.id }),
    ).toBeGreaterThanOrEqual(400);
    const [self] = await platform.database
      .select()
      .from(member)
      .where(eq(member.userId, owner.user.id));
    expect(
      await status("auth/organization/update-member-role", owner.cookie, {
        memberId: self.id,
        organizationId: owner.workspace.id,
        role: "member",
      }),
    ).toBeGreaterThanOrEqual(400);
    expect(
      await status("auth/organization/delete", next.cookie, { organizationId: owner.workspace.id }),
    ).toBe(403);
    expect(
      await status("auth/organization/update-member-role", owner.cookie, {
        memberId: accepted.member.id,
        organizationId: owner.workspace.id,
        role: "owner",
      }),
    ).toBe(200);
    expect(
      await status("auth/organization/leave", owner.cookie, { organizationId: owner.workspace.id }),
    ).toBe(200);
    expect(
      await status("auth/organization/delete", next.cookie, { organizationId: owner.workspace.id }),
    ).toBe(200);
  });

  it("deletes the last initial workspace without recreating it", async () => {
    const owner = await account("owner@example.com");
    expect(
      await status("auth/organization/delete", owner.cookie, {
        organizationId: owner.workspace.id,
      }),
    ).toBe(200);
    const remaining = await data("workspaces", owner.cookie);
    expect(remaining.workspaces).toEqual([]);
    expect(await platform.database.select().from(member)).toEqual([]);
    expect(await platform.database.select().from(organization)).toEqual([]);
  });
});
