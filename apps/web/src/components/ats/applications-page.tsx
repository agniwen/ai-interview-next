import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { IconListDetails } from "@tabler/icons-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableFilterSelect } from "@/components/layout/table-filters";
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
import { Skeleton } from "@/components/ui/skeleton";
import { UserColumn } from "@/components/user-column";
import * as m from "@/paraglide/messages";
import { atsKeys } from "./query-keys";
import { atsApi, atsDate, atsStatus, readAts } from "./client";
import { CreateApplicationDialog } from "./create-application-dialog";
import { AtsListPage } from "./list-page";
import type { AtsPageProps } from "./list-page";
import { listParams, applicationStatuses } from "./list-search";
import type { ApplicationListSearch } from "./list-search";
import { ProjectFilter } from "./project-select";

function ApplicationHistory({ workspaceId, id }: { workspaceId: string; id: string }) {
  const { data, isError } = useQuery({
    queryFn: async () =>
      readAts(await atsApi.applications[":id"].$get({ param: { id, workspaceId } })),
    queryKey: atsKeys.applications(workspaceId)._ctx.history(id).queryKey,
  });
  const phase = useSkeletonPhase(!data && !isError);
  return (
    <DialogPopup>
      <DialogHeader>
        <DialogTitle>{m.ats_history()}</DialogTitle>
        <DialogDescription>{m.ats_history_help()}</DialogDescription>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-4">
        {phase === "ready" && isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )}
        {phase === "ready" && !isError && data && (
          <>
            {data.activity.map((entry) => (
              <div key={entry.id} className="flex flex-col gap-1">
                <p className="text-sm font-medium">
                  {entry.result.reason === "job_changed" ? m.ats_transferred() : m.ats_closed()}
                </p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <time dateTime={entry.occurredAt}>{atsDate(entry.occurredAt, "short")}</time>
                  <span aria-hidden="true">·</span>
                  {entry.actorType === "system" ? (
                    <span>{m.ats_system()}</span>
                  ) : (
                    <UserColumn
                      user={{ image: entry.actorImage, name: entry.actorName ?? entry.actorId }}
                    />
                  )}
                </div>
              </div>
            ))}
            {data.evaluations.map((evaluation) => (
              <div key={evaluation.id} className="flex flex-col gap-1 border-t pt-3">
                <p className="text-sm font-medium">
                  {m.ats_evaluation()}{" "}
                  {typeof evaluation.result.score === "number"
                    ? `${evaluation.result.score}/100`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {typeof evaluation.result.summary === "string" ? evaluation.result.summary : "—"}
                </p>
              </div>
            ))}
            {!data.activity.length && !data.evaluations.length && (
              <p className="text-sm text-muted-foreground">{m.ats_empty_history()}</p>
            )}
          </>
        )}
        {phase === "skeleton" && (
          <div aria-busy="true" aria-label={m.ats_loading()}>
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </DialogPanel>
    </DialogPopup>
  );
}

export function ApplicationsPage({
  workspaceId,
  query,
  onQueryChange,
}: AtsPageProps<ApplicationListSearch>) {
  const historyDialog = useMemo(() => createDialogHandle<string>(), []);
  const closeDialog = useMemo(() => createDialogHandle<string>(), []);
  const createDialog = useMemo(() => createDialogHandle<string>(), []);
  const client = useQueryClient();
  const param = { workspaceId };
  const refresh = () =>
    client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey });
  const { data, isError, refetch } = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.applications.$get({ param, query: listParams(query) }, { init: { signal } }),
      ),
    queryKey: atsKeys.applications(workspaceId)._ctx.list(query).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.rows.some(
        (row) => row.evaluationStatus === "queued" || row.evaluationStatus === "running",
      )
        ? 5000
        : false,
  });
  const retry = useMutation({
    mutationFn: async (id: string) =>
      readAts(await atsApi.runs[":id"].retry.$post({ param: { ...param, id } })),
    onSuccess: refresh,
  });
  const close = useMutation({
    mutationFn: async (id: string) =>
      readAts(await atsApi.applications[":id"].close.$post({ param: { ...param, id } })),
    async onSuccess() {
      await refresh();
      closeDialog.close();
    },
  });
  return (
    <AtsListPage
      title={m.ats_applications()}
      icon={IconListDetails}
      action={
        <DialogTrigger handle={createDialog} render={<Button variant="outline" />}>
          {m.ats_create_application()}
        </DialogTrigger>
      }
      filters={
        <>
          <ProjectFilter
            onChange={(projectId) => onQueryChange({ page: 1, projectId: projectId ?? undefined })}
            value={query.projectId ?? null}
            workspaceId={workspaceId}
          />
          <TableFilterSelect
            label={m.ats_status()}
            onChange={(status) => onQueryChange({ page: 1, status: status || undefined })}
            options={[
              { label: m.ats_all_statuses(), value: "" },
              ...applicationStatuses.map((status) => ({
                label: status === "open" ? m.ats_open() : m.ats_closed(),
                value: status,
              })),
            ]}
            value={query.status ?? ""}
          />
        </>
      }
      feedback={
        retry.isError && (
          <Alert variant="error">
            <AlertDescription>{m.ats_error()}</AlertDescription>
          </Alert>
        )
      }
      headings={[
        m.ats_candidate(),
        m.ats_job(),
        m.ats_status(),
        m.ats_evaluation(),
        m.ats_date(),
        m.ats_action(),
      ]}
      rows={data?.rows.map((row) => {
        const { evaluationRunId } = row;
        return {
          cells: [
            row.candidateName,
            row.jobTitle,
            <Badge key="status" variant="outline">
              {row.closedAt ? m.ats_closed() : m.ats_open()}
            </Badge>,
            atsStatus(row.evaluationStatus),
            atsDate(row.createdAt),
            <div key="actions" className="flex gap-1">
              {!row.closedAt && evaluationRunId && row.evaluationStatus === "failed" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retry.isPending}
                  onClick={() => retry.mutate(evaluationRunId)}
                >
                  {m.ats_retry()}
                </Button>
              )}
              {!row.closedAt && (
                <DialogTrigger
                  handle={closeDialog}
                  payload={row.id}
                  render={<Button size="sm" variant="outline" />}
                  onClick={() => close.reset()}
                >
                  {m.ats_close_application()}
                </DialogTrigger>
              )}
              <DialogTrigger
                handle={historyDialog}
                payload={row.id}
                render={<Button size="sm" variant="outline" />}
              >
                {m.ats_history()}
              </DialogTrigger>
            </div>,
          ],
          id: row.id,
        };
      })}
      empty={m.ats_empty_applications()}
      error={isError}
      query={query}
      searchPlaceholder={m.ats_search_applications()}
      total={data?.total ?? 0}
      onQueryChange={onQueryChange}
      onRefresh={refetch}
    >
      <CreateApplicationDialog handle={createDialog} workspaceId={workspaceId} />
      <Dialog handle={closeDialog}>
        {({ payload }) =>
          payload && (
            <DialogPopup>
              <DialogHeader>
                <DialogTitle>{m.ats_close_application()}</DialogTitle>
                <DialogDescription>{m.ats_close_help()}</DialogDescription>
              </DialogHeader>
              {close.isError && (
                <DialogPanel>
                  <Alert variant="error">
                    <AlertDescription>{m.ats_error()}</AlertDescription>
                  </Alert>
                </DialogPanel>
              )}
              <DialogFooter>
                <Button
                  variant="destructive"
                  disabled={close.isPending}
                  onClick={() => close.mutate(payload)}
                >
                  {m.ats_close_application()}
                </Button>
              </DialogFooter>
            </DialogPopup>
          )
        }
      </Dialog>
      <Dialog handle={historyDialog}>
        {({ payload }) => payload && <ApplicationHistory workspaceId={workspaceId} id={payload} />}
      </Dialog>
    </AtsListPage>
  );
}
