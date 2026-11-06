import { readFileSync, readdirSync } from "node:fs";
import { createDatabase } from "@ai-interview/db";
import { getPlatformProxy } from "wrangler";
import type { ApiBindings } from "../src/env";

export async function createTestDatabase() {
  const platform = await getPlatformProxy<ApiBindings>({
    configPath: "wrangler.jsonc",
    persist: false,
    remoteBindings: false,
  });
  const directory = new URL("../../../packages/db/migrations/", import.meta.url);
  const statements = readdirSync(directory)
    .filter((name) => name.endsWith(".sql"))
    .toSorted()
    .flatMap((file) => readFileSync(new URL(file, directory), "utf-8").split(";"))
    .map((statement) => statement.trim())
    .filter(Boolean);
  await platform.env.AUTH_DB.batch(
    statements.map((statement) => platform.env.AUTH_DB.prepare(statement)),
  );
  return {
    ctx: platform.ctx,
    database: createDatabase(platform.env.AUTH_DB),
    dispose: () => platform.dispose(),
    env: platform.env,
  };
}
