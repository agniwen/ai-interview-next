import { createDatabase } from "@ai-interview/db";
import { getUserStatistics } from "../modules/statistics/service.example";
import type { ApiBindings } from "../../src/env";

export function runStatisticsJob(env: Pick<ApiBindings, "AUTH_DB">) {
  return getUserStatistics(createDatabase(env.AUTH_DB), { verifiedOnly: false });
}
