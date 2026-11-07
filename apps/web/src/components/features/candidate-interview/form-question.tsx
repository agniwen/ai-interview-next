import { lazy } from "react";
import { MarkdownView } from "@/components/features/home/support/markdown-view";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as m from "@/paraglide/messages";
import type { CandidateFormAnswers, CandidateFormQuestion } from "./client";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});

/**
 * 展示固定题目与作答控件；题目 ID 和选项位置保持与服务端快照一致。
 * Renders a frozen question and its answer control, preserving snapshot question IDs and option positions.
 */
export function FormQuestion({
  question,
  value,
  index,
  disabled,
  onChange,
}: {
  question: CandidateFormQuestion;
  value: CandidateFormAnswers[string] | undefined;
  index: number;
  disabled: boolean;
  onChange: (value: CandidateFormAnswers[string]) => void;
}) {
  const labelId = `question-${question.id}`;
  const descriptionId = `${labelId}-description`;
  return (
    <Field className="items-stretch gap-2 text-left" disabled={disabled}>
      <div id={labelId} className="flex items-baseline gap-1 text-sm font-medium">
        <span className="shrink-0 text-muted-foreground">{index + 1}.</span>
        <MarkdownView content={question.content} className="flex-1" />
        <span
          className="shrink-0 text-destructive-foreground"
          aria-label={m.candidate_form_required()}
        >
          *
        </span>
      </div>
      {question.description && (
        <div id={descriptionId} className="text-muted-foreground">
          <MarkdownView content={question.description} />
        </div>
      )}
      {question.type === "text" && (
        <SkeletonSuspense fallback={<MarkdownEditorSkeleton compact />}>
          <MarkdownEditor
            compact
            aria-labelledby={labelId}
            aria-required
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
            maxLength={30_000}
            disabled={disabled}
          />
        </SkeletonSuspense>
      )}
      {question.type === "single_choice" && (
        <Select
          items={question.options.map((label, optionIndex) => ({ label, value: optionIndex }))}
          value={typeof value === "number" ? value : null}
          onValueChange={onChange}
          disabled={disabled}
        >
          <SelectTrigger
            aria-labelledby={labelId}
            aria-describedby={question.description ? descriptionId : undefined}
            className="w-full py-1.5"
          >
            <SelectValue
              placeholder={m.candidate_form_select()}
              className="whitespace-pre-wrap wrap-anywhere"
            />
          </SelectTrigger>
          <SelectPopup>
            <SelectGroup>
              {question.options.map((option, optionIndex) => (
                <SelectItem
                  key={optionIndex}
                  value={optionIndex}
                  className="whitespace-pre-wrap wrap-anywhere"
                >
                  {option}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectPopup>
        </Select>
      )}
      {question.type === "multiple_choice" && (
        <fieldset
          aria-labelledby={labelId}
          aria-describedby={question.description ? descriptionId : undefined}
          className="flex flex-col gap-1.5"
        >
          {question.options.map((option, optionIndex) => {
            const selected = Array.isArray(value) ? value : [];
            return (
              <label
                key={optionIndex}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 text-sm transition-colors hover:bg-accent has-data-checked:border-primary/40 has-data-checked:bg-accent/60 has-data-disabled:cursor-default"
              >
                <Checkbox
                  disabled={disabled}
                  checked={selected.includes(optionIndex)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...selected, optionIndex]
                        : selected.filter((item) => item !== optionIndex),
                    )
                  }
                />
                <span className="min-w-0 whitespace-pre-wrap wrap-anywhere">{option}</span>
              </label>
            );
          })}
        </fieldset>
      )}
    </Field>
  );
}
