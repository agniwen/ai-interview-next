import { readFileSync, readdirSync } from "node:fs";
import { createDatabase } from "@ai-interview/db";
import { getPlatformProxy } from "wrangler";
import type { ApiBindings } from "../src/env";

export async function migrateTestDatabase(
  database: ApiBindings["AUTH_DB"],
  after = "",
  through = "~",
) {
  const directory = new URL("../../../packages/db/migrations/", import.meta.url);
  const statements = readdirSync(directory)
    .filter((name) => name.endsWith(".sql") && name > after && name <= through)
    .toSorted()
    .flatMap((file) => readFileSync(new URL(file, directory), "utf-8").split(";"))
    .map((statement) => statement.trim())
    .filter(Boolean);
  await database.batch(statements.map((statement) => database.prepare(statement)));
}

export async function createTestDatabase(throughMigration = "~") {
  const platform = await getPlatformProxy<ApiBindings>({
    configPath: "wrangler.jsonc",
    persist: false,
    remoteBindings: false,
  });
  await migrateTestDatabase(platform.env.AUTH_DB, "", throughMigration);
  return {
    ctx: platform.ctx,
    database: createDatabase(platform.env.AUTH_DB),
    dispose: () => platform.dispose(),
    env: platform.env,
  };
}
