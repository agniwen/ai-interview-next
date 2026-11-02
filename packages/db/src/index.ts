import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { D1Database } from "@cloudflare/workers-types";

export function createDatabase(binding: D1Database) {
  return drizzle(binding, { schema });
}

export type Database = ReturnType<typeof createDatabase>;
