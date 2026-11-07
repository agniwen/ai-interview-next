import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 题套编辑内容的骨架，保留元数据、默认岗位、题目区与保存入口的空间。
 * Question-set editor skeleton retaining metadata, default-job, question and save-control space.
 */
export function QuestionSetSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex min-w-0 flex-col gap-6">
          <Skeleton aria-hidden="true" className="h-14 w-full" />
          <MarkdownEditorSkeleton compact />
          <Skeleton aria-hidden="true" className="h-20 w-full" />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton aria-hidden="true" className="h-5 w-24" />
          <Skeleton aria-hidden="true" className="h-19 w-full" />
          <Skeleton aria-hidden="true" className="h-19 w-full" />
        </div>
      </div>
      <Skeleton aria-hidden="true" className="mx-auto h-11 w-22 rounded-xl" />
    </div>
  );
}
