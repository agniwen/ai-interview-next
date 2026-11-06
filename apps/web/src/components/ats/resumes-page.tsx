import { TableFilterSelect } from "@/components/layout/table-filters";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { IconFileCv, IconUpload } from "@tabler/icons-react";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
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

async function uploadResumeFile(workspaceId: string, id: string, url: string, file: File) {
  const param = { id, workspaceId };
  try {
    const response = await fetch(url, {
      body: file,
      headers: { "Content-Type": "application/pdf" },
      method: "PUT",
    });
    if (!response.ok) {
      throw new Error(m.ats_error());
    }
    await readAts(await atsApi.uploads[":id"].confirm.$post({ param }));
  } catch (error) {
    await atsApi.uploads[":id"].failed.$post({ param });
    throw error;
  }
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
  const input = useRef<HTMLInputElement>(null);
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
  const uploads = useMutation({
    async mutationFn(files: File[]) {
      const batch = await readAts(
        await atsApi.uploads.$post({
          json: {
            files: files.map((file) => ({ filename: file.name, size: file.size })),
            version: 1,
          },
          param,
        }),
      );
      const results = await Promise.allSettled(
        batch.uploads.map(({ id, url }, index) =>
          uploadResumeFile(workspaceId, id, url, files[index]),
        ),
      );
      if (results.some((result) => result.status === "rejected")) {
        throw new Error(m.ats_error());
      }
    },
    onSettled: refresh,
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
        <Button
          onClick={() => input.current?.click()}
          disabled={uploads.isPending}
          variant="outline"
        >
          <IconUpload />
          {uploads.isPending ? m.ats_uploading() : m.ats_upload()}
        </Button>
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
        (uploads.isError || retry.isError) && (
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
            <div key="status" className="flex flex-col items-start gap-1">
              <Badge variant="outline">{atsStatus(row.parseStatus ?? row.status)}</Badge>
              {row.parseStatus === "failed" && row.error && (
                <span className="text-xs text-muted-foreground">{row.error}</span>
              )}
              {batch && batch.total > 1 && (
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {m.ats_batch_progress({
                    complete: String(batch.complete),
                    failed: String(batch.failed),
                    total: String(batch.total),
                  })}
                </span>
              )}
            </div>,
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
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        aria-label={m.ats_upload()}
        onChange={(event) => {
          const files = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = "";
          if (files.length) {
            uploads.mutate(files);
          }
        }}
      />
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
