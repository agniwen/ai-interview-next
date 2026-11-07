import { z } from "zod";

const recommendation = z.enum([
  "not_recommended",
  "undecided",
  "recommended",
  "highly_recommended",
]);
const evidence = z.strictObject({
  content: z.string().min(1).max(1000),
  jobRequirement: z.string().min(1).max(1000),
  point: z.string().min(1).max(100),
  /** null 表示材料未提供证据，不等同于候选人不符合要求。 / Null means evidence is absent, not that the candidate fails the requirement. */
  resumeEvidence: z.string().max(1000).nullable(),
});

/** 模型输出在入口按当前格式校验，旧格式由数据库迁移处理。 / Validate model output against the current format at the boundary, with legacy formats handled by migrations. */
export const qualitativeEvaluationSchema = z.strictObject({
  conciseOverall: z.string().min(1).max(500),
  detailedOverall: z.strictObject({
    judgment: z.string().min(1).max(2000),
    matchingEvidence: z.array(evidence).max(8),
    risks: z.array(evidence).max(8),
  }),
  recommendationLevel: recommendation,
  version: z.literal(3),
});

export type QualitativeEvaluation = z.infer<typeof qualitativeEvaluationSchema>;
export type ApplicationEvaluationResult = QualitativeEvaluation;
