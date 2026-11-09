import { allJobsOptionId, JobSelect } from "../ats/job-select";
import type { JobOption } from "../ats/job-select";
import { IconDeviceFloppy, IconPlus } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, useId, useState } from "react";
import type { ComponentType } from "react";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar";
import * as m from "@/paraglide/messages";
import { saveQuestionSetMutation } from "./client";
import type { QuestionSetInput } from "./client";
import { ItemActions } from "./item-actions";
import { SortableList, SortableItem } from "./sortable-list";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});

export interface QuestionSetEditorProps<Content extends QuestionSetInput["content"]> {
  record?: {
    id: string;
    name: string;
    description: string;
    defaultAllJobs?: boolean;
    defaultJobs?: JobOption[];
    content: Content;
  };
  workspaceId: string;
  onSuccess: () => void;
}

export interface QuestionEditorConfig<Content, Question> {
  kind: "form" | "conversation";
  drafts: (content: Content) => Question[];
  create: () => Question;
  isComplete: (question: Question) => boolean;
  label: (question: Question) => string;
  toInput: (name: string, description: string, questions: Question[]) => QuestionSetInput;
  Fields: ComponentType<{
    question: Question;
    number: number;
    disabled: boolean;
    onChange: (question: Question) => void;
  }>;
}

/**
 * 题套编辑的共用草稿与保存流程，管理元数据、默认岗位和题目顺序，具体题型由配置注入。
 * Shared question-set draft and save flow for metadata, default jobs and question order, with question types supplied by configuration.
 */
export function QuestionSetEditor<
  Content extends QuestionSetInput["content"],
  Question extends { key: string; content: string },
>({
  record,
  workspaceId,
  onSuccess,
  config,
}: QuestionSetEditorProps<Content> & { config: QuestionEditorConfig<Content, Question> }) {
  const isForm = config.kind === "form";
  const help = isForm ? m.question_sets_all_required_help() : m.question_sets_conversation_help();
  const formId = useId();
  const client = useQueryClient();
  const mutation = useMutation(saveQuestionSetMutation(client, workspaceId, record?.id));
  const [defaultJobs, setDefaultJobs] = useState<JobOption[]>(() =>
    record?.defaultAllJobs
      ? [{ id: allJobsOptionId, title: m.question_sets_all_jobs() }]
      : (record?.defaultJobs ?? []),
  );
  const [name, setName] = useState(record?.name ?? "");
  const [description, setDescription] = useState(record?.description ?? "");
  const [questions, setQuestions] = useState(() => (record ? config.drafts(record.content) : []));
  const [expanded, setExpanded] = useState<string[]>([]);
  const incompleteIndex = questions.findIndex((question) => !config.isComplete(question));
  const incompleteMessage = isForm
    ? m.question_sets_complete_question({ number: incompleteIndex + 1 })
    : m.question_sets_complete_conversation({ number: incompleteIndex + 1 });

  return (
    <form
      className="flex min-w-0 flex-1 flex-col gap-6"
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate(
          {
            ...config.toInput(name, description, questions),
            defaultAllJobs: defaultJobs.some((job) => job.id === allJobsOptionId),
            defaultJobIds: defaultJobs
              .filter((job) => job.id !== allJobsOptionId)
              .map((job) => job.id),
          },
          { onSuccess },
        );
      }}
    >
      {mutation.isError && (
        <Alert variant="error">
          <AlertDescription>{m.ats_error()}</AlertDescription>
        </Alert>
      )}
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex min-w-0 flex-col gap-6">
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
        </div>
        <Field>
          <FieldLabel htmlFor={`${formId}-jobs`}>{m.question_sets_default_jobs()}</FieldLabel>
          <JobSelect
            id={`${formId}-jobs`}
            workspaceId={workspaceId}
            value={defaultJobs}
            onChange={setDefaultJobs}
            disabled={mutation.isPending}
          />
          <p className="text-xs text-muted-foreground">{m.question_sets_default_jobs_help()}</p>
        </Field>
        <section
          aria-label={isForm ? m.question_sets_form() : m.question_sets_conversation()}
          className="flex min-w-0 flex-col gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">
              {m.question_sets_question_count({ count: questions.length })}
            </h3>
            {isForm && <Badge variant="secondary">{m.question_sets_all_required()}</Badge>}
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
                                {config.label(question)}
                                {config.isComplete(question)
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
                        <config.Fields
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
              const question = config.create();
              setQuestions([...questions, question]);
              setExpanded([question.key]);
            }}
          >
            <IconPlus aria-hidden="true" />
            {m.question_sets_add_question()}
          </Button>
          <p className="text-xs text-muted-foreground">{m.question_sets_limit()}</p>
        </section>
      </div>
      <output className="text-xs text-muted-foreground">
        {incompleteIndex === -1 ? help : incompleteMessage}
      </output>
      <Toolbar
        aria-label={m.ats_action()}
        className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto mt-auto mb-[env(safe-area-inset-bottom)] w-fit max-w-full shrink-0 items-center gap-1 border-border/70 bg-card/95 p-1.5 shadow-xs/5 backdrop-blur-md md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <ToolbarButton
          form={formId}
          type="submit"
          render={<Button size="sm" variant="outline" loading={mutation.isPending} />}
          disabled={
            mutation.isPending ||
            !name.trim() ||
            description.length > 30_000 ||
            incompleteIndex !== -1
          }
        >
          <IconDeviceFloppy aria-hidden="true" data-icon="inline-start" />
          {m.ats_save()}
        </ToolbarButton>
      </Toolbar>
    </form>
  );
}
