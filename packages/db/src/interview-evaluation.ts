import { z } from "zod";

export const interviewConclusion = z.enum(["pass", "pending", "fail"]);

export const interviewEvaluationDraftSchema = z.strictObject({
  conclusion: interviewConclusion.nullable(),
  overall: z.string().trim().max(30_000),
  version: z.literal(1),
});

export const interviewEvaluationSchema = interviewEvaluationDraftSchema.extend({
  conclusion: interviewConclusion,
  overall: z.string().trim().min(1).max(30_000),
});

export const interviewAiEvaluationSchema = interviewEvaluationSchema.extend({
  conclusion: z.enum(["pass", "fail"]).nullable(),
});

export type InterviewEvaluationDraft = z.infer<typeof interviewEvaluationDraftSchema>;
export type InterviewEvaluationContent = z.infer<typeof interviewEvaluationSchema>;
export type InterviewAiEvaluation = z.infer<typeof interviewAiEvaluationSchema>;
