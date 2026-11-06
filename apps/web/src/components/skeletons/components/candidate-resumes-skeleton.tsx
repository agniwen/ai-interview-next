import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function CandidateResumesSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()}>
      <div aria-hidden="true" className="divide-y">
        {["first", "second", "third"].map((row) => (
          <div className="flex items-center gap-3 py-3" key={row}>
            <Skeleton className="size-6 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Skeleton className="h-5 w-3/4 max-w-56" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="h-8 w-20 shrink-0 rounded-lg sm:h-7" />
          </div>
        ))}
      </div>
    </div>
  );
}
