import { foreignKey, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { InterviewQuestions } from "../interview-questions";
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
