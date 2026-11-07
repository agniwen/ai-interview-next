import { foreignKey, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InterviewQuestions } from "../interview-questions";
import type { InterviewFormContent } from "../interview-form";
import { interviewRound } from "./ats";

/** 邀请凭证独立于轮次 ID，不随列表或详情返回。
 * Invitation credentials are separate from round IDs and excluded from lists and details. */
export const interviewInvitation = sqliteTable(
  "interview_invitation",
  {
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    interviewRoundId: text("interviewRoundId").notNull(),
    token: text("token").primaryKey(),
    workspaceId: text("workspaceId").notNull(),
  },
  (table) => [
    uniqueIndex("interview_invitation_round_uq").on(table.interviewRoundId),
    foreignKey({
      columns: [table.workspaceId, table.interviewRoundId],
      foreignColumns: [interviewRound.workspaceId, interviewRound.id],
    }).onDelete("cascade"),
  ],
);

export const interviewQuestionSnapshot = sqliteTable(
  "interview_question_snapshot",
  {
    capturedAt: integer("capturedAt", { mode: "timestamp_ms" }).notNull(),
    content: text("content", { mode: "json" }).$type<InterviewQuestions>().notNull(),
    interviewRoundId: text("interviewRoundId").primaryKey(),
    workspaceId: text("workspaceId").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.interviewRoundId],
      foreignColumns: [interviewRound.workspaceId, interviewRound.id],
    }).onDelete("cascade"),
  ],
);

/** 每轮保留当前表单草稿和提交时间；实际开始后由轮次状态锁定写入。
 * Each round stores its current form draft and submission time; round status locks writes after the actual start. */
export const interviewFormResponse = sqliteTable(
  "interview_form_response",
  {
    content: text("content", { mode: "json" }).$type<InterviewFormContent>().notNull(),
    interviewRoundId: text("interviewRoundId").primaryKey(),
    submittedAt: integer("submittedAt", { mode: "timestamp_ms" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    workspaceId: text("workspaceId").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.interviewRoundId],
      foreignColumns: [interviewRound.workspaceId, interviewRound.id],
    }).onDelete("cascade"),
  ],
);
