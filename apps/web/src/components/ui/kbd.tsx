import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 键盘快捷键提示的键帽与组合布局，仅负责展示，不注册快捷键。
 * Keycap and shortcut-group presentation without registering keyboard shortcuts.
 */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 min-w-5 select-none items-center justify-center gap-1 rounded-[.25rem] bg-muted px-1 font-medium font-sans text-muted-foreground text-xs [&_svg:not([class*='size-'])]:size-3",
        className,
      )}
      data-slot="kbd"
      {...props}
    />
  );
}

export function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">): React.ReactElement {
  return (
    <kbd
      className={cn("inline-flex items-center gap-1", className)}
      data-slot="kbd-group"
      {...props}
    />
  );
}
