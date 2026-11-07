import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { InterviewEntryShell } from "@/components/interview-entry-shell";
import * as m from "@/paraglide/messages";

export function CandidateInterviewSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.candidate_interview_loading()}
      className="flex w-full flex-col items-center"
    >
      <div aria-hidden="true" className="flex w-full flex-col items-center">
        <Skeleton className="mb-9 h-9 w-64 rounded-full" />
        <Skeleton className="h-10 w-60 max-w-full" />
        <Skeleton className="mt-4 h-6 w-96 max-w-full" />
        <Skeleton className="mt-2 h-4 w-28" />
        <div className="mt-8 flex w-full max-w-sm flex-col">
          <Card className="gap-4 p-4">
            <Skeleton className="h-4 w-24" />
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex justify-between gap-8 border-t pt-4">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-32" />
              </div>
            ))}
          </Card>
          <Skeleton className="mt-6 h-4 w-20" />
          <Skeleton className="mt-3 h-10 w-full" />
          <Skeleton className="mt-2 h-10 w-full" />
          <Skeleton className="mx-auto mt-8 h-9 w-32" />
        </div>
      </div>
    </div>
  );
}

export function CandidateInterviewPageSkeleton() {
  return (
    <InterviewEntryShell>
      <CandidateInterviewSkeleton />
    </InterviewEntryShell>
  );
}
