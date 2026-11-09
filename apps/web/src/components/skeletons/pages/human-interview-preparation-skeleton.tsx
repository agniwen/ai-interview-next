import { InterviewEntryShell } from "@/components/interview-entry-shell";
import { DocumentPreviewSkeleton } from "@/components/skeletons/components/document-preview-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function HumanInterviewPreparationSkeleton({
  interviewer = false,
}: {
  interviewer?: boolean;
}) {
  return (
    <section
      aria-busy="true"
      aria-label={m.candidate_interview_loading()}
      className="grid w-full max-w-5xl items-start gap-6 text-left md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10 lg:gap-20"
      data-slot="human-interview-preparation-skeleton"
    >
      <div
        aria-hidden="true"
        className="flex min-w-0 flex-col gap-4 pr-1 md:sticky md:top-24 md:gap-6 [@media(min-height:800px)]:gap-8"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {interviewer ? m.meeting_interviewer() : m.candidate_human_invitation()}
          </p>
          <Skeleton className="h-8 w-56 max-w-full sm:h-9 [@media(min-height:800px)]:sm:h-10" />
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 [@media(min-height:800px)]:gap-y-6">
          <div className="flex flex-col gap-1.5">
            <dt className="text-sm text-muted-foreground">{m.candidate_name()}</dt>
            <dd>
              <Skeleton className="h-6 w-20 max-w-full" />
            </dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-sm text-muted-foreground">{m.candidate_round_label()}</dt>
            <dd>
              <Skeleton className="h-6 w-16 max-w-full" />
            </dd>
          </div>
          {[m.interviews_start(), m.interviews_deadline()].map((label) => (
            <div key={label} className="col-span-2 flex flex-col gap-1.5">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd>
                <Skeleton className="h-6 w-44 max-w-full" />
              </dd>
            </div>
          ))}
        </dl>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-6 w-96 max-w-full" />
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-[34px] items-center gap-2 px-2 sm:h-[30px]">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="ms-1 h-4 w-px" />
            <Skeleton className="size-3" />
          </div>
          <div className="flex h-8 items-center gap-1.5 px-2 sm:h-7">
            <Skeleton className="size-4" />
            <Skeleton className="h-4 w-20" />
          </div>
        </div>
        <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:border-t max-md:bg-background max-md:px-5 max-md:pt-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Skeleton className="h-11 w-full rounded-lg md:h-9 md:w-36" />
        </div>
        {!interviewer && <Skeleton className="h-5 w-72 max-w-full" />}
      </div>
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-6 pb-4 md:pt-1">
        <p className="text-base font-semibold">
          {interviewer ? m.meeting_materials() : m.candidate_job_description()}
        </p>
        {interviewer ? (
          <div>
            <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
              <div className="flex aspect-[16/10] flex-col overflow-hidden">
                <DocumentPreviewSkeleton />
              </div>
              <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
                <Skeleton className="size-4" />
                <Skeleton className="h-5 w-40 max-w-full" />
                <Skeleton className="ms-auto size-4" />
              </div>
            </div>
            <div className="mt-6 flex flex-col gap-2">
              <p className="text-lg font-semibold">{m.meeting_history()}</p>
              <Skeleton className="h-5 w-40" />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function HumanInterviewPreparationPageSkeleton() {
  return (
    <InterviewEntryShell>
      <HumanInterviewPreparationSkeleton interviewer />
    </InterviewEntryShell>
  );
}
