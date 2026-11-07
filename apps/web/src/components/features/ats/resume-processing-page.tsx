import { LocalTime } from "@/components/local-time";
import { IconArrowLeft, IconRefresh, IconX } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link, useCanGoBack, useLocation, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ResumeProfileDocument } from "@/components/features/document-preview/resume-profile-document";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import { MessageResponse } from "@/components/ai-elements/message-response";
import { PageHeaderContent } from "@/components/layout/page-header";
import { ResumeProcessingSkeleton } from "@/components/skeletons/pages/resume-processing-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { atsApi, readResumeProcessing } from "./client";
import type { ResumeListSearch } from "./list-search";
import { atsKeys } from "./query-keys";
import {
  ProcessingStatus,
  processingStepStatus,
  processingStepTitle,
  ResumeProcessingFlow,
} from "./resume-processing-flow";
import type { ProcessingDetail, ProcessingStep } from "./resume-processing-flow";

function AttemptHistory({ detail, step }: { detail: ProcessingDetail; step: ProcessingStep }) {
  const attempts = detail.attempts.filter((attempt) => attempt.stage === step);
  return (
    <div className="flex flex-col items-start gap-4">
      <ProcessingStatus status={processingStepStatus(detail, step)} />
      {step === "avatar" && (
        <p className="text-sm leading-6 text-muted-foreground">
          {m.resume_processing_avatar_note()}
        </p>
      )}
      {attempts.map((attempt) => (
        <div className="flex flex-col gap-2 border-s-2 ps-3 text-xs" key={attempt.id}>
          <div className="flex flex-wrap items-center gap-2">
            <span>{m.resume_processing_attempt({ count: attempt.ordinal })}</span>
            <ProcessingStatus status={attempt.status} />
          </div>
          {attempt.startedAt && (
            <p className="text-muted-foreground">
              <LocalTime value={attempt.startedAt} />
            </p>
          )}
          {attempt.startedAt && attempt.finishedAt && (
            <p>
              {m.resume_processing_duration({
                seconds: (
                  (new Date(attempt.finishedAt).getTime() - new Date(attempt.startedAt).getTime()) /
                  1000
                ).toFixed(1),
              })}
            </p>
          )}
          {attempt.error && (
            <p className="wrap-anywhere text-destructive-foreground">{attempt.error}</p>
          )}
          {attempt.parameters && (
            <p className="wrap-anywhere text-muted-foreground">{attempt.parameters.model}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StepOutput({
  detail,
  step,
  workspaceId,
}: {
  detail: ProcessingDetail;
  step: ProcessingStep;
  workspaceId: string;
}) {
  const avatarSrc = detail.resume?.hasAvatar
    ? atsApi.resumes[":id"].avatar.$path({ param: { id: detail.resume.id, workspaceId } })
    : undefined;
  if (step === "original") {
    return (
      <div className="flex flex-col items-start gap-4 p-6">
        <p className="font-medium wrap-anywhere">{detail.upload.filename}</p>
        <p className="text-sm text-muted-foreground">{(detail.upload.size / 1024).toFixed(1)} KB</p>
        {detail.upload.status === "accepted" && (
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>
              {m.resume_preview_original()}
            </DialogTrigger>
            <ResumePreviewDialog
              id={detail.upload.id}
              filename={detail.upload.filename}
              workspaceId={workspaceId}
            />
          </Dialog>
        )}
      </div>
    );
  }
  if (step === "avatar") {
    return (
      <div className="flex flex-col items-start gap-4 p-6">
        {avatarSrc ? (
          <img
            src={avatarSrc}
            alt={m.resume_processing_avatar()}
            className="max-h-56 max-w-full rounded-lg border object-contain"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{m.resume_processing_avatar_unknown()}</p>
        )}
      </div>
    );
  }
  if (step === "extract_text" && detail.resume?.markdown) {
    return <MessageResponse className="p-6">{detail.resume.markdown}</MessageResponse>;
  }
  if (step === "structure" && detail.resume?.profile?.version === 1) {
    return (
      <div className="[&_article]:p-6">
        <ResumeProfileDocument profile={detail.resume.profile} avatarSrc={avatarSrc} />
      </div>
    );
  }
  return <p className="p-6 text-sm text-muted-foreground">{m.resume_processing_no_output()}</p>;
}

function ProcessingContent({
  detail,
  workspaceId,
}: {
  detail: ProcessingDetail;
  workspaceId: string;
}) {
  const [selected, setSelected] = useState<ProcessingStep | null>(null);
  return (
    <>
      <ResumeProcessingFlow
        detail={detail}
        selected={selected}
        onSelect={setSelected}
        workspaceId={workspaceId}
      />
      {selected && (
        <aside
          aria-label={processingStepTitle(selected)}
          className="absolute inset-x-3 bottom-12 z-10 flex max-h-[55dvh] flex-col overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-extra-large md:inset-x-auto md:top-16 md:right-4 md:bottom-12 md:max-h-none md:w-[min(28rem,calc(100vw-2.5rem))]"
        >
          <header className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-3">
            <h2 className="text-base font-semibold">{processingStepTitle(selected)}</h2>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={m.resume_processing_close()}
              onClick={() => setSelected(null)}
            >
              <IconX aria-hidden="true" />
            </Button>
          </header>
          <ScrollArea key={selected} className="min-h-0 flex-1" overscrollContain>
            <div className="border-b p-5">
              <AttemptHistory detail={detail} step={selected} />
            </div>
            <p className="px-5 pt-4 text-xs leading-5 text-muted-foreground">
              {m.resume_processing_saved_results()}
            </p>
            <StepOutput detail={detail} step={selected} workspaceId={workspaceId} />
          </ScrollArea>
        </aside>
      )}
    </>
  );
}

/**
 * 简历处理详情页面，加载处理结果并将流程选择、步骤输出及尝试历史连接起来。
 * Resume processing page connecting loaded results, selected flow steps, outputs and attempt history.
 */
export function ResumeProcessingPage({
  id,
  search,
  workspaceId,
}: {
  id: string;
  search: ResumeListSearch;
  workspaceId: string;
}) {
  const router = useRouter();
  const masked = useLocation({ select: (location) => Boolean(location.maskedLocation) });
  const canGoBack = useCanGoBack();
  const backToList = masked && canGoBack;
  const { data, isPending, isError, isFetching, refetch } = useQuery({
    queryFn: ({ signal }) => readResumeProcessing({ id, workspaceId }, signal),
    queryKey: atsKeys.resumes(workspaceId)._ctx.processing(id).queryKey,
    refetchInterval: ({ state }) => {
      const status = state.data?.run?.status;
      return status === "queued" || status === "running" || state.data?.upload.status === "waiting"
        ? 3000
        : false;
    },
  });
  const phase = useSkeletonPhase(isPending);
  return (
    <>
      <PageHeaderContent>
        <Button
          variant="ghost"
          size="sm"
          aria-label={m.resume_processing_back()}
          onClick={backToList ? () => router.history.back() : undefined}
          render={
            backToList ? undefined : (
              <Link to="/w/$workspaceId/hub/resumes" params={{ workspaceId }} search={search} />
            )
          }
        >
          <IconArrowLeft aria-hidden="true" />
          {m.ats_resumes()}
        </Button>
        <span aria-hidden="true" className="text-muted-foreground">
          /
        </span>
        <h1 className="truncate text-sm font-medium">{m.resume_processing_title()}</h1>
      </PageHeaderContent>
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background"
        aria-label={m.resume_processing_title()}
      >
        {phase === "skeleton" && <ResumeProcessingSkeleton />}
        {phase === "ready" && data?.version === 1 && (
          <ProcessingContent key={id} detail={data} workspaceId={workspaceId} />
        )}
        <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex items-start justify-between gap-3">
          <p
            className="pointer-events-auto max-w-[min(36rem,65%)] truncate rounded-lg border bg-card px-3 py-2 text-xs text-muted-foreground shadow-default"
            title={data?.upload.filename}
          >
            {data?.upload.filename ?? m.resume_processing_description()}
          </p>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="pointer-events-auto shrink-0 bg-card shadow-default"
                  size="icon"
                  variant="outline"
                  aria-label={m.ats_refresh()}
                  disabled={isFetching}
                  onClick={() => {
                    void refetch();
                  }}
                />
              }
            >
              <IconRefresh aria-hidden="true" />
            </TooltipTrigger>
            <TooltipPopup>{m.ats_refresh()}</TooltipPopup>
          </Tooltip>
        </div>
        {isError && (
          <div className="absolute top-20 right-4 left-4 z-20 mx-auto max-w-lg">
            <Alert variant="error">
              <AlertDescription>{m.resume_parse_load_error()}</AlertDescription>
            </Alert>
          </div>
        )}
        {phase === "ready" && data === null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>{m.resume_processing_unavailable()}</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </div>
        )}
      </div>
    </>
  );
}
