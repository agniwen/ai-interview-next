import { z } from "zod";

export const questionSetKind = z.enum(["form", "conversation"]);

const formQuestionFields = {
  content: z.string().trim().min(1).max(1000),
  description: z.string().trim().max(500).default(""),
};
const choices = z.array(z.string().trim().min(1).max(200)).min(2).max(20);

/** 表单题全部必填；题型决定是否需要选项，不提供 required 开关。
 * All form questions are required; their type determines options, with no required toggle. */
const formQuestion = z.discriminatedUnion("type", [
  z.strictObject({ ...formQuestionFields, options: choices, type: z.literal("single_choice") }),
  z.strictObject({ ...formQuestionFields, options: choices, type: z.literal("multiple_choice") }),
  z.strictObject({ ...formQuestionFields, type: z.literal("text") }),
]);

const conversationQuestion = z.strictObject({
  content: z.string().trim().min(1).max(1000),
  difficulty: z.enum(["easy", "medium", "hard"]),
  evaluationCriteria: z.string().trim().max(2000).default(""),
  evaluationFocus: z.string().trim().max(500).default(""),
  followUpDirections: z.string().trim().max(1000).default(""),
});

/** version 标识内容格式；questions 和 options 的数组位置就是顺序，不按题干去重。
 * Version identifies the content format; questions and options use array order without deduplicating prompts. */
export const questionSetContentSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("form"),
    questions: z.array(formQuestion).max(50),
    version: z.literal(1),
  }),
  z.strictObject({
    kind: z.literal("conversation"),
    questions: z.array(conversationQuestion).max(50),
    version: z.literal(1),
  }),
]);

export type QuestionSetContent = z.output<typeof questionSetContentSchema>;
export type QuestionSetKind = z.output<typeof questionSetKind>;
