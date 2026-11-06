import { TableFilterSelect } from "@/components/layout/table-filters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { IconFileCv } from "@tabler/icons-react";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";
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
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@/components/ui/preview-card";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserColumn } from "@/components/user-column";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, atsDate, atsStatus, readAts } from "./client";
import { CreateApplicationDialog } from "./create-application-dialog";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams, resumeStatuses } from "./list-search";
import type { ResumeListSearch } from "./list-search";
import { ResumeUploadDialog } from "./resume-upload-dialog";

const statusVariants: Partial<Record<string, BadgeProps["variant"]>> = {
  failed: "error",
  running: "info",
  succeeded: "success",
  upload_failed: "error",
};

function ResumeStatusBadge({
  status,
  progress,
  error,
}: {
  status: string;
  progress?: string;
  error?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();
  const variant = statusVariants[status] ?? "outline";
  const label = atsStatus(status);

  if (!progress && !error) {
    return <Badge variant={variant}>{label}</Badge>;
  }

  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <PreviewCardTrigger
        aria-describedby={descriptionId}
        aria-expanded={open}
        delay={200}
        onClick={() => setOpen(true)}
        render={<Badge render={<button aria-label={label} type="button" />} variant={variant} />}
      >
        {label}
      </PreviewCardTrigger>
      <span className="sr-only" id={descriptionId}>
        {[progress, error].filter(Boolean).join(" ")}
      </span>
      <PreviewCardPopup
        align="start"
        className="max-w-[calc(100vw-2rem)] flex-col gap-2 p-3 text-left text-xs"
      >
        {progress && <p className="text-muted-foreground">{progress}</p>}
        {error && (
          <p className="wrap-anywhere whitespace-pre-wrap text-destructive-foreground">{error}</p>
        )}
      </PreviewCardPopup>
    </PreviewCard>
  );
}

function ResumeCandidateDialog({
  submissionId,
  workspaceId,
  onClose,
  onSuccess,
}: {
  submissionId: string;
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const param = { workspaceId };
  const { data, isError } = useQuery({
    queryFn: async () => {
      const { rows } = await readAts(await atsApi.candidates.$get({ param, query: { page: "1" } }));
      return rows.map((candidate) => ({ id: candidate.id, label: candidate.name }));
    },
    queryKey: atsKeys.candidates(workspaceId)._ctx.resolveOptions.queryKey,
  });
  const mutation = useMutation({
    async mutationFn() {
      await readAts(
        await atsApi.submissions[":id"].resolve.$post({
          json: value ? { candidateId: value, version: 1 } : { name, version: 1 },
          param: { ...param, id: submissionId },
        }),
      );
    },
    async onSuccess() {
      await onSuccess();
      onClose();
    },
  });
  const title = m.ats_review();
  return (
    <DialogPopup>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{m.ats_review_help()}</DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="flex flex-col gap-4">
          {(isError || mutation.isError) && (
            <Alert variant="error">
              <AlertDescription>{m.ats_error()}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel>{m.ats_candidate()}</FieldLabel>
            <Select
              value={value}
              onValueChange={(next) => setValue(next ?? "")}
              items={data?.map((entry) => ({ label: entry.label, value: entry.id }))}
            >
              <SelectTrigger aria-label={m.ats_candidate()}>
                <SelectValue placeholder={title} />
              </SelectTrigger>
              <SelectPopup>
                <SelectGroup>
                  {data?.map((entry) => (
                    <SelectItem key={entry.id} value={entry.id}>
                      {entry.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectPopup>
            </Select>
          </Field>
          {!value && (
            <Field>
              <FieldLabel>{m.ats_name()}</FieldLabel>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
          )}
        </div>
      </DialogPanel>
      <DialogFooter>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || (!value && !name.trim())}
        >
          {m.ats_save()}
        </Button>
      </DialogFooter>
    </DialogPopup>
  );
}

export function ResumesPage({ workspaceId, query, onQueryChange }: AtsPageProps<ResumeListSearch>) {
  const client = useQueryClient();
  const param = { workspaceId };
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: atsKeys.resumes(workspaceId).queryKey }),
      client.invalidateQueries({ queryKey: atsKeys.candidates(workspaceId).queryKey }),
    ]);
  }
  const candidateDialog = useMemo(() => createDialogHandle<string>(), []);
  const recruitmentDialog = useMemo(() => createDialogHandle<string>(), []);
  const previewDialog = useMemo(() => createDialogHandle<{ filename: string; id: string }>(), []);
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(await atsApi.resumes.$get({ param, query: listParams(query) }, { init: { signal } })),
    queryKey: atsKeys.resumes(workspaceId)._ctx.list(query).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.rows.some((row) => row.parseStatus === "queued" || row.parseStatus === "running")
        ? 5000
        : false,
  });
  const retry = useMutation({
    mutationFn: async (id: string) =>
      readAts(await atsApi.runs[":id"].retry.$post({ param: { ...param, id } })),
    onSuccess: refresh,
  });
  const recruitmentResumes = new Map(
    data?.rows
      .filter((row) => row.parseStatus === "succeeded")
      .map((row) => [row.id, row.resumeId]),
  );
  return (
    <AtsListPage
      title={m.ats_resumes()}
      icon={IconFileCv}
      action={
        <ResumeUploadDialog key={workspaceId} workspaceId={workspaceId} onSettled={refresh} />
      }
      filters={
        <TableFilterSelect
          label={m.ats_status()}
          onChange={(status) => onQueryChange({ page: 1, status: status || undefined })}
          options={[
            { label: m.ats_all_statuses(), value: "" },
            ...resumeStatuses.map((status) => ({ label: atsStatus(status), value: status })),
          ]}
          value={query.status ?? ""}
        />
      }
      feedback={
        retry.isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )
      }
      firstColumnClassName="w-120 min-w-40"
      headings={[
        m.ats_filename(),
        m.ats_candidate(),
        m.ats_status(),
        m.ats_creator(),
        m.ats_date(),
        m.ats_action(),
      ]}
      rows={data?.rows.map((row) => {
        const { runId, submissionId } = row;
        const recruitmentResumeId = recruitmentResumes.get(row.id);
        const previewPayload = { filename: row.filename, id: row.id };
        const batch = data.batches.find((entry) => entry.id === row.batchId);
        const progress =
          batch && batch.total > 1
            ? m.ats_batch_progress({
                complete: String(batch.complete),
                failed: String(batch.failed),
                total: String(batch.total),
              })
            : undefined;
        const filename = (
          <>
            <ResumeDocumentFileIcon
              className="size-5 shrink-0"
              kind={getResumeDocumentFileIconKind({ fileName: row.filename })}
            />
            <span className="min-w-0 truncate">{row.filename}</span>
          </>
        );
        return {
          cells: [
            <div className="contain-inline-size" key="name">
              {row.status === "accepted" ? (
                <DialogTrigger
                  className="flex max-w-full items-center gap-2 rounded-sm text-left hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  handle={previewDialog}
                  payload={previewPayload}
                  title={row.filename}
                >
                  {filename}
                </DialogTrigger>
              ) : (
                <span className="flex max-w-full items-center gap-2" title={row.filename}>
                  {filename}
                </span>
              )}
            </div>,
            row.candidateName ?? (row.identityStatus === "pending_review" ? m.ats_review() : "—"),
            <ResumeStatusBadge
              error={row.parseStatus === "failed" ? row.error : undefined}
              key="status"
              progress={progress}
              status={row.parseStatus ?? row.status}
            />,
            <UserColumn key="creator" user={row.creator} />,
            atsDate(row.createdAt),
            <div key="actions" className="flex gap-1">
              {runId && row.parseStatus === "failed" && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(runId)}
                >
                  {m.ats_retry()}
                </Button>
              )}
              {row.status === "accepted" && (
                <DialogTrigger
                  handle={previewDialog}
                  payload={previewPayload}
                  render={<Button variant="outline" size="sm" />}
                >
                  {m.ats_view_resume()}
                </DialogTrigger>
              )}
              {recruitmentResumeId && (
                <DialogTrigger
                  handle={recruitmentDialog}
                  payload={recruitmentResumeId}
                  render={<Button variant="outline" size="sm" />}
                >
                  {m.ats_join_recruitment()}
                </DialogTrigger>
              )}
              {submissionId && row.identityStatus === "pending_review" && (
                <DialogTrigger
                  handle={candidateDialog}
                  payload={submissionId}
                  render={<Button variant="outline" size="sm" />}
                >
                  {m.ats_review()}
                </DialogTrigger>
              )}
            </div>,
          ],
          id: row.id,
        };
      })}
      empty={m.ats_empty_resumes()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_resumes()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <Dialog handle={candidateDialog}>
        {({ payload }) =>
          payload && (
            <ResumeCandidateDialog
              key={payload}
              submissionId={payload}
              workspaceId={workspaceId}
              onClose={() => candidateDialog.close()}
              onSuccess={refresh}
            />
          )
        }
      </Dialog>
      <CreateApplicationDialog handle={recruitmentDialog} workspaceId={workspaceId} />
      <Dialog handle={previewDialog}>
        {({ payload }) => {
          if (!payload) {
            return null;
          }
          const resumeId = recruitmentResumes.get(payload.id);
          return (
            <ResumePreviewDialog
              actions={
                resumeId && (
                  <CreateApplicationDialog resumeId={resumeId} workspaceId={workspaceId} />
                )
              }
              key={`${workspaceId}/${payload.id}`}
              filename={payload.filename}
              id={payload.id}
              workspaceId={workspaceId}
            />
          );
        }}
      </Dialog>
    </AtsListPage>
  );
}
