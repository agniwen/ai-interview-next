import { useRef } from "react";
import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogPortal,
  DialogPrimitive,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Drawer, DrawerClose, DrawerPopup, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-media-query";
import * as m from "@/paraglide/messages";

export function MeetingPanel({
  open,
  onClose,
  title,
  children,
  initialFocus,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  initialFocus?: DialogPrimitive.Popup.Props["initialFocus"];
}) {
  const mobile = useIsMobile();
  const anchor = useRef<HTMLDivElement>(null);
  const Title = mobile ? DrawerTitle : DialogTitle;
  const Close = mobile ? DrawerClose : DialogClose;
  const content = (
    <>
      <header className="flex shrink-0 items-center gap-2 px-3 pb-3 pt-[max(.75rem,env(safe-area-inset-top))]">
        <Close
          aria-label={m.meeting_close_panel()}
          render={<Button size="icon-sm" variant="ghost" />}
        >
          <IconX aria-hidden="true" />
        </Close>
        <Title className="text-sm font-medium">{title}</Title>
      </header>
      {children}
    </>
  );

  const onOpenChange = (value: boolean) => {
    if (!value) {
      onClose();
    }
  };
  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPopup
          className="fixed inset-x-0 bottom-0 h-dvh max-h-none overflow-hidden border-t-0"
          portalProps={{ keepMounted: true }}
          variant="straight"
        >
          {content}
        </DrawerPopup>
      </Drawer>
    );
  }

  return (
    <Dialog disablePointerDismissal modal={false} open={open} onOpenChange={onOpenChange}>
      <div ref={anchor} className="pointer-events-none absolute inset-0 z-30" />
      <DialogPortal container={anchor} keepMounted>
        <DialogPrimitive.Popup
          render={<Card />}
          className="pointer-events-auto absolute end-3 bottom-3 h-[32rem] max-h-[calc(100%-1.5rem)] w-96 origin-bottom-right overflow-hidden outline-none transition-[opacity,scale,translate] duration-200 data-starting-style:translate-y-2 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:translate-y-2 data-ending-style:scale-95 data-ending-style:opacity-0 data-closed:not-data-ending-style:invisible motion-reduce:transition-none"
          initialFocus={initialFocus}
        >
          {content}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
