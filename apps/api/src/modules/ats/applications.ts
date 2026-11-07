import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  applicationFeedback,
  applicationResume,
  job,
  resume,
  resumeProcessingOutbox as outbox,
  resumeProcessingRun as run,
  resumeSubmission as submission,
} from "@ai-interview/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { outboxEntry } from "./outbox";
import { completedResumeFilter } from "./queries";

interface ApplicationActor {
  id: string;
  type: "user" | "system";
}

function applicationCreationStatements(
  db: Database,
  input: Pick<
    typeof application.$inferInsert,
    "id" | "candidateId" | "createdAt" | "jobId" | "workspaceId"
  >,
  actor: ApplicationActor,
) {
  return [
    db.insert(application).values({
      ...input,
      createdBy: actor.id,
      createdByType: actor.type,
      stage: "screening",
    }),
    db.insert(applicationActivity).values({
      action: "created",
      actorId: actor.id,
      actorType: actor.type,
      applicationId: input.id,
      id: `created-${input.id}`,
      occurredAt: input.createdAt,
      result: {
        outcome: "created",
        reason: actor.type === "system" ? "job_matched" : "manual",
        version: 1,
      },
      workspaceId: input.workspaceId,
    }),
  ] as const;
}

/** 任务与派发消息由调用方同事务保存，材料快照在入队时固定。 / Callers persist the run and dispatch entry atomically, freezing input snapshots at enqueue time. */
function evaluationStatements(
  db: Database,
  runId: string,
  input: {
    applicationId: string;
    createdAt: Date;
    jobRequirementsSnapshot: string;
    internalCriteriaSnapshot: string;
    resumeId: string;
    workspaceId: string;
  },
) {
  return [
    db.insert(run).values({
      ...input,
      executionId: runId,
      id: runId,
      kind: "evaluate",
      stage: "evaluate",
      status: "queued",
    }),
    db.insert(outbox).values(outboxEntry("start", runId, runId)),
  ] as const;
}

export async function createApplication(
  db: Database,
  workspaceId: string,
  input: { jobId: string; resumeId: string },
  actorId: string,
) {
  const { jobId, resumeId } = input;
  const [pdf, target] = await Promise.all([
    db
      .select({ candidateId: resume.candidateId })
      .from(resume)
      .where(and(eq(resume.id, resumeId), completedResumeFilter(db, workspaceId)))
      .get(),
    db
      .select({ internalCriteria: job.internalCriteria, requirements: job.requirements })
      .from(job)
      .where(and(eq(job.workspaceId, workspaceId), eq(job.id, jobId)))
      .get(),
  ]);
  if (!pdf || !target) {
    return { error: "APPLICATION_INPUT_UNAVAILABLE" as const, version: 1 as const };
  }
  const { candidateId } = pdf;
  if (!candidateId) {
    return { error: "RESUME_CANDIDATE_REQUIRED" as const, version: 1 as const };
  }
  const existing = await db
    .select({ id: application.id, resumeId: applicationResume.resumeId })
    .from(application)
    .leftJoin(
      applicationResume,
      and(
        eq(applicationResume.applicationId, application.id),
        eq(applicationResume.resumeId, resumeId),
      ),
    )
    .where(
      and(
        eq(application.workspaceId, workspaceId),
        eq(application.jobId, jobId),
        eq(application.candidateId, candidateId),
        isNull(application.closedAt),
        isNull(application.deletedAt),
      ),
    )
    .get();
  if (existing?.resumeId) {
    return { applicationId: existing.id, runId: null, version: 1 as const };
  }
  const applicationId = existing?.id ?? crypto.randomUUID();
  const runId = crypto.randomUUID();
  const createdAt = new Date();
  const actions = [
    db.insert(applicationResume).values({
      applicationId,
      createdAt,
      id: crypto.randomUUID(),
      resumeId,
      status: "available",
      workspaceId,
    }),
    ...evaluationStatements(db, runId, {
      applicationId,
      createdAt,
      internalCriteriaSnapshot: target.internalCriteria,
      jobRequirementsSnapshot: target.requirements,
      resumeId,
      workspaceId,
    }),
  ] as const;
  await db.batch(
    existing
      ? actions
      : [
          ...applicationCreationStatements(
            db,
            { candidateId, createdAt, id: applicationId, jobId, workspaceId },
            { id: actorId, type: "user" },
          ),
          ...actions,
        ],
  );
  return { applicationId, runId, version: 1 as const };
}

export async function matchSubmissionJob(
  db: Database,
  workspaceId: string,
  id: string,
  jobId: string,
  actor: ApplicationActor,
) {
  const [[entry], [target]] = await Promise.all([
    db
      .select({ pdf: resume, submission })
      .from(submission)
      .innerJoin(resume, eq(resume.id, submission.resumeId))
      .where(and(eq(submission.workspaceId, workspaceId), eq(submission.id, id))),
    db
      .select()
      .from(job)
      .where(and(eq(job.workspaceId, workspaceId), eq(job.id, jobId))),
  ]);
  if (!entry || !target) {
    return null;
  }
  const record = entry.submission;
  if (!record.resolvedCandidateId || entry.pdf.parseStatus !== "succeeded") {
    await db.update(submission).set({ jobId }).where(eq(submission.id, id));
    return { applicationId: null, runId: null, version: 1 as const };
  }
  const [existing] = await db
    .select({ id: application.id })
    .from(application)
    .where(
      and(
        eq(application.workspaceId, workspaceId),
        eq(application.jobId, jobId),
        eq(application.candidateId, record.resolvedCandidateId),
        isNull(application.closedAt),
        isNull(application.deletedAt),
      ),
    );
  if (existing && existing.id === record.applicationId) {
    return { applicationId: existing.id, runId: null, version: 1 as const };
  }
  const applicationId = existing?.id ?? crypto.randomUUID();
  const runId = crypto.randomUUID();
  const createdAt = new Date();
  const updateSubmission = db
    .update(submission)
    .set({ applicationId, jobId })
    .where(eq(submission.id, id));
  const attachResume = db
    .insert(applicationResume)
    .values({
      applicationId,
      createdAt,
      id: crypto.randomUUID(),
      resumeId: record.resumeId,
      status:
        entry.pdf.candidateId && entry.pdf.candidateId !== record.resolvedCandidateId
          ? "pending_confirmation"
          : "available",
      workspaceId,
    })
    .onConflictDoNothing();
  const actions = [
    attachResume,
    updateSubmission,
    ...evaluationStatements(db, runId, {
      applicationId,
      createdAt,
      internalCriteriaSnapshot: target.internalCriteria,
      jobRequirementsSnapshot: target.requirements,
      resumeId: record.resumeId,
      workspaceId,
    }),
  ] as const;
  const queries = existing
    ? actions
    : ([
        ...applicationCreationStatements(
          db,
          {
            candidateId: record.resolvedCandidateId,
            createdAt,
            id: applicationId,
            jobId,
            workspaceId,
          },
          actor,
        ),
        ...actions,
      ] as const);
  if (record.applicationId) {
    const [previous] = await db
      .select({ closedAt: application.closedAt })
      .from(application)
      .where(and(eq(application.id, record.applicationId), isNull(application.deletedAt)));
    if (previous && !previous.closedAt) {
      await db.batch([
        ...queries,
        db
          .update(application)
          .set({ closedAt: createdAt, outcome: "transferred" })
          .where(and(eq(application.id, record.applicationId), isNull(application.closedAt))),
        db
          .insert(applicationActivity)
          .values({
            action: "closed",
            actorId: actor.id,
            actorType: actor.type,
            applicationId: record.applicationId,
            id: `closed-${record.applicationId}`,
            occurredAt: createdAt,
            result: {
              nextApplicationId: applicationId,
              outcome: "transferred",
              reason: "job_changed",
              version: 1,
            },
            workspaceId,
          })
          .onConflictDoNothing(),
      ]);
      return { applicationId, runId, version: 1 as const };
    }
  }
  await db.batch(queries);
  return { applicationId, runId, version: 1 as const };
}

export async function closeApplication(
  db: Database,
  workspaceId: string,
  id: string,
  actorId: string,
) {
  const occurredAt = new Date();
  const open = and(
    eq(application.id, id),
    eq(application.workspaceId, workspaceId),
    isNull(application.closedAt),
    isNull(application.deletedAt),
  );
  const [, changed] = await db.batch([
    db.insert(applicationActivity).select(
      db
        .select({
          action: sql<"closed">`'closed'`.as("action"),
          actorId: sql<string>`${actorId}`.as("actorId"),
          actorType: sql<"user">`'user'`.as("actorType"),
          applicationId: application.id,
          id: sql<string>`${`closed-${id}`}`.as("id"),
          occurredAt: sql<Date>`${occurredAt.getTime()}`.as("occurredAt"),
          result: sql<typeof applicationActivity.$inferInsert.result>`${JSON.stringify({
            outcome: "closed",
            reason: "manual",
            version: 1,
          })}`.as("result"),
          workspaceId: application.workspaceId,
        })
        .from(application)
        .where(open),
    ),
    db.update(application).set({ closedAt: occurredAt, outcome: "closed" }).where(open).returning({
      id: application.id,
    }),
  ]);
  return changed.length > 0;
}

/** 将成员正文和活动记录一起保存，确保消息与操作历史同时可见。 / Save member feedback and its activity together so both timelines become visible atomically. */
export async function addApplicationFeedback(
  db: Database,
  workspaceId: string,
  applicationId: string,
  authorUserId: string,
  body: string,
) {
  const record = await db
    .select({ id: application.id })
    .from(application)
    .where(
      and(
        eq(application.id, applicationId),
        eq(application.workspaceId, workspaceId),
        isNull(application.deletedAt),
      ),
    )
    .get();
  if (!record) {
    return null;
  }
  const id = crypto.randomUUID();
  const createdAt = new Date();
  await db.batch([
    db.insert(applicationFeedback).values({
      applicationId,
      authorUserId,
      body,
      createdAt,
      id,
      workspaceId,
    }),
    db.insert(applicationActivity).values({
      action: "feedback_added",
      actorId: authorUserId,
      actorType: "user",
      applicationId,
      id: `feedback-${id}`,
      occurredAt: createdAt,
      result: { feedbackId: id, outcome: "feedback_added", reason: "manual", version: 1 },
      workspaceId,
    }),
  ]);
  return { id, version: 1 as const };
}

/** 使用最近关联且解析完成的可用简历创建新评价，保留旧结果和各次材料快照。 / Evaluate the most recently linked usable parsed resume, preserving prior results and each run's input snapshots. */
export async function reevaluateApplication(
  db: Database,
  workspaceId: string,
  applicationId: string,
) {
  const record = await db
    .select({
      internalCriteriaSnapshot: job.internalCriteria,
      jobRequirementsSnapshot: job.requirements,
      resumeId: resume.id,
    })
    .from(application)
    .innerJoin(job, eq(job.id, application.jobId))
    .innerJoin(
      applicationResume,
      and(
        eq(applicationResume.applicationId, application.id),
        eq(applicationResume.workspaceId, workspaceId),
        eq(applicationResume.status, "available"),
      ),
    )
    .innerJoin(
      resume,
      and(eq(resume.id, applicationResume.resumeId), eq(resume.parseStatus, "succeeded")),
    )
    .where(
      and(
        eq(application.id, applicationId),
        eq(application.workspaceId, workspaceId),
        isNull(application.closedAt),
        isNull(application.deletedAt),
      ),
    )
    .orderBy(desc(applicationResume.createdAt), desc(applicationResume.id))
    .limit(1)
    .get();
  if (!record) {
    return null;
  }
  const runId = crypto.randomUUID();
  await db.batch(
    evaluationStatements(db, runId, {
      ...record,
      applicationId,
      createdAt: new Date(),
      workspaceId,
    }),
  );
  return { runId, version: 1 as const };
}

export async function deleteApplication(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const deleted = await db
    .update(application)
    .set({ deletedAt: new Date() })
    .where(
      and(
        eq(application.workspaceId, workspaceId),
        eq(application.id, id),
        eq(application.createdBy, userId),
        eq(application.createdByType, "user"),
        isNull(application.deletedAt),
      ),
    )
    .returning({ id: application.id })
    .get();
  return Boolean(deleted);
}
