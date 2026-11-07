import { IconDeviceFloppy } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { lazy, useId, useState } from "react";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, readAts } from "./client";
import { DepartmentSelect } from "./department-select";
import type { DepartmentOption } from "./department-select";
import { ProjectSelect } from "./project-select";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});
const maxJobRequirementsLength = 30_000;

export function JobForm({
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
    <form
      className="flex min-w-0 flex-1 flex-col gap-6"
      id={formId}
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
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
      <Toolbar
        aria-label={m.ats_action()}
        className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto mt-auto mb-[env(safe-area-inset-bottom)] w-fit max-w-full shrink-0 items-center gap-1 border-border/70 bg-card/95 p-1.5 shadow-xs/5 backdrop-blur-md md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <ToolbarButton
          render={<Button size="sm" variant="outline" loading={mutation.isPending} />}
          disabled={
            mutation.isPending ||
            !title.trim() ||
            !validRequirements ||
            internalCriteria.length > maxJobRequirementsLength
          }
          form={formId}
          type="submit"
        >
          <IconDeviceFloppy aria-hidden="true" />
          {m.ats_save()}
        </ToolbarButton>
      </Toolbar>
    </form>
  );
}
