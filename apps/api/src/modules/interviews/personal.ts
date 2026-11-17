import type { Database } from "@ai-interview/db";
import {
  application,
  applicationResume,
  candidate,
  interviewAssignment,
  interviewEvaluation,
  interviewRound,
  job,
  resumeSubmission,
  resumeUploadBatch,
  resumeUploadItem,
} from "@ai-interview/db/schema";
import {
  and,
  asc,
  desc,
  eq,
  exists,
  gte,
  isNotNull,
  isNull,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import type { z } from "zod";
import type { personalInterviewQuery } from "./input";

export function personalInterviewPredicates(db: Database, workspaceId: string, userId: string) {
  const interviewer = exists(
    db
      .select({ id: interviewAssignment.interviewRoundId })
      .from(interviewAssignment)
      .where(
        and(
          eq(interviewAssignment.workspaceId, workspaceId),
          eq(interviewAssignment.interviewRoundId, interviewRound.id),
          eq(interviewAssignment.role, "interviewer"),
          eq(interviewAssignment.userId, userId),
        ),
      ),
  );
  const uploaded = db
    .select({ id: resumeSubmission.resumeId })
    .from(resumeSubmission)
    .innerJoin(resumeUploadItem, eq(resumeUploadItem.submissionId, resumeSubmission.id))
    .innerJoin(resumeUploadBatch, eq(resumeUploadBatch.id, resumeUploadItem.batchId))
    .where(
      and(
        eq(resumeSubmission.workspaceId, workspaceId),
        eq(resumeUploadItem.workspaceId, workspaceId),
        eq(resumeUploadItem.status, "accepted"),
        eq(resumeUploadBatch.workspaceId, workspaceId),
        eq(resumeUploadBatch.createdBy, userId),
        or(
          eq(resumeSubmission.resumeId, interviewRound.resumeId),
          and(
            isNull(interviewRound.resumeId),
            exists(
              db
                .select({ id: applicationResume.id })
                .from(applicationResume)
                .where(
                  and(
                    eq(applicationResume.workspaceId, workspaceId),
                    eq(applicationResume.applicationId, interviewRound.applicationId),
                    eq(applicationResume.resumeId, resumeSubmission.resumeId),
                    eq(applicationResume.status, "available"),
                  ),
                ),
            ),
          ),
        ),
      ),
    );
  return { interviewer, uploader: exists(uploaded) };
}

export async function listPersonalInterviews(
  db: Database,
  workspaceId: string,
  userId: string,
  { creatorId, page, pageSize, role, todo }: z.output<typeof personalInterviewQuery>,
) {
  const { interviewer, uploader } = personalInterviewPredicates(db, workspaceId, userId);
  const now = new Date();
  const reviewer = exists(
    db
      .select({ id: interviewAssignment.interviewRoundId })
      .from(interviewAssignment)
      .where(
        and(
          eq(interviewAssignment.workspaceId, workspaceId),
          eq(interviewAssignment.interviewRoundId, interviewRound.id),
          eq(interviewAssignment.role, "reviewer"),
          eq(interviewAssignment.userId, userId),
        ),
      ),
  );
  const needsEvaluation = and(
    or(interviewer, and(eq(interviewRound.kind, "ai"), reviewer)),
    eq(interviewRound.status, "completed"),
    notExists(
      db
        .select({ id: interviewEvaluation.interviewRoundId })
        .from(interviewEvaluation)
        .where(
          and(
            eq(interviewEvaluation.workspaceId, workspaceId),
            eq(interviewEvaluation.interviewRoundId, interviewRound.id),
            or(eq(interviewRound.kind, "ai"), eq(interviewEvaluation.authorUserId, userId)),
            isNotNull(interviewEvaluation.submittedAt),
          ),
        ),
    ),
  );
  const upcoming = and(
    interviewer,
    isNull(application.closedAt),
    or(
      eq(interviewRound.status, "in_progress"),
      and(eq(interviewRound.status, "scheduled"), gte(interviewRound.scheduledAt, now)),
    ),
  );
  const related =
    creatorId === "me"
      ? eq(interviewRound.createdBy, userId)
      : { all: or(interviewer, uploader), interviewer, uploader }[role ?? "all"];
  const selection = { evaluation: needsEvaluation, upcoming };
  const where = and(
    eq(interviewRound.workspaceId, workspaceId),
    eq(application.workspaceId, workspaceId),
    isNull(application.deletedAt),
    todo ? selection[todo] : related,
  );
  const priority = sql`case when ${interviewRound.status} = 'in_progress' then 0
    when ${needsEvaluation} then 1 when ${interviewRound.status} = 'scheduled' then 2 else 3 end`;
  const [rows, [count]] = await Promise.all([
    db
      .select({
        applicationId: interviewRound.applicationId,
        canJoin:
          sql<boolean>`(${interviewer} and ${interviewRound.kind} = 'human' and ${interviewRound.status} in ('scheduled', 'in_progress') and ${application.closedAt} is null)`.mapWith(
            Boolean,
          ),
        candidateName: candidate.name,
        endedAt: interviewRound.endedAt,
        id: interviewRound.id,
        interviewer: sql<boolean>`${interviewer}`.mapWith(Boolean),
        jobTitle: job.title,
        kind: interviewRound.kind,
        label: interviewRound.label,
        needsEvaluation: sql<boolean>`${needsEvaluation}`.mapWith(Boolean),
        scheduledAt: interviewRound.scheduledAt,
        sequence: interviewRound.sequence,
        status: interviewRound.status,
        uploader: sql<boolean>`${uploader}`.mapWith(Boolean),
      })
      .from(interviewRound)
      .innerJoin(application, eq(application.id, interviewRound.applicationId))
      .innerJoin(candidate, eq(candidate.id, application.candidateId))
      .innerJoin(job, eq(job.id, application.jobId))
      .where(where)
      .orderBy(
        ...(todo === "evaluation" ? [desc(interviewRound.endedAt)] : [asc(priority)]),
        asc(
          sql`case when ${interviewRound.status} = 'scheduled' then coalesce(${interviewRound.scheduledAt}, 9223372036854775807) end`,
        ),
        desc(interviewRound.createdAt),
        desc(interviewRound.id),
      )
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)` })
      .from(interviewRound)
      .innerJoin(application, eq(application.id, interviewRound.applicationId))
      .where(where),
  ]);
  const joinWindow = now.getTime() + 15 * 60_000;
  return {
    page,
    pageSize,
    rows: rows.map((row) => ({
      ...row,
      canJoinNow:
        row.canJoin &&
        (row.status === "in_progress" ||
          (row.scheduledAt !== null && row.scheduledAt.getTime() <= joinWindow)),
    })),
    total: count.total,
    version: 1 as const,
  };
}
