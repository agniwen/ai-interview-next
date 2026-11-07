import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * 首页演示的空字段占位，集中统一缺失值的文本与样式。
 * Empty-field placeholder sharing missing-value text and styling across homepage demos.
 */
export function EmptyValue({ className, children = "—", ...props }: ComponentProps<"span">) {
  return (
    <span className={cn("text-muted-foreground/60", className)} data-slot="empty-value" {...props}>
      {children}
    </span>
  );
}
