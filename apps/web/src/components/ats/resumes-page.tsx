import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { IconFileCv, IconUpload } from "@tabler/icons-react";
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
import * as m from "@/paraglide/messages";
import { atsApi, atsDate, atsStatus, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";

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

function ResumeAction({
  selection,
  workspaceId,
  onClose,
  onSuccess,
}: {
  selection: { id: string; action: "match" | "resolve" };
  workspaceId: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const matching = selection.action === "match";
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const param = { workspaceId };
  const { data, isError } = useQuery({
    queryFn: async () => {
      if (matching) {
        const { rows } = await readAts(await atsApi.jobs.$get({ param }));
        return rows.map((job) => ({ id: job.id, label: job.title }));
      }
      const { rows } = await readAts(await atsApi.candidates.$get({ param, query: { page: "1" } }));
      return rows.map((candidate) => ({ id: candidate.id, label: candidate.name }));
    },
    queryKey: ["ats", workspaceId, "options", selection.action],
  });
  const mutation = useMutation({
    async mutationFn() {
      const endpoint = atsApi.submissions[":id"];
      const request = { ...param, id: selection.id };
      const response = matching
        ? await endpoint.match.$post({ json: { jobId: value, version: 1 }, param: request })
        : await endpoint.resolve.$post({
            json: value ? { candidateId: value, version: 1 } : { name, version: 1 },
            param: request,
          });
      await readAts(response);
    },
    async onSuccess() {
      await onSuccess();
      onClose();
    },
  });
  const title = matching ? m.ats_match() : m.ats_review();
  return (
    <DialogPopup>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{matching ? m.ats_match_help() : m.ats_review_help()}</DialogDescription>
      </DialogHeader>
      <DialogPanel>
        <div className="flex flex-col gap-4">
          {(isError || mutation.isError) && (
            <Alert variant="error">
              <AlertDescription>{m.ats_error()}</AlertDescription>
            </Alert>
          )}
          <Field>
            <FieldLabel>{matching ? m.ats_job() : m.ats_candidate()}</FieldLabel>
            <Select
              value={value}
              onValueChange={(next) => setValue(next ?? "")}
              items={data?.map((entry) => ({ label: entry.label, value: entry.id }))}
            >
              <SelectTrigger aria-label={matching ? m.ats_job() : m.ats_candidate()}>
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
          {!matching && !value && (
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
          disabled={mutation.isPending || (!value && (matching || !name.trim()))}
        >
          {m.ats_save()}
        </Button>
      </DialogFooter>
    </DialogPopup>
  );
}

export function ResumesPage({ workspaceId, page, onPage }: AtsPageProps) {
  const input = useRef<HTMLInputElement>(null);
  const client = useQueryClient();
  const param = { workspaceId };
  const refresh = () => client.invalidateQueries({ queryKey: ["ats", workspaceId] });
  const actionDialog = useMemo(
    () => createDialogHandle<{ id: string; action: "match" | "resolve" }>(),
    [],
  );
  const { data, isError } = useQuery({
    queryFn: async () =>
      readAts(await atsApi.resumes.$get({ param, query: { page: String(page) } })),
    queryKey: ["ats", workspaceId, "resumes", page],
    refetchInterval: (query) =>
      query.state.data?.rows.some(
        (row) => row.parseStatus === "queued" || row.parseStatus === "running",
      )
        ? 2000
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
  return (
    <AtsListPage
      title={m.ats_resumes()}
      icon={IconFileCv}
      toolbar={
        <>
          {(uploads.isError || retry.isError) && (
            <Alert variant="error">
              <AlertDescription>{m.ats_error()}</AlertDescription>
            </Alert>
          )}
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
          <Button onClick={() => input.current?.click()} disabled={uploads.isPending}>
            <IconUpload />
            {uploads.isPending ? m.ats_uploading() : m.ats_upload()}
          </Button>
          <Dialog handle={actionDialog}>
            {({ payload }) =>
              payload && (
                <ResumeAction
                  key={payload.id + payload.action}
                  workspaceId={workspaceId}
                  selection={payload}
                  onClose={() => actionDialog.close()}
                  onSuccess={refresh}
                />
              )
            }
          </Dialog>
        </>
      }
      headings={[
        m.ats_filename(),
        m.ats_candidate(),
        m.ats_job(),
        m.ats_status(),
        m.ats_date(),
        m.ats_action(),
      ]}
      rows={data?.rows.map((row) => {
        const { runId, submissionId } = row;
        const batch = data.batches.find((entry) => entry.id === row.batchId);
        return {
          cells: [
            <span key="name" className="block max-w-64 truncate" title={row.filename}>
              {row.filename}
            </span>,
            row.candidateName ?? (row.identityStatus === "pending_review" ? m.ats_review() : "—"),
            row.jobTitle ?? m.ats_unmatched(),
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
              {submissionId && (
                <DialogTrigger
                  handle={actionDialog}
                  payload={{ action: "match", id: submissionId }}
                  render={<Button variant="outline" size="sm" />}
                >
                  {m.ats_match()}
                </DialogTrigger>
              )}
              {submissionId && row.identityStatus === "pending_review" && (
                <DialogTrigger
                  handle={actionDialog}
                  payload={{ action: "resolve", id: submissionId }}
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
      page={page}
      pageSize={data?.pageSize ?? 20}
      total={data?.total ?? 0}
      onPage={onPage}
    />
  );
}
