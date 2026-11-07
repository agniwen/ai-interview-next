import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 项目编辑数据加载时的名称与描述表单占位。
 * Project-editing placeholder for name and description while record data loads.
 */
export function ProjectFormSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-4">
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <MarkdownEditorSkeleton />
    </div>
  );
}
