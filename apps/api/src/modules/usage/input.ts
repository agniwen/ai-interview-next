import { usageStages } from "@ai-interview/db/schema";
import { z } from "zod";
import { paginationQuery } from "../ats/input";

export const usageQuery = paginationQuery.extend({
  model: z.string().trim().min(1).max(200).optional(),
  period: z.enum(["7d", "30d", "90d"]).optional(),
  stage: z.enum(usageStages).optional(),
  status: z.enum(["normal", "retry"]).optional(),
});

export type UsageQuery = z.output<typeof usageQuery>;
