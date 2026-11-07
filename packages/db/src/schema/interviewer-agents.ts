import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { organization } from "./organization";

/** 工作区内可编辑的面试官模板，不代表某轮面试实际采用的配置快照。
 * An editable workspace interviewer template, not the configuration snapshot used by an interview round. */
export const interviewerAgent = sqliteTable(
  "interviewer_agent",
  {
    createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull(),
    /** 创建人取自登录会话，其他成员编辑时保留原创建人。 / Creator comes from the session and is preserved when another member edits. */
    createdBy: text("createdBy")
      .notNull()
      .references(() => user.id),
    /** 供招聘人员识别用途的说明，与主持提示词分开保存。 / Recruiter-facing purpose, stored separately from the hosting prompt. */
    description: text("description").notNull().default(""),
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    /** 定义主持方式；具体题目由每轮面试另行选择。 / Defines hosting behavior; each interview round selects its questions separately. */
    prompt: text("prompt").notNull(),
    updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull(),
    /** 配置由所属工作区成员共同管理，读取和编辑均限定工作区。 / Workspace members share this configuration; reads and edits are workspace-scoped. */
    workspaceId: text("workspaceId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("interviewer_agent_workspace_created_idx").on(
      table.workspaceId,
      table.createdAt,
      table.id,
    ),
  ],
);
