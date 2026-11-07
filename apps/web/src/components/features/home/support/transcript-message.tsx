"use client";

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: "user" | "assistant" | "system";
};

/**
 * 首页语音转录演示的消息布局，根据说话方排列正文，并复用演示 Markdown 渲染。
 * Homepage voice-transcript message layout aligning content by speaker and reusing demo Markdown rendering.
 */
export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        "group flex w-full max-w-full flex-col gap-2",
        from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
        className,
      )}
      {...props}
    />
  );
}

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export function MessageContent({ children, className, ...props }: MessageContentProps) {
  return (
    <div
      className={cn(
        "is-user:dark flex w-fit min-w-0 max-w-full flex-col gap-2 overflow-hidden text-sm leading-7",
        "group-[.is-user]:ml-auto group-[.is-user]:bg-white dark:group-[.is-user]:bg-secondary group-[.is-user]:max-w-[88%] group-[.is-user]:rounded-2xl group-[.is-user]:border group-[.is-user]:border-border/70  group-[.is-user]:px-3 group-[.is-user]:py-2 group-[.is-user]:text-foreground",
        "group-[.is-assistant]:max-w-[100%] group-[.is-assistant]:w-full group-[.is-assistant]:text-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export { MarkdownView as MessageResponse } from "./markdown-view";
