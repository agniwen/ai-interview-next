import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function McpConsentSkeleton() {
  return (
    <output aria-label={m.auth_loading()} aria-busy="true" className="flex flex-col gap-5">
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <Skeleton aria-hidden="true" className="h-24 w-full rounded-xl" />
      <Skeleton aria-hidden="true" className="h-9 w-36 self-end rounded-lg" />
    </output>
  );
}
