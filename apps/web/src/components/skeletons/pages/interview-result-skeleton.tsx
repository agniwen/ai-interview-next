import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function InterviewResultSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.candidate_interview_loading()} className="w-full">
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
          <div className="hidden flex-col gap-6 border-l pl-8 xl:flex">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-16 w-4/5" />
            <Skeleton className="h-24 w-3/4 self-end" />
            <Skeleton className="h-24 w-4/5" />
          </div>
        </div>
      </div>
    </div>
  );
}
