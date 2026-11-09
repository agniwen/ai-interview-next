import { useState } from "react";
import type { ReactNode } from "react";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@/components/ui/preview-card";
import { cn } from "@/lib/utils";

/**
 * 关联记录名称的共用预览入口，兼容悬停和点击，由弹层管理详情内容的挂载和退场。
 * Shared linked-record preview supporting hover and click, letting the popup manage detail mounting and exit.
 */
export function RecordPreviewCard({
  title,
  trigger,
  children,
}: {
  title: string;
  trigger?: { content: ReactNode; label: string };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <PreviewCardTrigger
        aria-expanded={open}
        className={cn(
          "block max-w-full cursor-pointer truncate rounded-sm text-start focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
          !trigger &&
            "underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground",
        )}
        delay={200}
        onClick={() => setOpen(true)}
        render={<button aria-label={trigger?.label ?? title} type="button" />}
      >
        {trigger?.content ?? title}
      </PreviewCardTrigger>
      <PreviewCardPopup
        align="start"
        className="max-h-[min(24rem,calc(var(--available-height)-2px))] w-96 max-w-(--available-width) text-wrap"
        panelClassName="flex flex-col gap-3"
      >
        <h3 className="font-semibold wrap-anywhere">{title}</h3>
        {children}
      </PreviewCardPopup>
    </PreviewCard>
  );
}
