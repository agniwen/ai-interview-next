import { IconDownload, IconX } from "@tabler/icons-react";
import { CatchBoundary } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import * as m from "@/paraglide/messages";

export function DocumentPreviewError() {
  return (
    <div className="grid min-h-0 flex-1 place-items-center bg-muted/40 p-4">
      <Alert className="max-w-sm" variant="error">
        <AlertDescription>{m.document_preview_error()}</AlertDescription>
      </Alert>
    </div>
  );
}

/**
 * 文档弹窗内容容器；由外层 Dialog 管理打开状态，children 提供预览器。
 * Document-dialog content shell; an outer Dialog owns open state and children supply the viewer.
 */
export function DocumentPreviewDialog({
  actions,
  children,
  downloadUrl,
  filename,
}: {
  actions?: ReactNode;
  children: ReactNode;
  downloadUrl: string;
  filename: string;
}) {
  return (
    <DialogPopup
      bottomStickOnMobile={false}
      className="h-[calc(100dvh-2rem)] max-w-6xl overflow-hidden sm:h-[min(88dvh,64rem)]"
      showCloseButton={false}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <ResumeDocumentFileIcon
            className="size-6 shrink-0"
            kind={getResumeDocumentFileIconKind({ fileName: filename })}
          />
          <DialogTitle className="truncate text-sm font-medium" title={filename}>
            {filename}
          </DialogTitle>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <Button
            render={
              <a
                aria-label={m.document_preview_download()}
                download={filename}
                href={downloadUrl}
              />
            }
            size="icon"
            title={m.document_preview_download()}
            variant="ghost"
          >
            <IconDownload />
          </Button>
          <DialogClose
            aria-label={m.document_preview_close()}
            render={<Button size="icon" variant="ghost" />}
            title={m.document_preview_close()}
          >
            <IconX />
          </DialogClose>
        </div>
      </header>
      <CatchBoundary getResetKey={() => downloadUrl} errorComponent={DocumentPreviewError}>
        {children}
      </CatchBoundary>
    </DialogPopup>
  );
}
