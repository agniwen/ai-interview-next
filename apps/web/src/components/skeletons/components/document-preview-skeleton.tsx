import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

export function DocumentPreviewSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 justify-center overflow-hidden bg-muted/40 p-3 sm:p-6"
      aria-busy="true"
      aria-label={m.document_preview_loading()}
    >
      <Skeleton aria-hidden="true" className="aspect-[210/297] h-max w-full max-w-xl rounded-sm" />
    </div>
  );
}
