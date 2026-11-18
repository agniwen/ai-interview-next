import {
  applicationResume,
  interviewRound,
  interviewSession,
  resume,
  resumeSubmission,
  resumeUploadBatch,
  resumeUploadItem,
} from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { assert, expect, it } from "vitest";
import { app } from "../src/app";
import { captureUsage } from "../src/modules/usage/capture";
import { account, atsTest, read } from "./ats-fixture";
import { addInterviewMember, fixture } from "./interview-fixture";

function request(token: string, action: string, body?: object) {
  return app.request(
    `https://sainoa.example/api/candidate-interviews/${token}/${action}`,
    {
      body: body ? JSON.stringify(body) : undefined,
      headers: { "content-type": "application/json", origin: "https://sainoa.example" },
      method: "POST",
    },
    atsTest.env,
    atsTest.platform.ctx,
  );
}

it("attributes interview usage only to the frozen upload and counts repeat deliveries once", async () => {
  const f = await fixture("bound-application-resume@example.com");
  const db = atsTest.platform.database;
  const { workspaceId } = f.owner;
  const uploader = await addInterviewMember(workspaceId, "selected-uploader@example.com");
  const outsider = await account("other-workspace-usage@example.com");
  const resumeId = crypto.randomUUID();
  const laterResumeId = crypto.randomUUID();
  const submissionId = crypto.randomUUID();
  const laterSubmissionId = crypto.randomUUID();
  const createdAt = new Date();
  await db.insert(resume).values(
    [resumeId, laterResumeId].map((id) => ({
      createdAt,
      id,
      pdfObjectKey: `${id}.pdf`,
      sha256: "same-uploaded-by-two-people",
      workspaceId,
    })),
  );
  const filename = "selected.pdf";
  await Promise.all(
    [
      { id: submissionId, resumeId, uploaderId: uploader.userId },
      { id: laterSubmissionId, resumeId: laterResumeId, uploaderId: f.owner.userId },
    ].map(async (upload) => {
      const batchId = crypto.randomUUID();
      await db.insert(resumeSubmission).values({
        createdAt,
        id: upload.id,
        isDuplicate: upload.id === laterSubmissionId,
        originalFilename: filename,
        resumeId: upload.resumeId,
        workspaceId,
      });
      await db.insert(resumeUploadBatch).values({
        createdAt,
        createdBy: upload.uploaderId,
        id: batchId,
        workspaceId,
      });
      await db.insert(resumeUploadItem).values({
        batchId,
        filename,
        id: crypto.randomUUID(),
        objectKey: `${upload.resumeId}.pdf`,
        size: 1,
        status: "accepted",
        submissionId: upload.id,
        workspaceId,
      });
    }),
  );
  await db.insert(applicationResume).values({
    applicationId: f.applicationId,
    createdAt,
    id: crypto.randomUUID(),
    resumeId,
    status: "available",
    submissionId,
    workspaceId,
  });
  const { id } = await read(f.owner.call(f.path, { ...f.input, formQuestionSetIds: [] }));
  expect(
    await db.select().from(interviewRound).where(eq(interviewRound.id, id)).get(),
  ).toMatchObject({ resumeId });
  await db.insert(applicationResume).values({
    applicationId: f.applicationId,
    createdAt: new Date(),
    id: crypto.randomUUID(),
    resumeId: laterResumeId,
    status: "available",
    submissionId: laterSubmissionId,
    workspaceId,
  });
  const { token } = await read(
    f.owner.request(`interviews/${workspaceId}/${id}/invitation`, { method: "POST" }),
  );
  await request(token, "entry");
  const response = await request(token, "start", { version: 1 });
  expect(response.status).toBe(200);
  const session = await db
    .select()
    .from(interviewSession)
    .where(eq(interviewSession.interviewRoundId, id))
    .get();
  assert(session);
  expect(session.content.resumes).toMatchObject([{ id: resumeId, submissionId }]);

  const measured = {
    cachedInputTokens: 30,
    inputTokens: 80,
    model: "qwen-realtime-test",
    occurredAt: createdAt.getTime(),
    outputTokens: 20,
    requestId: "response-failed",
    retry: true,
    stage: "interview_realtime",
    version: 1,
  };
  const record = (body: object, credential = session.contextToken) =>
    app.request(
      `https://sainoa.example/api/interview-sessions/${id}/usage`,
      {
        body: JSON.stringify(body),
        headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
        method: "POST",
      },
      atsTest.env,
      atsTest.platform.ctx,
    );
  expect(await record(measured, "f".repeat(64))).toMatchObject({ status: 404 });
  expect(await record(measured)).toMatchObject({ status: 200 });
  expect(await record(measured)).toMatchObject({ status: 200 });
  expect(
    await record({
      ...measured,
      model: "gpt-test",
      occurredAt: measured.occurredAt + 1,
      requestId: "response-succeeded",
      retry: false,
      stage: "interview_reconciliation",
    }),
  ).toMatchObject({ status: 200 });

  const usagePath = `usage/${workspaceId}/me`;
  expect(await read(uploader.call(`${usagePath}?page=1&pageSize=1`))).toMatchObject({
    page: 1,
    pageSize: 1,
    rows: [{ filename, model: "gpt-test", provider: "openai", retry: false }],
    summary: {
      breakdown: expect.arrayContaining([
        expect.objectContaining({ retry: true, stage: "interview_realtime", tokens: 100 }),
        expect.objectContaining({ retry: false, stage: "interview_reconciliation", tokens: 100 }),
      ]),
      normal: { pages: 0, tokens: 100 },
      retry: { pages: 0, tokens: 100 },
      total: { pages: 0, tokens: 200 },
    },
    total: 2,
  });
  expect(await read(uploader.call(`${usagePath}?page=2&pageSize=1`))).toMatchObject({
    rows: [{ cachedInputTokens: 30, model: "qwen-realtime-test", retry: true }],
    total: 2,
  });
  expect(await read(uploader.call(`${usagePath}?page=3&pageSize=1`))).toMatchObject({
    rows: [],
    total: 2,
  });
  expect(
    await record({
      ...measured,
      occurredAt: createdAt.getTime() - 8 * 86_400_000,
      requestId: "historical-response",
    }),
  ).toMatchObject({ status: 200 });
  const realtimeFilter = "model=qwen-realtime-test&stage=interview_realtime&status=retry";
  expect(await read(uploader.call(`${usagePath}?${realtimeFilter}&period=7d`))).toMatchObject({
    models: ["gpt-test", "qwen-realtime-test"],
    rows: [{ model: "qwen-realtime-test", retry: true }],
    summary: {
      normal: { pages: 0, tokens: 0 },
      retry: { pages: 0, tokens: 100 },
      total: { pages: 0, tokens: 100 },
    },
    total: 1,
  });
  expect(
    await read(uploader.call(`${usagePath}?${realtimeFilter}&period=30d&pageSize=1`)),
  ).toMatchObject({
    rows: [{ model: "qwen-realtime-test", retry: true }],
    summary: { total: { pages: 0, tokens: 200 } },
    total: 2,
  });
  expect(
    await read(uploader.call(`${usagePath}?stage=interview_reconciliation&status=retry`)),
  ).toMatchObject({
    rows: [],
    summary: { total: { pages: 0, tokens: 0 } },
    total: 0,
  });
  expect(await read(f.owner.call(usagePath))).toMatchObject({ rows: [], total: 0 });
  expect(await outsider.call(usagePath)).toMatchObject({ status: 404 });
});

it("counts OCR pages and provider tokens for truncated model responses", async () => {
  const ocr = captureUsage("resume_ocr", "deepseek", "deepseek-ocr");
  await ocr.observe(
    Response.json({
      page_count: 2,
      pages: [{ finish_reason: "stop" }, { finish_reason: "length" }],
    }),
  );
  expect(ocr.rows(false)).toMatchObject([
    { model: "deepseek-ocr", pages: 2, retry: true, stage: "resume_ocr" },
  ]);

  const evaluation = captureUsage("interview_evaluation", "dashscope", "configured-model");
  await evaluation.observe(
    Response.json({
      choices: [{ finish_reason: "length" }],
      id: "truncated",
      model: "reported-model",
      usage: {
        completion_tokens: 25,
        prompt_tokens: 100,
        prompt_tokens_details: { cached_tokens: 40 },
      },
    }),
  );
  expect(evaluation.rows(false)).toMatchObject([
    {
      cachedInputTokens: 40,
      inputTokens: 100,
      model: "reported-model",
      outputTokens: 25,
      requestId: "truncated",
      retry: true,
    },
  ]);
});
