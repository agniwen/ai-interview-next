import type { ConversationSetContent, QuestionSetInput } from "./client";

export interface ConversationQuestionDraft {
  key: string;
  content: string;
  difficulty: ConversationSetContent["questions"][number]["difficulty"];
  evaluationFocus: string;
  followUpDirections: string;
  evaluationCriteria: string;
}

export function newConversationQuestion(): ConversationQuestionDraft {
  return {
    content: "",
    difficulty: "medium",
    evaluationCriteria: "",
    evaluationFocus: "",
    followUpDirections: "",
    key: crypto.randomUUID(),
  };
}

export function conversationDrafts(content: ConversationSetContent): ConversationQuestionDraft[] {
  return content.questions.map((question) => ({
    ...question,
    evaluationCriteria: question.evaluationCriteria ?? "",
    evaluationFocus: question.evaluationFocus ?? "",
    followUpDirections: question.followUpDirections ?? "",
    key: crypto.randomUUID(),
  }));
}

export function conversationIsComplete(question: ConversationQuestionDraft): boolean {
  return (
    Boolean(question.content.trim()) &&
    question.content.length <= 1000 &&
    question.evaluationFocus.length <= 500 &&
    question.followUpDirections.length <= 1000 &&
    question.evaluationCriteria.length <= 2000
  );
}

/** 草稿 key 只用于保持编辑器身份；按当前顺序提交业务字段。
 * Draft keys only preserve editor identity; submit business fields in their current order. */
export function conversationSetInput(
  name: string,
  description: string,
  questions: ConversationQuestionDraft[],
): QuestionSetInput {
  return {
    content: {
      kind: "conversation",
      questions: questions.map(
        ({ content, difficulty, evaluationFocus, followUpDirections, evaluationCriteria }) => ({
          content,
          difficulty,
          evaluationCriteria,
          evaluationFocus,
          followUpDirections,
        }),
      ),
      version: 1,
    },
    description,
    name,
    version: 1,
  };
}
