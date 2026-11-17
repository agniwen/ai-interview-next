import {
  IconArrowRight,
  IconCalendarEvent,
  IconClipboardCheck,
  IconFileCv,
  IconInbox,
  IconListDetails,
} from "@tabler/icons-react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import { LocalTime } from "@/components/local-time";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia } from "@/components/ui/empty";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";
import { atsApi, atsStatus, getResumeCandidateDisplay, readAts } from "../ats/client";
import { CreateApplicationDialog } from "../ats/create-application-dialog";
import { listParams } from "../ats/list-search";
import type { ApplicationListSearch, ResumeListSearch } from "../ats/list-search";
import { atsKeys } from "../ats/query-keys";
import { ResumeCandidateDialog } from "../ats/resume-candidate-dialog";
import { interviewKeys, interviewsApi } from "../interviews/client";
import { VirtualListTable } from "@/components/layout/virtual-list-table";
import type { virtualListFeatures } from "@/components/layout/virtual-list-table";

const followedColumnWidths = [undefined, "45%"];

const applicationSearch: ApplicationListSearch = {
  creatorId: "me",
  page: 1,
  pageSize: 20,
  search: "",
  status: "open",
};

const resumeSearch: ResumeListSearch = { owner: "me", page: 1, pageSize: 20, search: "" };

async function readFollowedResumes(workspaceId: string, page: number, signal: AbortSignal) {
  return readAts(
    await atsApi.resumes.$get(
      { param: { workspaceId }, query: listParams({ ...resumeSearch, page }) },
      { init: { signal } },
    ),
  );
}

async function readFollowedApplications(workspaceId: string, page: number, signal: AbortSignal) {
  return readAts(
    await atsApi.applications.$get(
      { param: { workspaceId }, query: listParams({ ...applicationSearch, page }) },
      { init: { signal } },
    ),
  );
}

interface ResumePreviewPayload {
  filename: string;
  id: string;
  submissionId?: string;
}
type FollowedResume = Awaited<ReturnType<typeof readFollowedResumes>>["rows"][number];
type FollowedApplication = Awaited<ReturnType<typeof readFollowedApplications>>["rows"][number];
const resumeColumn = createColumnHelper<typeof virtualListFeatures, FollowedResume>();
const applicationColumn = createColumnHelper<typeof virtualListFeatures, FollowedApplication>();

function nextListPage({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  return page * pageSize < total ? page + 1 : undefined;
}

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
            <h2 className="flex items-center gap-2">
              {icon}
              {title}
            </h2>
          </FrameTitle>
          {action}
        </FrameHeader>
        <FramePanel className="flex min-h-36 min-w-0 flex-1 flex-col p-0">{children}</FramePanel>
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
  return (
    <Empty className="py-4 md:py-4">
      <EmptyHeader>
        <EmptyMedia className="mb-2" variant="icon">
          <IconInbox aria-hidden="true" />
        </EmptyMedia>
        <EmptyDescription>{empty}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

function CandidateSummary({
  children,
  row,
  workspaceId,
}: {
  children: ReactNode;
  row: { candidateAvatarResumeId: string | null; candidateName: string | null; jobTitle: string };
  workspaceId: string;
}) {
  const candidate = getResumeCandidateDisplay(workspaceId, row);
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar aria-hidden="true" className="ring-1 ring-foreground/10 [--avatar-size:28px]">
        <AvatarImage alt="" referrerPolicy="no-referrer" src={candidate?.image} />
        <AvatarFallback>{candidate?.name.slice(0, 1).toUpperCase() ?? "—"}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="wrap-anywhere text-sm font-medium">
          {candidate?.name ?? "—"} · {row.jobTitle}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{children}</p>
      </div>
    </div>
  );
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
        <ul>
          {rows.map((row) => {
            const join = row.canJoinNow;
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b border-border px-4 py-2.5 sm:px-5"
              >
                <div className="min-w-32 flex-1">
                  <CandidateSummary row={row} workspaceId={workspaceId}>
                    {row.label || m.interviews_round({ number: row.sequence })}
                    {" · "}
                    <LocalTime value={evaluation ? row.endedAt : row.scheduledAt} />
                    {" · "}
                    {evaluation ? m.dashboard_todo_reviewer() : m.dashboard_todo_interviewer()}
                  </CandidateSummary>
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

function ResumeOverviewAction({
  filename,
  id,
  preview,
  previewDialog,
  submissionId,
  workspaceId,
}: {
  filename: string;
  id: string;
  preview: boolean;
  previewDialog: ReturnType<typeof createDialogHandle<ResumePreviewPayload>>;
  submissionId: string | null;
  workspaceId: string;
}) {
  if (preview) {
    return (
      <DialogTrigger
        handle={previewDialog}
        payload={{ filename, id, submissionId: submissionId ?? undefined }}
        render={<Button size="sm" variant="outline" />}
      >
        {m.ats_resume_details()}
      </DialogTrigger>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      render={
        <Link
          to="/w/$workspaceId/hub/resumes/$id"
          params={{ id, workspaceId }}
          search={{ from: "dashboard" }}
        />
      }
    >
      {m.dashboard_todo_view_issue()}
    </Button>
  );
}

function ResumeRecruitmentAction({
  handle,
  inRecruitment,
  resumeId,
  workspaceId,
}: {
  handle?: ReturnType<typeof createDialogHandle<string>>;
  inRecruitment: boolean;
  resumeId: string | null;
  workspaceId: string;
}) {
  if (inRecruitment) {
    return (
      <Button disabled size="sm" variant="outline">
        {m.dashboard_already_recruiting()}
      </Button>
    );
  }
  if (!resumeId) {
    return null;
  }
  return handle ? (
    <DialogTrigger
      handle={handle}
      payload={resumeId}
      render={<Button size="sm" variant="outline" />}
    >
      {m.ats_join_recruitment()}
    </DialogTrigger>
  ) : (
    <CreateApplicationDialog resumeId={resumeId} workspaceId={workspaceId} />
  );
}

function ResumeSummary({ row }: { row: FollowedResume }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <ResumeDocumentFileIcon
        className="size-6 shrink-0"
        kind={getResumeDocumentFileIconKind({ fileName: row.filename })}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={row.filename}>
          {row.filename}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.linkedCandidateName && <>{row.linkedCandidateName} · </>}
          <LocalTime value={row.createdAt} format="date" />
          {" · "}
          {row.identityStatus === "pending_review"
            ? m.ats_candidate_pending_review()
            : atsStatus(row.parseStatus ?? row.status)}
        </p>
      </div>
    </div>
  );
}

function buildFollowedResumesColumns(
  previewDialog: ReturnType<typeof createDialogHandle<ResumePreviewPayload>>,
  recruitmentDialog: ReturnType<typeof createDialogHandle<string>>,
  workspaceId: string,
) {
  return resumeColumn.columns([
    resumeColumn.display({
      cell: ({ row }) => <ResumeSummary row={row.original} />,
      header: m.ats_resumes(),
      id: "resume",
    }),
    resumeColumn.display({
      cell: ({ row: { original: row } }) => (
        <div className="flex flex-wrap justify-end gap-2">
          <ResumeRecruitmentAction
            handle={recruitmentDialog}
            inRecruitment={row.inRecruitment}
            resumeId={row.parseStatus === "succeeded" ? row.resumeId : null}
            workspaceId={workspaceId}
          />
          <ResumeOverviewAction
            filename={row.filename}
            id={row.id}
            preview={row.status === "accepted"}
            previewDialog={previewDialog}
            submissionId={row.identityStatus === "pending_review" ? row.submissionId : null}
            workspaceId={workspaceId}
          />
        </div>
      ),
      header: m.ats_action(),
      id: "actions",
    }),
  ]);
}

function FollowedResumes({ workspaceId }: { workspaceId: string }) {
  const client = useQueryClient();
  const candidateDialog = useMemo(() => createDialogHandle<string>(), []);
  const recruitmentDialog = useMemo(() => createDialogHandle<string>(), []);
  const previewDialog = useMemo(() => createDialogHandle<ResumePreviewPayload>(), []);
  const resumes = useInfiniteQuery({
    getNextPageParam: nextListPage,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => readFollowedResumes(workspaceId, pageParam, signal),
    queryKey: atsKeys.resumes(workspaceId)._ctx.list(resumeSearch)._ctx.infinite.queryKey,
    refetchInterval: ({ state }) =>
      state.data?.pages.some((page) =>
        page.rows.some((row) => row.parseStatus === "queued" || row.parseStatus === "running"),
      )
        ? 5000
        : false,
  });
  const rows = useMemo(
    () => resumes.data?.pages.flatMap((page) => page.rows) ?? [],
    [resumes.data],
  );
  const columns = useMemo(
    () => buildFollowedResumesColumns(previewDialog, recruitmentDialog, workspaceId),
    [previewDialog, recruitmentDialog, workspaceId],
  );
  const title = m.dashboard_followed_resumes();
  return (
    <Panel
      title={title}
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
        <VirtualListTable
          className="[&_th:last-child]:text-end"
          columns={columns}
          columnWidths={followedColumnWidths}
          data={rows}
          hasNextPage={resumes.hasNextPage}
          isFetching={resumes.isFetching}
          isFetchingNextPage={resumes.isFetchingNextPage}
          isFetchNextPageError={resumes.isFetchNextPageError}
          label={title}
          loadingLabel={m.ats_loading()}
          retryLabel={m.ats_retry()}
          loadMore={resumes.fetchNextPage}
          total={resumes.data?.pages.at(-1)?.total ?? rows.length}
        />
      ) : (
        <ListState
          loading={resumes.isPending}
          failed={resumes.isError}
          empty={m.dashboard_no_resumes()}
          retry={() => resumes.refetch()}
        />
      )}
      <CreateApplicationDialog handle={recruitmentDialog} workspaceId={workspaceId} />
      <Dialog handle={previewDialog}>
        {({ payload }) => {
          if (!payload) {
            return null;
          }
          const row = rows.find(({ id }) => id === payload.id);
          return (
            <ResumePreviewDialog
              key={payload.id}
              filename={payload.filename}
              id={payload.id}
              workspaceId={workspaceId}
              actions={
                <>
                  {payload.submissionId && (
                    <DialogTrigger
                      handle={candidateDialog}
                      payload={payload.submissionId}
                      render={<Button size="sm" variant="outline" />}
                    >
                      {m.ats_review()}
                    </DialogTrigger>
                  )}
                  {row && (
                    <ResumeRecruitmentAction
                      inRecruitment={row.inRecruitment}
                      resumeId={row.parseStatus === "succeeded" ? row.resumeId : null}
                      workspaceId={workspaceId}
                    />
                  )}
                </>
              }
            />
          );
        }}
      </Dialog>
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

function buildFollowedApplicationsColumns(workspaceId: string) {
  return applicationColumn.columns([
    applicationColumn.display({
      cell: ({ row: { original: row } }) => (
        <CandidateSummary row={row} workspaceId={workspaceId}>
          {m.ats_open()} · <LocalTime value={row.createdAt} format="date" />
        </CandidateSummary>
      ),
      header: m.ats_applications(),
      id: "application",
    }),
    applicationColumn.display({
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                to="/w/$workspaceId/hub/applications/$id"
                params={{ id: row.id, workspaceId }}
                search={{ creatorId: "me", status: "open" }}
              />
            }
          >
            {m.ats_view_application()}
          </Button>
        </div>
      ),
      header: m.ats_action(),
      id: "actions",
    }),
  ]);
}

function FollowedApplications({ workspaceId }: { workspaceId: string }) {
  const applications = useInfiniteQuery({
    getNextPageParam: nextListPage,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => readFollowedApplications(workspaceId, pageParam, signal),
    queryKey: atsKeys.applications(workspaceId)._ctx.list(applicationSearch)._ctx.infinite.queryKey,
  });
  const rows = useMemo(
    () => applications.data?.pages.flatMap((page) => page.rows) ?? [],
    [applications.data],
  );
  const columns = useMemo(() => buildFollowedApplicationsColumns(workspaceId), [workspaceId]);
  return (
    <Panel
      title={m.dashboard_followed_applications()}
      icon={<IconListDetails aria-hidden="true" className="size-4 text-muted-foreground" />}
      action={
        <Button
          size="sm"
          variant="ghost"
          render={
            <Link
              to="/w/$workspaceId/hub/applications"
              params={{ workspaceId }}
              search={{ creatorId: "me", status: "open" }}
            />
          }
        >
          {m.dashboard_view_all()}
          <IconArrowRight aria-hidden="true" />
        </Button>
      }
    >
      {rows.length ? (
        <VirtualListTable
          className="[&_th:last-child]:text-end"
          columns={columns}
          columnWidths={followedColumnWidths}
          data={rows}
          hasNextPage={applications.hasNextPage}
          isFetching={applications.isFetching}
          isFetchingNextPage={applications.isFetchingNextPage}
          isFetchNextPageError={applications.isFetchNextPageError}
          label={m.dashboard_followed_applications()}
          loadingLabel={m.ats_loading()}
          retryLabel={m.ats_retry()}
          loadMore={applications.fetchNextPage}
          total={applications.data?.pages.at(-1)?.total ?? rows.length}
        />
      ) : (
        <ListState
          loading={applications.isPending}
          failed={applications.isError}
          empty={m.dashboard_no_open_applications()}
          retry={() => applications.refetch()}
        />
      )}
    </Panel>
  );
}

export function Overview({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <section aria-label={m.dashboard_todo_title()} className="@container/todo min-w-0">
        <div className="grid gap-4 @min-[48rem]/todo:grid-cols-2">
          <InterviewTasks workspaceId={workspaceId} todo="upcoming" />
          <InterviewTasks workspaceId={workspaceId} todo="evaluation" />
        </div>
      </section>
      <div className="@container/followed min-w-0">
        <div className="grid gap-4 @min-[48rem]/followed:grid-cols-2">
          <FollowedApplications workspaceId={workspaceId} />
          <FollowedResumes workspaceId={workspaceId} />
        </div>
      </div>
    </div>
  );
}
