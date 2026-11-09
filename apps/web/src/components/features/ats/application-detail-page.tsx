import { LocalTime } from "@/components/local-time";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { InterviewListSkeleton } from "@/components/skeletons/components/interview-list-skeleton";
import { IconArrowLeft, IconCircleOff, IconTrash, IconX } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { lazy, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message-response";
import {
  getResumeProfileBasics,
  ResumeProfileDocument,
} from "@/components/features/document-preview/resume-profile-document";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import { PageHeader, PageHeaderContent } from "@/components/layout/page-header";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { ApplicationDetailSkeleton } from "@/components/skeletons/pages/application-detail-skeleton";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Popover,
  PopoverClose,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { Toolbar, ToolbarButton, ToolbarSeparator } from "@/components/ui/toolbar";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { UserColumn } from "@/components/user-column";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import { ProjectPreviewCard } from "./project-preview-card";
import { JobPreviewCard } from "./job-preview-card";
import { ApplicationEvaluations } from "./application-evaluations";
import { ApplicationEvaluationComposer } from "./application-evaluation-composer";
import { ApplicationStatusBadge } from "./application-status-badge";
import { CandidateResumesDialog } from "./candidate-resumes-dialog";
import { atsApi, readAts } from "./client";
import type { ApplicationDetailSearch, ApplicationTab } from "./list-search";
import { atsKeys } from "./query-keys";

const ApplicationInterviews = lazy(async () => {
  const module = await import("../interviews/application-interviews");
  return { default: module.ApplicationInterviews };
});

async function readApplicationDetail(
  param: { id: string; workspaceId: string },
  signal: AbortSignal,
) {
  const response = await atsApi.applications[":id"].$get({ param }, { init: { signal } });
  return response.status === 404 ? null : readAts(response);
}

export type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof readApplicationDetail>>>;
type ApplicationActorDetails = Pick<
  ApplicationDetail["activity"][number],
  "actorId" | "actorType" | "actorImage" | "actorName"
>;
const applicationColumnsClassName =
  "grid items-start gap-8 @min-[56rem]:grid-cols-[minmax(0,1fr)_clamp(18rem,25cqw,24rem)]";

function CloseApplicationDialog({ id, workspaceId }: { id: string; workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const close = useMutation({
    mutationFn: async () =>
      readAts(await atsApi.applications[":id"].close.$post({ param: { id, workspaceId } })),
    async onSuccess() {
      await client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey });
      setOpen(false);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<ToolbarButton render={<Button size="sm" variant="outline" />} />}
        onClick={() => close.reset()}
      >
        <IconCircleOff aria-hidden="true" data-icon="inline-start" />
        {m.ats_close_application()}
      </DialogTrigger>
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
          <Button variant="destructive" loading={close.isPending} onClick={() => close.mutate()}>
            <IconCircleOff aria-hidden="true" data-icon="inline-start" />
            {m.ats_close_application()}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}

function DeleteApplicationPopover({
  id,
  onDeleted,
  workspaceId,
}: {
  id: string;
  onDeleted: () => Promise<void>;
  workspaceId: string;
}) {
  const client = useQueryClient();
  const remove = useMutation({
    mutationFn: async () =>
      readAts(await atsApi.applications[":id"].$delete({ param: { id, workspaceId } })),
    async onSuccess() {
      const { detail, list } = atsKeys.applications(workspaceId)._ctx;
      await onDeleted();
      client.removeQueries({ queryKey: detail(id).queryKey });
      await client.invalidateQueries({ queryKey: list._def });
    },
  });
  return (
    <Popover>
      <PopoverTrigger
        render={
          <ToolbarButton
            disabled={remove.isPending}
            render={<Button size="sm" variant="destructive" />}
          />
        }
        onClick={() => remove.reset()}
      >
        <IconTrash aria-hidden="true" data-icon="inline-start" />
        {m.ats_delete_application()}
      </PopoverTrigger>
      <PopoverPopup align="end" side="top" className="w-72 max-w-(--available-width)">
        <div className="flex flex-col gap-3">
          <PopoverTitle className="text-sm">{m.ats_delete_application_title()}</PopoverTitle>
          <PopoverDescription>{m.ats_delete_application_help()}</PopoverDescription>
          {remove.isError && (
            <Alert variant="error">
              <AlertDescription>{m.ats_error()}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <PopoverClose
              render={<Button disabled={remove.isPending} size="sm" variant="outline" />}
            >
              <IconX aria-hidden="true" data-icon="inline-start" />
              {m.ws_cancel()}
            </PopoverClose>
            <Button
              loading={remove.isPending}
              onClick={() => remove.mutate()}
              size="sm"
              variant="destructive"
            >
              <IconTrash aria-hidden="true" data-icon="inline-start" />
              {m.ats_delete_application()}
            </Button>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function ApplicationActor({
  actor,
  className,
}: {
  actor?: ApplicationActorDetails | null;
  className?: string;
}) {
  if (!actor) {
    return <span className="text-muted-foreground">{m.ats_application_creator_unrecorded()}</span>;
  }
  if (actor.actorType === "system") {
    if (actor.actorId === "sainoa-agent" || actor.actorName) {
      return (
        <UserColumn
          className={className}
          user={{ image: "/logo.png", name: actor.actorName ?? m.ats_evaluation_ai() }}
        />
      );
    }
    return <span>{m.ats_system()}</span>;
  }
  return (
    <UserColumn
      className={className}
      user={{ image: actor.actorImage, name: actor.actorName ?? actor.actorId }}
    />
  );
}

function ApplicationResumeFile({
  resume,
  variant = "filename",
  workspaceId,
}: {
  resume: NonNullable<ApplicationDetail["resume"]>;
  variant?: "filename" | "icon";
  workspaceId: string;
}) {
  const filename = resume.filename ?? m.ats_unnamed_resume();
  const icon = (
    <ResumeDocumentFileIcon kind={getResumeDocumentFileIconKind({ fileName: resume.filename })} />
  );
  return resume.uploadId ? (
    <Dialog>
      {variant === "icon" ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <DialogTrigger
                aria-label={`${m.resume_preview_original()} · ${filename}`}
                render={<ToolbarButton render={<Button size="icon-sm" variant="outline" />} />}
              />
            }
          >
            {icon}
          </TooltipTrigger>
          <TooltipPopup>
            {m.resume_preview_original()} · {filename}
          </TooltipPopup>
        </Tooltip>
      ) : (
        <DialogTrigger
          className="block max-w-full cursor-pointer truncate rounded-sm text-start underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          title={filename}
        >
          {filename}
        </DialogTrigger>
      )}
      <ResumePreviewDialog filename={filename} id={resume.uploadId} workspaceId={workspaceId} />
    </Dialog>
  ) : (
    <span title={filename}>{variant === "icon" ? icon : filename}</span>
  );
}

function ApplicationHeader({
  application,
  resume,
  resumeProfile,
  workspaceId,
}: Pick<ApplicationDetail, "application" | "resume" | "resumeProfile"> & {
  workspaceId: string;
}) {
  const {
    candidateId,
    candidateName,
    closedAt,
    createdAt,
    jobId,
    jobTitle,
    linkedCandidateName,
    outcome,
    projectId,
    projectTitle,
  } = application;
  const basics = resumeProfile && getResumeProfileBasics(resumeProfile);
  return (
    <header className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar aria-hidden="true" className="[--avatar-size:--spacing(14)]">
          {resume?.hasAvatar && (
            <AvatarImage
              alt=""
              src={atsApi.resumes[":id"].avatar.$path({ param: { id: resume.id, workspaceId } })}
            />
          )}
          <AvatarFallback>{candidateName?.slice(0, 1).toUpperCase() ?? "—"}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h1 className="wrap-anywhere text-2xl font-semibold tracking-tight">
            {candidateName ?? m.ats_application_detail()}
          </h1>
          <ApplicationStatusBadge closedAt={closedAt} outcome={outcome} />
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 @min-[23.5rem]:grid-cols-2 @min-[36rem]:grid-cols-3 @min-[48.5rem]:grid-cols-4 *:min-w-0 [&_dd]:mt-0.5 [&_dd]:truncate [&_dd]:text-sm [&_dt]:text-xs [&_dt]:text-muted-foreground">
        <div>
          <dt>{m.ats_linked_candidate()}</dt>
          <dd>
            <Dialog<string>>
              {({ payload }) => (
                <>
                  <DialogTrigger
                    className="block max-w-full cursor-pointer truncate rounded-sm text-start underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                    payload={candidateId}
                    title={linkedCandidateName}
                  >
                    {linkedCandidateName}
                  </DialogTrigger>
                  {payload && (
                    <CandidateResumesDialog
                      id={payload}
                      name={linkedCandidateName}
                      workspaceId={workspaceId}
                    />
                  )}
                </>
              )}
            </Dialog>
          </dd>
        </div>
        <div>
          <dt>{m.ats_job()}</dt>
          <dd className="font-medium">
            <JobPreviewCard id={jobId} title={jobTitle} workspaceId={workspaceId} />
          </dd>
        </div>
        {projectId && projectTitle && (
          <div>
            <dt>{m.ats_project()}</dt>
            <dd>
              <ProjectPreviewCard id={projectId} title={projectTitle} workspaceId={workspaceId} />
            </dd>
          </div>
        )}
        <div>
          <dt>{m.ats_creator()}</dt>
          <dd>
            <ApplicationActor actor={application.creator} className="max-w-full" />
          </dd>
        </div>
        <div>
          <dt>{m.ats_date()}</dt>
          <dd>
            <LocalTime value={createdAt} />
          </dd>
        </div>
        <div>
          <dt>{m.ats_application_resume()}</dt>
          <dd>
            {resume ? <ApplicationResumeFile resume={resume} workspaceId={workspaceId} /> : "—"}
          </dd>
        </div>
        {basics?.contacts.map(({ detail, href, label, value }, index) => {
          const contact = detail ? `${value} (${detail})` : value;
          return (
            <div key={`${value}-${index}`}>
              <dt>{label}</dt>
              <dd title={contact ?? undefined}>
                {href ? (
                  <a
                    className="underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-current"
                    href={href}
                  >
                    {contact}
                  </a>
                ) : (
                  contact
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </header>
  );
}

function ApplicationActivityItem({
  actor,
  body,
  label,
  occurredAt,
}: {
  actor?: ApplicationActorDetails | null;
  body?: string;
  label: string;
  occurredAt: string;
}) {
  return (
    <li className="relative flex min-w-0 flex-col gap-1 before:absolute before:-start-5 before:top-1.5 before:size-2 before:rounded-full before:bg-muted-foreground/50 before:ring-2 before:ring-background">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <ApplicationActor actor={actor} />
        <LocalTime className="text-xs" value={occurredAt} />
      </div>
      {body && (
        <MessageResponse className="mt-1 rounded-md bg-muted/50 px-2.5 py-2 text-muted-foreground">
          {body}
        </MessageResponse>
      )}
    </li>
  );
}

function ApplicationActivity({
  activity,
  application,
  feedback,
}: Pick<ApplicationDetail, "activity" | "application" | "feedback">) {
  const feedbackById = new Map(feedback.map((entry) => [entry.id, entry.body]));
  return (
    <aside
      aria-label={m.ats_history()}
      className="flex min-w-0 flex-col gap-4 border-t pt-4 @min-[56rem]:sticky @min-[56rem]:top-16 @min-[56rem]:border-t-0 @min-[56rem]:ps-5 @min-[56rem]:pt-0"
    >
      <h2 className="text-sm font-semibold">{m.ats_history()}</h2>
      <ol className="ms-1 flex flex-col gap-4 border-s ps-4">
        {activity.map((entry) => {
          let label = m.ats_closed();
          if (entry.action === "created") {
            label = m.ats_application_created();
          } else if (entry.action === "evaluation_completed") {
            label = m.ats_activity_evaluation_completed();
          } else if (entry.action === "feedback_added") {
            label = m.ats_activity_feedback_added();
          } else if (entry.action === "interview_created") {
            label = m.ats_activity_interview_created();
          } else if (entry.action === "interview_started") {
            label = m.ats_activity_interview_started();
          } else if (entry.action === "interview_ended") {
            label = m.ats_activity_interview_ended();
          } else if (entry.action === "interview_evaluation_submitted") {
            label = m.interview_evaluation_activity();
          } else if (entry.result.reason === "job_changed") {
            label = m.ats_transferred();
          }
          return (
            <ApplicationActivityItem
              actor={entry}
              body={entry.result.feedbackId ? feedbackById.get(entry.result.feedbackId) : undefined}
              key={entry.id}
              label={
                entry.result.interview
                  ? `${label} · ${m.interviews_round({ number: entry.result.interview.sequence })}${entry.result.interview.label ? ` · ${entry.result.interview.label}` : ""}`
                  : label
              }
              occurredAt={entry.occurredAt}
            />
          );
        })}
        {!activity.some((entry) => entry.action === "created") && (
          <ApplicationActivityItem
            actor={application.creator}
            label={m.ats_application_created()}
            occurredAt={application.createdAt}
          />
        )}
      </ol>
    </aside>
  );
}

function ApplicationDetailContent({
  application,
  activity,
  evaluations,
  feedback,
  onDeleted,
  resume,
  resumeProfile,
  workspaceId,
  tab,
  onTabChange,
}: ApplicationDetail & {
  onDeleted: () => Promise<void>;
  workspaceId: string;
  tab: ApplicationTab;
  onTabChange: (tab: ApplicationTab) => void;
}) {
  const profile = resumeProfile?.version === 1 ? resumeProfile : null;
  return (
    <>
      <ApplicationHeader
        application={application}
        resume={resume}
        resumeProfile={profile}
        workspaceId={workspaceId}
      />
      <Tabs
        value={tab}
        onValueChange={(value) => onTabChange(value as ApplicationTab)}
        className="w-full min-w-0 flex-1 gap-4"
      >
        <TabsList
          aria-label={m.ats_application_detail()}
          className="w-full justify-start border-b"
          variant="underline"
        >
          <TabsTab className="grow-0" value="overview">
            {m.ats_application_overview()}
          </TabsTab>
          <TabsTab className="grow-0" value="evaluation">
            {m.ats_evaluation()}
          </TabsTab>
          <TabsTab className="grow-0" value="interviews">
            {m.interviews_title()}
          </TabsTab>
        </TabsList>
        <div className={applicationColumnsClassName}>
          <div className="relative min-w-0">
            <TabsPanel motion="page" value="overview">
              {profile ? (
                <ResumeProfileDocument profile={profile} layout="inline" />
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>{m.ats_empty_standard_resume()}</EmptyTitle>
                  </EmptyHeader>
                </Empty>
              )}
            </TabsPanel>
            <TabsPanel motion="page" value="interviews" keepMounted>
              <SkeletonSuspense fallback={<InterviewListSkeleton />}>
                <ApplicationInterviews
                  workspaceId={workspaceId}
                  applicationId={application.id}
                  closed={Boolean(application.closedAt)}
                />
              </SkeletonSuspense>
            </TabsPanel>
            <TabsPanel motion="page" value="evaluation" keepMounted>
              <ApplicationEvaluations
                application={application}
                evaluations={evaluations}
                feedback={feedback}
                workspaceId={workspaceId}
              />
            </TabsPanel>
          </div>
          <ApplicationActivity activity={activity} application={application} feedback={feedback} />
        </div>
      </Tabs>
      <div
        hidden={tab !== "evaluation"}
        className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mb-[env(safe-area-inset-bottom)] w-full shrink-0 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <div className={applicationColumnsClassName}>
          <div className="relative isolate min-w-0 before:pointer-events-none before:absolute before:inset-x-0 before:-top-8 before:-bottom-6 before:-z-1 before:bg-linear-to-t before:from-background before:from-40% before:to-transparent sm:px-11">
            <div className="mx-auto w-4/5">
              <ApplicationEvaluationComposer
                applicationId={application.id}
                workspaceId={workspaceId}
              />
            </div>
          </div>
        </div>
      </div>
      {tab === "overview" &&
        (resume?.uploadId || !application.closedAt || application.canDelete) && (
          <div
            className={cn(
              applicationColumnsClassName,
              "pointer-events-none sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mb-[env(safe-area-inset-bottom)] w-full shrink-0 md:bottom-[calc(1.5rem+env(safe-area-inset-bottom))]",
            )}
          >
            <Toolbar
              aria-label={m.ats_action()}
              className="pointer-events-auto w-fit max-w-full items-center justify-self-center gap-1 border-border/70 bg-card/95 p-1.5 shadow-xs/5 backdrop-blur-md"
            >
              {resume?.uploadId && (
                <ApplicationResumeFile resume={resume} variant="icon" workspaceId={workspaceId} />
              )}
              {resume?.uploadId && (!application.closedAt || application.canDelete) && (
                <ToolbarSeparator orientation="vertical" />
              )}
              {!application.closedAt && (
                <CloseApplicationDialog id={application.id} workspaceId={workspaceId} />
              )}
              {!application.closedAt && application.canDelete && (
                <ToolbarSeparator orientation="vertical" />
              )}
              {application.canDelete && (
                <DeleteApplicationPopover
                  id={application.id}
                  onDeleted={onDeleted}
                  workspaceId={workspaceId}
                />
              )}
            </Toolbar>
          </div>
        )}
    </>
  );
}

/**
 * 招聘记录详情入口：加载简历、评价与活动记录，并协调概览、评价和面试页签及关闭、删除操作。
 * Application detail entry: loads resume, evaluations and activity, and coordinates tabs plus close and delete actions.
 */
export function ApplicationDetailPage({
  id,
  search,
  workspaceId,
  onTabChange,
}: {
  id: string;
  search: ApplicationDetailSearch;
  onTabChange: (tab: ApplicationTab) => void;
  workspaceId: string;
}) {
  const { tab, ...listSearch } = search;
  const router = useRouter();
  const masked = useLocation({ select: (location) => Boolean(location.maskedLocation) });
  const canGoBack = useCanGoBack();
  const backToList = masked && canGoBack;
  const { data, isError, isPending, refetch } = useQuery({
    queryFn: ({ signal }) => readApplicationDetail({ id, workspaceId }, signal),
    queryKey: atsKeys.applications(workspaceId)._ctx.detail(id).queryKey,
    refetchInterval: ({ state }) => {
      const status = state.data?.application.evaluationStatus;
      return status === "queued" || status === "running" ? 5000 : false;
    },
  });
  const phase = useSkeletonPhase(isPending);
  let content;
  if (phase === "skeleton") {
    content = <ApplicationDetailSkeleton />;
  } else if (phase === "ready") {
    if (data) {
      content = (
        <ApplicationDetailContent
          key={id}
          {...data}
          tab={tab}
          onTabChange={onTabChange}
          onDeleted={() =>
            router.navigate({
              params: { workspaceId },
              replace: true,
              search: listSearch,
              to: "/w/$workspaceId/hub/applications",
            })
          }
          workspaceId={workspaceId}
        />
      );
    } else if (isError) {
      content = (
        <Alert variant="error">
          <AlertDescription>{m.ats_error()}</AlertDescription>
          <AlertAction>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void refetch();
              }}
            >
              {m.ats_retry()}
            </Button>
          </AlertAction>
        </Alert>
      );
    } else {
      content = (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{m.ats_application_unavailable()}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      );
    }
  }

  return (
    <>
      <PageHeaderContent>
        <Button
          variant="ghost"
          size="sm"
          onClick={backToList ? () => router.history.back() : undefined}
          render={
            backToList ? undefined : (
              <Link
                to="/w/$workspaceId/hub/applications"
                params={{ workspaceId }}
                search={listSearch}
              />
            )
          }
        >
          <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
          {m.ats_back_to_applications()}
        </Button>
      </PageHeaderContent>
      <div className="@container mx-auto flex w-full max-w-[96rem] flex-1 flex-col gap-6">
        {phase === "ready" && !data && <PageHeader title={m.ats_application_detail()} />}
        {content}
      </div>
    </>
  );
}
