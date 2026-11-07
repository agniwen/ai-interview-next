import { IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, useId, useState } from "react";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogPanel } from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as m from "@/paraglide/messages";
import { saveQuestionSetMutation } from "./client";
import type { FormSetContent } from "./client";
import { formSetInput, newQuestion, questionDrafts, questionIsComplete } from "./form-draft";
import { ItemActions } from "./item-actions";
import { SortableList, SortableItem } from "./sortable-list";
import { QuestionFields, questionTypeLabel } from "./question-fields";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});

export function FormSetEditor({
  record,
  workspaceId,
  onSuccess,
}: {
  record?: { id: string; name: string; description: string; content: FormSetContent };
  workspaceId: string;
  onSuccess: () => void;
}) {
  const formId = useId();
  const client = useQueryClient();
  const mutation = useMutation(saveQuestionSetMutation(client, workspaceId, record?.id));
  const [name, setName] = useState(record?.name ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [questions, setQuestions] = useState(() => (record ? questionDrafts(record.content) : []));
  const [expanded, setExpanded] = useState<string[]>([]);
  const incompleteIndex = questions.findIndex((question) => !questionIsComplete(question));

  return (
    <>
      <DialogPanel
        className="flex flex-col gap-6"
        render={
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate(formSetInput(name, description, questions), { onSuccess });
            }}
          />
        }
      >
        {mutation.isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor={`${formId}-name`}>{m.question_sets_name()}</FieldLabel>
          <Input
            id={`${formId}-name`}
            maxLength={200}
            required
            value={name}
            disabled={mutation.isPending}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field data-invalid={description.length > 30_000 || undefined}>
          <FieldLabel id={`${formId}-description-label`} htmlFor={`${formId}-description`}>
            {m.question_sets_description()}
          </FieldLabel>
          <SkeletonSuspense fallback={<MarkdownEditorSkeleton compact />}>
            <MarkdownEditor
              compact
              id={`${formId}-description`}
              aria-labelledby={`${formId}-description-label`}
              maxLength={30_000}
              value={description}
              onChange={setDescription}
              disabled={mutation.isPending}
            />
          </SkeletonSuspense>
        </Field>
        <section aria-label={m.question_sets_form()} className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {m.question_sets_question_count({ count: questions.length })}
            </h3>
            <Badge variant="secondary">{m.question_sets_all_required()}</Badge>
          </div>
          <SortableList items={questions} onChange={setQuestions}>
            <Accordion
              className="flex flex-col gap-3"
              multiple={false}
              value={expanded}
              onValueChange={(values) => setExpanded(values as string[])}
            >
              {questions.map((question, index) => (
                <SortableItem
                  key={question.key}
                  id={question.key}
                  index={index}
                  label={m.question_sets_question_number({ number: index + 1 })}
                  disabled={mutation.isPending}
                >
                  {(handle) => (
                    <AccordionItem value={question.key} className="border-0">
                      <div className="flex min-w-0 items-center gap-2 px-3">
                        {handle}
                        <div className="min-w-0 flex-1">
                          <AccordionTrigger
                            className="w-full items-center"
                            disabled={mutation.isPending}
                          >
                            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                              <span className="truncate">
                                {m.question_sets_question_number({ number: index + 1 })} ·{" "}
                                {question.content || m.question_sets_untitled_question()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {questionTypeLabel(question.type)}
                                {questionIsComplete(question)
                                  ? ""
                                  : ` · ${m.question_sets_incomplete()}`}
                              </span>
                            </span>
                          </AccordionTrigger>
                        </div>
                        <ItemActions
                          label={m.question_sets_question_number({ number: index + 1 })}
                          disabled={mutation.isPending}
                          onRemove={() => {
                            setQuestions(
                              questions.filter((current) => current.key !== question.key),
                            );
                            setExpanded(expanded.filter((key) => key !== question.key));
                          }}
                        />
                      </div>
                      <AccordionPanel className="border-t px-4 pt-5 sm:px-5">
                        <QuestionFields
                          question={question}
                          number={index + 1}
                          disabled={mutation.isPending}
                          onChange={(updated) =>
                            setQuestions((current) =>
                              current.map((item) => (item.key === question.key ? updated : item)),
                            )
                          }
                        />
                      </AccordionPanel>
                    </AccordionItem>
                  )}
                </SortableItem>
              ))}
            </Accordion>
          </SortableList>
          {questions.length === 0 && (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{m.question_sets_no_questions()}</EmptyTitle>
                <EmptyDescription>{m.question_sets_no_questions_help()}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <Button
            className="w-full border-dashed"
            variant="outline"
            disabled={mutation.isPending || questions.length >= 50}
            onClick={() => {
              const question = newQuestion();
              setQuestions([...questions, question]);
              setExpanded([question.key]);
            }}
          >
            <IconPlus aria-hidden="true" />
            {m.question_sets_add_question()}
          </Button>
          <p className="text-xs text-muted-foreground">{m.question_sets_limit()}</p>
        </section>
      </DialogPanel>
      <DialogFooter className="items-center sm:justify-between">
        <output className="text-xs text-muted-foreground">
          {incompleteIndex === -1
            ? m.question_sets_all_required_help()
            : m.question_sets_complete_question({ number: incompleteIndex + 1 })}
        </output>
        <Button
          form={formId}
          type="submit"
          loading={mutation.isPending}
          disabled={!name.trim() || description.length > 30_000 || incompleteIndex !== -1}
        >
          {m.ats_save()}
        </Button>
      </DialogFooter>
    </>
  );
}
