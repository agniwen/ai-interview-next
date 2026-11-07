import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { IconBriefcase } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, useId, useMemo, useState } from "react";
import { JobFormSkeleton } from "@/components/skeletons/components/job-form-skeleton";
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
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, atsDate, jobDetailsQuery, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams } from "./list-search";
import type { JobListSearch } from "./list-search";
import { DepartmentSelect } from "./department-select";
import type { DepartmentOption } from "./department-select";
import { ProjectPreviewCard } from "./project-preview-card";
import { ProjectFilter, ProjectSelect } from "./project-select";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});
const maxJobRequirementsLength = 30_000;

function JobForm({
  job,
  workspaceId,
  onSuccess,
}: {
  job?: {
    department: string | null;
    departmentId: string | null;
    id: string;
    title: string;
    requirements: string;
    internalCriteria: string;
    projectId: string | null;
  };
  workspaceId: string;
  onSuccess: () => void;
}) {
  const client = useQueryClient();
  const formId = useId();
  const [department, setDepartment] = useState<DepartmentOption | null>(
    job?.departmentId && job.department ? { id: job.departmentId, name: job.department } : null,
  );
  const [projectId, setProjectId] = useState(job?.projectId ?? null);
  const [title, setTitle] = useState(job?.title ?? "");
  const [internalCriteria, setInternalCriteria] = useState(job?.internalCriteria ?? "");
  const [requirements, setRequirements] = useState(job?.requirements ?? "");
  const validRequirements =
    requirements.trim().length > 0 && requirements.length <= maxJobRequirementsLength;
  const mutation = useMutation({
    mutationFn: async () => {
      const json = {
        departmentId: department?.id ?? null,
        internalCriteria,
        requirements,
        title,
        version: 1 as const,
      };
      return readAts(
        job
          ? await atsApi.jobs[":id"].$put({
              json: { ...json, projectId },
              param: { id: job.id, workspaceId },
            })
          : await atsApi.jobs.$post({
              json: { ...json, projectId: projectId ?? undefined },
              param: { workspaceId },
            }),
      );
    },
    async onSuccess() {
      await Promise.all([
        client.invalidateQueries({ queryKey: atsKeys.jobs(workspaceId).queryKey }),
        client.invalidateQueries({ queryKey: atsKeys.projects(workspaceId)._ctx.detail._def }),
        ...(job
          ? [
              client.invalidateQueries({
                queryKey: atsKeys.applications(workspaceId)._ctx.list._def,
              }),
              client.invalidateQueries({
                queryKey: atsKeys.applications(workspaceId)._ctx.detail._def,
              }),
              client.invalidateQueries({
                queryKey: atsKeys.resumes(workspaceId)._ctx.list._def,
              }),
            ]
          : []),
      ]);
      onSuccess();
    },
  });

  return (
    <>
      <DialogPanel
        className="flex flex-col gap-4"
        render={
          <form
            id={formId}
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
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
          <FieldLabel htmlFor={`${formId}-title`}>{m.ats_job()}</FieldLabel>
          <Input
            id={`${formId}-title`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={200}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${formId}-department`}>{m.ats_department()}</FieldLabel>
          <DepartmentSelect
            id={`${formId}-department`}
            onChange={setDepartment}
            value={department}
            workspaceId={workspaceId}
          />
        </Field>
        <Field>
          <FieldLabel>{m.ats_project()}</FieldLabel>
          <ProjectSelect onChange={setProjectId} value={projectId} workspaceId={workspaceId} />
        </Field>
        <Field>
          <FieldLabel id={`${formId}-requirements-label`} htmlFor={`${formId}-requirements`}>
            {m.ats_requirements()}
          </FieldLabel>
          <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
            <MarkdownEditor
              id={`${formId}-requirements`}
              aria-labelledby={`${formId}-requirements-label`}
              aria-required="true"
              value={requirements}
              onChange={setRequirements}
              placeholder={m.ats_requirements_placeholder()}
              maxLength={maxJobRequirementsLength}
            />
          </SkeletonSuspense>
        </Field>
        <Field>
          <FieldLabel
            id={`${formId}-internal-criteria-label`}
            htmlFor={`${formId}-internal-criteria`}
          >
            {m.ats_internal_criteria()}
          </FieldLabel>
          <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
            <MarkdownEditor
              id={`${formId}-internal-criteria`}
              aria-labelledby={`${formId}-internal-criteria-label`}
              value={internalCriteria}
              onChange={setInternalCriteria}
              maxLength={maxJobRequirementsLength}
            />
          </SkeletonSuspense>
        </Field>
      </DialogPanel>
      <DialogFooter>
        <Button
          disabled={
            !title.trim() ||
            !validRequirements ||
            internalCriteria.length > maxJobRequirementsLength
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

function EditJobForm({
  id,
  onSuccess,
  workspaceId,
}: {
  id: string;
  onSuccess: () => void;
  workspaceId: string;
}) {
  const { data, isPending } = useQuery(jobDetailsQuery(workspaceId, id));
  const phase = useSkeletonPhase(isPending);
  if (phase === "pending") {
    return null;
  }
  if (phase === "skeleton") {
    return (
      <DialogPanel>
        <JobFormSkeleton />
      </DialogPanel>
    );
  }
  if (!data) {
    return (
      <DialogPanel>
        <Alert variant="error">
          <AlertDescription>{m.ats_error()}</AlertDescription>
        </Alert>
      </DialogPanel>
    );
  }
  return <JobForm job={data} onSuccess={onSuccess} workspaceId={workspaceId} />;
}

export function JobsPage({ workspaceId, query, onQueryChange }: AtsPageProps<JobListSearch>) {
  const dialog = useMemo(() => createDialogHandle<string>(), []);
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
        <DialogTrigger handle={dialog} render={<Button variant="outline" />}>
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
      hasRowActions
      headings={[m.ats_job(), m.ats_project(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
        action: (
          <DialogTrigger
            handle={dialog}
            payload={row.id}
            render={<Button size="sm" variant="outline" />}
          >
            {m.ats_edit()}
          </DialogTrigger>
        ),
        cells: [
          row.title,
          row.projectId && row.projectTitle ? (
            <ProjectPreviewCard
              key="project"
              id={row.projectId}
              title={row.projectTitle}
              workspaceId={workspaceId}
            />
          ) : (
            "—"
          ),
          atsDate(row.createdAt),
        ],
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
      <Dialog handle={dialog}>
        {({ payload }) => (
          <DialogPopup className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>{payload ? m.ats_edit_job() : m.ats_create_job()}</DialogTitle>
              {!payload && <DialogDescription>{m.ats_job_help()}</DialogDescription>}
            </DialogHeader>
            {payload ? (
              <EditJobForm
                id={payload}
                key={`${workspaceId}/${payload}`}
                onSuccess={() => dialog.close()}
                workspaceId={workspaceId}
              />
            ) : (
              <JobForm
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
