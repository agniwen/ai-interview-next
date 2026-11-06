import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { IconBriefcase } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, useMemo, useState } from "react";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, atsDate, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams } from "./list-search";
import type { JobListSearch } from "./list-search";
import { ProjectFilter, ProjectSelect } from "./project-select";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});
const maxJobRequirementsLength = 30_000;

function JobForm({
  handle,
  workspaceId,
  onSuccess,
}: {
  handle: ReturnType<typeof createDialogHandle>;
  workspaceId: string;
  onSuccess: () => void;
}) {
  const client = useQueryClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [requirements, setRequirements] = useState("");
  const validRequirements =
    requirements.trim().length > 0 && requirements.length <= maxJobRequirementsLength;
  const mutation = useMutation({
    mutationFn: async () =>
      readAts(
        await atsApi.jobs.$post({
          json: { projectId: projectId ?? undefined, requirements, title, version: 1 },
          param: { workspaceId },
        }),
      ),
    async onSuccess() {
      await client.invalidateQueries({ queryKey: atsKeys.jobs(workspaceId).queryKey });
      handle.close();
      onSuccess();
    },
  });
  return (
    <Dialog
      handle={handle}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) {
          setProjectId(null);
          setTitle("");
          setRequirements("");
          mutation.reset();
        }
      }}
    >
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
              <FieldLabel>{m.ats_project()}</FieldLabel>
              <ProjectSelect onChange={setProjectId} value={projectId} workspaceId={workspaceId} />
            </Field>
            <Field>
              <FieldLabel id="ats-job-requirements-label" htmlFor="ats-job-requirements">
                {m.ats_requirements()}
              </FieldLabel>
              <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
                <MarkdownEditor
                  id="ats-job-requirements"
                  aria-labelledby="ats-job-requirements-label"
                  aria-required="true"
                  value={requirements}
                  onChange={setRequirements}
                  placeholder={m.ats_requirements_placeholder()}
                  maxLength={maxJobRequirementsLength}
                />
              </SkeletonSuspense>
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

export function JobsPage({ workspaceId, query, onQueryChange }: AtsPageProps<JobListSearch>) {
  const createDialog = useMemo(() => createDialogHandle(), []);
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.jobs.$get(
          { param: { workspaceId }, query: listParams(query) },
          { init: { signal } },
        ),
      ),
    queryKey: atsKeys.jobs(workspaceId)._ctx.list(query).queryKey,
  });
  return (
    <AtsListPage
      title={m.ats_job()}
      icon={IconBriefcase}
      action={
        <DialogTrigger handle={createDialog} render={<Button variant="outline" />}>
          {m.ats_create_job()}
        </DialogTrigger>
      }
      filters={
        <ProjectFilter
          onChange={(projectId) => onQueryChange({ page: 1, projectId: projectId ?? undefined })}
          value={query.projectId ?? null}
          workspaceId={workspaceId}
        />
      }
      headings={[m.ats_job(), m.ats_project(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
        cells: [row.title, row.projectTitle ?? "—", atsDate(row.createdAt)],
        id: row.id,
      }))}
      empty={m.ats_empty_jobs()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_jobs()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <JobForm
        handle={createDialog}
        workspaceId={workspaceId}
        onSuccess={() => {
          if (query.page !== 1) {
            onQueryChange({ page: 1 });
          }
        }}
      />
    </AtsListPage>
  );
}
