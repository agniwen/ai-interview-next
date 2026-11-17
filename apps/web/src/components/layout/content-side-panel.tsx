import { createMagicPortal } from "foxact/magic-portal";

export const [ContentSidePanelProvider, ContentSidePanelTarget, ContentSidePanelContent] =
  createMagicPortal("ContentSidePanel");

export const contentPanelClassName =
  "min-h-0 min-w-0 overflow-hidden bg-background md:rounded-2xl md:shadow-sm/5 md:ring-1 md:ring-border/50";
