"use client";

import * as React from "react";
import {
  MessageScroller as MessageScrollerPrimitive,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from "@shadcn/react/message-scroller";
import { cn } from "@/lib/utils";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { IconArrowDown } from "@tabler/icons-react";

/**
 * 提供聊天滚动上下文，将自动跟随和消息位置协调交给底层消息滚动实现。
 * Provides chat-scrolling context, delegating following and message-position coordination to the underlying implementation.
 */
function MessageScrollerProvider(
  props: React.ComponentProps<typeof MessageScrollerPrimitive.Provider>,
) {
  return <MessageScrollerPrimitive.Provider {...props} />;
}

/**
 * 消息滚动区域的根布局，视口、消息内容和悬浮控件由子组件组成。
 * Root layout for a message scroller, composed with viewport, content and floating-control children.
 */
function MessageScroller({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Root>) {
  return (
    <MessageScrollerPrimitive.Root
      data-slot="message-scroller"
      className={cn(
        "group/message-scroller relative flex size-full min-h-0 flex-col overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerViewport({
  className,
  children,
  scrollFade = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Viewport> & { scrollFade?: boolean }) {
  return (
    <ScrollArea
      overscrollContain
      scrollFade={scrollFade}
      viewportClassName={cn(
        "size-full min-h-0 min-w-0 contain-content data-pending-scroll:invisible [&>[data-slot=scroll-area-content]]:min-h-full",
        className,
      )}
      viewportProps={{
        render: <MessageScrollerPrimitive.Viewport data-slot="message-scroller-viewport" {...props} />,
      }}
    >
      {children}
    </ScrollArea>
  );
}

function MessageScrollerContent({
  className,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Content>) {
  return (
    <MessageScrollerPrimitive.Content
      data-slot="message-scroller-content"
      className={cn("flex h-max min-h-full flex-col gap-6", className)}
      {...props}
    />
  );
}

function MessageScrollerItem({
  className,
  scrollAnchor = false,
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Item>) {
  return (
    <MessageScrollerPrimitive.Item
      data-slot="message-scroller-item"
      scrollAnchor={scrollAnchor}
      className={cn(
        "min-w-0 shrink-0 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]",
        className,
      )}
      {...props}
    />
  );
}

function MessageScrollerButton({
  direction = "end",
  className,
  children,
  label,
  render,
  variant = "outline",
  size = "icon-sm",
  ...props
}: React.ComponentProps<typeof MessageScrollerPrimitive.Button> &
  Pick<React.ComponentProps<typeof Button>, "variant" | "size"> & { label: string }) {
  return (
    <MessageScrollerPrimitive.Button
      data-slot="message-scroller-button"
      data-direction={direction}
      data-variant={variant}
      data-size={size}
      direction={direction}
      className={cn(
        "absolute z-10 inset-s-1/2 bg-popover hover:bg-[color-mix(in_oklab,var(--popover)_95%,var(--foreground))] data-pressed:bg-[color-mix(in_oklab,var(--popover)_95%,var(--foreground))] dark:bg-popover dark:hover:bg-[color-mix(in_oklab,var(--popover)_95%,var(--foreground))] dark:data-pressed:bg-[color-mix(in_oklab,var(--popover)_95%,var(--foreground))] -translate-x-1/2 transition-[translate,scale,opacity] duration-200 data-[active=false]:pointer-events-none data-[active=false]:scale-95 data-[active=false]:opacity-0 data-[active=false]:duration-400 data-[active=false]:ease-[cubic-bezier(0.7,0,0.84,0)] data-[active=true]:translate-y-0 data-[active=true]:scale-100 data-[active=true]:opacity-100 data-[active=true]:ease-[cubic-bezier(0.23,1,0.32,1)] data-[direction=end]:bottom-4 data-[direction=end]:data-[active=false]:translate-y-full data-[direction=start]:top-4 data-[direction=start]:data-[active=false]:-translate-y-full rtl:translate-x-1/2 data-[direction=start]:[&_svg]:rotate-180",
        className,
      )}
      render={render ?? <Button variant={variant} size={size} />}
      {...props}
    >
      {children ?? (
        <>
          <IconArrowDown />
          <span className="sr-only">{label}</span>
        </>
      )}
    </MessageScrollerPrimitive.Button>
  );
}

export {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
};
