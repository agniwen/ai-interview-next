import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  applicationEvaluation,
  candidate,
  job,
  resume,
  resumeProcessingAttempt as attempt,
  resumeProcessingRun as run,
  resumeSubmission as submission,
  resumeUploadBatch as batch,
  resumeUploadItem as item,
  user,
} from "@ai-interview/db/schema";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";

export const atsPageSize = 20;

export async function listCandidates(db: Database, workspaceId: string, page: number) {
  const where = eq(candidate.workspaceId, workspaceId);
  const [rows, [result]] = await Promise.all([
    db
      .select()
      .from(candidate)
      .where(where)
      .orderBy(desc(candidate.createdAt), desc(candidate.id))
      .limit(atsPageSize)
      .offset((page - 1) * atsPageSize),
    db.select({ count: count() }).from(candidate).where(where),
  ]);
  return { page, pageSize: atsPageSize, rows, total: result?.count ?? 0, version: 1 as const };
}

export async function listResumes(db: Database, workspaceId: string, page: number) {
  const where = eq(item.workspaceId, workspaceId);
  const [rows, [result]] = await Promise.all([
    db
      .select({
        batchId: item.batchId,
        candidateName: candidate.name,
        createdAt: batch.createdAt,
        error: sql<string | null>`(${db
          .select({ error: attempt.error })
          .from(attempt)
          .where(
            and(
              eq(attempt.runId, run.id),
              eq(attempt.executionId, run.executionId),
              eq(attempt.stage, run.stage),
            ),
          )
          .orderBy(desc(attempt.ordinal))
          .limit(1)})`,
        filename: item.filename,
        id: item.id,
        identityStatus: submission.identityStatus,
        jobId: submission.jobId,
        jobTitle: job.title,
        parseStage: run.stage,
        parseStatus: run.status,
        resumeId: resume.id,
        runId: item.runId,
        status: item.status,
        submissionId: item.submissionId,
      })
      .from(item)
      .innerJoin(batch, eq(batch.id, item.batchId))
      .leftJoin(run, eq(run.id, item.runId))
      .leftJoin(submission, eq(submission.id, item.submissionId))
      .leftJoin(resume, eq(resume.id, submission.resumeId))
      .leftJoin(candidate, eq(candidate.id, submission.resolvedCandidateId))
      .leftJoin(job, eq(job.id, submission.jobId))
      .where(where)
      .orderBy(desc(batch.createdAt), desc(item.id))
      .limit(atsPageSize)
      .offset((page - 1) * atsPageSize),
    db.select({ count: count() }).from(item).where(where),
  ]);
  const batches = rows.length
    ? await db
        .select({
          complete: sql<number>`sum(case when ${run.status} = 'succeeded' then 1 else 0 end)`,
          failed: sql<number>`sum(case when ${item.status} = 'upload_failed' or ${run.status} = 'failed' then 1 else 0 end)`,
          id: item.batchId,
          total: count(),
        })
        .from(item)
        .leftJoin(run, eq(run.id, item.runId))
        .where(and(where, inArray(item.batchId, [...new Set(rows.map((row) => row.batchId))])))
        .groupBy(item.batchId)
    : [];
  return {
    batches,
    page,
    pageSize: atsPageSize,
    rows,
    total: result?.count ?? 0,
    version: 1 as const,
  };
}

export async function listApplications(db: Database, workspaceId: string, page: number) {
  const where = eq(application.workspaceId, workspaceId);
  const [rows, [result]] = await Promise.all([
    db
      .select({
        candidateName: candidate.name,
        closedAt: application.closedAt,
        createdAt: application.createdAt,
        evaluationRunId: sql<
          string | null
        >`(${db.select({ id: run.id }).from(run).where(eq(run.applicationId, application.id)).orderBy(desc(run.createdAt), desc(run.id)).limit(1)})`,
        evaluationStatus: sql<
          typeof run.$inferSelect.status | null
        >`(${db.select({ status: run.status }).from(run).where(eq(run.applicationId, application.id)).orderBy(desc(run.createdAt), desc(run.id)).limit(1)})`,
        id: application.id,
        jobTitle: job.title,
        outcome: application.outcome,
        stage: application.stage,
      })
      .from(application)
      .innerJoin(candidate, eq(candidate.id, application.candidateId))
      .innerJoin(job, eq(job.id, application.jobId))
      .where(where)
      .orderBy(desc(application.createdAt), desc(application.id))
      .limit(atsPageSize)
      .offset((page - 1) * atsPageSize),
    db.select({ count: count() }).from(application).where(where),
  ]);
  return { page, pageSize: atsPageSize, rows, total: result?.count ?? 0, version: 1 as const };
}

export async function applicationHistory(db: Database, workspaceId: string, id: string) {
  const [activity, evaluations] = await Promise.all([
    db
      .select({ actorName: user.name, event: applicationActivity })
      .from(applicationActivity)
      .leftJoin(user, eq(user.id, applicationActivity.actorId))
      .where(
        and(
          eq(applicationActivity.workspaceId, workspaceId),
          eq(applicationActivity.applicationId, id),
        ),
      )
      .orderBy(desc(applicationActivity.occurredAt), desc(applicationActivity.id)),
    db
      .select()
      .from(applicationEvaluation)
      .where(
        and(
          eq(applicationEvaluation.workspaceId, workspaceId),
          eq(applicationEvaluation.applicationId, id),
        ),
      )
      .orderBy(desc(applicationEvaluation.createdAt), desc(applicationEvaluation.id)),
  ]);
  return {
    activity: activity.map(({ actorName, event }) => ({ ...event, actorName })),
    evaluations,
    version: 1 as const,
  };
}
