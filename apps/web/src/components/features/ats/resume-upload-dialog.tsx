import { IconUpload } from "@tabler/icons-react";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  getResumeDocumentFileIconKind,
  ResumeDocumentFileIcon,
} from "@/components/resume-document-file-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import * as m from "@/paraglide/messages";
import { atsApi, readAts } from "./client";

const uploadConcurrency = 4;

interface UploadTask {
  file: File;
  index: number;
  uploadId?: string;
  status: "waiting" | "uploading" | "confirming" | "succeeded" | "failed";
  progress: number | null;
}

interface UploadTarget {
  contentType: string;
  id: string;
  url: string | null;
}

const uploadStatus = {
  failed: { label: m.ats_failed, variant: "error" },
  succeeded: { label: m.ats_uploaded, variant: "success" },
  waiting: { label: m.ats_waiting, variant: "outline" },
} as const;

function putResume(
  url: string,
  file: File,
  contentType: string,
  onProgress: (progress: number) => void,
) {
  // oxlint-disable-next-line promise/avoid-new -- 上传进度由 XHR 事件提供。 / XHR events provide upload progress.
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.floor((event.loaded / event.total) * 100));
      }
    });
    request.addEventListener(
      "loadend",
      () => {
        if (request.status >= 200 && request.status < 300) {
          resolve();
        } else {
          reject(new Error(m.ats_error()));
        }
      },
      { once: true },
    );
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", contentType);
    request.send(file);
  });
}

/**
 * 简历批量上传入口，负责上传、确认和操作反馈，通过回调通知外层刷新数据。
 * Batch resume upload entry handling upload, confirmation and feedback, notifying the caller to refresh data through a callback.
 */
export function ResumeUploadDialog({
  workspaceId,
  onSettled,
}: {
  workspaceId: string;
  onSettled: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [tasks, setTasks] = useState<UploadTask[]>([]);

  function updateTask(index: number, changes: Partial<UploadTask>) {
    setTasks((current) =>
      current.map((task) => (task.index === index ? { ...task, ...changes } : task)),
    );
  }

  async function uploadFile(task: UploadTask, target: UploadTarget | Promise<UploadTarget>) {
    let { uploadId } = task;
    updateTask(task.index, { progress: null, status: "uploading" });
    try {
      const { contentType, id, url } = await target;
      uploadId = id;
      if (url) {
        await putResume(url, task.file, contentType, (progress) =>
          updateTask(task.index, { progress }),
        );
      }
      updateTask(task.index, { progress: 100, status: "confirming" });
      await readAts(await atsApi.uploads[":id"].confirm.$post({ param: { id, workspaceId } }));
      updateTask(task.index, { status: "succeeded" });
    } catch {
      if (uploadId) {
        await atsApi.uploads[":id"].failed
          .$post({ param: { id: uploadId, workspaceId } })
          .catch(() => null);
      }
      updateTask(task.index, { status: "failed", uploadId });
    }
  }

  const uploads = useMutation({
    async mutationFn(pending: UploadTask[]) {
      const [first] = pending;
      if (first.uploadId) {
        await uploadFile(
          first,
          atsApi.uploads[":id"].retry
            .$post({ param: { id: first.uploadId, workspaceId } })
            .then(readAts),
        );
        return;
      }
      const batch = await readAts(
        await atsApi.uploads.$post({
          json: {
            files: pending.map(({ file }) => ({ filename: file.name, size: file.size })),
            version: 1,
          },
          param: { workspaceId },
        }),
      );
      const queue = pending.entries();
      await Promise.all(
        Array.from({ length: Math.min(uploadConcurrency, pending.length) }, async () => {
          for (const [index, task] of queue) {
            // oxlint-disable-next-line no-await-in-loop -- 每个并发槽位一次上传一份文件。 / Each concurrent worker uploads one file at a time.
            await uploadFile(task, batch.uploads[index]);
          }
        }),
      );
    },
    onError(_error, pending) {
      for (const task of pending) {
        updateTask(task.index, { status: "failed" });
      }
    },
    onSettled,
  });

  const complete = tasks.filter((task) => task.status === "succeeded").length;
  const open = complete < tasks.length;

  return (
    <>
      <Button
        ref={trigger}
        onClick={() => input.current?.click()}
        disabled={open}
        variant="outline"
      >
        <IconUpload aria-hidden="true" />
        {m.ats_upload()}
      </Button>
      <input
        ref={input}
        type="file"
        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
        multiple
        hidden
        aria-label={m.ats_upload()}
        onChange={(event) => {
          const selected = [...(event.currentTarget.files ?? [])];
          event.currentTarget.value = "";
          if (selected.length) {
            const pending = selected.map((file, index): UploadTask => ({
              file,
              index,
              progress: null,
              status: "waiting",
            }));
            setTasks(pending);
            uploads.mutate(pending);
          }
        }}
      />
      <Dialog
        open={open}
        disablePointerDismissal
        onOpenChange={(next, details) => {
          if (!next) {
            if (uploads.isPending) {
              details.cancel();
            } else {
              setTasks([]);
            }
          }
        }}
      >
        <DialogPopup
          className="[&_[data-slot=scroll-area-viewport]]:max-h-[min(50dvh,24rem)]"
          finalFocus={trigger}
          showCloseButton={!uploads.isPending}
        >
          <DialogHeader>
            <DialogTitle>{m.ats_upload()}</DialogTitle>
            <DialogDescription aria-live="polite">
              {m.ats_upload_progress({ complete: String(complete), total: String(tasks.length) })}
            </DialogDescription>
          </DialogHeader>
          <DialogPanel>
            <ul className="divide-y">
              {tasks.map((task) => {
                const { file, index, progress, status } = task;
                return (
                  <li key={index} className="flex items-start gap-3 py-3">
                    <ResumeDocumentFileIcon
                      className="size-6 shrink-0"
                      kind={getResumeDocumentFileIconKind({
                        fileName: file.name,
                        mediaType: file.type,
                      })}
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <p className="wrap-anywhere text-sm font-medium">{file.name}</p>
                      {status === "uploading" || status === "confirming" ? (
                        <>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                            <span>
                              {status === "confirming"
                                ? m.ats_upload_confirming()
                                : m.ats_uploading()}
                            </span>
                            {progress !== null && <span className="tabular-nums">{progress}%</span>}
                          </div>
                          <Progress aria-label={file.name} value={progress} />
                        </>
                      ) : (
                        <Badge variant={uploadStatus[status].variant}>
                          {uploadStatus[status].label()}
                        </Badge>
                      )}
                    </div>
                    {status === "failed" && (
                      <Button
                        aria-label={m.ats_retry_upload({ filename: file.name })}
                        disabled={uploads.isPending}
                        onClick={() => uploads.mutate([task])}
                        size="sm"
                        variant="outline"
                      >
                        {m.ats_retry()}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </DialogPanel>
        </DialogPopup>
      </Dialog>
    </>
  );
}
