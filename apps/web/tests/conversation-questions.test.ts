import { expect, it } from "vitest";
import {
  conversationDrafts,
  conversationIsComplete,
  conversationSetInput,
  newConversationQuestion,
} from "../src/components/features/question-sets/conversation-draft";

it("preserves all guidance and difficulty after editing, removing and reordering repeated prompts", () => {
  const questions = conversationDrafts({
    kind: "conversation",
    questions: [
      { content: "介绍一次项目经历。", difficulty: "easy" },
      { content: "待删除", difficulty: "medium" },
      {
        content: "介绍一次项目经历。",
        difficulty: "hard",
        evaluationCriteria: "能清楚说明权衡和结果。",
        evaluationFocus: "**个人贡献**",
        followUpDirections: "- 为什么选择这个方案？",
      },
    ],
    version: 1,
  });
  expect(new Set(questions.map((question) => question.key)).size).toBe(3);
  const reordered = [questions[2], { ...questions[0], difficulty: "medium" as const }];
  const payload = conversationSetInput("项目经历", "**沟通提纲**", reordered);
  expect(payload).toEqual({
    content: {
      kind: "conversation",
      questions: [
        {
          content: "介绍一次项目经历。",
          difficulty: "hard",
          evaluationCriteria: "能清楚说明权衡和结果。",
          evaluationFocus: "**个人贡献**",
          followUpDirections: "- 为什么选择这个方案？",
        },
        {
          content: "介绍一次项目经历。",
          difficulty: "medium",
          evaluationCriteria: "",
          evaluationFocus: "",
          followUpDirections: "",
        },
      ],
      version: 1,
    },
    description: "**沟通提纲**",
    name: "项目经历",
    version: 1,
  });
  expect(questions[0].difficulty).toBe("easy");
  expect(conversationSetInput("空题套", "", []).content.questions).toEqual([]);
});

it("requires a prompt, defaults to medium and allows optional guidance within its limits", () => {
  const blank = newConversationQuestion();
  expect(blank.difficulty).toBe("medium");
  expect(conversationIsComplete(blank)).toBe(false);
  const complete = { ...blank, content: "介绍一次项目经历。" };
  expect(conversationIsComplete(complete)).toBe(true);
  expect(conversationIsComplete({ ...complete, content: "  " })).toBe(false);
  for (const [field, limit] of [
    ["content", 1000],
    ["evaluationFocus", 500],
    ["followUpDirections", 1000],
    ["evaluationCriteria", 2000],
  ] as const) {
    expect(conversationIsComplete({ ...complete, [field]: "x".repeat(limit) })).toBe(true);
    expect(conversationIsComplete({ ...complete, [field]: "x".repeat(limit + 1) })).toBe(false);
  }
});
