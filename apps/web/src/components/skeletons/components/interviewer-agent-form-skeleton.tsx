import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 面试官 Agent 编辑数据加载骨架，保留名称、说明与指令编辑区。
 * Interviewer Agent form skeleton retaining name, description and instruction-editor areas.
 */
export function InterviewerAgentFormSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-6">
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <MarkdownEditorSkeleton />
      <MarkdownEditorSkeleton />
    </div>
  );
}
