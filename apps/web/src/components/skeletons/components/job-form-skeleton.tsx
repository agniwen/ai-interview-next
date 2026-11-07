import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 岗位编辑表单的局部骨架，覆盖字段与富文本编辑区域，不包含页面导航。
 * Local job-form skeleton for fields and rich-text regions, excluding page navigation.
 */
export function JobFormSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-4">
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <MarkdownEditorSkeleton />
      <MarkdownEditorSkeleton />
    </div>
  );
}
