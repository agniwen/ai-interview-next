import { IconBriefcase } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useState } from "react";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
import * as m from "@/paraglide/messages";
import { atsApi, atsDate, readAts } from "./client";
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

export function JobsPage({ workspaceId, page, onPage }: AtsPageProps) {
  const client = useQueryClient();
  const { data, isError } = useQuery({
    queryFn: async () =>
      readAts(await atsApi.jobs.$get({ param: { workspaceId }, query: { page: String(page) } })),
    queryKey: ["ats", workspaceId, "jobs", page],
  });
  return (
    <AtsListPage
      title={m.ats_job()}
      icon={IconBriefcase}
      toolbar={
        <JobForm
          workspaceId={workspaceId}
          onSuccess={async () => {
            await client.invalidateQueries({ queryKey: ["ats", workspaceId] });
            if (page !== 1) {
              onPage(1);
            }
          }}
        />
      }
      headings={[m.ats_job(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
        cells: [row.title, atsDate(row.createdAt)],
        id: row.id,
      }))}
      empty={m.ats_empty_jobs()}
      error={isError}
      page={page}
      pageSize={data?.pageSize ?? 20}
      total={data?.total ?? 0}
      onPage={onPage}
    />
  );
}
