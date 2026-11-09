import type { Database } from "@ai-interview/db";
import type { QuestionSetKind } from "@ai-interview/db/question-set";
import { job, questionSet, questionSetJob } from "@ai-interview/db/schema";
import { and, asc, desc, eq, exists, inArray, or, sql } from "drizzle-orm";
import type { QuestionSetInput, QuestionSetListQuery } from "./input";

export function questionSetMatchesJob(db: Database, jobId: string) {
  return or(
    eq(questionSet.defaultAllJobs, true),
    exists(
      db
        .select({ id: questionSetJob.jobId })
        .from(questionSetJob)
        .where(
          and(eq(questionSetJob.questionSetId, questionSet.id), eq(questionSetJob.jobId, jobId)),
        ),
    ),
  );
}

/** 列表只投影摘要；按 version 1 的内容结构读取类型与题数，不加载完整题目。
 * Project summaries only, reading kind and counts from the version 1 content format without loading full questions. */
export async function listQuestionSets(
  db: Database,
  workspaceId: string,
  { jobId, kind, page, pageSize, search }: QuestionSetListQuery,
) {
  const kindValue = sql<QuestionSetKind>`json_extract(${questionSet.content}, '$.kind')`;
  const where = and(
    eq(questionSet.workspaceId, workspaceId),
    kind ? eq(kindValue, kind) : undefined,
    jobId ? questionSetMatchesJob(db, jobId) : undefined,
    search
      ? or(
          sql`instr(lower(${questionSet.name}), lower(${search})) > 0`,
          sql`instr(lower(${questionSet.description}), lower(${search})) > 0`,
        )
      : undefined,
  );
  // 总数与分页共用权限和筛选条件，同时间记录以 ID 稳定排序。
  // Counts and pages share access and filter conditions, with ID breaking timestamp ties.
  const [rows, total] = await Promise.all([
    db
      .select({
        createdAt: questionSet.createdAt,
        createdBy: questionSet.createdBy,
        defaultAllJobs: questionSet.defaultAllJobs,
        description: questionSet.description,
        id: questionSet.id,
        kind: kindValue,
        name: questionSet.name,
        questionCount: sql<number>`json_array_length(${questionSet.content}, '$.questions')`,
        updatedAt: questionSet.updatedAt,
      })
      .from(questionSet)
      .where(where)
      .orderBy(desc(questionSet.createdAt), desc(questionSet.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.$count(questionSet, where),
  ]);
  const bindings = await db
    .select({ id: job.id, questionSetId: questionSetJob.questionSetId, title: job.title })
    .from(questionSetJob)
    .innerJoin(job, eq(job.id, questionSetJob.jobId))
    .where(
      inArray(
        questionSetJob.questionSetId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(job.title), asc(job.id));
  return {
    page,
    pageSize,
    rows: rows.map((row) => ({
      ...row,
      defaultJobs: bindings
        .filter((binding) => binding.questionSetId === row.id)
        .map(({ id, title }) => ({ id, title })),
    })),
    total,
    version: 1 as const,
  };
}

export async function getQuestionSet(db: Database, workspaceId: string, id: string) {
  const record = await db
    .select()
    .from(questionSet)
    .where(and(eq(questionSet.workspaceId, workspaceId), eq(questionSet.id, id)))
    .get();
  if (!record) {
    return;
  }
  const defaultJobs = await db
    .select({ id: job.id, title: job.title })
    .from(questionSetJob)
    .innerJoin(job, eq(job.id, questionSetJob.jobId))
    .where(eq(questionSetJob.questionSetId, id))
    .orderBy(asc(job.title), asc(job.id));
  return { ...record, defaultJobs };
}

async function jobsBelongToWorkspace(db: Database, workspaceId: string, ids: string[] = []) {
  if (ids.length === 0) {
    return true;
  }
  return (
    (await db.$count(job, and(eq(job.workspaceId, workspaceId), inArray(job.id, ids)))) ===
    ids.length
  );
}

/** 空题套可用于逐步编辑；是否能用于面试由创建面试的入口决定。
 * Empty sets support incremental editing; interview creation decides whether a set is usable. */
export async function createQuestionSet(
  db: Database,
  workspaceId: string,
  userId: string,
  { content, defaultAllJobs, defaultJobIds, description, name }: QuestionSetInput,
) {
  if (!(await jobsBelongToWorkspace(db, workspaceId, defaultJobIds))) {
    return { error: "JOB_UNAVAILABLE" as const, version: 1 as const };
  }
  const id = crypto.randomUUID();
  const now = new Date();
  const insert = db.insert(questionSet).values({
    content,
    createdAt: now,
    createdBy: userId,
    defaultAllJobs,
    description,
    id,
    name,
    updatedAt: now,
    workspaceId,
  });
  await db.batch([
    insert,
    ...(defaultJobIds ?? []).map((jobId) =>
      db.insert(questionSetJob).values({ jobId, questionSetId: id }),
    ),
  ]);
  return { id, version: 1 as const };
}

/** 题套和默认岗位在同一批次保存，避免部分写入。
 * Save the set and its default jobs in one batch to avoid partial writes. */
export async function updateQuestionSet(
  db: Database,
  workspaceId: string,
  id: string,
  { content, defaultAllJobs, defaultJobIds, description, name }: QuestionSetInput,
) {
  const record = await db
    .select({ id: questionSet.id })
    .from(questionSet)
    .where(and(eq(questionSet.workspaceId, workspaceId), eq(questionSet.id, id)))
    .get();
  if (!record) {
    return;
  }
  if (!(await jobsBelongToWorkspace(db, workspaceId, defaultJobIds))) {
    return { error: "JOB_UNAVAILABLE" as const, version: 1 as const };
  }
  await db.batch([
    db
      .update(questionSet)
      .set({ content, defaultAllJobs, description, name, updatedAt: new Date() })
      .where(eq(questionSet.id, id)),
    ...(defaultJobIds === undefined
      ? []
      : [
          db.delete(questionSetJob).where(eq(questionSetJob.questionSetId, id)),
          ...defaultJobIds.map((jobId) =>
            db.insert(questionSetJob).values({ jobId, questionSetId: id }),
          ),
        ]),
  ]);
  return record;
}
