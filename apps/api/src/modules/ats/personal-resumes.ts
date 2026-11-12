import type { Database } from "@ai-interview/db";
import {
  candidate,
  resume,
  resumeProcessingRun as run,
  resumeSubmission as submission,
  resumeUploadBatch as batch,
  resumeUploadItem as item,
  user,
} from "@ai-interview/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

export const uploadCandidateJoin = eq(
  candidate.id,
  sql`case when ${batch.source} = 'external_import' then coalesce(${submission.resolvedCandidateId}, ${resume.candidateId}) else ${resume.candidateId} end`,
);

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
