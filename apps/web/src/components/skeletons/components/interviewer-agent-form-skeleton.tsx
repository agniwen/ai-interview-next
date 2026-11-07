import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function InterviewerAgentFormSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-6">
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <MarkdownEditorSkeleton />
      <MarkdownEditorSkeleton />
    </div>
  );
}
