import { lazy } from "react";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import * as m from "@/paraglide/messages";
import type { ConversationQuestionDraft } from "./conversation-draft";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});

export function difficultyLabel(difficulty: ConversationQuestionDraft["difficulty"]) {
  const labels = {
    easy: m.question_sets_easy,
    hard: m.question_sets_hard,
    medium: m.question_sets_medium,
  };
  return labels[difficulty]();
}

const textFields = [
  { key: "content", label: m.question_sets_prompt, maxLength: 1000 },
  { key: "evaluationFocus", label: m.question_sets_evaluation_focus, maxLength: 500 },
  { key: "followUpDirections", label: m.question_sets_follow_up, maxLength: 1000 },
  { key: "evaluationCriteria", label: m.question_sets_evaluation_criteria, maxLength: 2000 },
] as const;

export function ConversationFields({
  question,
  disabled,
  onChange,
}: {
  question: ConversationQuestionDraft;
  disabled: boolean;
  onChange: (question: ConversationQuestionDraft) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel id={`${question.key}-difficulty`}>{m.question_sets_difficulty()}</FieldLabel>
        <ToggleGroup
          aria-labelledby={`${question.key}-difficulty`}
          value={[question.difficulty]}
          disabled={disabled}
          variant="outline"
          onValueChange={(values) => {
            const difficulty = values[0] as ConversationQuestionDraft["difficulty"] | undefined;
            if (difficulty) {
              onChange({ ...question, difficulty });
            }
          }}
        >
          {(["easy", "medium", "hard"] as const).map((difficulty) => (
            <ToggleGroupItem key={difficulty} value={difficulty}>
              {difficultyLabel(difficulty)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      {textFields.map(({ key, label, maxLength }) => {
        const id = `${question.key}-${key}`;
        return (
          <Field key={key} data-invalid={question[key].length > maxLength || undefined}>
            <FieldLabel id={`${id}-label`} htmlFor={id}>
              {label()}
            </FieldLabel>
            <SkeletonSuspense fallback={<MarkdownEditorSkeleton compact />}>
              <MarkdownEditor
                compact
                id={id}
                aria-labelledby={`${id}-label`}
                aria-required={key === "content" ? true : undefined}
                aria-describedby={key === "evaluationCriteria" ? `${id}-help` : undefined}
                value={question[key]}
                maxLength={maxLength}
                disabled={disabled}
                onChange={(value) => onChange({ ...question, [key]: value })}
              />
            </SkeletonSuspense>
            {key === "evaluationCriteria" && (
              <FieldDescription id={`${id}-help`}>
                {m.question_sets_evaluation_help()}
              </FieldDescription>
            )}
          </Field>
        );
      })}
    </div>
  );
}
