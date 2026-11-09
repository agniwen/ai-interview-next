import { lazy, Suspense, useState } from "react";
import { createClientOnlyFn } from "@tanstack/react-start";
import { ClientOnly } from "@tanstack/react-router";
import { IconMaximize } from "@tabler/icons-react";
import { DocumentPreviewDialog } from "@/components/features/document-preview/document-preview-dialog";
import type { DocumentPreviewToolbarTargets } from "@/components/features/document-preview/document-preview-toolbar";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { DocumentPreviewSkeleton } from "@/components/skeletons/components/document-preview-skeleton";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { getResumeDocumentKind } from "@/lib/resume-documents";
import * as m from "@/paraglide/messages";

const PdfPreview = lazy(createClientOnlyFn(() => import("../document-preview/pdf-preview")));

function MeetingResumePdf({
  url,
  toolbarTargets,
}: {
  url: string;
  toolbarTargets?: DocumentPreviewToolbarTargets;
}) {
  const [loading, setLoading] = useState(true);
  const phase = useSkeletonPhase(loading);
  return (
    <ClientOnly fallback={<DocumentPreviewSkeleton />}>
      {phase === "skeleton" && <DocumentPreviewSkeleton />}
      <Suspense fallback={null}>
        <PdfPreview
          url={url}
          onLoadingChange={setLoading}
          visible={phase === "ready"}
          toolbarTargets={toolbarTargets}
        />
      </Suspense>
    </ClientOnly>
  );
}

export function MeetingResume({ filename, url }: { filename: string; url: string }) {
  const [pagination, setPagination] = useState<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState<HTMLDivElement | null>(null);
  const isImage = getResumeDocumentKind({ fileName: filename }) === "image";
  return (
    <Dialog>
      <div className="relative overflow-hidden rounded-xl border bg-card shadow-sm focus-within:ring-2 focus-within:ring-ring">
        <div
          className="flex aspect-[16/10] w-full flex-col overflow-hidden bg-muted/40"
          aria-hidden="true"
          inert
        >
          {isImage ? (
            <img alt="" className="size-full object-contain" loading="lazy" src={url} />
          ) : (
            <MeetingResumePdf url={url} />
          )}
        </div>
        <DialogTrigger
          aria-label={`${m.meeting_resume_fullscreen()} · ${filename}`}
          className="flex w-full cursor-zoom-in items-center gap-2 border-t bg-muted/40 px-4 py-3 text-start text-sm outline-none after:absolute after:inset-0"
        >
          <ResumeDocumentFileIcon
            className="size-4 shrink-0"
            kind={getResumeDocumentFileIconKind({ fileName: filename })}
          />
          <span className="min-w-0 flex-1 truncate">{filename}</span>
          <IconMaximize aria-hidden="true" className="size-4 shrink-0" />
        </DialogTrigger>
      </div>
      <DocumentPreviewDialog filename={filename} downloadUrl={url} fullScreen>
        {isImage ? (
          <ScrollArea className="min-h-0 flex-1 bg-muted/40" overscrollContain>
            <img alt={filename} className="mx-auto h-auto max-w-full p-4" src={url} />
          </ScrollArea>
        ) : (
          <>
            <div className="flex shrink-0 justify-between border-b p-2">
              <div ref={setPagination} />
              <div ref={setZoom} />
            </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <MeetingResumePdf url={url} toolbarTargets={{ pagination, zoom }} />
            </div>
          </>
        )}
      </DocumentPreviewDialog>
    </Dialog>
  );
}
