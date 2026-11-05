import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useMemo, useState } from "react";
import { IconListDetails } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";
import { atsApi, atsDate, atsStatus, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});
const maxJobRequirementsLength = 30_000;

function JobForm({
  workspaceId,
  onSuccess,
}: {
  workspaceId: string;
  onSuccess: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  const validRequirements =
    requirements.trim().length > 0 && requirements.length <= maxJobRequirementsLength;
  const mutation = useMutation({
    mutationFn: async () =>
      readAts(
        await atsApi.jobs.$post({
          json: { requirements, title, version: 1 },
          param: { workspaceId },
        }),
      ),
    async onSuccess() {
      await onSuccess();
      setOpen(false);
    },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setTitle("");
          setRequirements("");
          mutation.reset();
        }
      }}
    >
      <DialogTrigger render={<Button />}>{m.ats_create_job()}</DialogTrigger>
      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{m.ats_create_job()}</DialogTitle>
          <DialogDescription>{m.ats_job_help()}</DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex flex-col gap-4">
            {mutation.isError && (
              <Alert variant="error">
                <AlertDescription>{m.ats_error()}</AlertDescription>
              </Alert>
            )}
            <Field>
              <FieldLabel htmlFor="ats-job-title">{m.ats_job()}</FieldLabel>
              <Input
                id="ats-job-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
              />
            </Field>
            <Field>
              <FieldLabel id="ats-job-requirements-label" htmlFor="ats-job-requirements">
                {m.ats_requirements()}
              </FieldLabel>
              <Suspense fallback={<MarkdownEditorSkeleton />}>
                <MarkdownEditor
                  id="ats-job-requirements"
                  aria-labelledby="ats-job-requirements-label"
                  aria-required="true"
                  value={requirements}
                  onChange={setRequirements}
                  placeholder={m.ats_requirements_placeholder()}
                  maxLength={maxJobRequirementsLength}
                />
              </Suspense>
            </Field>
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !title.trim() || !validRequirements}
          >
            {m.ats_save()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function ApplicationHistory({ workspaceId, id }: { workspaceId: string; id: string }) {
  const { data, isError } = useQuery({
    queryFn: async () =>
      readAts(await atsApi.applications[":id"].$get({ param: { id, workspaceId } })),
    queryKey: ["ats", workspaceId, "history", id],
  });
  return (
    <DialogPopup>
      <DialogHeader>
        <DialogTitle>{m.ats_history()}</DialogTitle>
        <DialogDescription>{m.ats_history_help()}</DialogDescription>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-4">
        {isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )}
        {!isError && data && (
          <>
            {data.activity.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {entry.result.reason === "job_changed" ? m.ats_transferred() : m.ats_closed()}
                </p>
                <p className="text-sm text-muted-foreground">
                  {atsDate(entry.occurredAt, "short")} ·{" "}
                  {entry.actorType === "system"
                    ? m.ats_system()
                    : (entry.actorName ?? entry.actorId)}
                </p>
              </div>
            ))}
            {data.evaluations.map((evaluation) => (
              <div key={evaluation.id} className="flex flex-col gap-1 border-t pt-3">
                <p className="text-sm font-medium">
                  {m.ats_evaluation()}{" "}
                  {typeof evaluation.result.score === "number"
                    ? `${evaluation.result.score}/100`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {typeof evaluation.result.summary === "string" ? evaluation.result.summary : "—"}
                </p>
              </div>
            ))}
            {!data.activity.length && !data.evaluations.length && (
              <p className="text-sm text-muted-foreground">{m.ats_empty_history()}</p>
            )}
          </>
        )}
        {!isError && !data && (
          <div aria-busy="true" aria-label={m.ats_loading()}>
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </DialogPanel>
    </DialogPopup>
  );
}

export function ApplicationsPage({ workspaceId, page, onPage }: AtsPageProps) {
  const historyDialog = useMemo(() => createDialogHandle<string>(), []);
  const closeDialog = useMemo(() => createDialogHandle<string>(), []);
  const client = useQueryClient();
  const param = { workspaceId };
  const refresh = () => client.invalidateQueries({ queryKey: ["ats", workspaceId] });
  const { data, isError } = useQuery({
    queryFn: async () =>
      readAts(await atsApi.applications.$get({ param, query: { page: String(page) } })),
    queryKey: ["ats", workspaceId, "applications", page],
    refetchInterval: (query) =>
      query.state.data?.rows.some(
        (row) => row.evaluationStatus === "queued" || row.evaluationStatus === "running",
      )
        ? 2000
        : false,
  });
  const retry = useMutation({
    mutationFn: async (id: string) =>
      readAts(await atsApi.runs[":id"].retry.$post({ param: { ...param, id } })),
    onSuccess: refresh,
  });
  const close = useMutation({
    mutationFn: async (id: string) =>
      readAts(await atsApi.applications[":id"].close.$post({ param: { ...param, id } })),
    async onSuccess() {
      await refresh();
      closeDialog.close();
    },
  });
  return (
    <AtsListPage
      title={m.ats_applications()}
      icon={IconListDetails}
      toolbar={
        <>
          {retry.isError && (
            <Alert variant="error">
              <AlertDescription>{m.ats_error()}</AlertDescription>
            </Alert>
          )}
          <JobForm workspaceId={workspaceId} onSuccess={refresh} />
          <Dialog handle={closeDialog}>
            {({ payload }) =>
              payload && (
                <DialogPopup>
                  <DialogHeader>
                    <DialogTitle>{m.ats_close_application()}</DialogTitle>
                    <DialogDescription>{m.ats_close_help()}</DialogDescription>
                  </DialogHeader>
                  {close.isError && (
                    <DialogPanel>
                      <Alert variant="error">
                        <AlertDescription>{m.ats_error()}</AlertDescription>
                      </Alert>
                    </DialogPanel>
                  )}
                  <DialogFooter>
                    <Button
                      variant="destructive"
                      disabled={close.isPending}
                      onClick={() => close.mutate(payload)}
                    >
                      {m.ats_close_application()}
                    </Button>
                  </DialogFooter>
                </DialogPopup>
              )
            }
          </Dialog>
          <Dialog handle={historyDialog}>
            {({ payload }) =>
              payload && <ApplicationHistory workspaceId={workspaceId} id={payload} />
            }
          </Dialog>
        </>
      }
      headings={[
        m.ats_candidate(),
        m.ats_job(),
        m.ats_status(),
        m.ats_evaluation(),
        m.ats_date(),
        m.ats_action(),
      ]}
      rows={data?.rows.map((row) => {
        const { evaluationRunId } = row;
        return {
          cells: [
            row.candidateName,
            row.jobTitle,
            <Badge key="status" variant="outline">
              {row.closedAt ? m.ats_closed() : m.ats_open()}
            </Badge>,
            atsStatus(row.evaluationStatus),
            atsDate(row.createdAt),
            <div key="actions" className="flex gap-1">
              {!row.closedAt && evaluationRunId && row.evaluationStatus === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(evaluationRunId)}
                >
                  {m.ats_retry()}
                </Button>
              )}
              {!row.closedAt && (
                <DialogTrigger
                  handle={closeDialog}
                  payload={row.id}
                  render={<Button size="sm" variant="outline" />}
                  onClick={() => close.reset()}
                >
                  {m.ats_close_application()}
                </DialogTrigger>
              )}
              <DialogTrigger
                handle={historyDialog}
                payload={row.id}
                render={<Button size="sm" variant="outline" />}
              >
                {m.ats_history()}
              </DialogTrigger>
            </div>,
          ],
          id: row.id,
        };
      })}
      empty={m.ats_empty_applications()}
      error={isError}
      page={page}
      pageSize={data?.pageSize ?? 20}
      total={data?.total ?? 0}
      onPage={onPage}
    />
  );
}
