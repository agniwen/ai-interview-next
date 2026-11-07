import { cn } from "@/lib/utils";

/**
 * 应用共用品牌图形，尺寸和布局由调用方通过 className 控制。
 * Shared application brand mark, with size and layout controlled by the caller's className.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      alt=""
      className={cn("size-7 shrink-0", className)}
      height={28}
      src="/logo.png"
      width={28}
    />
  );
}
