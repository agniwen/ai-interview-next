import { LocalTime } from "@/components/local-time";
import { IconRobot } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, useId, useMemo, useState } from "react";
import { InterviewerAgentFormSkeleton } from "@/components/skeletons/components/interviewer-agent-form-skeleton";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { AtsListPage } from "../ats/list-page";
import type { AtsPageProps } from "../ats/list-page";
import {
  interviewerAgentQuery,
  interviewerAgentsQuery,
  saveInterviewerAgentMutation,
} from "./client";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});
const maxTextLength = 30_000;

interface EditableAgent {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
}

function AgentForm({
  agent,
  workspaceId,
  onSuccess,
}: {
  agent?: EditableAgent;
  workspaceId: string;
  onSuccess: () => void;
}) {
  const client = useQueryClient();
  const formId = useId();
  const [name, setName] = useState(agent?.name ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [prompt, setPrompt] = useState(agent?.prompt ?? "");
  const mutation = useMutation(saveInterviewerAgentMutation(client, workspaceId, agent?.id));

  return (
    <>
      <DialogPanel
        className="flex flex-col gap-6"
        render={
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate({ description, name, prompt, version: 1 }, { onSuccess });
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
          <FieldLabel htmlFor={`${formId}-name`}>{m.interviewer_agents_name()}</FieldLabel>
          <Input
            id={`${formId}-name`}
            maxLength={200}
            disabled={mutation.isPending}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field data-invalid={description.length > maxTextLength || undefined}>
          <FieldLabel id={`${formId}-description-label`} htmlFor={`${formId}-description`}>
            {m.interviewer_agents_description()}
          </FieldLabel>
          <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
            <MarkdownEditor
              id={`${formId}-description`}
              aria-labelledby={`${formId}-description-label`}
              value={description}
              onChange={setDescription}
              maxLength={maxTextLength}
              disabled={mutation.isPending}
            />
          </SkeletonSuspense>
        </Field>
        <Field data-invalid={prompt.length > maxTextLength || undefined}>
          <FieldLabel id={`${formId}-prompt-label`} htmlFor={`${formId}-prompt`}>
            {m.interviewer_agents_prompt()}
          </FieldLabel>
          <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
            <MarkdownEditor
              id={`${formId}-prompt`}
              aria-labelledby={`${formId}-prompt-label`}
              aria-required="true"
              value={prompt}
              onChange={setPrompt}
              maxLength={maxTextLength}
              disabled={mutation.isPending}
            />
          </SkeletonSuspense>
          <FieldDescription>{m.interviewer_agents_prompt_help()}</FieldDescription>
        </Field>
      </DialogPanel>
      <DialogFooter>
        <Button
          disabled={
            !name.trim() ||
            !prompt.trim() ||
            description.length > maxTextLength ||
            prompt.length > maxTextLength
          }
          form={formId}
          loading={mutation.isPending}
          type="submit"
        >
          {m.ats_save()}
        </Button>
      </DialogFooter>
    </>
  );
}

function EditAgentForm({
  id,
  workspaceId,
  onSuccess,
}: {
  id: string;
  workspaceId: string;
  onSuccess: () => void;
}) {
  const { data, isPending, refetch, isFetching } = useQuery(interviewerAgentQuery(workspaceId, id));
  const phase = useSkeletonPhase(isPending);
  if (phase === "pending") {
    return null;
  }
  if (phase === "skeleton") {
    return (
      <DialogPanel>
        <InterviewerAgentFormSkeleton />
      </DialogPanel>
    );
  }
  if (!data) {
    return (
      <DialogPanel className="flex flex-col gap-4">
        <Alert variant="error">
          <AlertDescription>{m.ats_error()}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          loading={isFetching}
          onClick={() => {
            void refetch();
          }}
        >
          {m.ats_refresh()}
        </Button>
      </DialogPanel>
    );
  }
  return <AgentForm agent={data} workspaceId={workspaceId} onSuccess={onSuccess} />;
}

export function InterviewerAgentsPage({ workspaceId, query, onQueryChange }: AtsPageProps) {
  const dialog = useMemo(() => createDialogHandle<{ id: string }>(), []);
  const { data, isError, refetch } = useQuery(interviewerAgentsQuery(workspaceId, query));

  return (
    <AtsListPage
      action={
        <DialogTrigger handle={dialog} render={<Button variant="outline" />}>
          {m.interviewer_agents_create()}
        </DialogTrigger>
      }
      title={m.interviewer_agents_title()}
      description={m.interviewer_agents_help()}
      icon={IconRobot}
      hasRowActions
      headings={[m.interviewer_agents_name(), m.interviewer_agents_updated_at()]}
      rows={data?.rows.map((row) => ({
        action: (
          <DialogTrigger
            handle={dialog}
            payload={{ id: row.id }}
            aria-label={m.interviewer_agents_edit_named({ name: row.name })}
            render={<Button size="sm" variant="outline" />}
          >
            {m.ats_edit()}
          </DialogTrigger>
        ),
        cells: [
          <div key="name" className="flex min-w-48 max-w-lg flex-col gap-1">
            <span className="truncate font-medium">{row.name}</span>
            {row.description && (
              <span className="line-clamp-2 whitespace-normal text-muted-foreground wrap-anywhere">
                {row.description}
              </span>
            )}
          </div>,
          <LocalTime key="date" value={row.updatedAt} />,
        ],
        id: row.id,
      }))}
      empty={m.interviewer_agents_empty()}
      error={isError}
      query={query}
      searchPlaceholder={m.interviewer_agents_search()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <Dialog handle={dialog}>
        {({ payload }) => (
          <DialogPopup className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>
                {payload ? m.interviewer_agents_edit() : m.interviewer_agents_create()}
              </DialogTitle>
              <DialogDescription>{m.interviewer_agents_help()}</DialogDescription>
            </DialogHeader>
            {payload ? (
              <EditAgentForm
                key={payload.id}
                id={payload.id}
                workspaceId={workspaceId}
                onSuccess={() => dialog.close()}
              />
            ) : (
              <AgentForm
                workspaceId={workspaceId}
                onSuccess={() => {
                  dialog.close();
                  if (query.page !== 1) {
                    onQueryChange({ page: 1 });
                  }
                }}
              />
            )}
          </DialogPopup>
        )}
      </Dialog>
    </AtsListPage>
  );
}
