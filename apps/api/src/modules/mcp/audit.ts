import type { Database } from "@ai-interview/db";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { SQLiteColumn, SQLiteTable } from "drizzle-orm/sqlite-core";
import { agentOperation } from "@ai-interview/db/schema";
import type { AgentOperationSource } from "@ai-interview/db/schema";

export interface AgentActor {
  clientId?: string;
  grantId?: string;
  source: AgentOperationSource;
  userId: string;
  workspaceId: string;
}

export function operationAudit(
  db: Database,
  actor: AgentActor,
  tool: string,
  kind: "read" | "write",
) {
  const entry = { ...actor, calledAt: new Date(), id: crypto.randomUUID(), kind, tool };
  function save(detail: typeof agentOperation.$inferInsert.detail | SQL, changedAt?: Date | SQL) {
    return db.insert(agentOperation).values({ ...entry, changedAt, detail, outcome: "succeeded" });
  }
  return {
    edit(
      id: string,
      table: SQLiteTable,
      columns: Record<string, SQLiteColumn>,
      values: Record<string, unknown>,
      filter: SQL | undefined,
    ) {
      const fields = Object.keys(values).filter((field) => values[field] !== undefined);
      const before = sql`json_object(${sql.join(
        fields.flatMap((field) => [sql`${field}`, columns[field] as SQLiteColumn]),
        sql`, `,
      )})`;
      const changes = sql`(select json_group_object(next.key, json_object('before', previous.value, 'after', next.value))
        from json_each(${before}) previous join json_each(${JSON.stringify(values)}) next on previous.key = next.key
        where previous.value is not next.value)`;
      // 在批次内先读取旧值，再应用更新，使并发编辑各自记录实际变更。 / Capture old values before the update in the same batch so concurrent edits each record their actual change.
      return save(
        sql`(select json_object('version', 1, 'id', ${id}, 'changes', json(${changes})) from ${table} where ${filter})`,
        sql`(select case when ${changes} <> '{}' then cast(unixepoch('subsec') * 1000 as integer) end from ${table} where ${filter})`,
      );
    },
    async failure(error: string, outcome: "failed" | "denied") {
      await db.insert(agentOperation).values({ ...entry, detail: { error, version: 1 }, outcome });
    },
    source: actor.source,
    success(detail: Record<string, unknown>, changedAt?: Date) {
      return save({ ...detail, version: 1 }, changedAt);
    },
  };
}

export type OperationAudit = ReturnType<typeof operationAudit>;

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(after)
      .filter(([field, value]) => value !== undefined && before[field] !== value)
      .map(([field, value]) => [field, { after: value, before: before[field] ?? null }]),
  );
}
