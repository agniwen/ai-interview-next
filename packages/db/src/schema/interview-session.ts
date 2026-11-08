import type { InterviewEventContent, InterviewPlan, InterviewProgress } from "../interview-report";
import {
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import type { InterviewSessionSnapshot } from "../interview-session";
import { interviewRound } from "./ats";

/** 每轮的固定上下文与服务端房间映射；上下文凭证不会发送给候选人。
 * Frozen per-round context and server-owned room mapping; context credentials are never sent to candidates. */
export const interviewSession = sqliteTable(
  "interview_session",
  {
    capturedAt: integer("capturedAt", { mode: "timestamp_ms" }).notNull(),
    content: text("content", { mode: "json" }).$type<InterviewSessionSnapshot>().notNull(),
    contextToken: text("contextToken").notNull(),
    interviewRoundId: text("interviewRoundId").primaryKey(),
    roomName: text("roomName").notNull(),
    workspaceId: text("workspaceId").notNull(),
  },
  (table) => [
    uniqueIndex("interview_session_room_uq").on(table.roomName),
    foreignKey({
      columns: [table.workspaceId, table.interviewRoundId],
      foreignColumns: [interviewRound.workspaceId, interviewRound.id],
    }).onDelete("cascade"),
  ],
);

/** 采集账本独立于模型上下文，截断历史不会删除已保存的面试结果。
 * The collection ledger is independent of model context, so history truncation never deletes saved results. */
export const interviewReport = sqliteTable(
  "interview_report",
  {
    interviewRoundId: text("interviewRoundId").primaryKey(),
    plan: text("plan", { mode: "json" }).$type<InterviewPlan>().notNull(),
    progress: text("progress", { mode: "json" }).$type<InterviewProgress>().notNull(),
    revision: integer("revision").notNull().default(0),
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

/** 保存已提交的对话消息，原文证据通过消息 ID 引用，不随摘要改写。
 * Store committed conversation messages; evidence references message IDs independently of summary revisions. */
export const interviewTranscript = sqliteTable(
  "interview_transcript",
  {
    at: integer("at").notNull(),
    id: text("id").notNull(),
    interrupted: integer("interrupted", { mode: "boolean" }).notNull(),
    interviewRoundId: text("interviewRoundId")
      .notNull()
      .references(() => interviewRound.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    text: text("text").notNull(),
  },
  (table) => [primaryKey({ columns: [table.interviewRoundId, table.id] })],
);

/** 连接与结束分别留痕；source 由认证入口指定，浏览器不能伪造系统结束。
 * Connection and completion have distinct events; authenticated endpoints own the source, preventing client-forged completion. */
export const interviewEvent = sqliteTable(
  "interview_event",
  {
    at: integer("at").notNull(),
    content: text("content", { mode: "json" }).$type<InterviewEventContent>().notNull(),
    id: text("id").notNull(),
    interviewRoundId: text("interviewRoundId")
      .notNull()
      .references(() => interviewRound.id, { onDelete: "cascade" }),
    receivedAt: integer("receivedAt", { mode: "timestamp_ms" }).notNull(),
    runId: text("runId").notNull(),
    source: text("source", { enum: ["candidate", "agent", "system"] }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.interviewRoundId, table.id] })],
);
