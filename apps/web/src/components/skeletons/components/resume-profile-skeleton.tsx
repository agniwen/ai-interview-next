import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function ResumeProfileSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.resume_profile_loading()}
      className="mx-auto max-w-4xl p-3 sm:p-6"
    >
      <div aria-hidden="true" className="flex flex-col gap-6 p-5 sm:gap-8 sm:p-10">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-3/4 max-w-72" />
        </div>
        {["summary", "employment"].map((section) => (
          <div className="flex flex-col gap-3.5" key={section}>
            <div className="border-b border-card-foreground/15 pb-2">
              <Skeleton className="h-7 w-28" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
