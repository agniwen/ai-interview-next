import { LocalTime } from "@/components/local-time";
import { MessageResponse } from "@/components/ai-elements/message-response";
import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { RecordPreviewCard } from "./record-preview-card";
import { IconBuilding } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { lazy, useId, useMemo, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
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
import { atsApi, readAts } from "./client";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams } from "./list-search";
import { atsKeys } from "./query-keys";

const MarkdownEditor = lazy(async () => {
  const { MarkdownEditor: Editor } = await import("@/components/ui/markdown-editor");
  return { default: Editor };
});
const maxDepartmentDescriptionLength = 30_000;

interface EditableDepartment {
  description: string;
  id: string;
  name: string;
}

function DepartmentForm({
  department,
  onSuccess,
  workspaceId,
}: {
  department?: EditableDepartment;
  onSuccess: () => void;
  workspaceId: string;
}) {
  const client = useQueryClient();
  const formId = useId();
  const [description, setDescription] = useState(department?.description ?? "");
  const [name, setName] = useState(department?.name ?? "");
  const mutation = useMutation({
    mutationFn: async () => {
      const json = { description, name, version: 1 as const };
      return readAts(
        department
          ? await atsApi.departments[":id"].$put({
              json,
              param: { id: department.id, workspaceId },
            })
          : await atsApi.departments.$post({ json, param: { workspaceId } }),
      );
    },
    async onSuccess() {
      await Promise.all([
        client.invalidateQueries({ queryKey: atsKeys.departments(workspaceId).queryKey }),
        ...(department
          ? [client.invalidateQueries({ queryKey: atsKeys.jobs(workspaceId)._ctx.detail._def })]
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
          <FieldLabel htmlFor={`${formId}-name`}>{m.ats_department_name()}</FieldLabel>
          <Input
            id={`${formId}-name`}
            maxLength={200}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </Field>
        <Field>
          <FieldLabel id={`${formId}-description-label`} htmlFor={`${formId}-description`}>
            {m.ats_department_description()}
          </FieldLabel>
          <SkeletonSuspense fallback={<MarkdownEditorSkeleton />}>
            <MarkdownEditor
              id={`${formId}-description`}
              aria-labelledby={`${formId}-description-label`}
              value={description}
              onChange={setDescription}
              maxLength={maxDepartmentDescriptionLength}
            />
          </SkeletonSuspense>
        </Field>
      </DialogPanel>
      <DialogFooter>
        <Button
          disabled={!name.trim() || description.length > maxDepartmentDescriptionLength}
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

export function DepartmentsPage({ workspaceId, query, onQueryChange }: AtsPageProps) {
  const dialog = useMemo(() => createDialogHandle<EditableDepartment>(), []);
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.departments.$get(
          { param: { workspaceId }, query: listParams(query) },
          { init: { signal } },
        ),
      ),
    queryKey: atsKeys.departments(workspaceId)._ctx.list(query).queryKey,
  });
  return (
    <AtsListPage
      title={m.ats_departments()}
      icon={IconBuilding}
      action={
        <DialogTrigger handle={dialog} render={<Button variant="outline" />}>
          {m.ats_create_department()}
        </DialogTrigger>
      }
      hasRowActions
      headings={[m.ats_department_name(), m.ats_date()]}
      rows={data?.rows.map((row) => ({
        action: (
          <DialogTrigger
            handle={dialog}
            payload={{ description: row.description, id: row.id, name: row.name }}
            render={<Button size="sm" variant="outline" />}
          >
            {m.ats_edit()}
          </DialogTrigger>
        ),
        cells: [
          <RecordPreviewCard key="department" title={row.name}>
            <dl className="text-xs">
              <dt className="text-muted-foreground">{m.ats_date()}</dt>
              <dd>
                <LocalTime value={row.createdAt} />
              </dd>
            </dl>
            {row.description && (
              <div className="flex min-w-0 flex-col gap-1.5 border-t pt-3">
                <h4 className="text-xs font-medium text-muted-foreground">
                  {m.ats_department_description()}
                </h4>
                <MessageResponse className="text-sm">{row.description}</MessageResponse>
              </div>
            )}
          </RecordPreviewCard>,
          <LocalTime key="date" value={row.createdAt} format="date" />,
        ],
        id: row.id,
      }))}
      empty={m.ats_empty_departments()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_departments()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <Dialog handle={dialog}>
        {({ payload }) => (
          <DialogPopup className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {payload ? m.ats_edit_department() : m.ats_create_department()}
              </DialogTitle>
            </DialogHeader>
            <DepartmentForm
              key={payload?.id ?? "create"}
              department={payload}
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
