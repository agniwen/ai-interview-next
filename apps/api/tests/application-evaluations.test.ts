import { readFileSync } from "node:fs";
import {
  applicationActivity,
  applicationEvaluation,
  candidate,
  job,
  member,
  resume,
  resumeProcessingAttempt,
  resumeProcessingOutbox,
  resumeProcessingRun,
} from "@ai-interview/db/schema";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { consumeResumeStage } from "../src/modules/ats/stages";
import type { ResumeStageDependencies } from "../src/modules/ats/stages";
import { runResumeWorkflow } from "../src/modules/ats/workflow";
import { resumeObjectStore } from "../src/modules/ats/storage";
import { account, atsTest, read } from "./ats-fixture";

const unavailable = () => Promise.reject(new Error("Unexpected extraction"));

async function completeEvaluation(
  runId: string,
  summary: string,
  evaluate?: ResumeStageDependencies["evaluate"],
) {
  const db = atsTest.platform.database;
  const parameters = { model: "test", promptVersion: 2, timeoutMs: 1000 };
  const dependencies: ResumeStageDependencies = {
    avatarParameters: { ...parameters, version: 1 },
    evaluate:
      evaluate ??
      ((input) =>
        Promise.resolve({
          conciseOverall: summary,
          detailedOverall: {
            judgment: input.internalCriteria,
            matchingEvidence: [],
            risks: [],
          },
          recommendationLevel: "recommended" as const,
          version: 3 as const,
        })),
    evaluateParameters: parameters,
    extract: () => unavailable,
    extractAvatar: unavailable,
    extractParameters: parameters,
    storage: resumeObjectStore(atsTest.env),
    structure: () => unavailable,
    structureParameters: parameters,
  };
  await runResumeWorkflow(
    db,
    {
      checkpoint: (_name, fn) => fn(),
      sleep: async () => {},
      waitForAttempt: async () => {},
    },
    { runId, version: 1 },
    runId,
    async () => {
      const queued = await db
        .select()
        .from(resumeProcessingAttempt)
        .where(
          and(
            eq(resumeProcessingAttempt.runId, runId),
            eq(resumeProcessingAttempt.status, "queued"),
          ),
        );
      await Promise.all(
        queued.map((attempt) =>
          consumeResumeStage(db, dependencies, { attemptId: attempt.id, runId, version: 1 }),
        ),
      );
    },
  );
  return dependencies;
}

it("shares member evaluations and appends AI reevaluations with immutable input snapshots", async () => {
  const owner = await account("evaluation-owner@example.com");
  const colleague = await account("evaluation-colleague@example.com");
  const outsider = await account("evaluation-outsider@example.com");
  const db = atsTest.platform.database;
  const candidateId = crypto.randomUUID();
  const resumeId = crypto.randomUUID();
  const createdAt = new Date();
  await db.insert(member).values({
    createdAt,
    id: crypto.randomUUID(),
    organizationId: owner.workspaceId,
    role: "member",
    userId: colleague.userId,
  });
  await db.insert(candidate).values({
    createdAt,
    creationSource: "manual",
    id: candidateId,
    name: "Candidate",
    workspaceId: owner.workspaceId,
  });
  await db.insert(resume).values({
    candidateId,
    createdAt,
    id: resumeId,
    parseStatus: "succeeded",
    parsedProfile: { identity: { name: "Candidate" }, version: 1 },
    pdfObjectKey: "test.pdf",
    sha256: resumeId,
    workspaceId: owner.workspaceId,
  });
  const parseId = crypto.randomUUID();
  await db.insert(resumeProcessingRun).values({
    createdAt,
    executionId: parseId,
    id: parseId,
    kind: "parse",
    resumeId,
    stage: "structure",
    status: "succeeded",
    workspaceId: owner.workspaceId,
  });
  const target = await read(
    owner.ats("jobs", {
      internalCriteria: "System design",
      requirements: "Build APIs",
      title: "Engineer",
      version: 1,
    }),
  );
  const created = await read(owner.ats("applications", { jobId: target.id, resumeId, version: 1 }));
  expect(created.runId).toEqual(expect.any(String));
  const path = `applications/${created.applicationId}`;
  const queued = await read(owner.ats(path));
  expect(queued.activity.map((entry: { action: string }) => entry.action)).toEqual(["created"]);
  await completeEvaluation(created.runId, "First evaluation");

  const response1 = await owner.ats(`${path}/feedback`, { body: "   ", version: 1 });
  expect(response1.status).toBe(400);
  const response2 = await owner.ats(`${path}/feedback`, { body: "x" });
  expect(response2.status).toBe(400);
  const forbidden = await outsider.call(`ats/${owner.workspaceId}/${path}/feedback`, {
    body: "Unauthorized",
    version: 1,
  });
  expect(forbidden.status).toBe(404);
  const wrongWorkspace = await outsider.ats(`${path}/feedback`, {
    body: "Wrong workspace",
    version: 1,
  });
  expect(wrongWorkspace.status).toBe(404);
  const response3 = await outsider.ats(`${path}/reevaluate`, {});
  expect(response3.status).toBe(409);

  const feedback = await read(
    colleague.call(`ats/${owner.workspaceId}/${path}/feedback`, {
      body: "  **Strong API experience**  ",
      version: 1,
    }),
  );
  await db
    .update(job)
    .set({ internalCriteria: "Mentoring", requirements: "Lead API design" })
    .where(eq(job.id, target.id));
  const next = await owner.ats(`${path}/reevaluate`, {});
  expect(next.status).toBe(202);
  const { runId } = await next.json();
  expect(runId).not.toBe(created.runId);
  const pending = await read(owner.ats(path));
  expect(pending.evaluations).toHaveLength(1);
  expect(pending.application.evaluationStatus).toBe("queued");
  expect(pending.activity).toHaveLength(3);
  const dependencies = await completeEvaluation(runId, "Updated evaluation");
  await consumeResumeStage(db, dependencies, {
    attemptId: `${runId}-evaluate-1`,
    runId,
    version: 1,
  });

  const detail = await read(colleague.call(`ats/${owner.workspaceId}/${path}`));
  expect(detail.feedback).toEqual([
    expect.objectContaining({
      authorId: colleague.userId,
      authorName: "evaluation-colleague@example.com",
      body: "**Strong API experience**",
      id: feedback.id,
    }),
  ]);
  expect(detail.application.evaluationStatus).toBe("succeeded");
  expect(detail.evaluations).toHaveLength(2);
  expect(detail.activity).toHaveLength(4);
  expect(detail.activity).toEqual(
    expect.arrayContaining([
      ...detail.evaluations.map((evaluation: { id: string; createdAt: string }) =>
        expect.objectContaining({
          action: "evaluation_completed",
          actorId: "sainoa-agent",
          actorType: "system",
          applicationId: created.applicationId,
          occurredAt: evaluation.createdAt,
          result: {
            evaluationId: evaluation.id,
            outcome: "evaluation_completed",
            reason: "ai",
            version: 1,
          },
          workspaceId: owner.workspaceId,
        }),
      ),
      expect.objectContaining({
        action: "feedback_added",
        actorId: colleague.userId,
        actorName: "evaluation-colleague@example.com",
        actorType: "user",
        applicationId: created.applicationId,
        occurredAt: detail.feedback[0].createdAt,
        result: {
          feedbackId: feedback.id,
          outcome: "feedback_added",
          reason: "manual",
          version: 1,
        },
        workspaceId: owner.workspaceId,
      }),
    ]),
  );
  expect(detail.evaluations).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        internalCriteriaSnapshot: "System design",
        jobRequirementsSnapshot: "Build APIs",
        result: expect.objectContaining({
          conciseOverall: "First evaluation",
          detailedOverall: expect.objectContaining({ judgment: "System design" }),
        }),
      }),
      expect.objectContaining({
        internalCriteriaSnapshot: "Mentoring",
        jobRequirementsSnapshot: "Lead API design",
        result: expect.objectContaining({
          conciseOverall: "Updated evaluation",
          detailedOverall: expect.objectContaining({ judgment: "Mentoring" }),
        }),
      }),
    ]),
  );
  expect(
    await db
      .select()
      .from(applicationEvaluation)
      .where(eq(applicationEvaluation.applicationId, created.applicationId)),
  ).toHaveLength(2);
  const legacyId = crypto.randomUUID();
  const d1 = atsTest.platform.env.AUTH_DB;
  await d1
    .prepare(
      `INSERT INTO application_evaluation
       (id, applicationId, workspaceId, resumeId, createdAt, internalCriteriaSnapshot, jobRequirementsSnapshot, result)
       SELECT ?, applicationId, workspaceId, resumeId, createdAt, internalCriteriaSnapshot, jobRequirementsSnapshot, ?
       FROM application_evaluation WHERE id = ?`,
    )
    .bind(
      legacyId,
      JSON.stringify({ gaps: [], score: 80, strengths: [], summary: "Legacy score", version: 1 }),
      detail.evaluations[0].id,
    )
    .run();
  await db.insert(resumeProcessingRun).values({
    applicationId: created.applicationId,
    createdAt,
    evaluationId: legacyId,
    executionId: legacyId,
    id: legacyId,
    kind: "evaluate",
    resumeId,
    stage: "evaluate",
    status: "succeeded",
    workspaceId: owner.workspaceId,
  });
  await db.insert(resumeProcessingAttempt).values({
    createdAt,
    executionId: legacyId,
    id: legacyId,
    ordinal: 1,
    runId: legacyId,
    stage: "evaluate",
    status: "succeeded",
  });
  await db.insert(resumeProcessingOutbox).values({
    attemptId: legacyId,
    availableAt: createdAt,
    executionId: legacyId,
    id: legacyId,
    runId: legacyId,
    sentAt: createdAt,
    topic: "finished",
  });
  await db.insert(applicationActivity).values({
    action: "evaluation_completed",
    actorId: "sainoa-agent",
    actorType: "system",
    applicationId: created.applicationId,
    id: legacyId,
    occurredAt: createdAt,
    result: { evaluationId: legacyId, outcome: "evaluation_completed", reason: "ai", version: 1 },
    workspaceId: owner.workspaceId,
  });
  await d1
    .prepare(
      "UPDATE application_evaluation SET result = json_set(result, '$.version', 2, '$.dimensions', json(?)) WHERE id = ?",
    )
    .bind(
      JSON.stringify({ skillMatch: { evaluation: "Old dimension", level: "recommended" } }),
      detail.evaluations[0].id,
    )
    .run();
  const migration = readFileSync(
    new URL(
      "../../../packages/db/migrations/20261107053253_remove_legacy_application_evaluations.sql",
      import.meta.url,
    ),
    "utf-8",
  );
  await d1.batch(
    migration
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => d1.prepare(statement)),
  );
  const migrated = await read(owner.ats(path));
  expect(migrated.evaluations).toEqual(detail.evaluations);
  expect(migrated.activity).toEqual(detail.activity);
  expect(migrated.feedback).toEqual(detail.feedback);
  const remaining = await Promise.all(
    [resumeProcessingRun, resumeProcessingAttempt, resumeProcessingOutbox].map((table) =>
      db.select({ id: table.id }).from(table).where(eq(table.id, legacyId)),
    ),
  );
  expect(remaining).toEqual([[], [], []]);
  const foreignKeys = await d1.prepare("PRAGMA foreign_key_check").all();
  expect(foreignKeys.results).toEqual([]);
  const failed = await read(owner.ats(`${path}/reevaluate`, {}));
  await completeEvaluation(failed.runId, "", () => Promise.reject(new Error("Model unavailable")));
  const afterFailure = await read(owner.ats(path));
  expect(afterFailure.application.evaluationStatus).toBe("failed");
  expect(afterFailure.activity).toEqual(detail.activity);
  expect(afterFailure.evaluations).toEqual(detail.evaluations);
  await owner.ats(`${path}/close`, {});
  const response4 = await owner.ats(`${path}/reevaluate`, {});
  expect(response4.status).toBe(409);
  await owner.request(`ats/${owner.workspaceId}/${path}`, { method: "DELETE" });
  const response5 = await owner.ats(`${path}/feedback`, { body: "Deleted", version: 1 });
  expect(response5.status).toBe(404);
});
