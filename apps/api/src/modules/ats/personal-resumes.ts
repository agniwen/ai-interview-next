import type { Database } from "@ai-interview/db";
import {
  application,
  applicationResume,
  candidate,
  resume,
  resumeProcessingRun as run,
  resumeSubmission as submission,
  resumeUploadBatch as batch,
  resumeUploadItem as item,
  user,
} from "@ai-interview/db/schema";
import { and, asc, eq, exists, inArray, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export const uploadCandidateJoin = eq(
  candidate.id,
  sql`case when ${batch.source} = 'external_import' then coalesce(${submission.resolvedCandidateId}, ${resume.candidateId}) else ${resume.candidateId} end`,
);

export function activeResumeRecruitment(db: Database, workspaceId: string) {
  return exists(
    db
      .select({ id: applicationResume.id })
      .from(applicationResume)
      .innerJoin(
        application,
        and(
          eq(application.id, applicationResume.applicationId),
          eq(application.workspaceId, workspaceId),
        ),
      )
      .where(
        and(
          eq(applicationResume.workspaceId, workspaceId),
          eq(applicationResume.resumeId, resume.id),
          or(
            isNull(applicationResume.submissionId),
            eq(applicationResume.submissionId, submission.id),
          ),
          eq(applicationResume.status, "available"),
          isNull(application.closedAt),
          isNull(application.deletedAt),
        ),
      ),
  ).mapWith(Boolean);
}

export function actionableResume(status: SQL) {
  return or(
    eq(submission.identityStatus, "pending_review"),
    inArray(status, ["failed", "upload_failed"]),
  );
}

/** 按简历版本去重，未完成的上传保留自己的处理记录。
 * Deduplicate by resume version while keeping each unfinished upload actionable. */
export function personalResumeRows(db: Database, needsAttention: SQL, filters: SQL | undefined) {
  const ranked = db
    .select({
      id: item.id,
      position: sql<number>`row_number() over (
        partition by case when ${needsAttention} then ${item.id} else ${resume.id} end
        order by ${batch.createdAt} desc, ${item.id} desc
      )`.as("position"),
    })
    .from(item)
    .innerJoin(batch, eq(batch.id, item.batchId))
    .leftJoin(user, eq(user.id, batch.createdBy))
    .leftJoin(run, eq(run.id, item.runId))
    .leftJoin(submission, eq(submission.id, item.submissionId))
    .leftJoin(resume, eq(resume.id, submission.resumeId))
    .leftJoin(candidate, uploadCandidateJoin)
    .where(filters)
    .as("ranked_resume_uploads");
  return inArray(item.id, db.select({ id: ranked.id }).from(ranked).where(eq(ranked.position, 1)));
}

export function firstAcceptedResumeUpload(db: Database, selectedSubmission?: SQL) {
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
    .where(
      and(
        eq(submission.workspaceId, resume.workspaceId),
        eq(submission.resumeId, resume.id),
        selectedSubmission ? eq(submission.id, selectedSubmission) : undefined,
      ),
    )
    .orderBy(asc(submission.createdAt), asc(submission.id), asc(item.id))
    .limit(1);
}

export function applicationResumeUpload(db: Database) {
  const selected = db
    .select({ id: applicationResume.submissionId })
    .from(applicationResume)
    .where(
      and(
        eq(applicationResume.applicationId, application.id),
        eq(applicationResume.resumeId, resume.id),
      ),
    );
  return firstAcceptedResumeUpload(db, sql`coalesce((${selected}), ${submission.id})`);
}
