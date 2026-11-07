import { LocalTime } from "@/components/local-time";
import { IconFolders } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, useId, useMemo, useState } from "react";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { ProjectFormSkeleton } from "@/components/skeletons/components/project-form-skeleton";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
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
import { atsApi, projectDetailsQuery, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { ProjectPreviewCard } from "./project-preview-card";
import { listParams } from "./list-search";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});
const maxProjectDescriptionLength = 30_000;

interface EditableProject {
  id: string;
  title: string;
}

function ProjectForm({
  onSuccess,
  project,
  workspaceId,
}: {
  onSuccess: () => void;
  project?: EditableProject & { description: string };
  workspaceId: string;
}) {
  const client = useQueryClient();
  const formId = useId();
  const [title, setTitle] = useState(project?.title ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const mutation = useMutation({
    mutationFn: async () => {
      const json = { description, title, version: 1 as const };
      return readAts(
        project
          ? await atsApi.projects[":id"].$put({ json, param: { id: project.id, workspaceId } })
          : await atsApi.projects.$post({ json, param: { workspaceId } }),
      );
    },
    async onSuccess() {
      await Promise.all([
        client.invalidateQueries({ queryKey: atsKeys.projects(workspaceId).queryKey }),
        ...(project
          ? [
              client.invalidateQueries({ queryKey: atsKeys.jobs(workspaceId)._ctx.list._def }),
              client.invalidateQueries({ queryKey: atsKeys.jobs(workspaceId)._ctx.detail._def }),
              client.invalidateQueries({
                queryKey: atsKeys.applications(workspaceId)._ctx.detail._def,
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
          <FieldLabel htmlFor={`${formId}-title`}>{m.ats_project_name()}</FieldLabel>
          <Input
            id={`${formId}-title`}
            maxLength={200}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </Field>
        <Field>
          <FieldLabel id={`${formId}-description-label`} htmlFor={`${formId}-description`}>
            {m.ats_project_description()}
          </FieldLabel>
          <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
            <MarkdownEditor
              id={`${formId}-description`}
              aria-labelledby={`${formId}-description-label`}
              value={description}
              onChange={setDescription}
              maxLength={maxProjectDescriptionLength}
            />
          </SkeletonSuspense>
        </Field>
      </DialogPanel>
      <DialogFooter>
        <Button
          disabled={!title.trim() || description.length > maxProjectDescriptionLength}
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

function EditProjectForm({
  id,
  workspaceId,
  onSuccess,
}: {
  id: string;
  workspaceId: string;
  onSuccess: () => void;
}) {
  const { data, isPending } = useQuery(projectDetailsQuery(workspaceId, id));
  const phase = useSkeletonPhase(isPending);
  if (phase === "pending") {
    return null;
  }
  if (phase === "skeleton") {
    return (
      <DialogPanel>
        <ProjectFormSkeleton />
      </DialogPanel>
    );
  }
  if (!data) {
    return (
      <DialogPanel>
        <output>{m.ats_error()}</output>
      </DialogPanel>
    );
  }
  return <ProjectForm project={data} workspaceId={workspaceId} onSuccess={onSuccess} />;
}

export function ProjectsPage({ workspaceId, query, onQueryChange }: AtsPageProps) {
  const dialog = useMemo(() => createDialogHandle<EditableProject>(), []);
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.projects.$get(
          { param: { workspaceId }, query: listParams(query) },
          { init: { signal } },
        ),
      ),
    queryKey: atsKeys.projects(workspaceId)._ctx.list(query).queryKey,
  });
  return (
    <AtsListPage
      action={
        <DialogTrigger handle={dialog} render={<Button variant="outline" />}>
          {m.ats_create_project()}
        </DialogTrigger>
      }
      title={m.ats_projects()}
      icon={IconFolders}
      hasRowActions
      headings={[m.ats_project_name(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
        action: (
          <DialogTrigger
            handle={dialog}
            payload={{ id: row.id, title: row.title }}
            render={<Button size="sm" variant="outline" />}
          >
            {m.ats_edit()}
          </DialogTrigger>
        ),
        cells: [
          <ProjectPreviewCard
            key="project"
            id={row.id}
            title={row.title}
            workspaceId={workspaceId}
          />,
          <LocalTime key="date" value={row.createdAt} format="date" />,
        ],
        id: row.id,
      }))}
      empty={m.ats_empty_projects()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_projects()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <Dialog handle={dialog}>
        {({ payload }) => (
          <DialogPopup className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{payload ? m.ats_edit_project() : m.ats_create_project()}</DialogTitle>
              {!payload && <DialogDescription>{m.ats_create_project_help()}</DialogDescription>}
            </DialogHeader>
            {payload ? (
              <EditProjectForm
                id={payload.id}
                workspaceId={workspaceId}
                onSuccess={() => dialog.close()}
              />
            ) : (
              <ProjectForm
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
