import type { FormSetContent, QuestionSetInput } from "./client";

export type FormQuestionType = FormSetContent["questions"][number]["type"];
export interface DraftOption {
  key: string;
  value: string;
}
export interface DraftQuestion {
  key: string;
  content: string;
  description: string;
  type: FormQuestionType;
  options: DraftOption[];
}

export function newOption(): DraftOption {
  return { key: crypto.randomUUID(), value: "" };
}

export function newQuestion(): DraftQuestion {
  return { content: "", description: "", key: crypto.randomUUID(), options: [], type: "text" };
}

/** 本地 key 在排序时保持编辑器身份，提交时剥离；服务端以数组顺序保存内容。
 * Local keys preserve editor identity while reordering and are stripped on submit; the server stores array order. */
export function questionDrafts(content: FormSetContent): DraftQuestion[] {
  return content.questions.map((question) => ({
    content: question.content,
    description: question.description ?? "",
    key: crypto.randomUUID(),
    options:
      question.type === "text"
        ? []
        : question.options.map((value) => ({ key: crypto.randomUUID(), value })),
    type: question.type,
  }));
}

export function changeQuestionType(question: DraftQuestion, type: FormQuestionType): DraftQuestion {
  return {
    ...question,
    // 临时切到填写题时保留选项草稿，切回来继续编辑；填写题提交时不携带选项。
    // Keep option drafts when temporarily switching to text; text submissions omit options.
    options:
      type !== "text" && question.options.length === 0
        ? [newOption(), newOption()]
        : question.options,
    type,
  };
}

export function questionIsComplete(question: DraftQuestion): boolean {
  return (
    Boolean(question.content.trim()) &&
    question.content.length <= 1000 &&
    question.description.length <= 500 &&
    (question.type === "text" || question.options.every((option) => Boolean(option.value.trim())))
  );
}

export function formSetInput(
  name: string,
  description: string,
  questions: DraftQuestion[],
): QuestionSetInput {
  return {
    content: {
      kind: "form",
      questions: questions.map(({ content, description: help, type, options }) =>
        type === "text"
          ? { content, description: help, type }
          : { content, description: help, options: options.map((option) => option.value), type },
      ),
      version: 1,
    },
    description,
    name,
    version: 1,
  };
}
