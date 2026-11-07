import type { FormSetContent } from "./client";
import { formSetInput, newQuestion, questionDrafts, questionIsComplete } from "./form-draft";
import type { DraftQuestion } from "./form-draft";
import { QuestionFields, questionTypeLabel } from "./question-fields";
import { QuestionSetEditor } from "./set-editor";
import type { QuestionEditorConfig, QuestionSetEditorProps } from "./set-editor";

const config: QuestionEditorConfig<FormSetContent, DraftQuestion> = {
  Fields: QuestionFields,
  create: newQuestion,
  drafts: questionDrafts,
  isComplete: questionIsComplete,
  kind: "form",
  label: (question) => questionTypeLabel(question.type),
  toInput: formSetInput,
};

export function FormSetEditor(props: QuestionSetEditorProps<FormSetContent>) {
  return <QuestionSetEditor {...props} config={config} />;
}
