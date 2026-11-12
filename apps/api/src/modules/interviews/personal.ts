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
import { and, asc, desc, eq, exists, isNotNull, isNull, notExists, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { personalInterviewQuery } from "./input";

export async function listPersonalInterviews(
  db: Database,
  workspaceId: string,
  userId: string,
  { page, pageSize, role }: z.output<typeof personalInterviewQuery>,
) {
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
  const uploader = exists(uploaded);
  const needsEvaluation = and(
    interviewer,
    eq(interviewRound.status, "completed"),
    notExists(
      db
        .select({ id: interviewEvaluation.interviewRoundId })
        .from(interviewEvaluation)
        .where(
          and(
            eq(interviewEvaluation.workspaceId, workspaceId),
            eq(interviewEvaluation.interviewRoundId, interviewRound.id),
            eq(interviewEvaluation.authorUserId, userId),
            isNotNull(interviewEvaluation.submittedAt),
          ),
        ),
    ),
  );
  const where = and(
    eq(interviewRound.workspaceId, workspaceId),
    eq(application.workspaceId, workspaceId),
    isNull(application.deletedAt),
    { all: or(interviewer, uploader), interviewer, uploader }[role ?? "all"],
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
        asc(priority),
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
  return { page, pageSize, rows, total: count.total, version: 1 as const };
}
