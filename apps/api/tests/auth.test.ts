import { randomBytes } from "node:crypto";
import { session as sessionTable, user as userTable } from "@ai-interview/db/schema";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { makeSignature } from "better-auth/crypto";
import { createTestDatabase } from "./database";
import { app } from "../src/app";
import { getAuth } from "../src/modules/auth/auth";
import type { ApiBindings } from "../src/env";

const origin = "https://sainoa.example";
const secret = randomBytes(32).toString("hex");
const config = {
  BETTER_AUTH_SECRET: secret,
  BETTER_AUTH_URL: origin,
  GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "test-google-secret",
};
let platform: Awaited<ReturnType<typeof createTestDatabase>>;
let env: ApiBindings & typeof config;
let database: Awaited<ReturnType<typeof createTestDatabase>>["database"];
let auth: ReturnType<typeof getAuth>;

beforeAll(async () => {
  platform = await createTestDatabase();
  env = {
    ...platform.env,
    ...config,
  };
  ({ database } = platform);
});

beforeEach(async () => {
  await database.delete(userTable);
  await env.AUTH_DB.prepare('DELETE FROM "verification"').run();
  await env.AUTH_DB.prepare('DELETE FROM "rateLimit"').run();
  auth = getAuth(env);
});

afterAll(async () => {
  await platform.dispose();
});

function request(input: Request) {
  return app.request(input, undefined, env);
}

function signIn(callbackURL: string, requestOrigin = origin) {
  return request(
    new Request(`${origin}/api/auth/sign-in/social`, {
      body: JSON.stringify({
        callbackURL,
        errorCallbackURL: `${origin}/zh-CN/sign-in`,
        provider: "google",
      }),
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=existing-session",
        origin: requestOrigin,
        "sec-fetch-mode": "cors",
        "sec-fetch-site": requestOrigin === origin ? "same-origin" : "cross-site",
      },
      method: "POST",
    }),
  );
}

describe("Google authentication", () => {
  it("starts Google OAuth with a fixed API callback and localized return URL", async () => {
    const response = await signIn(`${origin}/zh-CN/sign-in`);
    expect(response.status).toBe(200);
    const { url } = await response.json();
    const google = new URL(url);
    expect(google.hostname).toBe("accounts.google.com");
    expect(google.searchParams.get("client_id")).toBe("test.apps.googleusercontent.com");
    expect(google.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
    expect(google.searchParams.get("state")).toBeTruthy();
    expect(google.searchParams.get("code_challenge")).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects external callback URLs", async () => {
    const response = await signIn("https://untrusted.example/callback");
    expect(response.status).toBe(403);
  });

  it("rejects cookie-bearing requests from untrusted origins", async () => {
    const response = await signIn(`${origin}/sign-in`, "https://untrusted.example");
    expect(response.status).toBe(403);
  });

  it("returns no session for an anonymous request", async () => {
    const response = await request(new Request(`${origin}/api/auth/get-session`));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("reads a persisted session and invalidates it on sign-out", async () => {
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser(
      {
        email: "test@example.com",
        emailVerified: true,
        name: "Test User",
      },
      { method: "oauth" },
    );
    const session = await context.internalAdapter.createSession(user.id, false);
    const signedToken = `${session.token}.${await makeSignature(session.token, secret)}`;
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(signedToken)}`;
    const response = await request(
      new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(user.id);
    const storedUsers = await database.select().from(userTable);
    expect(storedUsers[0]?.emailVerified).toBe(true);
    expect(storedUsers[0]?.createdAt).toBeInstanceOf(Date);

    const logout = await request(
      new Request(`${origin}/api/auth/sign-out`, { headers: { cookie, origin }, method: "POST" }),
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    const afterLogout = await request(
      new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect(await afterLogout.json()).toBeNull();
  });

  it("reads ISO dates and sessions written before the Drizzle migration", async () => {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    await env.AUTH_DB.batch([
      env.AUTH_DB.prepare(
        'INSERT INTO "user" (id, name, email, emailVerified, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind("legacy-user", "Legacy User", "legacy@example.com", 1, now, now),
      env.AUTH_DB.prepare(
        'INSERT INTO "session" (id, token, userId, expiresAt, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      ).bind("legacy-session", "legacy-token", "legacy-user", expiresAt, now, now),
    ]);
    const context = await auth.$context;
    const signature = await makeSignature("legacy-token", secret);
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`legacy-token.${signature}`)}`;
    const response = await request(
      new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      session: { expiresAt, id: "legacy-session" },
      user: { createdAt: now, emailVerified: true, id: "legacy-user" },
    });
  });

  it("updates only the signed-in user's profile and returns the saved name in the session", async () => {
    const body = JSON.stringify({ name: "Updated User" });
    const anonymous = await request(
      new Request(`${origin}/api/auth/update-user`, {
        body,
        headers: { "content-type": "application/json", origin },
        method: "POST",
      }),
    );
    expect(anonymous.status).toBe(401);

    const context = await auth.$context;
    const owner = await context.internalAdapter.createUser(
      { email: "profile@example.com", emailVerified: true, name: "Profile User" },
      { method: "oauth" },
    );
    const other = await context.internalAdapter.createUser(
      { email: "other@example.com", emailVerified: true, name: "Other User" },
      { method: "oauth" },
    );
    const session = await context.internalAdapter.createSession(owner.id, false);
    const signedToken = `${session.token}.${await makeSignature(session.token, secret)}`;
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(signedToken)}`;
    const response = await request(
      new Request(`${origin}/api/auth/update-user`, {
        body,
        headers: { "content-type": "application/json", cookie, origin },
        method: "POST",
      }),
    );
    expect(response.status).toBe(200);
    const users = await database.select().from(userTable);
    expect(users.find((user) => user.id === owner.id)?.name).toBe("Updated User");
    expect(users.find((user) => user.id === other.id)?.name).toBe("Other User");
    const current = await request(
      new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect(await current.json()).toMatchObject({
      user: { email: owner.email, name: "Updated User" },
    });
  });

  it("does not create a session for a forged OAuth callback", async () => {
    const response = await request(
      new Request(`${origin}/api/auth/callback/google?code=invalid&state=forged`),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=");
    expect(await database.select().from(sessionTable)).toHaveLength(0);
  });
});
