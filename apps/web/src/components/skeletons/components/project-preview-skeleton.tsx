import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function ProjectPreviewSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {[0, 1].map((column) => (
          <div key={column} aria-hidden="true" className="flex flex-col gap-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <Skeleton aria-hidden="true" className="h-4 w-full" />
      <Skeleton aria-hidden="true" className="h-4 w-5/6" />
    </div>
  );
}
