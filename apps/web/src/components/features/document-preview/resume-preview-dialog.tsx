import { createClientOnlyFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import type { ReactNode } from "react";
import { atsApi } from "@/components/ats/client";
import { DocumentPreviewSkeleton } from "@/components/skeletons/components/document-preview-skeleton";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { DocumentPreviewDialog } from "./document-preview-dialog";
import { ResumeProfilePanel } from "./resume-profile-panel";

const PdfPreview = lazy(createClientOnlyFn(() => import("./pdf-preview")));

export function ResumePreviewDialog({
  actions,
  filename,
  id,
  workspaceId,
}: {
  actions?: ReactNode;
  filename: string;
  id: string;
  workspaceId: string;
}) {
  const url = atsApi["upload-files"][":id"].$path({ param: { id, workspaceId } });
  const [pdfLoading, setPdfLoading] = useState(true);
  const pdfPhase = useSkeletonPhase(pdfLoading);
  const [view, setView] = useState("original");
  const [paginationTarget, setPaginationTarget] = useState<HTMLDivElement | null>(null);
  const [zoomTarget, setZoomTarget] = useState<HTMLDivElement | null>(null);

  return (
    <DocumentPreviewDialog actions={actions} downloadUrl={url} filename={filename}>
      <Tabs
        className="min-h-0 flex-1 gap-0 [--preview-controls-height:--spacing(9)]"
        onValueChange={(value) => setView(String(value))}
        value={view}
      >
        <div className="grid shrink-0 grid-cols-[1fr_auto] items-center border-b px-2 py-1.5 sm:grid-cols-[1fr_auto_1fr] sm:px-4">
          <TabsList
            aria-label={m.resume_preview_views()}
            className="col-span-2 row-start-1 justify-self-center sm:col-span-1 sm:col-start-2"
          >
            <TabsTab className="text-sm" value="original">
              {m.resume_preview_original()}
            </TabsTab>
            <TabsTab className="text-sm" value="standard">
              {m.resume_preview_standard()}
            </TabsTab>
          </TabsList>
          <div
            className="col-start-1 row-start-2 justify-self-start empty:hidden max-sm:h-(--preview-controls-height) max-sm:content-end sm:row-start-1"
            hidden={view !== "original"}
            ref={setPaginationTarget}
          />
          <div
            className="col-start-2 row-start-2 justify-self-end empty:hidden max-sm:h-(--preview-controls-height) max-sm:content-end sm:col-start-3 sm:row-start-1"
            hidden={view !== "original"}
            ref={setZoomTarget}
          />
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* 保留 PDF 视口尺寸，切换标签页时维持页码。 / Keep the PDF viewport sized so switching tabs preserves the page. */}
          <TabsPanel
            className="flex min-h-0 flex-col data-hidden:invisible data-hidden:absolute data-hidden:inset-0 max-sm:data-hidden:top-(--preview-controls-height)"
            keepMounted
            render={<div hidden={false} />}
            value="original"
          >
            {pdfPhase === "skeleton" && <DocumentPreviewSkeleton />}
            <Suspense fallback={null}>
              <PdfPreview
                onLoadingChange={setPdfLoading}
                toolbarTargets={{ pagination: paginationTarget, zoom: zoomTarget }}
                url={url}
                visible={pdfPhase === "ready"}
              />
            </Suspense>
          </TabsPanel>
          <TabsPanel
            className="min-h-0 overflow-y-auto bg-card text-card-foreground"
            value="standard"
          >
            <ResumeProfilePanel id={id} workspaceId={workspaceId} />
          </TabsPanel>
        </div>
      </Tabs>
    </DocumentPreviewDialog>
  );
}
