import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function InterviewConversationSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.candidate_session_connecting()}
      className="fixed inset-0 z-20 h-dvh bg-background"
    >
      <div
        aria-hidden="true"
        className="relative mx-auto flex h-full max-w-2xl flex-col items-center px-5 pt-20 pb-10"
      >
        <Skeleton className="size-[min(28dvh,14rem)] rounded-full" />
        <Skeleton className="mt-3 h-6 w-32" />
        <div className="mt-10 flex w-full flex-1 flex-col gap-6">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-16 w-2/3 self-end" />
        </div>
        <Skeleton className="mb-3 h-5 w-72 max-w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  );
}
