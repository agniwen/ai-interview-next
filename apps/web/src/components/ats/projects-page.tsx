import { IconFolders } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
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
  project?: EditableProject;
  workspaceId: string;
}) {
  const client = useQueryClient();
  const formId = useId();
  const [title, setTitle] = useState(project?.title ?? "");
  const mutation = useMutation({
    mutationFn: async () => {
      const json = { title, version: 1 as const };
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
          ? [client.invalidateQueries({ queryKey: atsKeys.jobs(workspaceId)._ctx.list._def })]
          : []),
      ]);
      onSuccess();
    },
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>{project ? m.ats_edit_project() : m.ats_create_project()}</DialogTitle>
        {!project && <DialogDescription>{m.ats_create_project_help()}</DialogDescription>}
      </DialogHeader>
      <DialogPanel
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
      </DialogPanel>
      <DialogFooter>
        <Button disabled={!title.trim()} form={formId} loading={mutation.isPending} type="submit">
          {m.ats_save()}
        </Button>
      </DialogFooter>
    </>
  );
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
        cells: [row.title, atsDate(row.createdAt)],
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
          <DialogPopup>
            <ProjectForm
              key={payload?.id}
              project={payload}
              workspaceId={workspaceId}
              onSuccess={() => {
                dialog.close();
                if (!payload && query.page !== 1) {
                  onQueryChange({ page: 1 });
                }
              }}
            />
          </DialogPopup>
        )}
      </Dialog>
    </AtsListPage>
  );
}
