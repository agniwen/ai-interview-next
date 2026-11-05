import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  applicationResume,
  job,
  resume,
  resumeProcessingOutbox as outbox,
  resumeProcessingRun as run,
  resumeSubmission as submission,
} from "@ai-interview/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { outboxEntry } from "./outbox";

export async function matchSubmissionJob(
  db: Database,
  workspaceId: string,
  id: string,
  jobId: string,
  actor: { id: string; type: "user" | "system" },
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
    db.insert(run).values({
      applicationId,
      createdAt,
      executionId: runId,
      id: runId,
      jobRequirementsSnapshot: target.requirements,
      kind: "evaluate",
      resumeId: record.resumeId,
      stage: "evaluate",
      status: "queued",
      workspaceId,
    }),
    db.insert(outbox).values(outboxEntry("start", runId, runId)),
  ] as const;
  const queries = existing
    ? actions
    : ([
        db.insert(application).values({
          candidateId: record.resolvedCandidateId,
          createdAt,
          id: applicationId,
          jobId,
          stage: "screening",
          workspaceId,
        }),
        ...actions,
      ] as const);
  if (record.applicationId) {
    const [previous] = await db
      .select({ closedAt: application.closedAt })
      .from(application)
      .where(eq(application.id, record.applicationId));
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
