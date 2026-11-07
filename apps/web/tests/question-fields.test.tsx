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
