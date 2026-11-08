import { z } from "zod";

const orderedIds = z.array(z.uuid()).refine((ids) => new Set(ids).size === ids.length);
const common = {
  label: z.string().trim().max(200).default(""),
  version: z.literal(1),
};

/** 数组顺序即本轮选题顺序；时间以带时区的 ISO 字符串提交。
 * Array order is the round's selection order; times are submitted as timezone-aware ISO strings. */
export const createInterviewInput = z
  .discriminatedUnion("kind", [
    z.strictObject({
      ...common,
      confirmationUserId: z.string().trim().min(1).optional(),
      conversationQuestionSetIds: orderedIds.refine((ids) => ids.length > 0),
      formQuestionSetIds: orderedIds.default([]),
      interviewerAgentId: z.uuid(),
      kind: z.literal("ai"),
    }),
    z.strictObject({
      ...common,
      admissionDeadline: z.iso.datetime({ offset: true }),
      interviewerUserIds: z
        .array(z.string().trim().min(1))
        .min(1)
        .refine((ids) => new Set(ids).size === ids.length),
      kind: z.literal("human"),
      scheduledAt: z.iso.datetime({ offset: true }),
    }),
  ])
  .refine(
    (input) =>
      input.kind === "ai" || Date.parse(input.admissionDeadline) > Date.parse(input.scheduledAt),
    {
      message: "Admission deadline must follow the scheduled start",
      path: ["admissionDeadline"],
    },
  );

export type CreateInterviewInput = z.output<typeof createInterviewInput>;

export const updateInterviewInput = createInterviewInput;
