import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

function MeetingControlSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-12 flex-1 flex-col items-center justify-center gap-1 md:h-8 md:flex-none",
        className,
      )}
    >
      <Skeleton className="size-5 md:hidden" />
      <Skeleton className="h-2.5 w-9 md:h-full md:w-full md:rounded-lg" />
    </div>
  );
}

export function HumanMeetingSkeleton({
  title,
  interviewer = false,
}: {
  title: string;
  interviewer?: boolean;
}) {
  return (
    <section
      aria-label={m.meeting_connecting()}
      aria-busy="true"
      className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-background text-left text-foreground"
      data-slot="human-meeting-skeleton"
    >
      <header className="flex h-12 shrink-0 items-center gap-3 px-3 md:px-4">
        <h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>
          {title}
        </h1>
        <div aria-hidden="true" className="flex shrink-0 items-center gap-3">
          <Skeleton className="hidden h-8 w-18 rounded-lg sm:block" />
          <Skeleton className="h-7 w-12 rounded-lg" />
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="size-9 rounded-lg md:hidden" />
          <Skeleton className="size-9 rounded-lg md:hidden" />
        </div>
      </header>
      <output className="bg-muted px-4 py-2 text-center text-xs">{m.meeting_connecting()}</output>
      <div
        aria-hidden="true"
        className="grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-1.5 overflow-hidden px-1.5 pb-1.5 md:grid-cols-2"
      >
        {[0, 1].map((tile) => (
          <div
            key={tile}
            className="relative grid min-h-0 place-items-center overflow-hidden rounded-sm border border-border/50 bg-muted/40"
          >
            <Skeleton className="size-16 rounded-full" />
            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
              <Skeleton className="h-6 w-24 rounded-md" />
              <Skeleton className="size-6 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <footer
        aria-hidden="true"
        className="flex shrink-0 items-center justify-center gap-1 border-t bg-background px-2 pt-2 pb-[max(.75rem,env(safe-area-inset-bottom))] md:gap-3 md:px-4"
      >
        <MeetingControlSkeleton className="md:w-24" />
        <MeetingControlSkeleton className="md:w-24" />
        <Skeleton className="hidden h-8 w-24 rounded-lg md:block" />
        {interviewer && (
          <>
            <MeetingControlSkeleton className="md:w-24" />
            <MeetingControlSkeleton className="md:w-28" />
          </>
        )}
        <div className="hidden items-center gap-2 md:flex">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
          {interviewer && <Skeleton className="h-8 w-24 rounded-lg" />}
        </div>
      </footer>
    </section>
  );
}
