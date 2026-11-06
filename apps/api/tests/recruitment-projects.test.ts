import { randomBytes } from "node:crypto";
import {
  application,
  candidate,
  recruitmentProject,
  resume,
  resumeProcessingRun,
  resumeSubmission,
  resumeUploadBatch,
  resumeUploadItem,
} from "@ai-interview/db/schema";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { app } from "../src/app";
import type { ApiBindings } from "../src/env";
import { getAuth } from "../src/modules/auth/auth";
import { createTestDatabase } from "./database";

const origin = "https://sainoa.example";
const secret = randomBytes(32).toString("hex");
let platform: Awaited<ReturnType<typeof createTestDatabase>>;
let env: ApiBindings;

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

afterAll(() => platform.dispose());

async function read(request: Promise<Response> | Response) {
  const response = await request;
  return response.json();
}

async function account(email: string) {
  const context = await getAuth(env).$context;
  const user = await context.internalAdapter.createUser(
    { email, emailVerified: true, name: email },
    { method: "oauth" },
  );
  const session = await context.internalAdapter.createSession(user.id, false);
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${await makeSignature(session.token, secret)}`)}`;
  const request = (path: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set("cookie", cookie);
    headers.set("origin", origin);
    return app.request(new URL(path, `${origin}/api/`), { ...init, headers }, env, platform.ctx);
  };
  const call = (path: string, body?: object) =>
    request(path, {
      body: body ? JSON.stringify(body) : undefined,
      headers: { "content-type": "application/json" },
      method: body ? "POST" : "GET",
    });
  const { lastWorkspaceId: workspaceId } = await read(call("workspaces"));
  const ats = (path: string, body?: object) => call(`ats/${workspaceId}/${path}`, body);
  return { ats, call, request, userId: user.id, workspaceId };
}

it("retries one failed upload in its original batch while other files enter processing", async () => {
  const owner = await account("upload-retry@example.com");
  const outsider = await account("upload-retry-outsider@example.com");
  const bytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
  const batch = await read(
    owner.ats("uploads", {
      files: ["first.pdf", "second.pdf"].map((filename) => ({ filename, size: bytes.length })),
      version: 1,
    }),
  );
  const [first, second] = batch.uploads;
  const put = (url: string) =>
    owner.request(url, {
      body: bytes,
      headers: { "content-type": "application/pdf" },
      method: "PUT",
    });

  const uploaded = await put(first.url);
  expect(uploaded.status).toBe(204);
  const accepted = await owner.ats(`uploads/${first.id}/confirm`, {});
  expect(accepted.status).toBe(202);
  const failed = await owner.ats(`uploads/${second.id}/failed`, {});
  expect(failed.status).toBe(200);
  const blocked = await put(second.url);
  expect(blocked.status).toBe(404);
  const forbidden = await outsider.call(`ats/${owner.workspaceId}/uploads/${second.id}/retry`, {});
  expect(forbidden.status).toBe(404);
  expect(await read(owner.ats(`uploads/${first.id}/retry`, {}))).toEqual({
    id: first.id,
    url: null,
    version: 1,
  });

  const retry = await read(owner.ats(`uploads/${second.id}/retry`, {}));
  expect(retry).toEqual({ id: second.id, url: second.url, version: 1 });
  const retried = await put(retry.url);
  expect(retried.status).toBe(204);
  const confirmed = await owner.ats(`uploads/${second.id}/confirm`, {});
  expect(confirmed.status).toBe(202);
  expect(await read(owner.ats("resumes"))).toMatchObject({
    batches: [{ failed: 0, id: batch.id, total: 2 }],
    rows: expect.arrayContaining([
      expect.objectContaining({ id: first.id, runId: first.id, status: "accepted" }),
      expect.objectContaining({ id: second.id, runId: second.id, status: "accepted" }),
    ]),
    total: 2,
  });
});

it("lists projects by page and filters recruitment records by the job's project", async () => {
  const owner = await account("project-owner@example.com");
  const other = await account("project-outsider@example.com");
  const { workspaceId } = owner;
  const empty = await owner.ats("projects");
  expect(await empty.json()).toMatchObject({ rows: [], total: 0 });
  const projectResponse = await owner.ats("projects", { title: " Graduate hiring ", version: 1 });
  expect(projectResponse.status).toBe(201);
  const { id: projectId } = await projectResponse.json();
  expect(await read(owner.ats("projects/options"))).toMatchObject({
    rows: [{ id: projectId, title: "Graduate hiring" }],
  });
  const outsideProjectList = await other.call(`ats/${workspaceId}/projects`);
  expect(outsideProjectList.status).toBe(404);
  expect(await read(other.ats("projects/options"))).toMatchObject({ rows: [] });

  const jobInput = { requirements: "Requirements", title: "Engineer", version: 1 };
  const outsideJob = await other.ats("jobs", { ...jobInput, projectId });
  expect(outsideJob.status).toBe(404);
  const linked = await owner.ats("jobs", { ...jobInput, projectId });
  const unlinked = await owner.ats("jobs", jobInput);
  expect([linked.status, unlinked.status]).toEqual([201, 201]);
  const { id: linkedJobId } = await linked.json();
  const { id: unlinkedJobId } = await unlinked.json();
  expect(await read(owner.ats("jobs"))).toMatchObject({
    rows: expect.arrayContaining([
      expect.objectContaining({ id: linkedJobId, projectTitle: "Graduate hiring" }),
      expect.objectContaining({ id: unlinkedJobId, projectTitle: null }),
    ]),
  });
  const candidateId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  const createdAt = new Date(0);
  await platform.database.batch([
    platform.database.insert(candidate).values({
      createdAt,
      creationSource: "manual",
      email: "candidate@example.com",
      id: candidateId,
      name: "Candidate",
      workspaceId,
    }),
    platform.database.insert(application).values([
      {
        candidateId,
        createdAt,
        id: applicationId,
        jobId: linkedJobId,
        stage: "screening",
        workspaceId,
      },
      {
        candidateId,
        closedAt: createdAt,
        createdAt,
        id: crypto.randomUUID(),
        jobId: unlinkedJobId,
        stage: "screening",
        workspaceId,
      },
    ]),
    platform.database.insert(recruitmentProject).values(
      Array.from({ length: 20 }, (_, index) => ({
        createdAt,
        id: crypto.randomUUID(),
        title: `Project ${index}`,
        workspaceId,
      })),
    ),
  ]);
  expect(await read(owner.ats("applications"))).toMatchObject({ total: 2 });
  expect(await read(owner.ats(`applications?projectId=${projectId}`))).toMatchObject({
    rows: [{ id: applicationId }],
    total: 1,
  });
  const first = await read(owner.ats("projects?page=1"));
  const second = await read(owner.ats("projects?page=2"));
  expect(first).toMatchObject({ page: 1, pageSize: 20, total: 21 });
  expect(first.rows).toHaveLength(20);
  expect(first.rows[0]).toMatchObject({ id: projectId });
  expect(second).toMatchObject({ page: 2, total: 21 });
  expect(second.rows).toHaveLength(1);
  expect(first.rows).not.toEqual(expect.arrayContaining(second.rows));

  expect(
    await read(owner.ats(`jobs?search=engineer&pageSize=1&projectId=${projectId}`)),
  ).toMatchObject({ page: 1, pageSize: 1, rows: [{ id: linkedJobId }], total: 1 });
  expect(
    await read(
      owner.ats(`applications?search=candidate&status=open&pageSize=1&projectId=${projectId}`),
    ),
  ).toMatchObject({ rows: [{ id: applicationId }], total: 1 });
  expect(await read(owner.ats("applications?search=engineer&status=closed"))).toMatchObject({
    rows: [{ closedAt: createdAt.toISOString() }],
    total: 1,
  });
  expect(await read(owner.ats("candidates?search=example.com&pageSize=1"))).toMatchObject({
    rows: [{ id: candidateId }],
    total: 1,
  });
  expect(await read(owner.ats("projects?search=PROJECT&pageSize=1&page=21"))).toMatchObject({
    page: 21,
    pageSize: 1,
    rows: [],
    total: 20,
    version: 1,
  });
  const invalidPageSize = await owner.ats("projects?pageSize=101");
  expect(invalidPageSize.status).toBe(400);
});

it("filters resume files before pagination and keeps full upload batch totals", async () => {
  const { ats, userId, workspaceId } = await account("resume-filter@example.com");
  const batchId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const createdAt = new Date(0);
  const files = [
    { filename: "first.pdf", status: "upload_failed" },
    { filename: "second.pdf", runId, status: "accepted" },
    { filename: "third.pdf", status: "waiting" },
  ] as const;
  await platform.database.batch([
    platform.database
      .insert(resumeUploadBatch)
      .values({ createdAt, createdBy: userId, id: batchId, workspaceId }),
    platform.database.insert(resumeUploadItem).values(
      files.map((file) => ({
        ...file,
        batchId,
        id: file.filename,
        objectKey: file.filename,
        size: 1,
        workspaceId,
      })),
    ),
    platform.database.insert(resumeProcessingRun).values({
      createdAt,
      executionId: runId,
      id: runId,
      kind: "parse",
      stage: "extract_text",
      status: "failed",
      workspaceId,
    }),
  ]);
  const filter = "resumes?search=RESUME-FILTER&status=failed&pageSize=1";
  expect(await read(ats(filter))).toMatchObject({
    batches: [{ failed: 2, id: batchId, total: 3 }],
    page: 1,
    pageSize: 1,
    rows: [{ filename: "second.pdf" }],
    total: 2,
  });
  expect(await read(ats(`${filter}&page=2`))).toMatchObject({
    page: 2,
    rows: [{ filename: "first.pdf" }],
    total: 2,
  });
});

it("shows and searches the extracted candidate name until identity is confirmed", async () => {
  const { ats, userId, workspaceId } = await account("resume-review@example.com");
  const batchId = crypto.randomUUID();
  const resumeId = crypto.randomUUID();
  const filename = "intake.pdf";
  const createdAt = new Date(0);
  await platform.database.batch([
    platform.database
      .insert(resumeUploadBatch)
      .values({ createdAt, createdBy: userId, id: batchId, workspaceId }),
    platform.database.insert(resume).values({
      createdAt,
      id: resumeId,
      parseStatus: "succeeded",
      parsedProfile: { identity: { name: " Extracted Name " }, version: 1 },
      pdfObjectKey: resumeId,
      sha256: resumeId,
      workspaceId,
    }),
    platform.database.insert(resumeSubmission).values({
      createdAt,
      id: resumeId,
      identityStatus: "pending_review",
      originalFilename: filename,
      resumeId,
      workspaceId,
    }),
    platform.database.insert(resumeUploadItem).values({
      batchId,
      filename,
      id: resumeId,
      objectKey: resumeId,
      size: 1,
      status: "accepted",
      submissionId: resumeId,
      workspaceId,
    }),
  ]);
  expect(await read(ats("resumes?search=extracted"))).toMatchObject({
    rows: [{ candidateName: "Extracted Name", identityStatus: "pending_review" }],
    total: 1,
  });
  const confirmed = await ats(`submissions/${resumeId}/resolve`, {
    name: "Confirmed Name",
    version: 1,
  });
  expect(confirmed.status).toBe(200);
  expect(await read(ats("resumes?search=confirmed"))).toMatchObject({
    rows: [{ candidateName: "Confirmed Name", identityStatus: "resolved" }],
    total: 1,
  });
});
