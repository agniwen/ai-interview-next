import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function InterviewFlowPreviewSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.ats_loading()}
      className="flex flex-col gap-2 border-t pt-3"
    >
      <div aria-hidden="true" className="flex justify-between gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-14" />
      </div>
      <Skeleton aria-hidden="true" className="h-3 w-36" />
      <Skeleton aria-hidden="true" className="h-3 w-28" />
    </div>
  );
}
