import { lazy } from "react";
import { IconPlus } from "@tabler/icons-react";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import * as m from "@/paraglide/messages";
import { changeQuestionType, newOption } from "./form-draft";
import type { DraftQuestion, FormQuestionType } from "./form-draft";
import { ItemActions } from "./item-actions";
import { SortableList, SortableItem } from "./sortable-list";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});

export function questionTypeLabel(type: FormQuestionType) {
  const labels = {
    multiple_choice: m.question_sets_multiple,
    single_choice: m.question_sets_single,
    text: m.question_sets_text,
  };
  return labels[type]();
}

/**
 * 单道表单题的类型、题干、说明与选项编辑区域，选项支持追加、删除和排序。
 * Form-question type, prompt, help and option fields with option creation, removal and reordering.
 */
export function QuestionFields({
  question,
  number,
  disabled,
  onChange,
}: {
  question: DraftQuestion;
  number: number;
  disabled: boolean;
  onChange: (question: DraftQuestion) => void;
}) {
  const id = question.key;
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel id={`${id}-type`}>{m.question_sets_type()}</FieldLabel>
        <ToggleGroup
          aria-labelledby={`${id}-type`}
          value={[question.type]}
          disabled={disabled}
          variant="outline"
          onValueChange={(values) => {
            const type = values[0] as FormQuestionType | undefined;
            if (type) {
              onChange(changeQuestionType(question, type));
            }
          }}
        >
          {(["single_choice", "multiple_choice", "text"] as const).map((type) => (
            <ToggleGroupItem key={type} value={type}>
              {questionTypeLabel(type)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field data-invalid={question.content.length > 1000 || undefined}>
        <FieldLabel id={`${id}-content-label`} htmlFor={`${id}-content`}>
          {m.question_sets_prompt()}
        </FieldLabel>
        <SkeletonSuspense fallback={<MarkdownEditorSkeleton compact />}>
          <MarkdownEditor
            compact
            id={`${id}-content`}
            aria-labelledby={`${id}-content-label`}
            aria-required="true"
            value={question.content}
            onChange={(content) => onChange({ ...question, content })}
            maxLength={1000}
            disabled={disabled}
          />
        </SkeletonSuspense>
      </Field>
      <Field data-invalid={question.description.length > 500 || undefined}>
        <FieldLabel id={`${id}-help-label`} htmlFor={`${id}-help`}>
          {m.question_sets_question_help()}
        </FieldLabel>
        <SkeletonSuspense fallback={<MarkdownEditorSkeleton compact />}>
          <MarkdownEditor
            compact
            id={`${id}-help`}
            aria-labelledby={`${id}-help-label`}
            value={question.description}
            onChange={(description) => onChange({ ...question, description })}
            maxLength={500}
            disabled={disabled}
          />
        </SkeletonSuspense>
      </Field>
      {question.type !== "text" && (
        <fieldset
          className="flex min-w-0 flex-col gap-3"
          disabled={disabled}
          aria-describedby={`${id}-options-help`}
        >
          <legend className="mb-3 text-sm font-medium">{m.question_sets_options()}</legend>
          <SortableList
            items={question.options}
            onChange={(options) => onChange({ ...question, options })}
          >
            {question.options.map((option, index) => (
              <SortableItem
                key={option.key}
                id={option.key}
                index={index}
                label={m.question_sets_option_label({ number: index + 1, question: number })}
                disabled={disabled}
                className="rounded-lg border-transparent bg-muted/40"
              >
                {(handle) => (
                  <div className="flex min-w-0 items-center gap-2 p-1.5">
                    {handle}
                    <Field className="min-w-0 flex-1">
                      <FieldLabel htmlFor={option.key} className="sr-only">
                        {m.question_sets_option_label({ number: index + 1, question: number })}
                      </FieldLabel>
                      <Input
                        id={option.key}
                        maxLength={200}
                        required
                        value={option.value}
                        placeholder={m.question_sets_option_number({ number: index + 1 })}
                        onChange={(event) =>
                          onChange({
                            ...question,
                            options: question.options.map((current) =>
                              current.key === option.key
                                ? { ...current, value: event.target.value }
                                : current,
                            ),
                          })
                        }
                      />
                    </Field>
                    <ItemActions
                      label={m.question_sets_option_label({ number: index + 1, question: number })}
                      canRemove={question.options.length > 2}
                      disabled={disabled}
                      onRemove={() =>
                        onChange({
                          ...question,
                          options: question.options.filter((current) => current.key !== option.key),
                        })
                      }
                    />
                  </div>
                )}
              </SortableItem>
            ))}
          </SortableList>
          <Button
            className="self-start"
            variant="outline"
            size="sm"
            disabled={disabled || question.options.length >= 20}
            onClick={() => onChange({ ...question, options: [...question.options, newOption()] })}
          >
            <IconPlus aria-hidden="true" />
            {m.question_sets_add_option()}
          </Button>
          <p id={`${id}-options-help`} className="text-xs text-muted-foreground">
            {m.question_sets_options_help()}
          </p>
        </fieldset>
      )}
    </div>
  );
}
