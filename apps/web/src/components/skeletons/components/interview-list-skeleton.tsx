import { Frame, FrameHeader, FramePanel } from "@/components/ui/frame";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function InterviewListSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()}>
      <Frame aria-hidden="true">
        <FrameHeader className="flex-row items-center justify-between gap-3 px-4 py-3">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-5 w-14" />
        </FrameHeader>
        <FramePanel className="flex flex-col gap-4 p-4">
          <div className="grid grid-cols-2 gap-4 border-b pb-4">
            {[0, 1].map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
            <Skeleton className="col-span-2 h-3 w-44" />
          </div>
          <Skeleton className="h-5 w-20" />
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((key) => (
              <div key={key} className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
          <div className="flex gap-4 border-t pt-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </FramePanel>
      </Frame>
    </div>
  );
}
