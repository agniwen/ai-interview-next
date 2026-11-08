import { z } from "zod";

export const candidateInterviewParam = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/u) });

const choiceIndex = z.number().int().min(0).max(19);

export const candidateFormInput = z.strictObject({
  answers: z.record(
    z.uuid(),
    z.union([
      z.string().max(30_000),
      choiceIndex,
      z
        .array(choiceIndex)
        .max(20)
        .refine((values) => new Set(values).size === values.length),
      z.null(),
    ]),
  ),
  version: z.literal(1),
});

export type CandidateFormInput = z.output<typeof candidateFormInput>;

export const candidateStartInput = z.strictObject({ version: z.literal(1) });

export const candidateFeedbackInput = z.strictObject({
  comment: z.string().trim().max(3000),
  rating: z.number().int().min(1).max(5),
  version: z.literal(1),
});
