import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function CandidateInterviewSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.candidate_interview_loading()}
      className="flex flex-col gap-4 rounded-xl border p-6"
    >
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-5 w-32" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function CandidateInterviewPageSkeleton() {
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-6"
    >
      <p className="text-sm font-medium">Sainoa</p>
      <CandidateInterviewSkeleton />
    </main>
  );
}
