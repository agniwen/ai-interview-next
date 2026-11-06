import { ResumeProfileSkeleton } from "@/components/skeletons/components/resume-profile-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function ApplicationDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div aria-hidden="true" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-col gap-1">
            <Skeleton className="h-8 w-36 max-w-full" />
            <Skeleton className="h-4 w-12 rounded-md" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-6 gap-y-3 @min-[23.5rem]:grid-cols-2 @min-[36rem]:grid-cols-3 @min-[48.5rem]:grid-cols-4">
          {["candidate", "job", "project", "creator", "created", "resume", "phone", "email"].map(
            (field) => (
              <div key={field} className="flex flex-col gap-0.5">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-5 w-28 max-w-full" />
              </div>
            ),
          )}
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-4">
        <div aria-hidden="true" className="border-b py-1">
          <Skeleton className="h-8.5 w-32 max-w-full sm:h-7.5" />
        </div>
        <div className="grid items-start gap-8 @min-[56rem]:grid-cols-[minmax(0,56rem)_18rem]">
          <ResumeProfileSkeleton layout="inline" />
          <div
            aria-hidden="true"
            className="flex min-w-0 flex-col gap-4 border-t pt-4 @min-[56rem]:border-t-0 @min-[56rem]:ps-5 @min-[56rem]:pt-0"
          >
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-8 w-20 rounded-lg sm:h-7" />
            </div>
            <div className="ms-1 flex flex-col gap-1 border-s ps-4">
              <Skeleton className="h-5 w-28 max-w-full" />
              <Skeleton className="h-4 w-40 max-w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
