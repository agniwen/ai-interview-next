import type React from "react";
import { cn } from "@/lib/utils";

/**
 * 骨架占位的基础视觉单元；具体页面布局与显示时长由页面骨架和加载控制层负责。
 * Base skeleton visual; page skeletons and loading controllers own layout and visibility timing.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">): React.ReactElement {
  return (
    <div
      className={cn(
        "motion-safe:animate-skeleton rounded-sm [--skeleton-highlight:--alpha(var(--color-white)/64%)] [background:linear-gradient(120deg,transparent_40%,var(--skeleton-highlight),transparent_60%)_var(--color-muted)_0_0/200%_100%_fixed] dark:[--skeleton-highlight:--alpha(var(--color-white)/4%)]",
        className,
      )}
      data-slot="skeleton"
      {...props}
    />
  );
}
