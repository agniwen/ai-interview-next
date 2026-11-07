import type { Database } from "@ai-interview/db";
import { interviewerAgent } from "@ai-interview/db/schema";
import { and, desc, eq, or, sql } from "drizzle-orm";
import type { ListQuery } from "../ats/input";
import type { InterviewerAgentInput } from "./input";

/** 列表与总数共用工作区和搜索条件，列表省略长提示词，由详情按需读取。
 * Rows and totals share workspace and search filters; long prompts are loaded through detail requests. */
export async function listInterviewerAgents(
  db: Database,
  workspaceId: string,
  { page, pageSize, search }: ListQuery,
) {
  const where = and(
    eq(interviewerAgent.workspaceId, workspaceId),
    search
      ? or(
          sql`instr(lower(${interviewerAgent.name}), lower(${search})) > 0`,
          sql`instr(lower(${interviewerAgent.description}), lower(${search})) > 0`,
        )
      : undefined,
  );
  const [rows, total] = await Promise.all([
    db
      .select({
        createdAt: interviewerAgent.createdAt,
        createdBy: interviewerAgent.createdBy,
        description: interviewerAgent.description,
        id: interviewerAgent.id,
        name: interviewerAgent.name,
        updatedAt: interviewerAgent.updatedAt,
      })
      .from(interviewerAgent)
      .where(where)
      .orderBy(desc(interviewerAgent.createdAt), desc(interviewerAgent.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.$count(interviewerAgent, where),
  ]);
  return { page, pageSize, rows, total, version: 1 as const };
}

export function getInterviewerAgent(db: Database, workspaceId: string, id: string) {
  return db
    .select()
    .from(interviewerAgent)
    .where(and(eq(interviewerAgent.workspaceId, workspaceId), eq(interviewerAgent.id, id)))
    .get();
}

/** 工作区和创建人由入口的鉴权结果传入，不接受请求正文指定。
 * Workspace and creator come from the entry point's authenticated context, never the request body. */
export async function createInterviewerAgent(
  db: Database,
  workspaceId: string,
  userId: string,
  { description, name, prompt }: InterviewerAgentInput,
) {
  const id = crypto.randomUUID();
  const now = new Date();
  await db.insert(interviewerAgent).values({
    createdAt: now,
    createdBy: userId,
    description,
    id,
    name,
    prompt,
    updatedAt: now,
    workspaceId,
  });
  return { id, version: 1 as const };
}

/** 按工作区更新可复用模板，保留创建信息；省略说明时沿用原值。
 * Update the workspace's reusable template, preserving creation metadata and any omitted description. */
export async function updateInterviewerAgent(
  db: Database,
  workspaceId: string,
  id: string,
  { description, name, prompt }: InterviewerAgentInput,
) {
  const [record] = await db
    .update(interviewerAgent)
    .set({ description, name, prompt, updatedAt: new Date() })
    .where(and(eq(interviewerAgent.workspaceId, workspaceId), eq(interviewerAgent.id, id)))
    .returning({ id: interviewerAgent.id });
  return record;
}
