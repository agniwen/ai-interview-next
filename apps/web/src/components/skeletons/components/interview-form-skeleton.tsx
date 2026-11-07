import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 面试轮次新建或编辑配置尚未就绪时的表单占位。
 * Interview-round form placeholder while creation or editing configuration loads.
 */
export function InterviewFormSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-6">
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-64 max-w-full" />
      </div>
      <div aria-hidden="true" className="grid grid-cols-2 gap-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} aria-hidden="true" className="h-16 w-full" />
      ))}
    </div>
  );
}
