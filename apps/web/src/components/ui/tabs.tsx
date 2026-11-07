"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import * as React from "react";
import { cn } from "@/lib/utils";
import {
  type SegmentedControlSize,
  segmentedControlIndicatorSurfaceClassName,
  segmentedControlItemLayoutClassName,
  segmentedControlItemSizeClassNames,
} from "@/components/ui/segmented-control";

type TabsVariant = "default" | "underline";
type TabsSize = SegmentedControlSize;

const TabsListContext: React.Context<TabsSize> = React.createContext<TabsSize>("default");

/**
 * 页签和内容面板组件，复用分段指示器并支持内容切换动效。
 * Tabs and panels reusing the segmented indicator and supporting content-transition animation.
 */
export function Tabs({ className, ...props }: TabsPrimitive.Root.Props): React.ReactElement {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-2 data-[orientation=vertical]:flex-row", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

export function TabsList({
  variant = "default",
  size = "default",
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & {
  size?: TabsSize;
  variant?: TabsVariant;
}): React.ReactElement {
  return (
    <TabsPrimitive.List
      className={cn(
        "relative z-0 flex w-fit items-center justify-center gap-x-0.5 text-muted-foreground",
        "data-[orientation=vertical]:flex-col",
        variant === "default"
          ? "rounded-lg bg-muted p-0.5 text-muted-foreground/72"
          : "data-[orientation=vertical]:px-1 data-[orientation=horizontal]:py-1 *:data-[slot=tabs-tab]:hover:bg-accent",
        className,
      )}
      data-size={size}
      data-slot="tabs-list"
      {...props}
    >
      <TabsListContext.Provider value={size}>{children}</TabsListContext.Provider>
      <TabsPrimitive.Indicator
        className={cn(
          "absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out motion-reduce:transition-none",
          variant === "underline"
            ? "z-10 bg-primary data-[orientation=horizontal]:h-0.5 data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px data-[orientation=horizontal]:translate-y-px"
            : cn("-z-1", segmentedControlIndicatorSurfaceClassName),
        )}
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  );
}

export function TabsTab({
  className,
  size,
  ...props
}: TabsPrimitive.Tab.Props & {
  size?: TabsSize;
}): React.ReactElement {
  const contextSize: TabsSize = React.useContext(TabsListContext);
  const resolvedSize: TabsSize = size ?? contextSize;

  return (
    <TabsPrimitive.Tab
      className={cn(
        "relative flex shrink-0 grow cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-transparent font-medium text-base outline-none transition-[color,background-color,box-shadow] hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start data-active:text-foreground data-disabled:opacity-64 sm:text-sm",
        segmentedControlItemLayoutClassName,
        segmentedControlItemSizeClassNames[resolvedSize],
        className,
      )}
      data-size={resolvedSize}
      data-slot="tabs-tab"
      {...props}
    />
  );
}

export function TabsPanel({
  className,
  motion,
  ...props
}: TabsPrimitive.Panel.Props & { motion?: "page" }): React.ReactElement {
  return (
    <TabsPrimitive.Panel
      className={cn(
        "flex-1 outline-none",
        motion === "page" &&
          "transition-[opacity,translate,filter] duration-200 ease-out data-ending-style:absolute data-ending-style:inset-0 data-ending-style:pointer-events-none data-[activation-direction=left]:data-ending-style:translate-x-2 data-[activation-direction=right]:data-ending-style:-translate-x-2 data-ending-style:opacity-0 data-ending-style:blur-xs data-[activation-direction=left]:data-starting-style:-translate-x-2 data-[activation-direction=right]:data-starting-style:translate-x-2 data-starting-style:opacity-0 data-starting-style:blur-xs motion-reduce:transition-none motion-reduce:data-ending-style:translate-x-0 motion-reduce:data-starting-style:translate-x-0 motion-reduce:data-ending-style:blur-none motion-reduce:data-starting-style:blur-none",
        className,
      )}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export {
  TabsPrimitive,
  TabsTab as TabsTrigger,
  TabsPanel as TabsContent,
  type TabsSize,
  type TabsVariant,
};
