import { IconArrowLeft } from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  getResumeProfileBasics,
  ResumeBadgeList,
  ResumeProfileDocument,
} from "@/components/features/document-preview/resume-profile-document";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import { PageHeader, PageHeaderContent } from "@/components/layout/page-header";
import { ApplicationDetailSkeleton } from "@/components/skeletons/pages/application-detail-skeleton";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { UserColumn } from "@/components/user-column";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { atsApi, atsDate, atsStatus, readAts } from "./client";
import type { ApplicationListSearch } from "./list-search";
import { atsKeys } from "./query-keys";

async function readApplicationDetail(
  param: { id: string; workspaceId: string },
  signal: AbortSignal,
) {
  const response = await atsApi.applications[":id"].$get({ param }, { init: { signal } });
  return response.status === 404 ? null : readAts(response);
}

type ApplicationDetail = NonNullable<Awaited<ReturnType<typeof readApplicationDetail>>>;
type ApplicationActorDetails = NonNullable<ApplicationDetail["application"]["creator"]>;

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
      <DialogTrigger render={<Button size="sm" variant="outline" />} onClick={() => close.reset()}>
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
        render={<Button disabled={remove.isPending} size="sm" variant="destructive-outline" />}
        onClick={() => remove.reset()}
      >
        {m.ats_delete_application()}
      </PopoverTrigger>
      <PopoverPopup align="end" className="w-72">
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
              {m.ws_cancel()}
            </PopoverClose>
            <Button
              loading={remove.isPending}
              onClick={() => remove.mutate()}
              size="sm"
              variant="destructive"
            >
              {m.ats_delete_application()}
            </Button>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function ApplicationActor({ actor }: { actor?: ApplicationActorDetails | null }) {
  if (!actor) {
    return <span className="text-muted-foreground">{m.ats_application_creator_unrecorded()}</span>;
  }
  if (actor.actorType === "system") {
    return <span>{m.ats_system()}</span>;
  }
  return <UserColumn user={{ image: actor.actorImage, name: actor.actorName ?? actor.actorId }} />;
}

function ApplicationResumeFile({
  resume,
  workspaceId,
}: {
  resume: NonNullable<ApplicationDetail["resume"]>;
  workspaceId: string;
}) {
  const filename = resume.filename ?? m.ats_unnamed_resume();
  return resume.uploadId ? (
    <Dialog>
      <DialogTrigger className="cursor-pointer rounded-sm text-start wrap-anywhere underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground focus-visible:outline-2 focus-visible:outline-ring">
        {filename}
      </DialogTrigger>
      <ResumePreviewDialog filename={filename} id={resume.uploadId} workspaceId={workspaceId} />
    </Dialog>
  ) : (
    filename
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
  const { candidateName, closedAt, createdAt, jobTitle, projectTitle } = application;
  const basics = resumeProfile && getResumeProfileBasics(resumeProfile);
  return (
    <header className="flex min-w-0 flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar aria-hidden="true" className="[--avatar-size:--spacing(14)]">
          <AvatarFallback>{candidateName.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-col items-start gap-1">
          <h1 className="wrap-anywhere text-2xl font-semibold tracking-tight">{candidateName}</h1>
          <Badge variant="outline">{closedAt ? m.ats_closed() : m.ats_open()}</Badge>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 @min-[23.5rem]:grid-cols-2 @min-[36rem]:grid-cols-3 @min-[48.5rem]:grid-cols-4 *:min-w-0 [&_dd]:mt-0.5 [&_dd]:text-sm [&_dd]:wrap-anywhere [&_dt]:text-xs [&_dt]:text-muted-foreground">
        <div>
          <dt>{m.ats_candidate()}</dt>
          <dd>{candidateName}</dd>
        </div>
        <div>
          <dt>{m.ats_job()}</dt>
          <dd className="font-medium">{jobTitle}</dd>
        </div>
        {projectTitle && (
          <div>
            <dt>{m.ats_project()}</dt>
            <dd>{projectTitle}</dd>
          </div>
        )}
        <div>
          <dt>{m.ats_creator()}</dt>
          <dd>
            <ApplicationActor actor={application.creator} />
          </dd>
        </div>
        <div>
          <dt>{m.ats_date()}</dt>
          <dd>
            <time dateTime={createdAt}>{atsDate(createdAt, "short")}</time>
          </dd>
        </div>
        <div>
          <dt>{m.ats_application_resume()}</dt>
          <dd>
            {resume ? <ApplicationResumeFile resume={resume} workspaceId={workspaceId} /> : "—"}
          </dd>
        </div>
        {basics?.contacts.map(({ detail, label, value }, index) => (
          <div key={`${value}-${index}`}>
            <dt>{label}</dt>
            <dd>
              {value}
              {detail && <span className="ms-1.5">({detail})</span>}
            </dd>
          </div>
        ))}
        {basics && basics.targetRoles.length > 0 && (
          <div>
            <dt>{m.resume_profile_target_roles()}</dt>
            <dd>
              <ResumeBadgeList labels={basics.targetRoles} size="lg" />
            </dd>
          </div>
        )}
      </dl>
    </header>
  );
}

function ApplicationEvaluations({
  application,
  evaluations,
  workspaceId,
}: Pick<ApplicationDetail, "application" | "evaluations"> & { workspaceId: string }) {
  const { evaluationRunId, evaluationStatus } = application;
  const client = useQueryClient();
  const retry = useMutation({
    mutationFn: async (id: string) =>
      readAts(await atsApi.runs[":id"].retry.$post({ param: { id, workspaceId } })),
    onSuccess: () =>
      client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey }),
  });
  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{m.ats_evaluation()}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {evaluationStatus && <Badge variant="outline">{atsStatus(evaluationStatus)}</Badge>}
          {!application.closedAt && evaluationRunId && evaluationStatus === "failed" && (
            <Button
              loading={retry.isPending}
              onClick={() => retry.mutate(evaluationRunId)}
              size="sm"
              variant="outline"
            >
              {m.ats_retry()}
            </Button>
          )}
        </div>
      </header>
      {retry.isError && (
        <Alert variant="error">
          <AlertDescription>{m.ats_error()}</AlertDescription>
        </Alert>
      )}
      {evaluations.length ? (
        <ul className="divide-y">
          {evaluations.map((evaluation) => (
            <li key={evaluation.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <time dateTime={evaluation.createdAt} className="text-muted-foreground">
                  {atsDate(evaluation.createdAt, "short")}
                </time>
                {typeof evaluation.result.score === "number" && (
                  <Badge variant="outline">{evaluation.result.score}/100</Badge>
                )}
              </div>
              <p className="text-sm wrap-anywhere whitespace-pre-wrap">
                {typeof evaluation.result.summary === "string" ? evaluation.result.summary : "—"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{m.ats_empty_evaluations()}</p>
      )}
    </section>
  );
}

function ApplicationActivityItem({
  actor,
  label,
  occurredAt,
}: {
  actor?: ApplicationActorDetails | null;
  label: string;
  occurredAt: string;
}) {
  return (
    <li className="relative flex min-w-0 flex-col gap-1 before:absolute before:-start-5 before:top-1.5 before:size-2 before:rounded-full before:bg-muted-foreground/50 before:ring-2 before:ring-background">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
        <ApplicationActor actor={actor} />
        <time className="text-xs" dateTime={occurredAt}>
          {atsDate(occurredAt, "short")}
        </time>
      </div>
    </li>
  );
}

function ApplicationActivity({
  activity,
  application,
  onDeleted,
  workspaceId,
}: Pick<ApplicationDetail, "activity" | "application"> & {
  onDeleted: () => Promise<void>;
  workspaceId: string;
}) {
  return (
    <aside
      aria-label={m.ats_history()}
      className="flex min-w-0 flex-col gap-4 border-t pt-4 @min-[56rem]:sticky @min-[56rem]:top-16 @min-[56rem]:border-t-0 @min-[56rem]:ps-5 @min-[56rem]:pt-0"
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{m.ats_history()}</h2>
        <div className="flex flex-wrap gap-2">
          {!application.closedAt && (
            <CloseApplicationDialog id={application.id} workspaceId={workspaceId} />
          )}
          {application.canDelete && (
            <DeleteApplicationPopover
              id={application.id}
              onDeleted={onDeleted}
              workspaceId={workspaceId}
            />
          )}
        </div>
      </header>
      <ol className="ms-1 flex flex-col gap-4 border-s ps-4">
        {activity.map((entry) => {
          let label = m.ats_closed();
          if (entry.action === "created") {
            label = m.ats_application_created();
          } else if (entry.result.reason === "job_changed") {
            label = m.ats_transferred();
          }
          return (
            <ApplicationActivityItem
              actor={entry}
              key={entry.id}
              label={label}
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
  onDeleted,
  resume,
  resumeProfile,
  workspaceId,
}: ApplicationDetail & { onDeleted: () => Promise<void>; workspaceId: string }) {
  const profile = resumeProfile?.version === 1 ? resumeProfile : null;
  return (
    <>
      <ApplicationHeader
        application={application}
        resume={resume}
        resumeProfile={profile}
        workspaceId={workspaceId}
      />
      <Tabs defaultValue="overview" className="w-full min-w-0 gap-4">
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
        </TabsList>
        <div className="grid items-start gap-8 @min-[56rem]:grid-cols-[minmax(0,56rem)_18rem]">
          <div className="min-w-0">
            <TabsPanel value="overview">
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
            <TabsPanel value="evaluation">
              <ApplicationEvaluations
                application={application}
                evaluations={evaluations}
                workspaceId={workspaceId}
              />
            </TabsPanel>
          </div>
          <ApplicationActivity
            activity={activity}
            application={application}
            onDeleted={onDeleted}
            workspaceId={workspaceId}
          />
        </div>
      </Tabs>
    </>
  );
}

export function ApplicationDetailPage({
  id,
  search,
  workspaceId,
}: {
  id: string;
  search: ApplicationListSearch;
  workspaceId: string;
}) {
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
          onDeleted={() =>
            router.navigate({
              params: { workspaceId },
              replace: true,
              search,
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
                search={search}
              />
            )
          }
        >
          <IconArrowLeft aria-hidden="true" data-icon="inline-start" />
          {m.ats_back_to_applications()}
        </Button>
      </PageHeaderContent>
      <div className="@container mx-auto flex w-full max-w-[76rem] flex-col gap-6">
        {phase === "ready" && !data && <PageHeader title={m.ats_application_detail()} />}
        {content}
      </div>
    </>
  );
}
