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
