import { user } from "@ai-interview/db/schema";
import { count, eq } from "drizzle-orm";
import type { Database } from "@ai-interview/db";
import type { StatisticsInput } from "./input.example";

export async function getUserStatistics(database: Database, input: StatisticsInput) {
  const [statistics] = await database
    .select({ users: count() })
    .from(user)
    .where(input.verifiedOnly ? eq(user.emailVerified, true) : undefined);
  return statistics;
}
