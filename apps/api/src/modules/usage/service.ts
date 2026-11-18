import type { Database } from "@ai-interview/db";
import type { interviewSession } from "@ai-interview/db/schema";
import {
  modelUsage,
  resumeSubmission,
  resumeUploadBatch,
  resumeUploadItem,
} from "@ai-interview/db/schema";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import type { UsageCall } from "./capture";
import type { UsageQuery } from "./input";

export function usageOwner(db: Database, workspaceId: string, submissionId: string) {
  return db
    .select({
      submissionId: resumeSubmission.id,
      userId: resumeUploadBatch.createdBy,
      workspaceId: resumeSubmission.workspaceId,
    })
    .from(resumeSubmission)
    .innerJoin(
      resumeUploadItem,
      and(
        eq(resumeUploadItem.workspaceId, resumeSubmission.workspaceId),
        eq(resumeUploadItem.submissionId, resumeSubmission.id),
      ),
    )
    .innerJoin(
      resumeUploadBatch,
      and(
        eq(resumeUploadBatch.workspaceId, resumeSubmission.workspaceId),
        eq(resumeUploadBatch.id, resumeUploadItem.batchId),
      ),
    )
    .where(
      and(eq(resumeSubmission.workspaceId, workspaceId), eq(resumeSubmission.id, submissionId)),
    )
    .get();
}

export function interviewUsageOwner(
  db: Database,
  workspaceId: string,
  snapshot: typeof interviewSession.$inferSelect.content,
) {
  const submissionId = snapshot.resumes[0]?.submissionId;
  return submissionId && snapshot.resumes.length === 1
    ? usageOwner(db, workspaceId, submissionId)
    : undefined;
}

type UsageOwner = NonNullable<Awaited<ReturnType<typeof usageOwner>>>;

export function insertUsage(
  db: Database,
  owner: UsageOwner,
  calls: (UsageCall & { id: string })[],
  interviewRoundId?: string,
) {
  return db
    .insert(modelUsage)
    .values(
      calls.map((call) => ({
        ...call,
        ...owner,
        interviewRoundId,
      })),
    )
    .onConflictDoNothing();
}

export async function listMyUsage(
  db: Database,
  workspaceId: string,
  userId: string,
  { model, page, pageSize, period, stage, status }: UsageQuery,
) {
  const owned = and(eq(modelUsage.workspaceId, workspaceId), eq(modelUsage.userId, userId));
  const filtered = and(
    owned,
    model ? eq(modelUsage.model, model) : undefined,
    stage ? eq(modelUsage.stage, stage) : undefined,
    status ? eq(modelUsage.retry, status === "retry") : undefined,
    period
      ? gte(modelUsage.occurredAt, new Date(Date.now() - Number(period.slice(0, -1)) * 86_400_000))
      : undefined,
  );
  const [rows, total, groups, models] = await db.batch([
    db
      .select({
        cachedInputTokens: modelUsage.cachedInputTokens,
        filename: resumeSubmission.originalFilename,
        id: modelUsage.id,
        inputAudioTokens: modelUsage.inputAudioTokens,
        inputTokens: modelUsage.inputTokens,
        model: modelUsage.model,
        occurredAt: modelUsage.occurredAt,
        outputAudioTokens: modelUsage.outputAudioTokens,
        outputTokens: modelUsage.outputTokens,
        pages: modelUsage.pages,
        provider: modelUsage.provider,
        retry: modelUsage.retry,
        stage: modelUsage.stage,
      })
      .from(modelUsage)
      .leftJoin(
        resumeSubmission,
        and(
          eq(resumeSubmission.id, modelUsage.submissionId),
          eq(resumeSubmission.workspaceId, modelUsage.workspaceId),
        ),
      )
      .where(filtered)
      .orderBy(desc(modelUsage.occurredAt), desc(modelUsage.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ count: count() }).from(modelUsage).where(filtered),
    db
      .select({
        model: modelUsage.model,
        pages: sql<number>`coalesce(sum(${modelUsage.pages}), 0)`.mapWith(Number),
        provider: modelUsage.provider,
        retry: modelUsage.retry,
        stage: modelUsage.stage,
        tokens:
          sql<number>`coalesce(sum(coalesce(${modelUsage.inputTokens}, 0) + coalesce(${modelUsage.outputTokens}, 0)), 0)`.mapWith(
            Number,
          ),
      })
      .from(modelUsage)
      .where(filtered)
      .groupBy(modelUsage.stage, modelUsage.provider, modelUsage.model, modelUsage.retry)
      .orderBy(modelUsage.stage, modelUsage.provider, modelUsage.model),
    db
      .selectDistinct({ model: modelUsage.model })
      .from(modelUsage)
      .where(owned)
      .orderBy(modelUsage.model),
  ]);
  const normal = { pages: 0, tokens: 0 };
  const retry = { pages: 0, tokens: 0 };
  for (const group of groups) {
    const subtotal = group.retry ? retry : normal;
    subtotal.pages += group.pages;
    subtotal.tokens += group.tokens;
  }
  return {
    models: models.map(({ model: name }) => name),
    page,
    pageSize,
    rows,
    summary: {
      breakdown: groups,
      normal,
      retry,
      total: { pages: normal.pages + retry.pages, tokens: normal.tokens + retry.tokens },
      version: 1 as const,
    },
    total: total[0]?.count ?? 0,
    version: 1 as const,
  };
}
