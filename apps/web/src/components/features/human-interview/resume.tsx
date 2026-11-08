import { lazy, Suspense, useState } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { IconFileDescription } from "@tabler/icons-react";
import { DocumentPreviewDialog } from "@/components/features/document-preview/document-preview-dialog";
import { DocumentPreviewSkeleton } from "@/components/skeletons/components/document-preview-skeleton";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";

const PdfPreview = lazy(createClientOnlyFn(() => import("../document-preview/pdf-preview")));

export function MeetingResume({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const phase = useSkeletonPhase(loading);
  const [pagination, setPagination] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<HTMLDivElement | null>(null);
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <IconFileDescription />
        {m.resume_preview_original()}
      </DialogTrigger>
      <DocumentPreviewDialog filename="resume.pdf" downloadUrl={url}>
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
