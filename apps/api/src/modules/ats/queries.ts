import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  interviewerAgent,
  applicationEvaluation,
  applicationFeedback,
  applicationResume,
  candidate,
  department,
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

const parsedResumeName = sql<string | null>`case
  when json_extract(${resume.parsedProfile}, '$.version') = 1
  then nullif(trim(json_extract(${resume.parsedProfile}, '$.identity.name')), '')
end`;
const candidateAvatarResumeId = sql<string | null>`case
  when ${resume.avatarObjectKey} is not null then ${resume.id}
end`;

/** 工作流已启动但阶段仍在排队时，展示排队状态；终态以工作流为准。
 * Show queued while the current stage waits, even after workflow start; keep workflow terminal states. */
function displayedRunStatus(db: Database) {
  const stageStatus = db
    .select({ status: attempt.status })
    .from(attempt)
    .where(
      and(
        eq(attempt.runId, run.id),
        eq(attempt.executionId, run.executionId),
        eq(attempt.stage, run.stage),
      ),
    )
    .orderBy(desc(attempt.ordinal))
    .limit(1);
  return sql<typeof run.$inferSelect.status | null>`case
    when ${run.status} = 'running' and (${stageStatus}) = 'queued' then 'queued'
    else ${run.status}
  end`;
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
        includesText(parsedResumeName, search),
        sql`instr(lower(${user.name}), lower(${search})) > 0`,
        sql`instr(strftime('%Y-%m-%d', ${createdAt} / 1000, 'unixepoch', ${`${offsetMinutes} minutes`}), ${normalizedDate}) > 0`,
        sql`exists (select 1 from json_each(${resume.parsedProfile}, '$.targetRoles') where instr(lower(json_extract(value, '$.text')), lower(${search})) > 0)`,
      )
    : undefined;
  const rows = await db
    .select({
      candidateName: parsedResumeName,
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

export async function listDepartments(
  db: Database,
  workspaceId: string,
  { page, pageSize, search }: ListQuery,
) {
  const where = and(
    eq(department.workspaceId, workspaceId),
    search ? includesText(department.name, search) : undefined,
  );
  const [rows, [result]] = await Promise.all([
    db
      .select()
      .from(department)
      .where(where)
      .orderBy(desc(department.createdAt), desc(department.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(department).where(where),
  ]);
  return { page, pageSize, rows, total: result?.count ?? 0, version: 1 as const };
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
        createdBy: job.createdBy,
        id: job.id,
        projectId: recruitmentProject.id,
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

export function findDepartment(db: Database, workspaceId: string, id: string) {
  return db
    .select({ id: department.id })
    .from(department)
    .where(and(eq(department.id, id), eq(department.workspaceId, workspaceId)))
    .get();
}

export function findRecruitmentProject(db: Database, workspaceId: string, id: string) {
  return db
    .select({ id: recruitmentProject.id })
    .from(recruitmentProject)
    .where(and(eq(recruitmentProject.id, id), eq(recruitmentProject.workspaceId, workspaceId)))
    .get();
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

function firstAcceptedResumeUpload(db: Database) {
  return db
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
    .orderBy(asc(submission.createdAt), asc(submission.id), asc(item.id))
    .limit(1);
}

export async function listCandidateResumes(db: Database, workspaceId: string, candidateId: string) {
  const matches = await db
    .select({
      canJoinRecruitment: sql`coalesce(${completedResumeFilter(db, workspaceId)}, 0)`.mapWith(
        Boolean,
      ),
      filename: item.filename,
      record: { createdAt: resume.createdAt, id: resume.id },
      uploadId: item.id,
    })
    .from(candidate)
    .leftJoin(
      resume,
      and(eq(resume.workspaceId, candidate.workspaceId), eq(resume.candidateId, candidate.id)),
    )
    .leftJoin(item, eq(item.id, sql`(${firstAcceptedResumeUpload(db)})`))
    .where(and(eq(candidate.workspaceId, workspaceId), eq(candidate.id, candidateId)))
    .orderBy(desc(resume.createdAt), desc(resume.id));

  if (!matches.length) {
    return;
  }
  const rows = matches.flatMap(({ canJoinRecruitment, filename, record, uploadId }) =>
    record ? [{ ...record, canJoinRecruitment, filename, uploadId }] : [],
  );
  return { rows, total: rows.length, version: 1 as const };
}

export async function listResumes(
  db: Database,
  workspaceId: string,
  { page, pageSize, search, status }: ResumeListQuery,
) {
  const workspace = eq(item.workspaceId, workspaceId);
  const effectiveStatus = sql`coalesce(${displayedRunStatus(db)}, ${item.status})`;
  const where = and(
    workspace,
    search
      ? or(
          includesText(item.filename, search),
          includesText(parsedResumeName, search),
          includesText(candidate.name, search),
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
        candidateAvatarResumeId,
        candidateName: parsedResumeName,
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
        linkedCandidateName: candidate.name,
        parseStage: run.stage,
        parseStatus: displayedRunStatus(db),
        resumeId: resume.id,
        runId: item.runId,
        source: batch.source,
        status: item.status,
        submissionId: item.submissionId,
      })
      .from(item)
      .innerJoin(batch, eq(batch.id, item.batchId))
      .leftJoin(user, eq(user.id, batch.createdBy))
      .leftJoin(run, eq(run.id, item.runId))
      .leftJoin(submission, eq(submission.id, item.submissionId))
      .leftJoin(resume, eq(resume.id, submission.resumeId))
      .leftJoin(candidate, eq(candidate.id, resume.candidateId))
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
      .leftJoin(candidate, eq(candidate.id, resume.candidateId))
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

export async function getUploadProcessing(db: Database, workspaceId: string, id: string) {
  const record = await db
    .select({
      resume: {
        hasAvatar: sql<boolean>`(${resume.avatarObjectKey} is not null)`.mapWith(Boolean),
        id: resume.id,
        markdown: resume.markdown,
        profile: resume.parsedProfile,
      },
      run: {
        executionId: run.executionId,
        id: run.id,
        stage: run.stage,
        status: sql<typeof run.$inferSelect.status>`${displayedRunStatus(db)}`,
      },
      upload: { filename: item.filename, id: item.id, size: item.size, status: item.status },
    })
    .from(item)
    .leftJoin(run, and(eq(run.id, item.runId), eq(run.workspaceId, workspaceId)))
    .leftJoin(resume, and(eq(resume.id, run.resumeId), eq(resume.workspaceId, workspaceId)))
    .where(and(eq(item.id, id), eq(item.workspaceId, workspaceId)))
    .get();
  if (!record) {
    return null;
  }
  const attempts = record.run
    ? await db
        .select({
          createdAt: attempt.createdAt,
          error: attempt.error,
          finishedAt: attempt.finishedAt,
          id: attempt.id,
          ordinal: attempt.ordinal,
          parameters: attempt.parameters,
          stage: attempt.stage,
          startedAt: attempt.startedAt,
          status: attempt.status,
        })
        .from(attempt)
        .where(
          and(eq(attempt.runId, record.run.id), eq(attempt.executionId, record.run.executionId)),
        )
        .orderBy(asc(attempt.createdAt), asc(attempt.ordinal), asc(attempt.id))
    : [];
  return { ...record, attempts, version: 1 as const };
}

export async function getUploadResumeProfile(db: Database, workspaceId: string, id: string) {
  const [result] = await db
    .select({
      avatarObjectKey: resume.avatarObjectKey,
      parseStatus: displayedRunStatus(db),
      profile: resume.parsedProfile,
      resumeId: resume.id,
    })
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

function applicationResumeForDisplay(db: Database) {
  const selectedResume = db
    .select({ id: resume.id })
    .from(applicationResume)
    .innerJoin(
      resume,
      and(
        eq(resume.workspaceId, applicationResume.workspaceId),
        eq(resume.id, applicationResume.resumeId),
      ),
    )
    .where(
      and(
        eq(applicationResume.workspaceId, application.workspaceId),
        eq(applicationResume.applicationId, application.id),
        eq(applicationResume.status, "available"),
      ),
    )
    .orderBy(
      desc(isNotNull(resume.parsedProfile)),
      desc(applicationResume.createdAt),
      desc(applicationResume.id),
    )
    .limit(1);
  return and(
    eq(resume.workspaceId, application.workspaceId),
    eq(resume.id, sql`(${selectedResume})`),
  );
}

export async function listApplications(
  db: Database,
  workspaceId: string,
  { page, pageSize, projectId, search, status }: ApplicationListQuery,
) {
  const where = and(
    eq(application.workspaceId, workspaceId),
    isNull(application.deletedAt),
    projectId ? eq(job.projectId, projectId) : undefined,
    search
      ? or(includesText(parsedResumeName, search), includesText(job.title, search))
      : undefined,
    status === "open" ? isNull(application.closedAt) : undefined,
    status === "closed" ? isNotNull(application.closedAt) : undefined,
  );
  const [rows, [result]] = await Promise.all([
    db
      .select({
        candidateAvatarResumeId,
        candidateName: parsedResumeName,
        closedAt: application.closedAt,
        createdAt: application.createdAt,
        evaluationRunId: sql<
          string | null
        >`(${db.select({ id: run.id }).from(run).where(eq(run.applicationId, application.id)).orderBy(desc(run.createdAt), desc(run.id)).limit(1)})`,
        evaluationStatus: sql<typeof run.$inferSelect.status | null>`(${db
          .select({ status: displayedRunStatus(db) })
          .from(run)
          .where(eq(run.applicationId, application.id))
          .orderBy(desc(run.createdAt), desc(run.id))
          .limit(1)})`,
        id: application.id,
        jobId: job.id,
        jobTitle: job.title,
        outcome: application.outcome,
        stage: application.stage,
      })
      .from(application)
      .leftJoin(resume, applicationResumeForDisplay(db))
      .innerJoin(job, eq(job.id, application.jobId))
      .where(where)
      .orderBy(desc(application.createdAt), desc(application.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ count: count() })
      .from(application)
      .leftJoin(resume, applicationResumeForDisplay(db))
      .innerJoin(job, eq(job.id, application.jobId))
      .where(where),
  ]);
  return { page, pageSize, rows, total: result?.count ?? 0, version: 1 as const };
}

export async function applicationDetail(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const [details] = await db
    .select({
      candidateName: parsedResumeName,
      closedAt: application.closedAt,
      createdAt: application.createdAt,
      creatorId: application.createdBy,
      creatorImage: user.image,
      creatorName: user.name,
      creatorType: application.createdByType,
      id: application.id,
      jobId: job.id,
      jobTitle: job.title,
      projectId: recruitmentProject.id,
      projectTitle: recruitmentProject.title,
      resumeFilename: item.filename,
      resumeHasAvatar: isNotNull(resume.avatarObjectKey).mapWith(Boolean),
      resumeId: resume.id,
      resumeProfile: resume.parsedProfile,
      resumeUploadId: item.id,
    })
    .from(application)
    .leftJoin(resume, applicationResumeForDisplay(db))
    .innerJoin(job, eq(job.id, application.jobId))
    .leftJoin(recruitmentProject, eq(recruitmentProject.id, job.projectId))
    .leftJoin(item, eq(item.id, sql`(${firstAcceptedResumeUpload(db)})`))
    .leftJoin(user, and(eq(application.createdByType, "user"), eq(user.id, application.createdBy)))
    .where(
      and(
        eq(application.workspaceId, workspaceId),
        eq(application.id, id),
        isNull(application.deletedAt),
      ),
    );
  if (!details) {
    return null;
  }
  const {
    creatorId,
    creatorImage,
    creatorName,
    creatorType,
    resumeFilename,
    resumeHasAvatar,
    resumeId,
    resumeProfile,
    resumeUploadId,
    ...record
  } = details;

  const [activity, evaluations, feedback, [latestRun]] = await Promise.all([
    db
      .select({
        actorImage: user.image,
        actorName: sql<
          string | null
        >`coalesce(${user.name}, ${candidate.name}, ${interviewerAgent.name})`,
        event: applicationActivity,
      })
      .from(applicationActivity)
      .leftJoin(
        user,
        and(eq(user.id, applicationActivity.actorId), eq(applicationActivity.actorType, "user")),
      )
      .leftJoin(
        candidate,
        and(
          eq(candidate.id, applicationActivity.actorId),
          eq(applicationActivity.actorType, "candidate"),
        ),
      )
      .leftJoin(
        interviewerAgent,
        and(
          eq(interviewerAgent.id, applicationActivity.actorId),
          eq(applicationActivity.actorType, "system"),
        ),
      )
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
    db
      .select({
        authorId: applicationFeedback.authorUserId,
        authorImage: user.image,
        authorName: user.name,
        body: applicationFeedback.body,
        createdAt: applicationFeedback.createdAt,
        id: applicationFeedback.id,
      })
      .from(applicationFeedback)
      .innerJoin(user, eq(user.id, applicationFeedback.authorUserId))
      .where(
        and(
          eq(applicationFeedback.workspaceId, workspaceId),
          eq(applicationFeedback.applicationId, id),
        ),
      )
      .orderBy(asc(applicationFeedback.createdAt), asc(applicationFeedback.id)),
    db
      .select({ id: run.id, status: displayedRunStatus(db) })
      .from(run)
      .where(and(eq(run.workspaceId, workspaceId), eq(run.applicationId, id)))
      .orderBy(desc(run.createdAt), desc(run.id))
      .limit(1),
  ]);
  return {
    activity: activity.map(({ actorImage, actorName, event }) => ({
      ...event,
      actorImage,
      actorName,
    })),
    application: {
      ...record,
      canDelete: creatorType === "user" && creatorId === userId,
      creator:
        creatorId && creatorType
          ? {
              actorId: creatorId,
              actorImage: creatorImage,
              actorName: creatorName,
              actorType: creatorType,
            }
          : null,
      evaluationRunId: latestRun?.id ?? null,
      evaluationStatus: latestRun?.status ?? null,
    },
    evaluations,
    feedback,
    resume: resumeId
      ? {
          filename: resumeFilename,
          hasAvatar: resumeHasAvatar,
          id: resumeId,
          uploadId: resumeUploadId,
        }
      : null,
    resumeProfile,
    version: 1 as const,
  };
}
