import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 关联项目预览浮层的内容占位，与项目编辑表单骨架分开使用。
 * Linked-project preview placeholder, separate from the project-editing form skeleton.
 */
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
