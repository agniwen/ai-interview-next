import { IconArrowRight, IconCalendarEvent, IconFileCv } from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { z } from "zod";
import { TableFilterSelect } from "@/components/layout/table-filters";
import { LocalTime } from "@/components/local-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";
import { atsApi, atsStatus, readAts } from "../ats/client";
import { listParams, listSearch } from "../ats/list-search";
import type { ResumeListSearch } from "../ats/list-search";
import { atsKeys } from "../ats/query-keys";
import { ResumeCandidateDialog } from "../ats/resume-candidate-dialog";
import { interviewKeys, interviewsApi } from "../interviews/client";
import { interviewKindLabel, interviewRoundStatusLabel } from "../interviews/round-labels";

export const overviewSearch = listSearch.pick({ page: true, pageSize: true }).extend({
  role: z.enum(["interviewer", "uploader"]).optional().catch(undefined),
  view: z.literal("interviews").optional().catch(undefined),
});
type OverviewSearch = z.output<typeof overviewSearch>;
const resumeSearch: ResumeListSearch = { owner: "me", page: 1, pageSize: 6, search: "" };
const dashboardRoute = "/w/$workspaceId/hub/dashboard";

function Panel({
  action,
  children,
  icon,
  title,
}: {
  action: ReactNode;
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section
      className="flex min-h-72 min-w-0 flex-col rounded-xl border border-border bg-card"
      aria-label={title}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

function ListState({
  loading,
  failed,
  empty,
  retry,
}: {
  loading: boolean;
  failed: boolean;
  empty: string;
  retry: () => void;
}) {
  if (failed) {
    return (
      <Alert className="m-4" variant="error">
        <AlertDescription className="flex flex-wrap items-center gap-2">
          {m.ats_error()}
          <Button size="xs" variant="outline" onClick={retry}>
            {m.ats_retry()}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (loading) {
    return (
      <output className="block space-y-4 px-5 py-5" aria-label={m.ats_loading()}>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-3/5" />
      </output>
    );
  }
  return (
    <p className="grid flex-1 place-items-center px-5 py-8 text-center text-sm text-muted-foreground">
      {empty}
    </p>
  );
}

function Interviews({
  workspaceId,
  search,
  onSearchChange,
}: {
  workspaceId: string;
  search: OverviewSearch;
  onSearchChange: (changes: Partial<OverviewSearch>) => void;
}) {
  const expanded = search.view === "interviews";
  const query = {
    page: String(expanded ? search.page : 1),
    pageSize: String(expanded ? search.pageSize : 6),
    role: expanded ? search.role : undefined,
  };
  const interviews = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await interviewsApi.personal.$get({ param: { workspaceId }, query }, { init: { signal } }),
      ),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.personal(query).queryKey,
  });
  const rows = interviews.data?.rows ?? [];
  const pages = Math.max(1, Math.ceil((interviews.data?.total ?? 0) / search.pageSize));
  return (
    <Panel
      title={m.dashboard_my_interviews()}
      icon={<IconCalendarEvent aria-hidden="true" className="size-4 text-muted-foreground" />}
      action={
        expanded ? (
          <Button
            size="sm"
            variant="ghost"
            render={<Link to={dashboardRoute} params={{ workspaceId }} search={{}} />}
          >
            {m.dashboard_show_overview()}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            render={
              <Link to={dashboardRoute} params={{ workspaceId }} search={{ view: "interviews" }} />
            }
          >
            {m.dashboard_view_all()}
            <IconArrowRight aria-hidden="true" />
          </Button>
        )
      }
    >
      {expanded && (
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <TableFilterSelect
            label={m.dashboard_all_roles()}
            value={search.role ?? ""}
            options={[
              { label: m.dashboard_all_roles(), value: "" },
              { label: m.meeting_interviewer(), value: "interviewer" },
              { label: m.dashboard_uploader(), value: "uploader" },
            ]}
            onChange={(role) => onSearchChange({ page: 1, role: role || undefined })}
          />
        </div>
      )}
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {row.candidateName} · {row.jobTitle}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {interviewKindLabel(row.kind)} ·{" "}
                  {row.label || m.interviews_round({ number: row.sequence })}
                  {row.scheduledAt && (
                    <>
                      {" "}
                      · <LocalTime value={row.scheduledAt} format="dateTime" />
                    </>
                  )}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge variant={row.status === "in_progress" ? "info" : "secondary"}>
                    {interviewRoundStatusLabel(row)}
                  </Badge>
                  {row.interviewer && <Badge variant="outline">{m.meeting_interviewer()}</Badge>}
                  {row.uploader && <Badge variant="outline">{m.dashboard_uploader()}</Badge>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {row.canJoin && (
                  <Button
                    size="sm"
                    render={
                      <Link
                        to="/meet/$workspaceId/$roundId"
                        params={{ roundId: row.id, workspaceId }}
                      />
                    }
                  >
                    {m.meeting_join()}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      to="/w/$workspaceId/hub/applications/$id/result/$roundId"
                      params={{ id: row.applicationId, roundId: row.id, workspaceId }}
                      search={{ tab: "interviews" }}
                    />
                  }
                >
                  {row.needsEvaluation
                    ? m.interview_evaluation_review()
                    : m.dashboard_interview_details()}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <ListState
          loading={interviews.isPending}
          failed={interviews.isError}
          empty={m.dashboard_no_interviews()}
          retry={() => interviews.refetch()}
        />
      )}
      {expanded && (pages > 1 || search.page > 1) && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-3 sm:px-5">
          <span className="mr-1 text-xs text-muted-foreground">
            {m.dashboard_page_count({ page: search.page, total: pages })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={search.page === 1}
            onClick={() => onSearchChange({ page: search.page - 1 })}
          >
            {m.ats_previous()}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={search.page >= pages}
            onClick={() => onSearchChange({ page: search.page + 1 })}
          >
            {m.ats_next()}
          </Button>
        </div>
      )}
    </Panel>
  );
}

function FollowedResumes({ workspaceId }: { workspaceId: string }) {
  const client = useQueryClient();
  const candidateDialog = useMemo(() => createDialogHandle<string>(), []);
  const resumes = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.resumes.$get(
          { param: { workspaceId }, query: listParams(resumeSearch) },
          { init: { signal } },
        ),
      ),
    queryKey: atsKeys.resumes(workspaceId)._ctx.list(resumeSearch).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.rows.some((row) => row.parseStatus === "queued" || row.parseStatus === "running")
        ? 5000
        : false,
  });
  const rows = resumes.data?.rows ?? [];
  return (
    <Panel
      title={m.dashboard_followed_resumes()}
      icon={<IconFileCv aria-hidden="true" className="size-4 text-muted-foreground" />}
      action={
        <Button
          size="sm"
          variant="ghost"
          render={
            <Link
              to="/w/$workspaceId/hub/resumes"
              params={{ workspaceId }}
              search={{ owner: "me" }}
            />
          }
        >
          {m.dashboard_view_all()}
          <IconArrowRight aria-hidden="true" />
        </Button>
      }
    >
      {rows.length ? (
        [true, false].map((needsAttention) => {
          const group = rows.filter((row) => row.needsAttention === needsAttention);
          return (
            group.length > 0 && (
              <div key={String(needsAttention)} className="border-b border-border last:border-b-0">
                <h3 className="px-4 pt-3 text-xs font-medium text-muted-foreground sm:px-5">
                  {needsAttention ? m.dashboard_attention() : m.dashboard_resume_versions()}
                </h3>
                <ul className="divide-y divide-border">
                  {group.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium" title={row.filename}>
                          {row.filename}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.linkedCandidateName && <>{row.linkedCandidateName} · </>}
                          <LocalTime value={row.createdAt} format="date" />
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">
                          {row.identityStatus === "pending_review"
                            ? m.ats_candidate_pending_review()
                            : atsStatus(row.parseStatus ?? row.status)}
                        </Badge>
                        {row.identityStatus === "pending_review" && row.submissionId ? (
                          <DialogTrigger
                            handle={candidateDialog}
                            payload={row.submissionId}
                            render={<Button size="sm" variant="outline" />}
                          >
                            {m.ats_review()}
                          </DialogTrigger>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            render={
                              <Link
                                to="/w/$workspaceId/hub/resumes/$id"
                                params={{ id: row.id, workspaceId }}
                                search={{ owner: "me" }}
                              />
                            }
                          >
                            {m.ats_view_resume()}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )
          );
        })
      ) : (
        <ListState
          loading={resumes.isPending}
          failed={resumes.isError}
          empty={m.dashboard_no_resumes()}
          retry={() => resumes.refetch()}
        />
      )}
      <Dialog handle={candidateDialog}>
        {({ payload }) =>
          payload && (
            <ResumeCandidateDialog
              key={payload}
              submissionId={payload}
              workspaceId={workspaceId}
              onClose={() => candidateDialog.close()}
              onSuccess={async () => {
                await Promise.all([
                  client.invalidateQueries({ queryKey: atsKeys.resumes(workspaceId).queryKey }),
                  client.invalidateQueries({ queryKey: atsKeys.candidates(workspaceId).queryKey }),
                ]);
              }}
            />
          )
        }
      </Dialog>
    </Panel>
  );
}

export function Overview({
  workspaceId,
  search,
  onSearchChange,
}: {
  workspaceId: string;
  search: OverviewSearch;
  onSearchChange: (changes: Partial<OverviewSearch>) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className={search.view === "interviews" ? "" : "grid auto-rows-fr gap-5 lg:grid-cols-2"}>
        <Interviews workspaceId={workspaceId} search={search} onSearchChange={onSearchChange} />
        {search.view !== "interviews" && <FollowedResumes workspaceId={workspaceId} />}
      </div>
    </div>
  );
}
