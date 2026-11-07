import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// 保持插件和组件引用稳定，让 Streamdown 复用已完成的块。
// Stable plugin and component references let Streamdown reuse completed blocks.
const plugins = { cjk, code };
const components = {
  table({ children }: ComponentProps<"table">) {
    return (
      <ScrollArea className="my-3 h-auto max-w-full rounded-lg border border-input">
        <table>{children}</table>
      </ScrollArea>
    );
  },
};

/**
 * 聊天回复的流式 Markdown 渲染器，统一代码、中文排版和表格滚动展示。
 * Streaming Markdown renderer for chat responses, with code, CJK typography and scrollable tables.
 */
export function MessageResponse({
  children,
  className,
  streaming = false,
}: {
  children: string;
  className?: string;
  streaming?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full text-base leading-7 wrap-anywhere sm:text-sm sm:leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-3 [&_h1]:my-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:my-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-3 [&_h3]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:my-1 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_pre]:m-0 [&_pre]:max-w-full [&_pre]:text-xs [&_[data-streamdown=code-block]]:gap-0 [&_[data-streamdown=code-block]]:rounded-lg [&_[data-streamdown=code-block]]:bg-muted/40 [&_[data-streamdown=code-block]]:p-0 [&_[data-streamdown=code-block-header]]:px-3 [&_[data-streamdown=code-block-body]]:rounded-none [&_[data-streamdown=code-block-body]]:border-0 [&_[data-streamdown=code-block-body]]:bg-transparent [&_[data-streamdown=code-block-body]]:p-3 [&_code]:font-mono [&_p>code]:rounded-sm [&_p>code]:bg-muted [&_p>code]:px-1 [&_table]:w-full [&_table]:border-collapse [&_th]:border-b [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_td]:border-b [&_td]:px-3 [&_td]:py-2 [&_img]:max-w-full [&_img]:rounded-lg",
        className,
      )}
      data-slot="message-response"
    >
      <Streamdown
        components={components}
        plugins={plugins}
        mode={streaming ? "streaming" : "static"}
        isAnimating={streaming}
        controls={false}
        lineNumbers={false}
      >
        {children}
      </Streamdown>
    </div>
  );
}
