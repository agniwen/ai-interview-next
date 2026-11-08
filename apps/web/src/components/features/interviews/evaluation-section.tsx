import { lazy, useId, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconClipboardCheck } from "@tabler/icons-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { EvaluationStatus, evaluationConclusionLabel } from "./evaluation-status";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogTrigger,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogPanel,
} from "@/components/ui/dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LocalTime } from "@/components/local-time";
import { UserColumn } from "@/components/user-column";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import * as m from "@/paraglide/messages";
import { generateEvaluationMutation, saveEvaluationMutation } from "./client";
import type { EvaluationDraft, InterviewResult } from "./client";
import { ResultSection } from "./result-section";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});

function EvaluationDetails({ content }: { content: EvaluationDraft }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm font-medium">{evaluationConclusionLabel(content.conclusion)}</p>
      <div className="prose prose-sm max-w-none wrap-anywhere dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content.overall}</ReactMarkdown>
      </div>
    </div>
  );
}

function EvaluationChoices<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T | null) => void;
  disabled: boolean;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel id={id}>{label}</FieldLabel>
      <ToggleGroup
        aria-labelledby={id}
        value={value === null ? [] : [value]}
        onValueChange={(next) => next.length > 0 && onChange(next[0] as T)}
        disabled={disabled}
        variant="outline"
        size="lg"
        className="w-full max-w-lg"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={option.value}
            value={option.value}
            className="min-h-11 min-w-11 flex-1 px-3"
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Field>
  );
}

function EvaluationForm({ data }: { data: InterviewResult }) {
  const initial = data.evaluation.own?.content ?? data.evaluation.original?.content;
  const [content, setContent] = useState<EvaluationDraft>(() => ({
    conclusion:
      data.round.kind === "ai" && initial?.conclusion === "pending"
        ? null
        : (initial?.conclusion ?? null),
    overall: initial?.overall ?? "",
    version: 1,
  }));
  const id = useId();
  const mutation = useMutation(
    saveEvaluationMutation(useQueryClient(), data.round.workspaceId, data.round.id),
  );
  const overLimit = content.overall.length > 30_000;
  let submitHelp =
    data.round.kind === "ai"
      ? m.interview_evaluation_ai_submit_help()
      : m.interview_evaluation_submit_help();
  if (content.conclusion === "fail") {
    submitHelp = m.interview_evaluation_fail_help();
  }
  if (data.round.status !== "completed") {
    submitHelp = m.meeting_evaluation_draft_help();
  }
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (data.round.status === "completed" && content.conclusion) {
          mutation.mutate({
            content: { ...content, conclusion: content.conclusion },
            submit: true,
          });
        }
      }}
    >
      <EvaluationChoices
        label={m.interview_evaluation_conclusion()}
        value={content.conclusion}
        onChange={(conclusion) => setContent({ ...content, conclusion })}
        options={(data.round.kind === "ai"
          ? (["pass", "fail"] as const)
          : (["pass", "pending", "fail"] as const)
        ).map((value) => ({
          label: evaluationConclusionLabel(value),
          value,
        }))}
        disabled={mutation.isPending}
      />
      <Field data-invalid={overLimit || undefined}>
        <FieldLabel id={`${id}-overall-label`} htmlFor={`${id}-overall`}>
          {m.interview_evaluation_overall()}
        </FieldLabel>
        <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
          <MarkdownEditor
            id={`${id}-overall`}
            aria-labelledby={`${id}-overall-label`}
            aria-required
            value={content.overall}
            onChange={(overall) => setContent({ ...content, overall })}
            maxLength={30_000}
            disabled={mutation.isPending}
            compact
          />
        </SkeletonSuspense>
      </Field>
      <p className="text-xs leading-6 text-muted-foreground">{submitHelp}</p>
      {mutation.isError && (
        <Alert variant="error">
          <AlertDescription>{m.interview_evaluation_save_error()}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {mutation.isSuccess && (
          <output className="mr-auto text-xs text-muted-foreground">
            {m.interview_evaluation_draft_saved()}
          </output>
        )}
        <Button
          type="button"
          variant="outline"
          disabled={mutation.isPending || overLimit}
          onClick={() => mutation.mutate({ content, submit: false })}
        >
          {m.interview_evaluation_save_draft()}
        </Button>
        <Button
          type="submit"
          loading={mutation.isPending && mutation.variables?.submit}
          disabled={
            data.round.status !== "completed" ||
            mutation.isPending ||
            !content.conclusion ||
            !content.overall.trim() ||
            overLimit
          }
        >
          {data.round.kind === "ai"
            ? m.interview_evaluation_confirm()
            : m.interview_evaluation_submit()}
        </Button>
      </div>
    </form>
  );
}

function EvaluationGeneration({ data }: { data: InterviewResult }) {
  const { evaluation, round } = data;
  const generate = useMutation(
    generateEvaluationMutation(useQueryClient(), round.workspaceId, round.id),
  );
  const generating = generate.isPending || evaluation.original?.status === "generating";
  const generationHelp = data.progress?.finalized
    ? m.interview_evaluation_generation_help()
    : m.interview_evaluation_manual_help();
  return (
    round.kind === "ai" &&
    round.status === "completed" &&
    evaluation.original?.status !== "ready" &&
    evaluation.canEdit && (
      <div className="flex flex-col items-start gap-3">
        <p className="text-sm leading-6 text-muted-foreground">
          {generating ? m.interview_evaluation_generating() : generationHelp}
        </p>
        {evaluation.canGenerate && data.progress?.finalized && (
          <Button variant="outline" loading={generating} onClick={() => generate.mutate()}>
            {m.interview_evaluation_generate()}
          </Button>
        )}
        {(generate.isError || evaluation.original?.status === "failed") && (
          <Alert variant="error">
            <AlertDescription>{m.interview_evaluation_generation_error()}</AlertDescription>
          </Alert>
        )}
      </div>
    )
  );
}

function EvaluationSummary({ data, action }: { data: InterviewResult; action?: ReactNode }) {
  const { evaluation, round } = data;
  const submitted = evaluation.evaluations.filter((item) => item.submittedAt);
  return (
    <div>
      <ResultSection
        icon={IconClipboardCheck}
        title={m.interview_evaluation_title()}
        meta={<EvaluationStatus summary={evaluation.summary} />}
      >
        <div className="flex flex-col gap-5">
          <p className="text-xs leading-6 text-muted-foreground">
            {m.interview_evaluation_progress({
              submitted: evaluation.summary.submittedCount,
              total: evaluation.summary.requiredCount,
            })}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {round.kind === "ai" ? m.interviews_reviewer() : m.interviews_interviewers()}
            </span>
            {round.assignments.map((person) => (
              <UserColumn key={person.id} user={person} />
            ))}
            {round.kind === "ai" && round.assignments.length === 0 && (
              <span className="text-sm">{m.interviews_any_member()}</span>
            )}
          </div>
          {round.status !== "completed" && (
            <p className="text-sm text-muted-foreground">{m.interview_evaluation_after_end()}</p>
          )}
          <EvaluationGeneration data={data} />
          {action}
          {!evaluation.canEdit && round.status === "completed" && !evaluation.summary.complete && (
            <p className="text-sm text-muted-foreground">{m.interview_evaluation_waiting()}</p>
          )}
          {submitted.map((item) => (
            <article key={item.authorUserId} className="flex flex-col gap-4 border-t pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <UserColumn user={item.author} />
                <LocalTime value={item.submittedAt} className="text-xs text-muted-foreground" />
              </div>
              <EvaluationDetails content={item.content} />
            </article>
          ))}
          {evaluation.original?.content && (
            <details className="border-t pt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                {m.interview_evaluation_original()}
              </summary>
              <div className="pt-4">
                <EvaluationDetails content={evaluation.original.content} />
              </div>
            </details>
          )}
          {evaluation.summary.complete && (
            <p className="text-xs leading-6 text-muted-foreground">
              {evaluation.summary.conclusion === "fail"
                ? m.interview_evaluation_rejected()
                : m.interview_evaluation_next_ready()}
            </p>
          )}
        </div>
      </ResultSection>
    </div>
  );
}

export function InterviewEvaluationDialog({ data }: { data: InterviewResult }) {
  const { evaluation, round } = data;
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <IconClipboardCheck aria-hidden="true" />
        {evaluation.canEdit ? m.interview_evaluation_review() : m.interview_evaluation_title()}
      </DialogTrigger>
      <DialogPopup className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{m.interview_evaluation_title()}</DialogTitle>
          <DialogDescription>
            {data.candidate.name} · {m.interviews_round({ number: round.sequence })}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          {evaluation.canEdit ? <EvaluationForm data={data} /> : <EvaluationSummary data={data} />}
        </DialogPanel>
      </DialogPopup>
    </Dialog>
  );
}

export function InterviewEvaluationSection({ data }: { data: InterviewResult }) {
  return (
    <EvaluationSummary
      data={data}
      action={
        data.evaluation.canEdit ? (
          <div>
            <InterviewEvaluationDialog data={data} />
          </div>
        ) : undefined
      }
    />
  );
}
