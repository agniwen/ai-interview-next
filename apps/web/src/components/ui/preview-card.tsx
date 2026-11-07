"use client";

import { PreviewCard as PreviewCardPrimitive } from "@base-ui/react/preview-card";
import type React from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * 关联内容的预览浮层，供记录名称等触发器展示补充信息。
 * Anchored content preview for triggers such as linked record names.
 */
export const PreviewCard: typeof PreviewCardPrimitive.Root = PreviewCardPrimitive.Root;

export function PreviewCardTrigger({
  ...props
}: PreviewCardPrimitive.Trigger.Props): React.ReactElement {
  return <PreviewCardPrimitive.Trigger data-slot="preview-card-trigger" {...props} />;
}

export function PreviewCardPopup({
  className,
  children,
  panelClassName,
  align = "center",
  sideOffset = 4,
  anchor,
  portalProps,
  ...props
}: PreviewCardPrimitive.Popup.Props & {
  panelClassName?: string;
  align?: PreviewCardPrimitive.Positioner.Props["align"];
  sideOffset?: PreviewCardPrimitive.Positioner.Props["sideOffset"];
  anchor?: PreviewCardPrimitive.Positioner.Props["anchor"];
  portalProps?: PreviewCardPrimitive.Portal.Props;
}): React.ReactElement {
  return (
    <PreviewCardPrimitive.Portal {...portalProps}>
      <PreviewCardPrimitive.Positioner
        align={align}
        anchor={anchor}
        className="z-50"
        data-slot="preview-card-positioner"
        sideOffset={sideOffset}
      >
        <PreviewCardPrimitive.Popup
          className={cn(
            "relative flex max-h-[calc(var(--available-height)-2px)] w-64 min-w-0 origin-(--transform-origin) text-balance rounded-lg border bg-popover not-dark:bg-clip-padding text-popover-foreground text-sm shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className,
          )}
          data-slot="preview-card-content"
          {...props}
        >
          <ScrollArea
            className="h-auto max-h-[inherit] rounded-[inherit]"
            viewportClassName="max-h-[inherit]"
            overscrollContain
          >
            <div className={cn("p-4", panelClassName)}>{children}</div>
          </ScrollArea>
        </PreviewCardPrimitive.Popup>
      </PreviewCardPrimitive.Positioner>
    </PreviewCardPrimitive.Portal>
  );
}

export {
  PreviewCardPrimitive,
  PreviewCard as HoverCard,
  PreviewCardTrigger as HoverCardTrigger,
  PreviewCardPopup as HoverCardContent,
};
