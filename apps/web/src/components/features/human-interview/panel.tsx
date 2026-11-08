import type { ReactNode } from "react";
import { IconX } from "@tabler/icons-react";
import {
  Dialog,
  DialogPortal,
  DialogPrimitive,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";

export function MeetingPanel({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Dialog
      modal={false}
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose();
        }
      }}
    >
      <DialogPortal keepMounted>
        <DialogPrimitive.Popup
          aria-describedby={undefined}
          className="fixed right-3 bottom-24 z-50 flex h-[32rem] max-h-[calc(100dvh-10rem)] w-96 origin-bottom-right flex-col overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl outline-none transition-[opacity,scale,translate] duration-200 data-starting-style:translate-y-2 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:translate-y-2 data-ending-style:scale-95 data-ending-style:opacity-0 data-closed:not-data-ending-style:invisible max-md:inset-0 max-md:h-dvh max-md:max-h-none max-md:w-full max-md:rounded-none motion-reduce:transition-none"
        >
          <header className="flex shrink-0 items-center gap-2 px-3 pt-[max(.75rem,env(safe-area-inset-top))] pb-3">
            <DialogClose
              aria-label={m.meeting_close_panel()}
              render={<Button size="icon-sm" variant="ghost" />}
            >
              <IconX />
            </DialogClose>
            <DialogTitle className="text-sm font-medium">{title}</DialogTitle>
          </header>
          {children}
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
