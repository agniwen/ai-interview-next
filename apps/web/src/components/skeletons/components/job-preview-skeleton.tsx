import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 关联岗位预览浮层的内容占位，避免加载时浮层收缩。
 * Linked-job preview content placeholder retaining popup space while loading.
 */
export function JobPreviewSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-2">
      <Skeleton aria-hidden="true" className="h-4 w-2/3" />
      <Skeleton aria-hidden="true" className="h-4 w-full" />
      <Skeleton aria-hidden="true" className="h-4 w-5/6" />
    </div>
  );
}
