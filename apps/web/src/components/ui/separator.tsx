import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type React from "react";
import { cn } from "@/lib/utils";

/**
 * 语义分隔线组件，统一水平或垂直分隔的主题样式。
 * Semantic separator with shared horizontal and vertical theme styling.
 */
export function Separator({
  className,
  orientation = "horizontal",
  ...props
}: SeparatorPrimitive.Props): React.ReactElement {
  return (
    <SeparatorPrimitive
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
        className,
      )}
      data-slot="separator"
      orientation={orientation}
      {...props}
    />
  );
}

export { SeparatorPrimitive };
