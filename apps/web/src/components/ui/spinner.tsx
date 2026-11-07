import { IconLoader2 as Loader2Icon } from "@tabler/icons-react";
import type React from "react";
import { cn } from "@/lib/utils";

/**
 * 紧凑的加载旋转图标，供按钮和局部状态提示复用。
 * Compact loading spinner shared by buttons and inline status views.
 */
export function Spinner({
  className,
  ...props
}: React.ComponentProps<typeof Loader2Icon>): React.ReactElement {
  return (
    <Loader2Icon
      aria-label="Loading"
      className={cn("animate-spin", className)}
      role="status"
      {...props}
    />
  );
}
