import { createPluginRegistration } from "@embedpdf/core";
import { EmbedPDF } from "@embedpdf/core/react";
import { cdnFontConfig } from "@embedpdf/engines/pdfium";
import { usePdfiumEngine } from "@embedpdf/engines/react";
import wasmUrl from "@embedpdf/pdfium/pdfium.wasm?url";
import {
  DocumentContent,
  DocumentManagerPluginPackage,
} from "@embedpdf/plugin-document-manager/react";
import { RenderLayer, RenderPluginPackage } from "@embedpdf/plugin-render/react";
import { Scroller, ScrollPluginPackage, useScroll } from "@embedpdf/plugin-scroll/react";
import { Viewport, ViewportPluginPackage } from "@embedpdf/plugin-viewport/react";
import {
  useZoom,
  ZoomGestureWrapper,
  ZoomMode,
  ZoomPluginPackage,
} from "@embedpdf/plugin-zoom/react";
import { useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { DocumentPreviewError } from "./document-preview-dialog";
import { DocumentPreviewToolbar } from "./document-preview-toolbar";
import type { DocumentPreviewToolbarTargets } from "./document-preview-toolbar";

function PdfPreviewContent({
  documentId,
  toolbarTargets,
}: {
  documentId: string;
  toolbarTargets: DocumentPreviewToolbarTargets;
}) {
  const { provides: zoom, state: zoomState } = useZoom(documentId);
  const { provides: scroll, state: scrollState } = useScroll(documentId);

  return (
    <>
      {zoom && (
        <DocumentPreviewToolbar
          pages={
            scroll
              ? {
                  current: scrollState.currentPage,
                  goTo: (pageNumber) => scroll.scrollToPage({ pageNumber }),
                  total: scrollState.totalPages,
                }
              : undefined
          }
          targets={toolbarTargets}
          zoom={{
            fitWidth: () => zoom.requestZoom(ZoomMode.FitWidth),
            scale: zoomState.currentZoomLevel,
            zoomIn: () => zoom.zoomIn(),
            zoomOut: () => zoom.zoomOut(),
          }}
        />
      )}
      <div className="min-h-0 flex-1 bg-muted/40">
        <Viewport documentId={documentId} style={{ touchAction: "pan-x pan-y" }}>
          <ZoomGestureWrapper documentId={documentId}>
            <Scroller
              documentId={documentId}
              renderPage={({ height, pageIndex, width }) => (
                <div className="relative bg-white shadow-sm" style={{ height, width }}>
                  <RenderLayer documentId={documentId} pageIndex={pageIndex} />
                </div>
              )}
            />
          </ZoomGestureWrapper>
        </Viewport>
      </div>
    </>
  );
}

function PdfPreviewResult({
  children,
  loading,
  onLoadingChange,
  visible,
}: {
  children: ReactNode;
  loading: boolean;
  onLoadingChange: (loading: boolean) => void;
  visible: boolean;
}) {
  useEffect(() => onLoadingChange(loading), [loading, onLoadingChange]);
  return visible ? children : null;
}

export default function PdfPreview({
  onLoadingChange,
  toolbarTargets,
  url,
  visible,
}: {
  onLoadingChange: (loading: boolean) => void;
  toolbarTargets: DocumentPreviewToolbarTargets;
  url: string;
  visible: boolean;
}) {
  const { engine, error } = usePdfiumEngine({
    fontFallback: cdnFontConfig,
    wasmUrl: new URL(wasmUrl, window.location.origin).href,
  });
  const plugins = useMemo(
    () => [
      createPluginRegistration(DocumentManagerPluginPackage, {
        initialDocuments: [
          {
            documentId: url,
            mode: "full-fetch",
            requestOptions: { credentials: "same-origin" },
            url: new URL(url, window.location.origin).href,
          },
        ],
      }),
      createPluginRegistration(ViewportPluginPackage, { viewportGap: 16 }),
      createPluginRegistration(ScrollPluginPackage),
      createPluginRegistration(RenderPluginPackage),
      createPluginRegistration(ZoomPluginPackage, { defaultZoomLevel: ZoomMode.Automatic }),
    ],
    [url],
  );

  if (error) {
    return (
      <PdfPreviewResult loading={false} onLoadingChange={onLoadingChange} visible={visible}>
        <DocumentPreviewError />
      </PdfPreviewResult>
    );
  }
  if (!engine) {
    return null;
  }
  return (
    <EmbedPDF engine={engine} plugins={plugins}>
      {({ activeDocumentId }) =>
        activeDocumentId && (
          <DocumentContent documentId={activeDocumentId}>
            {({ isError, isLoaded }) => (
              <PdfPreviewResult
                loading={!isError && !isLoaded}
                onLoadingChange={onLoadingChange}
                visible={visible}
              >
                {isError ? (
                  <DocumentPreviewError />
                ) : (
                  isLoaded && (
                    <PdfPreviewContent
                      documentId={activeDocumentId}
                      toolbarTargets={toolbarTargets}
                    />
                  )
                )}
              </PdfPreviewResult>
            )}
          </DocumentContent>
        )
      }
    </EmbedPDF>
  );
}
