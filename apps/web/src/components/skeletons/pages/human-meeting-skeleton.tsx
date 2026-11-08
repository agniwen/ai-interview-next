import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function HumanMeetingSkeleton() {
  return (
    <section
      aria-label={m.meeting_connecting()}
      aria-busy="true"
      className="fixed inset-0 z-50 flex flex-col gap-2 bg-background p-2"
    >
      <div aria-hidden="true" className="flex min-h-0 flex-1 flex-col gap-2">
        <Skeleton className="my-2 h-6 w-56" />
        <div className="grid min-h-0 flex-1 gap-2 md:grid-cols-2">
          <Skeleton className="h-full rounded-sm" />
          <Skeleton className="h-full rounded-sm" />
        </div>
        <div className="flex justify-center gap-2 py-3">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </section>
  );
}
