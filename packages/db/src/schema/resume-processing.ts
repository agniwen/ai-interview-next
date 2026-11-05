import { sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { application, applicationEvaluation, resume, resumeSubmission } from "./ats";
import { organization } from "./organization";

const workspace = () =>
  text("workspaceId")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" });
const time = (name: string) => integer(name, { mode: "timestamp_ms" });

/** 一次批量上传的工作区与发起人，进度由文件汇总。 / Tracks the workspace and uploader for a batch; progress is derived from its files. */
export const resumeUploadBatch = sqliteTable("resume_upload_batch", {
  createdAt: time("createdAt").notNull(),
  createdBy: text("createdBy").notNull(),
  id: text("id").primaryKey(),
  workspaceId: workspace(),
});

/** 单个文件的存储位置、上传状态及后续投递和解析运行。 / Tracks one file, its upload, and its downstream submission and parse run. */
export const resumeUploadItem = sqliteTable(
  "resume_upload_item",
  {
    batchId: text("batchId")
      .notNull()
      .references(() => resumeUploadBatch.id),
    filename: text("filename").notNull(),
    id: text("id").primaryKey(),
    objectKey: text("objectKey").notNull(),
    runId: text("runId"),
    size: integer("size").notNull(),
    status: text("status", { enum: ["waiting", "accepted", "upload_failed"] }).notNull(),
    submissionId: text("submissionId").references(() => resumeSubmission.id),
    workspaceId: workspace(),
  },
  (table) => [
    index("resume_upload_item_batch_idx").on(table.batchId),
    index("resume_upload_item_submission_idx").on(table.submissionId),
  ],
);

/** 解析或评价的业务状态，可在多次 Workflow 执行间保留。 / Durable business state for a parse or evaluation across Workflow executions. */
export const resumeProcessingRun = sqliteTable(
  "resume_processing_run",
  {
    applicationId: text("applicationId").references(() => application.id),
    createdAt: time("createdAt").notNull(),
    evaluationId: text("evaluationId").references(() => applicationEvaluation.id),
    executionId: text("executionId").notNull(),
    id: text("id").primaryKey(),
    jobRequirementsSnapshot: text("jobRequirementsSnapshot"),
    kind: text("kind", { enum: ["parse", "evaluate"] }).notNull(),
    resumeId: text("resumeId").references(() => resume.id),
    stage: text("stage", { enum: ["extract_text", "structure", "evaluate"] }).notNull(),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "skipped"],
    }).notNull(),
    uploadItemId: text("uploadItemId").references(() => resumeUploadItem.id),
    workspaceId: workspace(),
  },
  (table) => [
    uniqueIndex("resume_processing_run_canonical_uq")
      .on(table.resumeId)
      .where(sql`${table.kind} = 'parse' and ${table.resumeId} is not null`),
    index("resume_processing_run_application_idx").on(table.applicationId, table.createdAt),
  ],
);

/** 单次阶段执行及可重放的调用参数和失败诊断。 / One stage attempt, with reproducible call parameters and failure diagnostics. */
export const resumeProcessingAttempt = sqliteTable(
  "resume_processing_attempt",
  {
    createdAt: time("createdAt").notNull(),
    deadlineAt: time("deadlineAt"),
    error: text("error"),
    executionId: text("executionId").notNull(),
    finishedAt: time("finishedAt"),
    id: text("id").primaryKey(),
    ordinal: integer("ordinal").notNull(),
    parameters: text("parameters", { mode: "json" }).$type<{
      version: 1;
      input: string;
      model: string;
      endpoint?: string;
      promptVersion: number;
      timeoutMs: number;
      temperature?: number;
      maxTokens?: number;
    }>(),
    providerRequestId: text("providerRequestId"),
    retryAfterAt: time("retryAfterAt"),
    retryable: integer("retryable", { mode: "boolean" }).notNull().default(false),
    runId: text("runId")
      .notNull()
      .references(() => resumeProcessingRun.id, { onDelete: "cascade" }),
    stage: text("stage", { enum: ["extract_text", "structure", "evaluate"] }).notNull(),
    startedAt: time("startedAt"),
    status: text("status", {
      enum: ["queued", "running", "succeeded", "failed", "skipped"],
    }).notNull(),
  },
  (table) => [index("resume_processing_attempt_run_idx").on(table.runId, table.createdAt)],
);

/** 同事务登记待派发的工作流、队列和完成通知。 / Records workflow starts, queue dispatches and completion notices in the same transaction. */
export const resumeProcessingOutbox = sqliteTable(
  "resume_processing_outbox",
  {
    attemptId: text("attemptId").references(() => resumeProcessingAttempt.id, {
      onDelete: "cascade",
    }),
    availableAt: time("availableAt").notNull(),
    executionId: text("executionId").notNull(),
    id: text("id").primaryKey(),
    runId: text("runId")
      .notNull()
      .references(() => resumeProcessingRun.id, { onDelete: "cascade" }),
    sentAt: time("sentAt"),
    topic: text("topic", { enum: ["start", "stage", "finished"] }).notNull(),
  },
  (table) => [index("resume_processing_outbox_pending_idx").on(table.sentAt, table.availableAt)],
);

/** 应聘变更历史，包含发起人和版本化的业务结果。 / Application history with the actor and versioned business outcome. */
export const applicationActivity = sqliteTable(
  "application_activity",
  {
    action: text("action", { enum: ["closed"] }).notNull(),
    actorId: text("actorId").notNull(),
    actorType: text("actorType", { enum: ["user", "system"] }).notNull(),
    applicationId: text("applicationId").notNull(),
    id: text("id").primaryKey(),
    occurredAt: time("occurredAt").notNull(),
    result: text("result", { mode: "json" })
      .$type<{
        version: 1;
        outcome: string;
        reason: string;
        nextApplicationId?: string;
      }>()
      .notNull(),
    workspaceId: workspace(),
  },
  (table) => [
    foreignKey({
      columns: [table.workspaceId, table.applicationId],
      foreignColumns: [application.workspaceId, application.id],
    }),
    index("application_activity_timeline_idx").on(
      table.workspaceId,
      table.applicationId,
      table.occurredAt,
    ),
  ],
);
