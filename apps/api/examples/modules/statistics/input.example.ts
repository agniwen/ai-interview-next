import { z } from "zod";

export const statisticsQuery = z.strictObject({
  verifiedOnly: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

export type StatisticsInput = z.output<typeof statisticsQuery>;
