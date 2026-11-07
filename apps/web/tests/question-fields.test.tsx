import { ConversationFields } from "../src/components/features/question-sets/conversation-fields";
import { newConversationQuestion } from "../src/components/features/question-sets/conversation-draft";
import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { QuestionFields } from "../src/components/features/question-sets/question-fields";
import {
  changeQuestionType,
  newQuestion,
} from "../src/components/features/question-sets/form-draft";

it.each(["text", "single_choice", "multiple_choice"] as const)(
  "renders %s question fields with their required Base UI context",
  (type) => {
    const question = changeQuestionType(newQuestion(), type);
    expect(() =>
      renderToString(
        <QuestionFields question={question} number={1} disabled={false} onChange={() => {}} />,
      ),
    ).not.toThrow();
  },
);

it("renders conversation difficulty and guidance fields with their Base UI context", () => {
  const markup = renderToString(
    <ConversationFields
      question={newConversationQuestion()}
      disabled={false}
      onChange={() => {}}
    />,
  );
  expect(markup).toMatch(/aria-pressed="true"[^>]*>Medium<\/button>/u);
});
