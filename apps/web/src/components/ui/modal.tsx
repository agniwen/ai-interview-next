import type { ReactElement, ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTrigger, DialogPopup, DialogHeader, DialogTitle, DialogDescription, DialogPanel } from "@/components/ui/dialog";
import { Drawer, DrawerTrigger, DrawerPopup, DrawerHeader, DrawerTitle, DrawerDescription, DrawerPanel, DrawerFooter, DrawerClose } from "@/components/ui/drawer";

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  closeLabel: string;
  trigger?: ReactElement;
  children: ReactNode;
}

/**
 * 调用方控制 open；内部只负责按屏幕尺寸选择 Dialog 或 Drawer。
 * The caller controls open; this component selects Dialog or Drawer by screen size.
 */
export function Modal({ open, onOpenChange, title, description, closeLabel, trigger, children }: ModalProps) {
  const mobile = useIsMobile();
  if (mobile) {
    return <Drawer open={open} onOpenChange={onOpenChange} position="bottom">
      {trigger && <DrawerTrigger render={trigger} />}
      <DrawerPopup showBar>
        <DrawerHeader><DrawerTitle>{title}</DrawerTitle>{description && <DrawerDescription>{description}</DrawerDescription>}</DrawerHeader>
        <DrawerPanel>{children}</DrawerPanel>
        <DrawerFooter variant="bare"><DrawerClose render={<Button variant="outline" />}>{closeLabel}</DrawerClose></DrawerFooter>
      </DrawerPopup>
    </Drawer>;
  }
  return <Dialog open={open} onOpenChange={onOpenChange}>
    {trigger && <DialogTrigger render={trigger} />}
    <DialogPopup closeProps={{ "aria-label": closeLabel }}>
      <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
      <DialogPanel>{children}</DialogPanel>
    </DialogPopup>
  </Dialog>;
}
