import { lazy, Suspense, useState } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { IconFileDescription, IconMaximize } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { DocumentPreviewDialog } from "@/components/features/document-preview/document-preview-dialog";
import { DocumentPreviewSkeleton } from "@/components/skeletons/components/document-preview-skeleton";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";

const PdfPreview = lazy(createClientOnlyFn(() => import("../document-preview/pdf-preview")));

export function MeetingResume({ url, children }: { url: string; children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const phase = useSkeletonPhase(loading);
  const [pagination, setPagination] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<HTMLDivElement | null>(null);
  return (
    <Dialog>
      <DialogTrigger
        className="group flex w-full cursor-zoom-in flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={m.meeting_resume_fullscreen()}
      >
        <div
          className="pointer-events-none aspect-[16/10] w-full overflow-hidden p-5 md:p-8"
          aria-hidden="true"
        >
          {children}
        </div>
        <div className="flex w-full items-center gap-2 border-t bg-muted/40 px-4 py-3 text-sm">
          <IconFileDescription className="size-4" />
          <span className="flex-1">{m.meeting_resume()}</span>
          <IconMaximize className="size-4" />
        </div>
      </DialogTrigger>
      <DocumentPreviewDialog filename="resume.pdf" downloadUrl={url} fullScreen>
        <div className="flex shrink-0 justify-between border-b p-2">
          <div ref={setPagination} />
          <div ref={setZoom} />
        </div>
        <div className="relative flex min-h-0 flex-1 flex-col">
          {phase === "skeleton" && <DocumentPreviewSkeleton />}
          <Suspense fallback={null}>
            <PdfPreview
              url={url}
              onLoadingChange={setLoading}
              visible={phase === "ready"}
              toolbarTargets={{ pagination, zoom }}
            />
          </Suspense>
        </div>
      </DocumentPreviewDialog>
    </Dialog>
  );
}
