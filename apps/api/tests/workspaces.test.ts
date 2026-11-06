import { randomBytes } from "node:crypto";
import {
  application,
  applicationResume,
  candidate,
  member,
  organization,
  resume,
  resumeProcessingOutbox,
  resumeProcessingRun,
  resumeSubmission,
  resumeUploadBatch,
  resumeUploadItem,
  user as userTable,
} from "@ai-interview/db/schema";
import { makeSignature } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { resumeObjectStore } from "../src/modules/ats/storage";
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
    platform.ctx,
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
  it("creates independent applications for a completed resume across jobs", async () => {
    const owner = await account("hiring@example.com");
    const outsider = await account("other-hiring@example.com");
    const workspaceId = owner.workspace.id;
    const base = `ats/${workspaceId}`;
    const candidateId = crypto.randomUUID();
    const resumeId = crypto.randomUUID();
    const batchId = crypto.randomUUID();
    const createdAt = new Date("2026-11-05T20:00:00.000Z");
    await platform.database.batch([
      platform.database.insert(candidate).values({
        createdAt,
        creationSource: "manual",
        id: candidateId,
        name: "Candidate",
        workspaceId,
      }),
      platform.database.insert(resume).values({
        candidateId,
        createdAt,
        id: resumeId,
        parseStatus: "succeeded",
        parsedProfile: { targetRoles: [{ text: "Platform engineer" }], version: 1 },
        pdfObjectKey: "ready",
        sha256: "a",
        workspaceId,
      }),
      platform.database.insert(resumeSubmission).values({
        createdAt,
        id: resumeId,
        originalFilename: "Intake.pdf",
        resumeId,
        workspaceId,
      }),
      platform.database.insert(resumeUploadBatch).values({
        createdAt,
        createdBy: owner.user.id,
        id: batchId,
        workspaceId,
      }),
      platform.database.insert(resumeUploadItem).values({
        batchId,
        filename: "Intake.pdf",
        id: resumeId,
        objectKey: "ready",
        size: 12,
        status: "accepted",
        submissionId: resumeId,
        workspaceId,
      }),
      platform.database.insert(resumeProcessingRun).values({
        createdAt,
        executionId: resumeId,
        id: resumeId,
        kind: "parse",
        resumeId,
        stage: "structure",
        status: "running",
        workspaceId,
      }),
    ]);
    const firstJob = await data(`${base}/jobs`, owner.cookie, {
      requirements: "First requirements",
      title: "First job",
      version: 1,
    });
    const secondJob = await data(`${base}/jobs`, owner.cookie, {
      requirements: "Second requirements",
      title: "Second job",
      version: 1,
    });
    const path = `${base}/applications`;
    const firstInput = { jobId: firstJob.id, resumeId, version: 1 };
    expect(await data(`${base}/jobs?page=1`, owner.cookie)).toMatchObject({ page: 1, total: 2 });
    expect(await status(path, outsider.cookie, firstInput)).toBe(404);
    expect(await status(path, owner.cookie, firstInput)).toBe(409);
    const optionsPath = `${path}/resume-options`;
    expect(await data(optionsPath, owner.cookie)).toMatchObject({ rows: [] });
    await platform.database
      .update(resumeProcessingRun)
      .set({ status: "succeeded" })
      .where(eq(resumeProcessingRun.id, resumeId));
    const results = await Promise.all(
      ["intake.pdf", "Platform", "hiring", "2026年11月6日"].map((search) =>
        data(
          `${optionsPath}?${new URLSearchParams({ offsetMinutes: "480", search })}`,
          owner.cookie,
        ),
      ),
    );
    for (const result of results) {
      expect(result).toMatchObject({
        nextPage: null,
        rows: [
          {
            candidateName: null,
            createdAt: createdAt.toISOString(),
            creator: { name: owner.user.name },
            filename: "Intake.pdf",
            id: resumeId,
            targetRoles: ["Platform engineer"],
          },
        ],
      });
    }
    expect(await data(`${optionsPath}?search=irrelevant`, owner.cookie)).toMatchObject({
      rows: [],
    });
    expect(await status(optionsPath, outsider.cookie)).toBe(404);
    const firstResponse = await call(path, owner.cookie, firstInput);
    const secondResponse = await call(path, owner.cookie, { ...firstInput, jobId: secondJob.id });
    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    const first = await firstResponse.json();
    const second = await secondResponse.json();
    expect(await data(path, owner.cookie, firstInput)).toEqual({
      applicationId: first.applicationId,
      runId: null,
      version: 1,
    });
    expect(await platform.database.select().from(application)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          candidateId,
          closedAt: null,
          id: first.applicationId,
          jobId: firstJob.id,
        }),
        expect.objectContaining({
          candidateId,
          closedAt: null,
          id: second.applicationId,
          jobId: secondJob.id,
        }),
      ]),
    );
    expect(await platform.database.select().from(applicationResume)).toHaveLength(2);
    const evaluations = await platform.database
      .select()
      .from(resumeProcessingRun)
      .where(eq(resumeProcessingRun.kind, "evaluate"));
    expect(evaluations).toHaveLength(2);
    expect(evaluations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          applicationId: first.applicationId,
          id: first.runId,
          jobRequirementsSnapshot: "First requirements",
          resumeId,
          status: "queued",
        }),
        expect.objectContaining({
          applicationId: second.applicationId,
          id: second.runId,
          jobRequirementsSnapshot: "Second requirements",
          resumeId,
          status: "queued",
        }),
      ]),
    );
    expect(await platform.database.select().from(resumeProcessingOutbox)).toHaveLength(2);

    const newerResumes = Array.from({ length: 20 }, () => {
      const id = crypto.randomUUID();
      return { createdAt: new Date("2026-11-07T00:00:00.000Z"), id, workspaceId };
    });
    await Promise.all(
      [newerResumes.slice(0, 10), newerResumes.slice(10)].map((group) =>
        platform.database.batch([
          platform.database.insert(resume).values(
            group.map<typeof resume.$inferInsert>((row) => ({
              ...row,
              candidateId,
              parseStatus: "succeeded",
              pdfObjectKey: row.id,
              sha256: row.id,
            })),
          ),
          platform.database.insert(resumeProcessingRun).values(
            group.map<typeof resumeProcessingRun.$inferInsert>((row) => ({
              ...row,
              executionId: row.id,
              kind: "parse",
              resumeId: row.id,
              stage: "structure",
              status: "succeeded",
            })),
          ),
        ]),
      ),
    );
    const pageOne = await data(`${optionsPath}?page=1`, owner.cookie);
    expect(pageOne.nextPage).toBe(2);
    expect(pageOne.rows.map(({ id }: { id: string }) => id).toSorted()).toEqual(
      newerResumes.map(({ id }) => id).toSorted(),
    );
    expect(await data(`${optionsPath}?page=2`, owner.cookie)).toMatchObject({
      nextPage: null,
      rows: [{ id: resumeId }],
    });
  });

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

  it("serves accepted resume originals and profiles only through their own workspace", async () => {
    const owner = await account("uploader@example.com");
    const outsider = await account("outsider@example.com");
    const workspaceId = owner.workspace.id;
    const id = crypto.randomUUID();
    const batchId = crypto.randomUUID();
    const objectKey = `${workspaceId}/${batchId}/${id}`;
    const filename = "候选人 (1).pdf";
    const bytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    const image = "https://sainoa.example/creator.png";
    await platform.database.update(userTable).set({ image }).where(eq(userTable.id, owner.user.id));
    await platform.database.insert(resumeUploadBatch).values({
      createdAt: new Date(),
      createdBy: owner.user.id,
      id: batchId,
      workspaceId,
    });
    await platform.database.insert(resumeUploadItem).values({
      batchId,
      filename,
      id,
      objectKey,
      size: bytes.length,
      status: "waiting",
      workspaceId,
    });
    await resumeObjectStore(env).write(objectKey, bytes.buffer, "application/pdf");

    const path = `ats/${workspaceId}/upload-files/${id}`;
    const profilePath = `ats/${workspaceId}/uploads/${id}/profile`;
    expect(await data(`ats/${workspaceId}/resumes`, owner.cookie)).toMatchObject({
      rows: [{ creator: { image, name: owner.user.name }, id }],
    });
    expect(await status(path, owner.cookie)).toBe(404);
    expect(await status(profilePath, owner.cookie)).toBe(404);
    await platform.database.insert(resumeProcessingRun).values({
      createdAt: new Date(),
      executionId: id,
      id,
      kind: "parse",
      stage: "extract_text",
      status: "queued",
      uploadItemId: id,
      workspaceId,
    });
    await platform.database
      .update(resumeUploadItem)
      .set({ runId: id, status: "accepted" })
      .where(eq(resumeUploadItem.id, id));
    expect(await status(path)).toBe(401);
    expect(await status(path, outsider.cookie)).toBe(404);
    expect(await status(`ats/${outsider.workspace.id}/upload-files/${id}`, outsider.cookie)).toBe(
      404,
    );

    const original = await call(path, owner.cookie);
    expect(original.status).toBe(200);
    expect(original.headers.get("content-type")).toBe("application/pdf");
    expect(original.headers.get("cache-control")).toContain("no-store");
    expect(original.headers.get("content-disposition")).toBe(
      "attachment; filename*=UTF-8''%E5%80%99%E9%80%89%E4%BA%BA%20%281%29.pdf",
    );
    expect(new Uint8Array(await original.arrayBuffer())).toEqual(bytes);

    expect(await status(profilePath)).toBe(401);
    expect(await status(profilePath, outsider.cookie)).toBe(404);
    expect(
      await status(`ats/${outsider.workspace.id}/uploads/${id}/profile`, outsider.cookie),
    ).toBe(404);
    expect(await data(profilePath, owner.cookie)).toEqual({
      hasAvatar: false,
      parseStatus: "queued",
      profile: null,
      resumeId: null,
      version: 1,
    });

    const profile = { identity: { name: "候选人" }, version: 1 as const };
    const markdown = "# 候选人\n\n- 系统架构师";
    const resumeId = crypto.randomUUID();
    await platform.database.batch([
      platform.database.insert(resume).values({
        createdAt: new Date(),
        id: resumeId,
        markdown,
        parseStatus: "processing",
        pdfObjectKey: objectKey,
        sha256: "a".repeat(64),
        workspaceId,
      }),
      platform.database.insert(resumeSubmission).values({
        createdAt: new Date(),
        id,
        originalFilename: filename,
        resumeId,
        workspaceId,
      }),
      platform.database
        .update(resumeUploadItem)
        .set({ submissionId: id })
        .where(eq(resumeUploadItem.id, id)),
      platform.database
        .update(resumeProcessingRun)
        .set({ resumeId, stage: "structure", status: "running" })
        .where(eq(resumeProcessingRun.id, id)),
    ]);
    expect(await data(profilePath, owner.cookie)).toEqual({
      hasAvatar: false,
      parseStatus: "running",
      profile: null,
      resumeId,
      version: 1,
    });

    await platform.database.batch([
      platform.database
        .update(resume)
        .set({ parseStatus: "succeeded", parsedProfile: profile })
        .where(eq(resume.id, resumeId)),
      platform.database
        .update(resumeProcessingRun)
        .set({ status: "succeeded" })
        .where(eq(resumeProcessingRun.id, id)),
    ]);
    expect(await data(profilePath, owner.cookie)).toEqual({
      hasAvatar: false,
      parseStatus: "succeeded",
      profile,
      resumeId,
      version: 1,
    });
  });

  it("lists a candidate's distinct owned resumes within the current workspace", async () => {
    const owner = await account("recruiter@example.com");
    const outsider = await account("other-recruiter@example.com");
    const workspaceId = owner.workspace.id;
    const firstDate = new Date("2026-11-01T00:00:00.000Z");
    const secondDate = new Date("2026-11-02T00:00:00.000Z");
    const uploads = [
      { createdAt: firstDate, filename: "first.pdf", id: "first-upload", resumeId: "first-resume" },
      {
        createdAt: secondDate,
        filename: "repeat.pdf",
        id: "repeat-upload",
        resumeId: "first-resume",
      },
    ];
    await platform.database.batch([
      platform.database.insert(candidate).values(
        ["candidate-with-resumes", "candidate-without-resumes"].map((id) => ({
          createdAt: firstDate,
          creationSource: "manual" as const,
          id,
          name: id,
          workspaceId,
        })),
      ),
      platform.database.insert(resume).values(
        [firstDate, secondDate].map((createdAt, index) => ({
          candidateId: "candidate-with-resumes",
          createdAt,
          id: index === 0 ? "first-resume" : "second-resume",
          pdfObjectKey: `sample-${index}.pdf`,
          sha256: String(index).repeat(64),
          workspaceId,
        })),
      ),
      platform.database.insert(resumeSubmission).values(
        uploads.map(({ createdAt, filename, id, resumeId }) => ({
          createdAt,
          id,
          identityStatus: "resolved" as const,
          originalFilename: filename,
          resolvedCandidateId:
            id === "repeat-upload" ? "candidate-without-resumes" : "candidate-with-resumes",
          resumeId,
          workspaceId,
        })),
      ),
      platform.database.insert(resumeUploadBatch).values({
        createdAt: firstDate,
        createdBy: owner.user.id,
        id: "candidate-resumes-batch",
        workspaceId,
      }),
      platform.database.insert(resumeUploadItem).values(
        uploads.map(({ filename, id }) => ({
          batchId: "candidate-resumes-batch",
          filename,
          id,
          objectKey: filename,
          size: 12,
          status: "accepted" as const,
          submissionId: id,
          workspaceId,
        })),
      ),
    ]);

    const path = `ats/${workspaceId}/candidates/candidate-with-resumes/resumes`;
    expect(await status(path)).toBe(401);
    expect(await status(path, outsider.cookie)).toBe(404);
    expect(
      await status(
        `ats/${outsider.workspace.id}/candidates/candidate-with-resumes/resumes`,
        outsider.cookie,
      ),
    ).toBe(404);
    const response = await call(path, owner.cookie);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toMatchObject({
      rows: [
        {
          canJoinRecruitment: false,
          createdAt: secondDate.toISOString(),
          filename: null,
          id: "second-resume",
          uploadId: null,
        },
        {
          createdAt: firstDate.toISOString(),
          filename: "first.pdf",
          id: "first-resume",
          uploadId: "first-upload",
        },
      ],
      total: 2,
      version: 1,
    });
    expect(
      await data(`ats/${workspaceId}/candidates/candidate-without-resumes/resumes`, owner.cookie),
    ).toEqual({ rows: [], total: 0, version: 1 });
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

describe("private agent routes", () => {
  it("requires authentication and workspace membership before accessing sessions", async () => {
    const owner = await account("agent-owner@example.com");
    const outsider = await account("agent-outsider@example.com");
    const path = `agent/${owner.workspace.id}/sessions`;
    const anonymous = await call(path);
    const forbidden = await call(path, outsider.cookie);
    expect(anonymous.status).toBe(401);
    expect(forbidden.status).toBe(404);
  });

  it("scopes sessions to their creator even when another member is a workspace admin", async () => {
    const owner = await account("agent-owner@example.com");
    const admin = await account("agent-admin@example.com");
    await platform.database.insert(member).values({
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: owner.workspace.id,
      role: "admin",
      userId: admin.user.id,
    });
    const chatId = crypto.randomUUID();
    const ownerScope = JSON.stringify([owner.workspace.id, owner.user.id]);
    const directory = {
      getByName: (scope: string) => ({
        hgetall: () =>
          Promise.resolve(
            scope === ownerScope
              ? {
                  [chatId]: JSON.stringify({
                    id: chatId,
                    lastSentAt: 1,
                    title: "Private",
                    trashed: false,
                  }),
                }
              : {},
          ),
      }),
    };
    // getPlatformProxy 不执行 DO；只替换目录传输，鉴权及 D1 查询使用真实实现。
    // getPlatformProxy cannot execute DOs; replace directory transport only, keeping real auth and D1 queries.
    const original = env.REDIS;
    env.REDIS = directory as unknown as ApiBindings["REDIS"];
    try {
      const path = `agent/${owner.workspace.id}/sessions`;
      const own = await call(path, owner.cookie);
      const other = await call(path, admin.cookie);
      expect(await own.json()).toMatchObject({ sessions: [{ id: chatId }] });
      expect(await other.json()).toEqual({ sessions: [] });
      const hidden = await call(`${path}/${chatId}/state`, admin.cookie);
      expect(hidden.status).toBe(404);
    } finally {
      env.REDIS = original;
    }
  });
});
