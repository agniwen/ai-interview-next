import type { Database } from "@ai-interview/db";
import {
  member,
  user,
  questionSet,
  interviewerAgent,
  interviewQuestionSnapshot,
} from "@ai-interview/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { questionSetMatchesJob } from "../question-sets/service";
import type { ListQuery } from "../ats/input";
import { interviewApplication, editableInterview } from "./service";

/** 默认题套仅作为表单初始值，创建接口仍以用户最终选择为准。
 * Default sets only initialize the form; creation uses the user's final selections. */
export async function interviewSetup(
  db: Database,
  workspaceId: string,
  applicationId: string,
  userId: string,
) {
  const record = await interviewApplication(db, workspaceId, applicationId);
  if (!record) {
    return;
  }
  const [sets, reviewer] = await Promise.all([
    db
      .select({
        id: questionSet.id,
        kind: sql<"form" | "conversation">`json_extract(${questionSet.content}, '$.kind')`,
        name: questionSet.name,
        questionCount: sql<number>`json_array_length(${questionSet.content}, '$.questions')`,
      })
      .from(questionSet)
      .where(and(questionSetMatchesJob(db, record.jobId), eq(questionSet.workspaceId, workspaceId)))
      .orderBy(asc(questionSet.createdAt), asc(questionSet.id)),
    db
      .select({ email: user.email, id: user.id, image: user.image, name: user.name })
      .from(user)
      .where(eq(user.id, userId))
      .get(),
  ]);
  return { reviewer, sets, version: 1 as const };
}

export async function interviewMembers(
  db: Database,
  workspaceId: string,
  { page, pageSize, search }: ListQuery,
) {
  const where = and(
    eq(member.organizationId, workspaceId),
    search
      ? sql`(instr(lower(${user.name}), lower(${search})) > 0 or instr(lower(${user.email}), lower(${search})) > 0)`
      : undefined,
  );
  const [rows, counts] = await Promise.all([
    db
      .select({ email: user.email, id: user.id, image: user.image, name: user.name })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where)
      .orderBy(asc(user.name), asc(user.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db
      .select({ total: sql<number>`count(*)` })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(where),
  ]);
  return { page, pageSize, rows, total: counts[0].total, version: 1 as const };
}

export async function interviewEditSetup(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const result = await editableInterview(db, workspaceId, id, userId);
  if ("error" in result) {
    return result;
  }
  const { round } = result;
  const ids = [
    ...round.questionSelection.formQuestionSetIds,
    ...round.questionSelection.conversationQuestionSetIds,
  ];
  const [sets, agent, snapshot] = await Promise.all([
    db
      .select({
        id: questionSet.id,
        name: questionSet.name,
        questionCount: sql<number>`json_array_length(${questionSet.content}, '$.questions')`,
      })
      .from(questionSet)
      .where(and(eq(questionSet.workspaceId, workspaceId), inArray(questionSet.id, ids))),
    round.interviewerAgentId
      ? db
          .select({ id: interviewerAgent.id, name: interviewerAgent.name })
          .from(interviewerAgent)
          .where(
            and(
              eq(interviewerAgent.workspaceId, workspaceId),
              eq(interviewerAgent.id, round.interviewerAgentId),
            ),
          )
          .get()
      : undefined,
    round.questionsBoundAt
      ? db
          .select({ content: interviewQuestionSnapshot.content })
          .from(interviewQuestionSnapshot)
          .where(eq(interviewQuestionSnapshot.interviewRoundId, id))
          .get()
      : undefined,
  ]);
  if (snapshot) {
    const counts = new Map<string, number>();
    for (const question of [...snapshot.content.form, ...snapshot.content.conversation]) {
      counts.set(question.questionSetId, (counts.get(question.questionSetId) ?? 0) + 1);
    }
    for (const set of sets) {
      set.questionCount = counts.get(set.id) ?? 0;
    }
  }
  return { agent: agent ?? null, round, sets, version: 1 as const };
}
