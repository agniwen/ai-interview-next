import { useId, useState } from "react";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@/components/ui/preview-card";
import { Separator } from "@/components/ui/separator";
import * as m from "@/paraglide/messages";

export function BrandPreview() {
  const [open, setOpen] = useState(false);
  const descriptionId = useId();

  return (
    <PreviewCard open={open} onOpenChange={setOpen}>
      <span className="block">
        <PreviewCardTrigger
          render={<button type="button" aria-label="Sainoa" />}
          delay={200}
          onClick={() => setOpen(true)}
          aria-describedby={descriptionId}
          aria-expanded={open}
          className="cursor-help rounded-lg underline decoration-transparent decoration-dashed decoration-1 underline-offset-[0.12em] outline-none transition-colors duration-200 hover:decoration-foreground/30 focus-visible:decoration-foreground/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 motion-reduce:transition-none"
        >
          Sainoa
        </PreviewCardTrigger>
        <span id={descriptionId} className="sr-only">
          sai-no-a. サイノア. {m.home_brand_meaning()} {m.home_brand_origin()}
        </span>
      </span>
      <PreviewCardPopup
        className="w-80 max-w-[calc(100vw-2rem)] text-left"
        panelClassName="flex flex-col gap-4"
        sideOffset={12}
      >
        <div>
          <p className="font-semibold text-base">Sainoa</p>
          <p className="text-xs text-muted-foreground">{m.home_brand_about()}</p>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{m.home_brand_pronunciation()}</p>
            <p className="font-mono text-sm">sai-no-a</p>
          </div>
          <span lang="ja" className="text-muted-foreground">
            サイノア
          </span>
        </div>
        <Separator />
        <div className="flex flex-col gap-2">
          <p className="font-medium">{m.home_brand_meaning()}</p>
          <p className="text-muted-foreground leading-relaxed">{m.home_brand_origin()}</p>
        </div>
      </PreviewCardPopup>
    </PreviewCard>
  );
}
