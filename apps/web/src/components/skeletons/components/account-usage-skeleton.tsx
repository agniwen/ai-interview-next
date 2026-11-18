import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function AccountUsageSkeleton() {
  return (
    <output aria-label={m.ats_loading()} aria-busy="true" className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3" aria-hidden="true">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton aria-hidden="true" className="h-[min(40rem,66dvh)] rounded-xl sm:h-[40rem]" />
    </output>
  );
}
