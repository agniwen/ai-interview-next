import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

/**
 * 富文本编辑器的工具栏与正文占位，compact 用于较紧凑的内嵌字段。
 * Rich-text toolbar and body placeholder, with compact mode for smaller inline fields.
 */
export function MarkdownEditorSkeleton({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
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
      <div className={cn("px-3.5 py-3", compact ? "min-h-22" : "min-h-44")}>
        <Skeleton aria-hidden="true" className="h-4 w-2/3" />
      </div>
    </div>
  );
}
