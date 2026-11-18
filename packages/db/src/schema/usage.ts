import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { organization } from "./organization";

export const usageStages = [
  "resume_ocr",
  "resume_avatar",
  "resume_structure",
  "application_evaluation",
  "interview_realtime",
  "interview_reconciliation",
  "interview_evaluation",
] as const;

export const modelUsage = sqliteTable(
  "model_usage",
  {
    cachedInputTokens: integer("cachedInputTokens"),
    id: text("id").primaryKey(),
    inputAudioTokens: integer("inputAudioTokens"),
    inputTokens: integer("inputTokens"),
    interviewRoundId: text("interviewRoundId"),
    model: text("model").notNull(),
    occurredAt: integer("occurredAt", { mode: "timestamp_ms" }).notNull(),
    outputAudioTokens: integer("outputAudioTokens"),
    outputTokens: integer("outputTokens"),
    pages: integer("pages"),
    provider: text("provider", { enum: ["deepseek", "dashscope", "openai"] }).notNull(),
    requestId: text("requestId"),
    retry: integer("retry", { mode: "boolean" }).notNull(),
    stage: text("stage", { enum: usageStages }).notNull(),
    submissionId: text("submissionId").notNull(),
    userId: text("userId").notNull(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("model_usage_owner_time_idx").on(
      table.workspaceId,
      table.userId,
      table.occurredAt,
      table.id,
    ),
  ],
);
