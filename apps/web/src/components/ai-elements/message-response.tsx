import { useEffect, useRef, useState } from "react";
import { parseMarkdownIntoBlocks, Streamdown } from "streamdown";
import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { Frame } from "@/components/ui/frame";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// 保持插件和组件引用稳定，让 Streamdown 复用已完成的块。
// Stable plugin and component references let Streamdown reuse completed blocks.
const plugins = { cjk, code };
const components = {
  table(props: ComponentProps<"table">) {
    return (
      <Frame className="my-3 w-full">
        <Table {...props} variant="card" />
      </Frame>
    );
  },
  tbody: TableBody,
  td: TableCell,
  th: TableHead,
  thead: TableHeader,
  tr: TableRow,
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
  const container = useRef<HTMLDivElement>(null);
  const [visibleBlockCount, setVisibleBlockCount] = useState(1);
  const blocks = streaming ? parseMarkdownIntoBlocks(children) : [];
  const visibleMarkdown = streaming ? blocks.slice(0, visibleBlockCount).join("") : children;
  const pendingAfterMarkdown = blocks.length > visibleBlockCount ? visibleMarkdown : null;
  if (!streaming && visibleBlockCount !== 1) {
    setVisibleBlockCount(1);
  }

  useEffect(() => {
    if (pendingAfterMarkdown === null) {
      return;
    }

    // 以浏览器的动画结束时间为准，包含 Streamdown 给文字添加的延迟。
    // Wait for the browser's animation completion, including Streamdown's stagger delays.
    let active = true;
    const frame = requestAnimationFrame(() => {
      const animations = container.current
        ?.getAnimations({ subtree: true })
        .filter(
          (animation) => "animationName" in animation && animation.animationName === "sd-fadeIn",
        );
      void Promise.allSettled(animations?.map((animation) => animation.finished) ?? []).then(() => {
        if (active) {
          setVisibleBlockCount((count) => count + 1);
        }
        return null;
      });
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [pendingAfterMarkdown]);

  return (
    <div
      ref={container}
      className={cn(
        "min-w-0 max-w-full text-base leading-7 wrap-anywhere sm:text-sm sm:leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-3 [&_h1]:my-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:my-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-3 [&_h3]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:my-1 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_pre]:m-0 [&_pre]:max-w-full [&_pre]:text-xs [&_[data-streamdown=code-block]]:gap-0 [&_[data-streamdown=code-block]]:rounded-lg [&_[data-streamdown=code-block]]:bg-muted/40 [&_[data-streamdown=code-block]]:p-0 [&_[data-streamdown=code-block-header]]:px-3 [&_[data-streamdown=code-block-body]]:rounded-none [&_[data-streamdown=code-block-body]]:border-0 [&_[data-streamdown=code-block-body]]:bg-transparent [&_[data-streamdown=code-block-body]]:p-3 [&_code]:font-mono [&_p>code]:rounded-sm [&_p>code]:bg-muted [&_p>code]:px-1 [&_img]:max-w-full [&_img]:rounded-lg",
        className,
      )}
      data-slot="message-response"
    >
      <Streamdown
        components={components}
        plugins={plugins}
        mode={streaming ? "streaming" : "static"}
        isAnimating={streaming}
        animated
        controls={false}
        lineNumbers={false}
      >
        {visibleMarkdown}
      </Streamdown>
    </div>
  );
}
