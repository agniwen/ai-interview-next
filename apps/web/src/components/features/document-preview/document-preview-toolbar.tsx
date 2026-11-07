import {
  IconArrowsHorizontal,
  IconChevronLeft,
  IconChevronRight,
  IconZoomIn,
  IconZoomOut,
} from "@tabler/icons-react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";

export interface DocumentPreviewToolbarTargets {
  pagination: HTMLElement | null;
  zoom: HTMLElement | null;
}

/**
 * 文档预览的缩放操作区，显示当前比例并通过回调控制预览器。
 * Document-preview zoom controls showing the current scale and delegating changes to the viewer.
 */
export function DocumentPreviewToolbar({
  pages,
  targets,
  zoom,
}: {
  pages?: { current: number; total: number; goTo: (page: number) => void };
  targets: DocumentPreviewToolbarTargets;
  zoom: { scale: number; zoomIn: () => void; zoomOut: () => void; fitWidth: () => void };
}) {
  return (
    <>
      {targets.pagination &&
        pages &&
        pages.total > 1 &&
        createPortal(
          <fieldset
            className="flex items-center gap-0.5 sm:gap-1"
            aria-label={m.document_preview_pages()}
          >
            <Button
              aria-label={m.document_preview_previous()}
              disabled={pages.current <= 1}
              onClick={() => pages.goTo(pages.current - 1)}
              size="icon-sm"
              title={m.document_preview_previous()}
              variant="ghost"
            >
              <IconChevronLeft />
            </Button>
            <span className="min-w-12 text-center text-sm tabular-nums">
              {pages.current} / {pages.total}
            </span>
            <Button
              aria-label={m.document_preview_next()}
              disabled={pages.current >= pages.total}
              onClick={() => pages.goTo(pages.current + 1)}
              size="icon-sm"
              title={m.document_preview_next()}
              variant="ghost"
            >
              <IconChevronRight />
            </Button>
          </fieldset>,
          targets.pagination,
        )}
      {targets.zoom &&
        createPortal(
          <fieldset
            className="flex items-center gap-0.5 sm:gap-1"
            aria-label={m.document_preview_zoom()}
          >
            <Button
              aria-label={m.document_preview_zoom_out()}
              onClick={() => zoom.zoomOut()}
              size="icon-sm"
              title={m.document_preview_zoom_out()}
              variant="ghost"
            >
              <IconZoomOut />
            </Button>
            <span className="min-w-12 text-center text-sm tabular-nums">
              {Math.round(zoom.scale * 100)}%
            </span>
            <Button
              aria-label={m.document_preview_zoom_in()}
              onClick={() => zoom.zoomIn()}
              size="icon-sm"
              title={m.document_preview_zoom_in()}
              variant="ghost"
            >
              <IconZoomIn />
            </Button>
            <Button
              aria-label={m.document_preview_fit_width()}
              onClick={() => zoom.fitWidth()}
              size="icon-sm"
              title={m.document_preview_fit_width()}
              variant="ghost"
            >
              <IconArrowsHorizontal />
            </Button>
          </fieldset>,
          targets.zoom,
        )}
    </>
  );
}
