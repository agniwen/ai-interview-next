import { foreignKey, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { InterviewEvaluationDraft } from "../interview-evaluation";
import { interviewRound } from "./ats";
import { user } from "./auth";

/** 原始 AI 评价与人工修订分开保存，确认不会覆盖模型的原始结论。
 * Store original AI evaluations separately from human revisions so confirmation preserves the model's original verdict. */
export const interviewEvaluationReport = sqliteTable(
  "interview_evaluation_report",
  {
    content: text("content", { mode: "json" }).$type<InterviewEvaluationDraft>(),
    interviewRoundId: text("interviewRoundId").primaryKey(),
    status: text("status", { enum: ["generating", "ready", "failed"] }).notNull(),
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

/** 每位指定人员的草稿与正式评价；submittedAt 非空后锁定。
 * Each assignee's draft and formal evaluation, locked once submittedAt is set. */
export const interviewEvaluation = sqliteTable(
  "interview_evaluation",
  {
    authorUserId: text("authorUserId")
      .notNull()
      .references(() => user.id),
    content: text("content", { mode: "json" }).$type<InterviewEvaluationDraft>().notNull(),
    interviewRoundId: text("interviewRoundId").notNull(),
    submittedAt: integer("submittedAt", { mode: "timestamp_ms" }),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    workspaceId: text("workspaceId").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.interviewRoundId, table.authorUserId] }),
    foreignKey({
      columns: [table.workspaceId, table.interviewRoundId],
      foreignColumns: [interviewRound.workspaceId, interviewRound.id],
    }).onDelete("cascade"),
  ],
);
