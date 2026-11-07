import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 文档预览加载时的纸张形状占位，保留预览区域的滚动与尺寸边界。
 * Paper-shaped document-loading placeholder retaining preview-region sizing and overflow boundaries.
 */
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
