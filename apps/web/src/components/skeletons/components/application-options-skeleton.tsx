import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function ApplicationOptionsSkeleton({ jobOnly }: { jobOnly: boolean }) {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-4">
      {(jobOnly ? ["job"] : ["resume", "job"]).map((field) => (
        <div aria-hidden="true" className="flex flex-col gap-2" key={field}>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}
