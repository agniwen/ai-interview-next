export const pipelineStageMeta = {
  ai_interview: { label: "AI 初面", tone: "warning" },
  background_check: { label: "背调", tone: "info" },
  closed: { label: "已结束", tone: "outline" },
  final_interview: { label: "终试", tone: "warning" },
  income_proof: { label: "流水提供", tone: "info" },
  offer: { label: "发 Offer", tone: "info" },
  onboarding: { label: "入职", tone: "success" },
  salary_negotiation: { label: "谈薪", tone: "info" },
  screening: { label: "简历筛选", tone: "outline" },
  second_interview: { label: "复试", tone: "warning" },
} as const;
export type PipelineStage = keyof typeof pipelineStageMeta;
