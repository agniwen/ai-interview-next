export const RESUME_REVIEW_DIMENSIONS: {
  checklist: readonly string[];
  key:
    | "skillMatch"
    | "experienceRelevance"
    | "projectMatch"
    | "educationBackground"
    | "potential"
    | "stability";
  label: string;
  weight: number;
}[] = [
  {
    checklist: [
      "JD 核心技能与候选人技能是否语义匹配",
      "候选人是否在工作或项目中实际使用过这些技能",
      "是否覆盖必备技术栈而不是仅有相邻关键词",
    ],
    key: "skillMatch",
    label: "技能匹配度",
    weight: 0.35,
  },
  {
    checklist: [
      "行业背景或业务领域是否与岗位相关",
      "职责范围和岗位层级是否吻合",
      "技术栈、业务场景、团队环境是否具备迁移价值",
    ],
    key: "experienceRelevance",
    label: "经验相关性",
    weight: 0.25,
  },
  {
    checklist: [
      "关键项目复杂度是否对应岗位要求",
      "候选人在项目中的角色和职责是否清楚",
      "项目成果是否能支撑岗位胜任判断",
    ],
    key: "projectMatch",
    label: "项目匹配度",
    weight: 0.15,
  },
  {
    checklist: [
      "学历层次是否符合岗位预期",
      "专业方向是否与岗位相关",
      "教育背景是否补强岗位匹配判断",
    ],
    key: "educationBackground",
    label: "学历/背景",
    weight: 0.1,
  },
  {
    checklist: [
      "成长曲线是否清晰",
      "技术或业务广度是否支持后续发展",
      "是否体现学习能力和承担更复杂任务的潜力",
    ],
    key: "potential",
    label: "潜力评估",
    weight: 0.08,
  },
  {
    checklist: ["平均在职时长是否合理", "跳槽频率是否存在风险", "职业路径是否连贯且解释充分"],
    key: "stability",
    label: "稳定性评估",
    weight: 0.07,
  },
];
