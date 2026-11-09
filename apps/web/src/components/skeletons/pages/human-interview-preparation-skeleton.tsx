import { InterviewEntryShell } from "@/components/interview-entry-shell";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function HumanInterviewPreparationSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label={m.candidate_interview_loading()}
      className="grid w-full max-w-5xl items-start gap-6 text-left md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10 lg:gap-20"
      data-slot="human-interview-preparation-skeleton"
    >
      <div
        aria-hidden="true"
        className="flex min-w-0 flex-col gap-4 pr-1 md:gap-6 [@media(min-height:800px)]:gap-8"
      >
        <div className="flex flex-col gap-3">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-8 w-56 max-w-full sm:h-9 [@media(min-height:800px)]:sm:h-10" />
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 [@media(min-height:800px)]:gap-y-6">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-5 w-16 max-w-full" />
            <Skeleton className="h-6 w-28 max-w-full" />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Skeleton className="h-5 w-20 max-w-full" />
            <Skeleton className="h-6 w-20 max-w-full" />
          </div>
          {[0, 1].map((row) => (
            <div key={row} className="col-span-2 flex flex-col gap-1.5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-48 max-w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-64 max-w-full" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div aria-hidden="true" className="flex min-w-0 flex-col gap-6 pb-4 md:pt-1">
        <Skeleton className="h-6 w-24" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-11/12" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-11/12" />
        </div>
        <Skeleton className="h-5 w-28" />
      </div>
    </section>
  );
}

export function HumanInterviewPreparationPageSkeleton() {
  return (
    <InterviewEntryShell>
      <HumanInterviewPreparationSkeleton />
    </InterviewEntryShell>
  );
}
