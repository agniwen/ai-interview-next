import type { Database } from "@ai-interview/db";
import type { QuestionSetKind } from "@ai-interview/db/question-set";
import { questionSet } from "@ai-interview/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { QuestionSetInput, QuestionSetListQuery } from "./input";

/** 列表只投影摘要；按 version 1 的内容结构读取类型与题数，不加载完整题目。
 * Project summaries only, reading kind and counts from the version 1 content format without loading full questions. */
export async function listQuestionSets(
  db: Database,
  workspaceId: string,
  { kind, page, pageSize, search }: QuestionSetListQuery,
) {
  const kindValue = sql<QuestionSetKind>`json_extract(${questionSet.content}, '$.kind')`;
  const where = and(
    eq(questionSet.workspaceId, workspaceId),
    kind ? eq(kindValue, kind) : undefined,
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
  return { page, pageSize, rows, total, version: 1 as const };
}

export function getQuestionSet(db: Database, workspaceId: string, id: string) {
  return db
    .select()
    .from(questionSet)
    .where(and(eq(questionSet.workspaceId, workspaceId), eq(questionSet.id, id)))
    .get();
}

/** 空题套可用于逐步编辑；是否能用于面试由创建面试的入口决定。
 * Empty sets support incremental editing; interview creation decides whether a set is usable. */
export async function createQuestionSet(
  db: Database,
  workspaceId: string,
  userId: string,
  { content, description, name }: QuestionSetInput,
) {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(questionSet).values({
    content,
    createdAt: now,
    createdBy: userId,
    description,
    id,
    name,
    updatedAt: now,
    workspaceId,
  });
  return { id, version: 1 as const };
}

/** 单条更新同时替换名称、内容和顺序，保留创建信息，并限定到已授权的工作区。
 * One update replaces metadata, content and order together, preserving creation details within the authorized workspace. */
export async function updateQuestionSet(
  db: Database,
  workspaceId: string,
  id: string,
  { content, description, name }: QuestionSetInput,
) {
  const [record] = await db
    .update(questionSet)
    .set({ content, description, name, updatedAt: new Date() })
    .where(and(eq(questionSet.workspaceId, workspaceId), eq(questionSet.id, id)))
    .returning({ id: questionSet.id });
  return record;
}
