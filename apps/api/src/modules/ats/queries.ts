import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  applicationEvaluation,
  candidate,
  job,
  recruitmentProject,
  resume,
  resumeProcessingAttempt as attempt,
  resumeProcessingRun as run,
  resumeSubmission as submission,
  resumeUploadBatch as batch,
  resumeUploadItem as item,
  user,
} from "@ai-interview/db/schema";
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
} from "drizzle-orm";

import type { SQLWrapper } from "drizzle-orm";
import type {
  ApplicationListQuery,
  JobListQuery,
  ListQuery,
  ResumeListQuery,
  ResumeOptionsQuery,
} from "./input";

function includesText(column: SQLWrapper, search: string) {
  return sql`instr(lower(${column}), lower(${search})) > 0`;
}

export function completedResumeFilter(db: Database, workspaceId: string) {
  return and(
    eq(resume.workspaceId, workspaceId),
    eq(resume.parseStatus, "succeeded"),
    exists(
      db
        .select({ id: run.id })
        .from(run)
        .where(
          and(
            eq(run.workspaceId, workspaceId),
            eq(run.resumeId, resume.id),
            eq(run.kind, "parse"),
            eq(run.status, "succeeded"),
          ),
        ),
    ),
  );
}

export async function applicationOptions(db: Database, workspaceId: string) {
  const jobs = await db
    .select({ id: job.id, title: job.title })
    .from(job)
    .where(eq(job.workspaceId, workspaceId))
    .orderBy(desc(job.createdAt), desc(job.id));
  return { jobs, version: 1 as const };
}

export async function applicationResumeOptions(
  db: Database,
  workspaceId: string,
  { offsetMinutes, page, pageSize, search }: ResumeOptionsQuery,
) {
  const firstSubmission = db
    .select({ id: submission.id })
    .from(submission)
    .where(and(eq(submission.workspaceId, workspaceId), eq(submission.resumeId, resume.id)))
    .orderBy(asc(submission.createdAt), asc(submission.id))
    .limit(1);
  const firstUpload = db
    .select({ id: item.id })
    .from(item)
    .where(
      and(
        eq(item.workspaceId, workspaceId),
        eq(item.submissionId, submission.id),
        eq(item.status, "accepted"),
      ),
    )
    .orderBy(asc(item.id))
    .limit(1);
  const createdAt = sql`coalesce(${batch.createdAt}, ${resume.createdAt})`.mapWith(
    resume.createdAt,
  );
  const normalizedDate = search
    .replaceAll(/[年/月]/gu, "-")
    .replace(/日$/u, "")
    .replaceAll(/-(?<digit>\d)(?=-|$)/gu, "-0$<digit>");
  const match = search
    ? or(
        sql`instr(lower(${submission.originalFilename}), lower(${search})) > 0`,
        sql`instr(lower(${candidate.name}), lower(${search})) > 0`,
        sql`instr(lower(${user.name}), lower(${search})) > 0`,
        sql`instr(strftime('%Y-%m-%d', ${createdAt} / 1000, 'unixepoch', ${`${offsetMinutes} minutes`}), ${normalizedDate}) > 0`,
        sql`exists (select 1 from json_each(${resume.parsedProfile}, '$.targetRoles') where instr(lower(json_extract(value, '$.text')), lower(${search})) > 0)`,
      )
    : undefined;
  const rows = await db
    .select({
      candidateName: candidate.name,
      createdAt,
      creatorImage: user.image,
      creatorName: user.name,
      filename: submission.originalFilename,
      id: resume.id,
      profile: resume.parsedProfile,
    })
    .from(resume)
    .leftJoin(submission, eq(submission.id, sql`(${firstSubmission})`))
    .leftJoin(item, eq(item.id, sql`(${firstUpload})`))
    .leftJoin(batch, and(eq(batch.workspaceId, workspaceId), eq(batch.id, item.batchId)))
    .leftJoin(user, eq(user.id, batch.createdBy))
    .leftJoin(
      candidate,
      and(eq(candidate.workspaceId, workspaceId), eq(candidate.id, resume.candidateId)),
    )
    .where(and(completedResumeFilter(db, workspaceId), match))
    .orderBy(desc(createdAt), desc(resume.id))
    .limit(pageSize + 1)
    .offset((page - 1) * pageSize);
  return {
    nextPage: rows.length > pageSize ? page + 1 : null,
    page,
    pageSize,
    rows: rows.slice(0, pageSize).map(({ creatorImage, creatorName, profile, ...row }) => ({
      ...row,
      creator: creatorName === null ? null : { image: creatorImage, name: creatorName },
      targetRoles: profile?.targetRoles?.flatMap(({ text }) => (text?.trim() ? [text] : [])) ?? [],
    })),
    version: 1 as const,
  };
}

export async function listJobs(
  db: Database,
  workspaceId: string,
  { page, pageSize, search, projectId }: JobListQuery,
) {
  const where = and(
    eq(job.workspaceId, workspaceId),
    projectId ? eq(job.projectId, projectId) : undefined,
    search ? includesText(job.title, search) : undefined,
  );
  const [rows, [result]] = await Promise.all([
    db
      .select({
        createdAt: job.createdAt,
        id: job.id,
        projectTitle: recruitmentProject.title,
        title: job.title,
      })
      .from(job)
      .leftJoin(recruitmentProject, eq(recruitmentProject.id, job.projectId))
      .where(where)
      .orderBy(desc(job.createdAt), desc(job.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(job).where(where),
  ]);
  return { page, pageSize, rows, total: result?.count ?? 0, version: 1 as const };
}

export async function listRecruitmentProjects(
  db: Database,
  workspaceId: string,
  { page, pageSize, search }: ListQuery,
) {
  const where = and(
    eq(recruitmentProject.workspaceId, workspaceId),
    search ? includesText(recruitmentProject.title, search) : undefined,
  );
  const [rows, [result]] = await Promise.all([
    db
      .select()
      .from(recruitmentProject)
      .where(where)
      .orderBy(desc(recruitmentProject.createdAt), desc(recruitmentProject.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(recruitmentProject).where(where),
  ]);
  return { page, pageSize, rows, total: result?.count ?? 0, version: 1 as const };
}

export async function listCandidates(
  db: Database,
  workspaceId: string,
  { page, pageSize, search }: ListQuery,
) {
  const where = and(
    eq(candidate.workspaceId, workspaceId),
    search
      ? or(
          includesText(candidate.name, search),
          includesText(candidate.latestEmployer, search),
          includesText(candidate.email, search),
          includesText(candidate.phoneNormalized, search),
        )
      : undefined,
  );
  const [rows, [result]] = await Promise.all([
    db
      .select()
      .from(candidate)
      .where(where)
      .orderBy(desc(candidate.createdAt), desc(candidate.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(candidate).where(where),
  ]);
  return { page, pageSize, rows, total: result?.count ?? 0, version: 1 as const };
}

export async function listCandidateResumes(db: Database, workspaceId: string, candidateId: string) {
  const firstUpload = db
    .select({ id: item.id })
    .from(submission)
    .innerJoin(
      item,
      and(
        eq(item.submissionId, submission.id),
        eq(item.workspaceId, submission.workspaceId),
        eq(item.status, "accepted"),
      ),
    )
    .where(and(eq(submission.workspaceId, resume.workspaceId), eq(submission.resumeId, resume.id)))
    .orderBy(asc(submission.createdAt), asc(submission.id))
    .limit(1);

  const matches = await db
    .select({
      filename: item.filename,
      record: { createdAt: resume.createdAt, id: resume.id },
      uploadId: item.id,
    })
    .from(candidate)
    .leftJoin(
      resume,
      and(eq(resume.workspaceId, candidate.workspaceId), eq(resume.candidateId, candidate.id)),
    )
    .leftJoin(item, eq(item.id, sql`(${firstUpload})`))
    .where(and(eq(candidate.workspaceId, workspaceId), eq(candidate.id, candidateId)))
    .orderBy(desc(resume.createdAt), desc(resume.id));

  if (!matches.length) {
    return;
  }
  const rows = matches.flatMap(({ filename, record, uploadId }) =>
    record ? [{ ...record, filename, uploadId }] : [],
  );
  return { rows, total: rows.length, version: 1 as const };
}

export async function listResumes(
  db: Database,
  workspaceId: string,
  { page, pageSize, search, status }: ResumeListQuery,
) {
  const workspace = eq(item.workspaceId, workspaceId);
  const effectiveStatus = sql`coalesce(${run.status}, ${item.status})`;
  const candidateName = sql<string | null>`coalesce(${candidate.name}, case
    when ${submission.identityStatus} = 'pending_review'
    then nullif(trim(json_extract(${resume.parsedProfile}, '$.identity.name')), '')
  end)`;
  const where = and(
    workspace,
    search
      ? or(
          includesText(item.filename, search),
          includesText(candidateName, search),
          includesText(user.name, search),
        )
      : undefined,
    status === "failed"
      ? inArray(effectiveStatus, ["failed", "upload_failed"])
      : status && eq(effectiveStatus, status),
  );
  const [rows, [result]] = await Promise.all([
    db
      .select({
        batchId: item.batchId,
        candidateName,
        createdAt: batch.createdAt,
        creatorImage: user.image,
        creatorName: user.name,
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
      .leftJoin(user, eq(user.id, batch.createdBy))
      .leftJoin(run, eq(run.id, item.runId))
      .leftJoin(submission, eq(submission.id, item.submissionId))
      .leftJoin(resume, eq(resume.id, submission.resumeId))
      .leftJoin(candidate, eq(candidate.id, submission.resolvedCandidateId))
      .leftJoin(job, eq(job.id, submission.jobId))
      .where(where)
      .orderBy(desc(batch.createdAt), desc(item.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(item)
      .innerJoin(batch, eq(batch.id, item.batchId))
      .leftJoin(user, eq(user.id, batch.createdBy))
      .leftJoin(run, eq(run.id, item.runId))
      .leftJoin(submission, eq(submission.id, item.submissionId))
      .leftJoin(resume, eq(resume.id, submission.resumeId))
      .leftJoin(candidate, eq(candidate.id, submission.resolvedCandidateId))
      .where(where),
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
        .where(and(workspace, inArray(item.batchId, [...new Set(rows.map((row) => row.batchId))])))
        .groupBy(item.batchId)
    : [];
  return {
    batches,
    page,
    pageSize,
    rows: rows.map(({ creatorImage, creatorName, ...row }) => ({
      ...row,
      creator: creatorName === null ? null : { image: creatorImage, name: creatorName },
    })),
    total: result?.count ?? 0,
    version: 1 as const,
  };
}

export async function getUploadResumeProfile(db: Database, workspaceId: string, id: string) {
  const [result] = await db
    .select({ parseStatus: run.status, profile: resume.parsedProfile })
    .from(item)
    .leftJoin(run, and(eq(run.id, item.runId), eq(run.workspaceId, item.workspaceId)))
    .leftJoin(
      submission,
      and(eq(submission.id, item.submissionId), eq(submission.workspaceId, item.workspaceId)),
    )
    .leftJoin(
      resume,
      and(eq(resume.id, submission.resumeId), eq(resume.workspaceId, item.workspaceId)),
    )
    .where(and(eq(item.workspaceId, workspaceId), eq(item.id, id), eq(item.status, "accepted")));
  return result;
}

export async function listApplications(
  db: Database,
  workspaceId: string,
  { page, pageSize, projectId, search, status }: ApplicationListQuery,
) {
  const where = and(
    eq(application.workspaceId, workspaceId),
    projectId ? eq(job.projectId, projectId) : undefined,
    search ? or(includesText(candidate.name, search), includesText(job.title, search)) : undefined,
    status === "open" ? isNull(application.closedAt) : undefined,
    status === "closed" ? isNotNull(application.closedAt) : undefined,
  );
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
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(application)
      .innerJoin(candidate, eq(candidate.id, application.candidateId))
      .innerJoin(job, eq(job.id, application.jobId))
      .where(where),
  ]);
  return { page, pageSize, rows, total: result?.count ?? 0, version: 1 as const };
}

export async function applicationHistory(db: Database, workspaceId: string, id: string) {
  const [activity, evaluations] = await Promise.all([
    db
      .select({ actorImage: user.image, actorName: user.name, event: applicationActivity })
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
    activity: activity.map(({ actorImage, actorName, event }) => ({
      ...event,
      actorImage,
      actorName,
    })),
    evaluations,
    version: 1 as const,
  };
}
