import type { Database } from "@ai-interview/db";
import {
  resumeProcessingOutbox as outbox,
  resumeProcessingRun as run,
  resumeUploadBatch as batch,
  resumeUploadItem as item,
} from "@ai-interview/db/schema";
import { and, eq } from "drizzle-orm";
import type { ResumeObjectStore } from "./contracts";
import { outboxEntry } from "./outbox";

export async function createUploadBatch(
  db: Database,
  storage: ResumeObjectStore,
  workspaceId: string,
  userId: string,
  files: { filename: string; size: number }[],
) {
  const id = crypto.randomUUID();
  const items = files.map((file) => {
    const itemId = crypto.randomUUID();
    return {
      ...file,
      batchId: id,
      id: itemId,
      objectKey: `${workspaceId}/${id}/${itemId}`,
      status: "waiting" as const,
      workspaceId,
    };
  });
  const uploads = await Promise.all(
    items.map(async (file) => ({ id: file.id, url: await storage.signUpload(file.objectKey) })),
  );
  await db.batch([
    db.insert(batch).values({ createdAt: new Date(), createdBy: userId, id, workspaceId }),
    db.insert(item).values(items),
  ]);
  return { id, uploads, version: 1 as const };
}

export async function findUploadItem(db: Database, workspaceId: string, id: string) {
  const [file] = await db
    .select()
    .from(item)
    .where(and(eq(item.workspaceId, workspaceId), eq(item.id, id)));
  return file;
}

export async function acceptUpload(
  db: Database,
  storage: ResumeObjectStore,
  workspaceId: string,
  id: string,
) {
  const file = await findUploadItem(db, workspaceId, id);
  if (!file) {
    return;
  }
  if (file.runId) {
    return { runId: file.runId, version: 1 as const };
  }
  const object = await storage.head(file.objectKey);
  if (object?.size !== file.size) {
    return null;
  }
  const newRun = {
    createdAt: new Date(),
    executionId: id,
    id,
    kind: "parse" as const,
    stage: "extract_text" as const,
    status: "queued" as const,
    uploadItemId: id,
    workspaceId,
  };
  await db.batch([
    db.insert(run).values(newRun).onConflictDoNothing(),
    db
      .update(item)
      .set({ runId: id, status: "accepted" })
      .where(and(eq(item.id, id), eq(item.status, "waiting"))),
    db
      .insert(outbox)
      .values(outboxEntry("start", id, id))
      .onConflictDoNothing(),
  ]);
  return { runId: id, version: 1 as const };
}

export async function retryResumeRun(db: Database, workspaceId: string, runId: string) {
  const [entry] = await db
    .select()
    .from(run)
    .where(and(eq(run.id, runId), eq(run.workspaceId, workspaceId), eq(run.status, "failed")));
  if (!entry) {
    return false;
  }
  const executionId = crypto.randomUUID();
  await db.batch([
    db.update(run).set({ executionId, status: "queued" }).where(eq(run.id, runId)),
    db.insert(outbox).values(outboxEntry("start", runId, executionId)),
  ]);
  return true;
}
