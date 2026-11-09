import {
  application,
  interviewEvaluationReport,
  interviewReport,
  interviewRound,
  interviewSession,
} from "@ai-interview/db/schema";
import type { InterviewEvaluationContent } from "@ai-interview/db/interview-evaluation";
import { eq } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { account, atsTest, read } from "./ats-fixture";
import { addInterviewMember, fixture } from "./interview-fixture";
import {
  createInterviewEvaluator,
  generateInterviewEvaluation,
} from "../src/modules/interviews/evaluation-generation";

const evaluation: InterviewEvaluationContent = {
  conclusion: "pass",
  overall: "**有明确证据**：讲清了系统设计与实际取舍。",
  version: 1,
};

async function finishedAi(name: string) {
  const f = await fixture(`evaluation-${name}@example.com`);
  const reviewer = await addInterviewMember(
    f.owner.workspaceId,
    `evaluation-reviewer-${name}@example.com`,
  );
  const { id } = await read(
    f.owner.call(f.path, { ...f.input, confirmationUserId: reviewer.userId }),
  );
  await atsTest.platform.database
    .update(interviewRound)
    .set({ endedAt: new Date(), status: "completed" })
    .where(eq(interviewRound.id, id));
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  return { ...f, id: id as string, path, reviewer };
}

async function readyAi(f: Awaited<ReturnType<typeof finishedAi>>, content = evaluation) {
  await atsTest.platform.database.insert(interviewEvaluationReport).values({
    content,
    interviewRoundId: f.id,
    status: "ready",
    updatedAt: new Date(),
    workspaceId: f.owner.workspaceId,
  });
}

function saveDraft(person: Awaited<ReturnType<typeof account>>, path: string, content: object) {
  return person.request(`${path}/evaluation`, {
    body: JSON.stringify(content),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
}

it("requires the assigned AI reviewer, keeps original output, and unlocks exactly the next round after confirmation", async () => {
  const f = await finishedAi("confirm");
  const applicationPath = `interviews/${f.owner.workspaceId}/applications/${f.applicationId}`;
  await readyAi(f, { ...evaluation, conclusion: "pending" });
  expect(await f.owner.call(`${f.path}/evaluation/submit`, evaluation)).toMatchObject({
    status: 403,
  });
  expect(
    await saveDraft(f.reviewer, f.path, { ...evaluation, conclusion: null, overall: "" }),
  ).toMatchObject({ status: 200 });
  expect(
    await f.reviewer.call(`${f.path}/evaluation/submit`, { ...evaluation, conclusion: null }),
  ).toMatchObject({ status: 400 });
  expect(await read(f.owner.call(applicationPath))).toMatchObject({
    canCreateRound: false,
    rows: [{ evaluation: { complete: false } }],
  });
  expect(await f.owner.call(applicationPath, f.input)).toMatchObject({ status: 409 });
  expect(await f.reviewer.call(`${f.path}/evaluation/submit`, evaluation)).toMatchObject({
    status: 200,
  });
  const result = await read(f.reviewer.call(`${f.path}/result`));
  expect(result.evaluation).toMatchObject({
    canEdit: false,
    original: { content: { conclusion: "pending" } },
    own: { content: evaluation, submittedAt: expect.any(String) },
    summary: { complete: true, conclusion: "pass", requiredCount: 1, submittedCount: 1 },
  });
  expect(await read(f.owner.call(applicationPath))).toMatchObject({ canCreateRound: true });
  expect(await saveDraft(f.reviewer, f.path, { ...evaluation, conclusion: "fail" })).toMatchObject({
    status: 409,
  });
  expect(await f.reviewer.call(`${f.path}/evaluation/submit`, evaluation)).toMatchObject({
    status: 409,
  });
  const second = await read(f.owner.call(applicationPath, f.input));
  expect(await read(f.owner.call(`interviews/${f.owner.workspaceId}/${second.id}`))).toMatchObject({
    sequence: 2,
    status: "scheduled",
  });
  expect(await read(f.owner.call(applicationPath))).toMatchObject({
    canCreateRound: false,
    total: 2,
  });
  expect(await read(f.owner.ats("applications"))).toMatchObject({
    rows: [{ id: f.applicationId, latestInterview: { kind: "ai", sequence: 2 } }],
  });
});

it("closes the application only after a human confirms a failed AI verdict", async () => {
  const f = await finishedAi("fail");
  await readyAi(f, { ...evaluation, conclusion: "fail" });
  expect(await read(f.owner.ats(`applications/${f.applicationId}`))).toMatchObject({
    application: { closedAt: null },
  });
  expect(
    await f.reviewer.call(`${f.path}/evaluation/submit`, { ...evaluation, conclusion: "fail" }),
  ).toMatchObject({ status: 200 });
  expect(await read(f.owner.ats(`applications/${f.applicationId}`))).toMatchObject({
    activity: expect.arrayContaining([
      expect.objectContaining({
        action: "interview_evaluation_submitted",
        actorId: f.reviewer.userId,
      }),
    ]),
    application: { closedAt: expect.any(String), outcome: "rejected" },
  });
  expect(
    await f.owner.call(
      `interviews/${f.owner.workspaceId}/applications/${f.applicationId}`,
      f.input,
    ),
  ).toMatchObject({ status: 409 });
});

it.each([
  ["pass", "fail", "pass", true],
  ["pending", "fail", "fail", false],
  ["pending", "pending", "pending", true],
] as const)(
  "combines human verdicts %s then %s as %s and requires every assignee",
  async (first, second, expected, allowed) => {
    const f = await fixture(`human-${first}-${second}@example.com`);
    const colleague = await addInterviewMember(
      f.owner.workspaceId,
      `human-peer-${first}-${second}@example.com`,
    );
    const { id } = await read(
      f.owner.call(f.path, {
        admissionDeadline: "2026-12-01T02:00:00Z",
        interviewerUserIds: [f.owner.userId, colleague.userId],
        kind: "human",
        label: "",
        scheduledAt: "2026-12-01T01:00:00Z",
        version: 1,
      }),
    );
    const path = `interviews/${f.owner.workspaceId}/${id}`;
    expect(await f.owner.call(`${path}/evaluation/submit`, evaluation)).toMatchObject({
      status: 409,
    });
    await atsTest.platform.database
      .update(interviewRound)
      .set({ status: "completed" })
      .where(eq(interviewRound.id, id));
    expect(
      await f.owner.call(`${path}/evaluation/submit`, { ...evaluation, conclusion: first }),
    ).toMatchObject({ status: 200 });
    expect(await read(f.owner.call(f.path))).toMatchObject({ canCreateRound: false });
    expect(
      await colleague.call(`${path}/evaluation/submit`, { ...evaluation, conclusion: second }),
    ).toMatchObject({ status: 200 });
    expect(await read(f.owner.call(`${path}/result`))).toMatchObject({
      evaluation: { summary: { complete: true, conclusion: expected, submittedCount: 2 } },
    });
    expect(await read(f.owner.call(f.path))).toMatchObject({ canCreateRound: allowed });
  },
);

it("isolates formal evaluations and rejects forged fields, missing versions, and deleted applications", async () => {
  const f = await finishedAi("access");
  await readyAi(f);
  const outsider = await account("evaluation-outsider@example.com");
  expect(await outsider.call(`${f.path}/evaluation/submit`, evaluation)).toMatchObject({
    status: 404,
  });
  expect(
    await outsider.call(`interviews/${outsider.workspaceId}/${f.id}/evaluation/submit`, evaluation),
  ).toMatchObject({ status: 404 });
  await Promise.all(
    [
      { ...evaluation, version: null },
      { ...evaluation, version: 2 },
      { ...evaluation, overall: " " },
      { ...evaluation, authorUserId: f.owner.userId },
    ].map(async (input) =>
      expect(await f.reviewer.call(`${f.path}/evaluation/submit`, input)).toMatchObject({
        status: 400,
      }),
    ),
  );
  await atsTest.platform.database
    .update(application)
    .set({ deletedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await f.reviewer.call(`${f.path}/evaluation/submit`, evaluation)).toMatchObject({
    status: 404,
  });
  expect(await f.reviewer.call(`${f.path}/evaluation/generate`, { version: 1 })).toMatchObject({
    status: 404,
  });
});

it("generates from frozen material, persists provider failure, and retries without replacing an original evaluation", async () => {
  const f = await finishedAi("generate");
  const db = atsTest.platform.database;
  await db.insert(interviewSession).values({
    capturedAt: new Date(),
    content: {
      candidate: { id: "candidate", name: "Candidate" },
      form: { answers: {}, version: 1 },
      interviewer: { description: "", id: f.agent.id, name: "Interviewer", prompt: "" },
      job: {
        id: f.jobId,
        internalCriteria: "System design",
        requirements: "Frozen requirement",
        title: "Engineer",
      },
      questions: { conversation: [], form: [], version: 1 },
      resumes: [],
      version: 1,
    },
    contextToken: "a".repeat(64),
    interviewRoundId: f.id,
    roomName: `room-${f.id}`,
    workspaceId: f.owner.workspaceId,
  });
  await db.insert(interviewReport).values({
    interviewRoundId: f.id,
    plan: { questions: [], version: 1 },
    progress: {
      answers: [],
      asked: [],
      endReason: "completed",
      finalized: true,
      revision: 1,
      summary: "Verified interview record",
      usage: { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 },
      version: 1,
    },
    updatedAt: new Date(),
    workspaceId: f.owner.workspaceId,
  });
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response("Unavailable", { status: 503 }))
    .mockResolvedValueOnce(
      Response.json({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(evaluation) } }],
      }),
    );
  const evaluate = createInterviewEvaluator(
    {
      AGENT_CHAT_BASE_URL: "https://model.example",
      AGENT_CHAT_KEY: "test",
      AGENT_CHAT_MODEL: "test-model",
    },
    transport,
  );
  expect(await generateInterviewEvaluation(db, f.id, evaluate)).toMatchObject({
    error: "INTERVIEW_EVALUATION_FAILED",
  });
  expect(await read(f.reviewer.call(`${f.path}/result`))).toMatchObject({
    evaluation: { canGenerate: true, original: { status: "failed" } },
  });
  expect(await generateInterviewEvaluation(db, f.id, evaluate)).toEqual({ version: 1 });
  expect(await generateInterviewEvaluation(db, f.id, evaluate)).toEqual({ version: 1 });
  expect(transport).toHaveBeenCalledTimes(2);
  const requestBody = JSON.parse(transport.mock.calls[1][1]?.body as string);
  expect(JSON.parse(requestBody.messages[1].content)).toMatchObject({
    progress: { summary: "Verified interview record" },
    snapshot: { job: { requirements: "Frozen requirement" } },
    version: 1,
  });
  expect(await read(f.reviewer.call(`${f.path}/result`))).toMatchObject({
    evaluation: { canEdit: true, original: { content: evaluation, status: "ready" } },
  });
});

it("lets the assigned AI reviewer evaluate without a report and accepts only pass or fail", async () => {
  const f = await finishedAi("without-report");
  expect(await read(f.reviewer.call(`${f.path}/result`))).toMatchObject({
    evaluation: { canEdit: true, original: null },
    progress: null,
  });
  expect(
    await saveDraft(f.reviewer, f.path, {
      conclusion: null,
      overall: "需补充实操验证。",
      version: 1,
    }),
  ).toMatchObject({ status: 200 });
  expect(
    await f.reviewer.call(`${f.path}/evaluation/submit`, {
      conclusion: "pending",
      overall: "需补充实操验证。",
      version: 1,
    }),
  ).toMatchObject({ status: 400 });
  expect(
    await f.reviewer.call(`${f.path}/evaluation/submit`, {
      conclusion: "pass",
      overall: "本轮通过。",
      version: 1,
    }),
  ).toMatchObject({ status: 200 });
  expect(
    await read(f.owner.call(`interviews/${f.owner.workspaceId}/applications/${f.applicationId}`)),
  ).toMatchObject({ canCreateRound: true });
});

it.each(["pass", "fail"] as const)(
  "allows any workspace member to confirm an unassigned AI interview as %s, then locks it",
  async (conclusion) => {
    const f = await fixture(`unassigned-${conclusion}@example.com`);
    const colleague = await addInterviewMember(
      f.owner.workspaceId,
      `unassigned-peer-${conclusion}@example.com`,
    );
    const outsider = await account(`unassigned-outsider-${conclusion}@example.com`);
    const { id } = await read(f.owner.call(f.path, f.input));
    await atsTest.platform.database
      .update(interviewRound)
      .set({ endedAt: new Date(), status: "completed" })
      .where(eq(interviewRound.id, id));
    const path = `interviews/${f.owner.workspaceId}/${id}`;
    expect(await read(colleague.call(`${path}/result`))).toMatchObject({
      evaluation: {
        canEdit: true,
        canGenerate: true,
        summary: { complete: false, requiredCount: 1, submittedCount: 0 },
      },
    });
    expect(await read(colleague.call(f.path))).toMatchObject({ rows: [{ canEvaluate: true }] });
    expect(await outsider.call(`${path}/evaluation/submit`, evaluation)).toMatchObject({
      status: 404,
    });
    expect(await colleague.call(`${path}/evaluation/generate`, { version: 1 })).toMatchObject({
      status: 409,
    });
    expect(await saveDraft(f.owner, path, evaluation)).toMatchObject({ status: 200 });
    expect(
      await colleague.call(`${path}/evaluation/submit`, { ...evaluation, conclusion }),
    ).toMatchObject({ status: 200 });
    expect(await read(f.owner.call(`${path}/result`))).toMatchObject({
      evaluation: {
        canEdit: false,
        canGenerate: false,
        summary: { complete: true, conclusion, requiredCount: 1, submittedCount: 1 },
      },
    });
    expect(await f.owner.call(`${path}/evaluation/submit`, evaluation)).toMatchObject({
      status: 409,
    });
    expect(await saveDraft(f.owner, path, evaluation)).toMatchObject({ status: 409 });
    expect(await read(f.owner.call(f.path))).toMatchObject({
      canCreateRound: conclusion === "pass",
      rows: [{ canEvaluate: false }],
    });
  },
);
