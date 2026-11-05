import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function MarkdownEditorSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-busy="true"
      aria-label={m.markdown_loading()}
      className={cn("w-full overflow-hidden rounded-lg border border-input", className)}
    >
      <div className="flex h-10 flex-wrap items-center justify-between gap-x-3 max-sm:h-18 max-sm:gap-x-18 border-b border-border/75 bg-muted/35 px-2">
        <Skeleton aria-hidden="true" className="h-5 w-1/2" />
        <Skeleton aria-hidden="true" className="h-5 w-28" />
      </div>
      <div className="min-h-44 px-3.5 py-3">
        <Skeleton aria-hidden="true" className="h-4 w-2/3" />
      </div>
    </div>
  );
}
