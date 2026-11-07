import type { QuestionSetContent } from "./question-set";

type FormQuestion = Extract<QuestionSetContent, { kind: "form" }>["questions"][number];
type ConversationQuestion = Extract<
  QuestionSetContent,
  { kind: "conversation" }
>["questions"][number];

interface QuestionSource {
  id: string;
  questionSetId: string;
  questionIndex: number;
}

/** 首次进入时固定内容与顺序；每题的独立 ID 用于后续作答与访谈进度。
 * Freeze content and order on first entry; independent question IDs identify later answers and interview progress. */
export interface InterviewQuestions {
  version: 1;
  form: (QuestionSource & { question: FormQuestion })[];
  conversation: (QuestionSource & { question: ConversationQuestion })[];
}
