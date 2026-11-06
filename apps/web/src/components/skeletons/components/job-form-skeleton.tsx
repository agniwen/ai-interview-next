import { MarkdownEditorSkeleton } from "@/components/skeletons/components/markdown-editor-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function JobFormSkeleton() {
  return (
    <div aria-busy="true" aria-label={m.ats_loading()} className="flex flex-col gap-4">
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <Skeleton aria-hidden="true" className="h-13 w-full" />
      <MarkdownEditorSkeleton />
    </div>
  );
}
