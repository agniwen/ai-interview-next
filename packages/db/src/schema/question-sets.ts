import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { QuestionSetContent } from "../question-set";
import { job } from "./ats";
import { user } from "./auth";
import { organization } from "./organization";

/** 工作区内可编辑的题套；面试首次进入时另行生成快照，不直接引用可变题目。
 * An editable workspace question set; first interview entry will snapshot its content separately. */
export const questionSet = sqliteTable(
  "question_set",
  {
    /** 整套内容一次写入，题目与选项保留数组顺序；格式在 HTTP 入口校验。
     * Write the whole set at once, preserving question and option array order; validate the format at the HTTP boundary. */
    content: text("content", { mode: "json" }).$type<QuestionSetContent>().notNull(),
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 创建人来自会话，其他成员编辑不改变归属记录。 / Creator comes from the session and remains unchanged when another member edits. */
    createdBy: text("createdBy")
      .notNull()
      .references(() => user.id),
    defaultAllJobs: integer("defaultAllJobs", { mode: "boolean" }).notNull().default(false),
    description: text("description").notNull().default(""),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("question_set_workspace_created_idx").on(table.workspaceId, table.createdAt, table.id),
  ],
);

/** 默认岗位只提供选题初始值，不限制题套的使用范围。
 * Default jobs seed question selection without restricting where sets can be used. */
export const questionSetJob = sqliteTable(
  "question_set_job",
  {
    jobId: text("jobId")
      .notNull()
      .references(() => job.id, { onDelete: "cascade" }),
    questionSetId: text("questionSetId")
      .notNull()
      .references(() => questionSet.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.questionSetId, table.jobId] }),
    index("question_set_job_job_idx").on(table.jobId),
  ],
);
