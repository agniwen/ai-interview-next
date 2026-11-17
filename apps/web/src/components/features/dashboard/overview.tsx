import {
  IconArrowRight,
  IconCalendarEvent,
  IconClipboardCheck,
  IconFileCv,
} from "@tabler/icons-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { LocalTime } from "@/components/local-time";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";
import { atsApi, atsStatus, readAts } from "../ats/client";
import { listParams } from "../ats/list-search";
import type { ResumeListSearch } from "../ats/list-search";
import { atsKeys } from "../ats/query-keys";
import { ResumeCandidateDialog } from "../ats/resume-candidate-dialog";
import { interviewKeys, interviewsApi } from "../interviews/client";

const resumeSearch: ResumeListSearch = { owner: "me", page: 1, pageSize: 6, search: "" };

function Panel({
  action,
  children,
  icon,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section className="flex min-w-0 flex-col" aria-label={title}>
      <Frame className="flex-1">
        <FrameHeader className="min-h-12 flex-row flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <FrameTitle className="min-w-0">
            <h3 className="flex items-center gap-2">
              {icon}
              {title}
            </h3>
          </FrameTitle>
          {action}
        </FrameHeader>
        <FramePanel className="min-w-0 flex-1 p-0">{children}</FramePanel>
      </Frame>
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
      <output className="block space-y-2 px-4 py-3 sm:px-5" aria-label={m.ats_loading()}>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </output>
    );
  }
  return <p className="px-4 py-3 text-sm text-muted-foreground sm:px-5">{empty}</p>;
}

function InterviewTasks({
  workspaceId,
  todo,
}: {
  workspaceId: string;
  todo: "upcoming" | "evaluation";
}) {
  const evaluation = todo === "evaluation";
  const query = { page: "1", pageSize: "6", todo };
  const interviews = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await interviewsApi.personal.$get({ param: { workspaceId }, query }, { init: { signal } }),
      ),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.personal(query).queryKey,
    refetchInterval: evaluation ? false : 60_000,
  });
  const rows = interviews.data?.rows ?? [];
  const Icon = evaluation ? IconClipboardCheck : IconCalendarEvent;
  const detailLabel = evaluation
    ? m.interview_evaluation_review()
    : m.dashboard_interview_details();
  return (
    <Panel
      title={evaluation ? m.dashboard_todo_evaluations() : m.dashboard_todo_upcoming()}
      icon={<Icon aria-hidden="true" className="size-4 text-muted-foreground" />}
      action={
        !evaluation && (
          <Button
            size="sm"
            variant="ghost"
            render={
              <Link
                to="/w/$workspaceId/hub/interviews"
                params={{ workspaceId }}
                search={{ creatorId: "me" }}
              />
            }
          >
            {m.dashboard_view_all()}
            <IconArrowRight aria-hidden="true" />
          </Button>
        )
      }
    >
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const join = row.canJoinNow;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-5"
              >
                <div className="min-w-32 flex-1">
                  <p className="wrap-anywhere text-sm font-medium">
                    {row.candidateName} · {row.jobTitle}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.label || m.interviews_round({ number: row.sequence })}
                    {" · "}
                    <LocalTime value={evaluation ? row.endedAt : row.scheduledAt} />
                    {" · "}
                    {evaluation ? m.dashboard_todo_reviewer() : m.dashboard_todo_interviewer()}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={join ? "default" : "outline"}
                  render={
                    join ? (
                      <Link
                        to="/meet/$workspaceId/$roundId"
                        params={{ roundId: row.id, workspaceId }}
                      />
                    ) : (
                      <Link
                        to="/w/$workspaceId/hub/applications/$id/result/$roundId"
                        params={{ id: row.applicationId, roundId: row.id, workspaceId }}
                        search={{ tab: "interviews" }}
                      />
                    )
                  }
                >
                  {join ? m.meeting_join() : detailLabel}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ListState
          loading={interviews.isPending}
          failed={interviews.isError}
          empty={m.dashboard_todo_empty()}
          retry={() => interviews.refetch()}
        />
      )}
    </Panel>
  );
}

function FollowedResumes({
  workspaceId,
  taskOnly = false,
}: {
  workspaceId: string;
  taskOnly?: boolean;
}) {
  const query = taskOnly ? { ...resumeSearch, attention: "actionable" as const } : resumeSearch;
  const client = useQueryClient();
  const candidateDialog = useMemo(() => createDialogHandle<string>(), []);
  const resumes = useQuery({
    queryFn: async ({ signal }) =>
      readAts(
        await atsApi.resumes.$get(
          { param: { workspaceId }, query: listParams(query) },
          { init: { signal } },
        ),
      ),
    queryKey: atsKeys.resumes(workspaceId)._ctx.list(query).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.rows.some((row) => row.parseStatus === "queued" || row.parseStatus === "running")
        ? 5000
        : false,
  });
  const rows = resumes.data?.rows ?? [];
  return (
    <Panel
      title={taskOnly ? m.dashboard_todo_resumes() : m.dashboard_followed_resumes()}
      icon={<IconFileCv aria-hidden="true" className="size-4 text-muted-foreground" />}
      action={
        <Button
          size="sm"
          variant="ghost"
          render={
            <Link
              to="/w/$workspaceId/hub/resumes"
              params={{ workspaceId }}
              search={{ creatorId: "me" }}
            />
          }
        >
          {m.dashboard_view_all()}
          <IconArrowRight aria-hidden="true" />
        </Button>
      }
    >
      {rows.length ? (
        (taskOnly ? [true] : [true, false]).map((needsAttention) => {
          const group = rows.filter((row) => row.needsAttention === needsAttention);
          return (
            group.length > 0 && (
              <div key={String(needsAttention)} className="border-b border-border last:border-b-0">
                {!taskOnly && (
                  <h4 className="px-4 pt-3 text-xs font-medium text-muted-foreground sm:px-5">
                    {needsAttention ? m.dashboard_attention() : m.dashboard_resume_versions()}
                  </h4>
                )}
                <ul className="divide-y divide-border">
                  {group.map((row) => (
                    <li
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5 sm:px-5"
                    >
                      <div className="min-w-32 flex-1">
                        <p className="truncate text-sm font-medium" title={row.filename}>
                          {row.filename}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {row.linkedCandidateName && <>{row.linkedCandidateName} · </>}
                          {taskOnly && <>{m.dashboard_todo_uploaded()} · </>}
                          <LocalTime value={row.createdAt} format="date" />
                          {" · "}
                          {row.identityStatus === "pending_review"
                            ? m.ats_candidate_pending_review()
                            : atsStatus(row.parseStatus ?? row.status)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center">
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
                                search={{ creatorId: "me" }}
                              />
                            }
                          >
                            {taskOnly ? m.dashboard_todo_view_issue() : m.ats_view_resume()}
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
          empty={taskOnly ? m.dashboard_todo_empty() : m.dashboard_no_resumes()}
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

export function Overview({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section
        aria-label={m.dashboard_todo_title()}
        className="@container/todo flex min-w-0 flex-col gap-3"
      >
        <h2 className="text-lg font-semibold">{m.dashboard_todo_title()}</h2>
        <div className="grid gap-4 @min-[48rem]/todo:grid-cols-2 @min-[48rem]/todo:@max-[72rem]/todo:[&>*:last-child]:col-span-full @min-[72rem]/todo:grid-cols-3">
          <InterviewTasks workspaceId={workspaceId} todo="upcoming" />
          <InterviewTasks workspaceId={workspaceId} todo="evaluation" />
          <FollowedResumes workspaceId={workspaceId} taskOnly />
        </div>
      </section>
      <FollowedResumes workspaceId={workspaceId} />
    </div>
  );
}
