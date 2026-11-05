import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function AtsTableSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="rounded-lg border">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="grid h-12 grid-cols-3 items-center gap-5 border-b px-4 last:border-b-0"
        >
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
