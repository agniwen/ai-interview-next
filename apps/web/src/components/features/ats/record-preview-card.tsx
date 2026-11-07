import { useState } from "react";
import type { ReactNode } from "react";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@/components/ui/preview-card";

/**
 * 关联记录名称的共用预览入口，兼容悬停和点击，并仅在展开时挂载详情内容。
 * Shared linked-record preview supporting hover and click, mounting details only while open.
 */
export function RecordPreviewCard({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <PreviewCardTrigger
        aria-expanded={open}
        className="block max-w-full cursor-pointer truncate rounded-sm text-start underline decoration-muted-foreground/40 underline-offset-2 hover:decoration-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        delay={200}
        onClick={() => setOpen(true)}
        render={<button aria-label={title} type="button" />}
      >
        {title}
      </PreviewCardTrigger>
      <PreviewCardPopup
        align="start"
        className="max-h-[min(24rem,calc(var(--available-height)-2px))] w-96 max-w-(--available-width) text-wrap"
        panelClassName="flex flex-col gap-3"
      >
        <h3 className="font-semibold wrap-anywhere">{title}</h3>
        {open && children}
      </PreviewCardPopup>
    </PreviewCard>
  );
}
