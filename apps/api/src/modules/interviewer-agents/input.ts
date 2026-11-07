import { z } from "zod";

export const interviewerAgentInput = z.strictObject({
  /** 编辑时省略说明保留原值，空字符串表示清空。 / Omitted descriptions preserve the existing value on edits; an empty string clears it. */
  description: z.string().trim().max(30_000).optional(),
  name: z.string().trim().min(1).max(200),
  prompt: z.string().trim().min(1).max(30_000),
  version: z.literal(1),
});

export type InterviewerAgentInput = z.output<typeof interviewerAgentInput>;
