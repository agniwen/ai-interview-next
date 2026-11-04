import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const components = {
  table({ children, ...props }: ComponentProps<"table">) {
    return (
      <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-input">
        <table {...props}>{children}</table>
      </div>
    );
  },
};

export function MessageResponse({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full text-base leading-7 wrap-anywhere sm:text-sm sm:leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_p]:my-3 [&_h1]:my-4 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:my-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:my-3 [&_h3]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:ps-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:ps-6 [&_li]:my-1 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-3 [&_blockquote]:border-s-2 [&_blockquote]:ps-4 [&_blockquote]:text-muted-foreground [&_pre]:my-3 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-input [&_pre]:bg-muted/40 [&_pre]:p-3 [&_pre]:text-xs [&_code]:font-mono [&_p>code]:rounded-sm [&_p>code]:bg-muted [&_p>code]:px-1 [&_table]:w-full [&_table]:border-collapse [&_th]:border-b [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_td]:border-b [&_td]:px-3 [&_td]:py-2 [&_img]:max-w-full [&_img]:rounded-lg",
        className,
      )}
      data-slot="message-response"
    >
      <Markdown components={components} remarkPlugins={[remarkGfm]}>
        {children}
      </Markdown>
    </div>
  );
}
