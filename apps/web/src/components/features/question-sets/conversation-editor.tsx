import type { ConversationSetContent } from "./client";
import {
  conversationDrafts,
  conversationIsComplete,
  conversationSetInput,
  newConversationQuestion,
} from "./conversation-draft";
import type { ConversationQuestionDraft } from "./conversation-draft";
import { ConversationFields, difficultyLabel } from "./conversation-fields";
import { QuestionSetEditor } from "./set-editor";
import type { QuestionEditorConfig, QuestionSetEditorProps } from "./set-editor";

const config: QuestionEditorConfig<ConversationSetContent, ConversationQuestionDraft> = {
  Fields: ConversationFields,
  create: newConversationQuestion,
  drafts: conversationDrafts,
  isComplete: conversationIsComplete,
  kind: "conversation",
  label: (question) => difficultyLabel(question.difficulty),
  toInput: conversationSetInput,
};

export function ConversationSetEditor(props: QuestionSetEditorProps<ConversationSetContent>) {
  return <QuestionSetEditor {...props} config={config} />;
}
