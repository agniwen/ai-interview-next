import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth";
import { organization } from "./organization";
import { oauthClient } from "./oauth";

export const mcpGrant = sqliteTable(
  "mcp_grant",
  {
    clientId: text()
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    createdAt: integer({ mode: "timestamp_ms" }).notNull(),
    id: text().primaryKey(),
    revokedAt: integer({ mode: "timestamp_ms" }),
    scopes: text({ mode: "json" }).$type<{ version: 1; values: string[] }>().notNull(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    workspaceId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("mcp_grant_workspace_idx").on(table.workspaceId),
    index("mcp_grant_user_idx").on(table.userId),
  ],
);

export type AgentOperationSource = "remote_mcp" | "internal_agent";

export const agentOperation = sqliteTable(
  "agent_operation",
  {
    calledAt: integer({ mode: "timestamp_ms" }).notNull(),
    changedAt: integer({ mode: "timestamp_ms" }),
    clientId: text(),
    detail: text({ mode: "json" }).$type<{ version: 1 } & Record<string, unknown>>().notNull(),
    grantId: text(),
    id: text().primaryKey(),
    kind: text({ enum: ["read", "write"] }).notNull(),
    outcome: text({ enum: ["succeeded", "failed", "denied"] }).notNull(),
    source: text({ enum: ["remote_mcp", "internal_agent"] }).notNull(),
    tool: text().notNull(),
    userId: text().notNull(),
    workspaceId: text()
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
  },
  (table) => [index("agent_operation_workspace_called_idx").on(table.workspaceId, table.calledAt)],
);
