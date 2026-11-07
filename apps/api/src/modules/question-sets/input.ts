import { questionSetContentSchema, questionSetKind } from "@ai-interview/db/question-set";
import { z } from "zod";
import { listQuery } from "../ats/input";

export const questionSetListQuery = listQuery.extend({ kind: questionSetKind.optional() });

/** 每次提交完整题目内容；省略说明保留原值，空字符串清空说明。
 * Submit the complete question content each time; omitted descriptions preserve the original, while empty strings clear it. */
export const questionSetInput = z.strictObject({
  content: questionSetContentSchema,
  description: z.string().trim().max(30_000).optional(),
  name: z.string().trim().min(1).max(200),
  version: z.literal(1),
});

export type QuestionSetInput = z.output<typeof questionSetInput>;
export type QuestionSetListQuery = z.output<typeof questionSetListQuery>;
