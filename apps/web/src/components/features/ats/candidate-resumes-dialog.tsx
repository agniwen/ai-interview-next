import { LocalTime } from "@/components/local-time";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ResumePreviewDialog } from "@/components/features/document-preview/resume-preview-dialog";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { CandidateResumesSkeleton } from "@/components/skeletons/components/candidate-resumes-skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogCreateHandle as createDialogHandle,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import { CreateApplicationDialog } from "./create-application-dialog";
import { atsKeys } from "./query-keys";
import { atsApi, readAts } from "./client";

const resumeRowClassName = "flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left";

export function CandidateResumesDialog({
  id,
  name,
  workspaceId,
}: {
  id: string;
  name: string;
  workspaceId: string;
}) {
  const preview = useMemo(() => createDialogHandle<{ filename: string; id: string }>(), []);
  const recruitment = useMemo(() => createDialogHandle<string>(), []);
  const { data, isError, isPending, refetch } = useQuery({
    queryFn: async () =>
      readAts(await atsApi.candidates[":id"].resumes.$get({ param: { id, workspaceId } })),
    queryKey: atsKeys.candidates(workspaceId)._ctx.resumes(id).queryKey,
  });

  const phase = useSkeletonPhase(isPending);

  return (
    <DialogPopup className="max-h-[min(32rem,75dvh)] sm:max-w-xl">
      <DialogHeader className="shrink-0 pe-12">
        <DialogTitle className="wrap-anywhere">
          {m.ats_candidate_resumes_title({ name })}
        </DialogTitle>
        {phase === "ready" && data && (
          <DialogDescription>
            {m.ats_candidate_resumes_count({ count: data.total })}
          </DialogDescription>
        )}
      </DialogHeader>
      <DialogPanel>
        {phase === "skeleton" && <CandidateResumesSkeleton />}
        {phase === "ready" && isError && !data && (
          <div className="flex flex-col items-start gap-3">
            <Alert variant="error">
              <AlertDescription>{m.ats_error()}</AlertDescription>
            </Alert>
            <Button onClick={() => refetch()} size="sm" variant="outline">
              {m.ats_retry()}
            </Button>
          </div>
        )}
        {phase === "ready" && data?.total === 0 && (
          <Empty className="py-8 md:py-8">
            <EmptyHeader>
              <EmptyTitle>{m.ats_empty_resumes()}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
        {phase === "ready" && data && data.total > 0 && (
          <ul className="-mx-2 divide-y">
            {data.rows.map((row) => {
              const filename = row.filename ?? m.ats_unnamed_resume();
              const content = (
                <>
                  <ResumeDocumentFileIcon
                    className="size-6 shrink-0"
                    kind={getResumeDocumentFileIconKind({ fileName: row.filename })}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium" title={filename}>
                      {filename}
                    </span>
                    <time className="text-xs text-muted-foreground" dateTime={row.createdAt}>
                      <LocalTime value={row.createdAt} format="date" />
                    </time>
                  </span>
                </>
              );
              return (
                <li
                  className="flex items-center gap-2 rounded-md pe-2 transition-colors hover:bg-accent focus-within:bg-accent"
                  key={row.id}
                >
                  {row.uploadId ? (
                    <DialogTrigger
                      className={cn(
                        resumeRowClassName,
                        "cursor-pointer rounded-md focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                      )}
                      handle={preview}
                      payload={{ filename, id: row.uploadId }}
                    >
                      {content}
                    </DialogTrigger>
                  ) : (
                    <div className={resumeRowClassName}>{content}</div>
                  )}
                  {row.canJoinRecruitment && (
                    <DialogTrigger
                      handle={recruitment}
                      payload={row.id}
                      render={<Button className="shrink-0" size="sm" variant="outline" />}
                    >
                      {m.ats_join_recruitment()}
                    </DialogTrigger>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogPanel>
      <CreateApplicationDialog handle={recruitment} workspaceId={workspaceId} />
      <Dialog handle={preview}>
        {({ payload }) =>
          payload && (
            <ResumePreviewDialog
              filename={payload.filename}
              id={payload.id}
              key={payload.id}
              workspaceId={workspaceId}
            />
          )
        }
      </Dialog>
    </DialogPopup>
  );
}
