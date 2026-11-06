import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function ResumeProfileSkeleton({ layout = "preview" }: { layout?: "inline" | "preview" }) {
  return (
    <div
      aria-busy="true"
      aria-label={m.resume_profile_loading()}
      className={cn("max-w-4xl", layout === "preview" ? "mx-auto p-8 sm:p-16" : "pt-2 pb-6")}
    >
      <div aria-hidden="true" className="flex flex-col gap-5 sm:gap-6">
        {layout === "preview" && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="h-4 w-3/4 max-w-72" />
          </div>
        )}
        <div className="flex flex-col gap-4 border-t border-border/70 pt-5 first:border-t-0 first:pt-0 sm:pt-6">
          <Skeleton className="h-6 w-24" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-11/12" />
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-border/70 pt-5 sm:pt-6">
          <Skeleton className="h-6 w-24" />
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div className="flex flex-col gap-1">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-24 sm:ms-auto" />
          </div>
          <Skeleton className="h-4 w-4/5" />
        </div>
      </div>
    </div>
  );
}
