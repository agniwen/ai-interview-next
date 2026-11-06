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

function ProjectForm({ onSuccess, workspaceId }: { onSuccess: () => void; workspaceId: string }) {
  const client = useQueryClient();
  const formId = useId();
  const [title, setTitle] = useState("");
  const mutation = useMutation({
    mutationFn: async () =>
      readAts(await atsApi.projects.$post({ json: { title, version: 1 }, param: { workspaceId } })),
    async onSuccess() {
      await client.invalidateQueries({ queryKey: atsKeys.projects(workspaceId).queryKey });
      onSuccess();
    },
  });
  return (
    <>
      <DialogHeader>
        <DialogTitle>{m.ats_create_project()}</DialogTitle>
        <DialogDescription>{m.ats_create_project_help()}</DialogDescription>
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
          <FieldLabel htmlFor="ats-project-title">{m.ats_project_name()}</FieldLabel>
          <Input
            id="ats-project-title"
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
  const createDialog = useMemo(() => createDialogHandle(), []);
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
        <DialogTrigger handle={createDialog} render={<Button variant="outline" />}>
          {m.ats_create_project()}
        </DialogTrigger>
      }
      title={m.ats_projects()}
      icon={IconFolders}
      headings={[m.ats_project_name(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
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
      <Dialog handle={createDialog}>
        <DialogPopup>
          <ProjectForm
            workspaceId={workspaceId}
            onSuccess={() => {
              createDialog.close();
              if (query.page !== 1) {
                onQueryChange({ page: 1 });
              }
            }}
          />
        </DialogPopup>
      </Dialog>
    </AtsListPage>
  );
}
