/* oxlint-disable typescript/no-non-null-assertion -- 阶段和完成事件与其尝试在同一事务内保存。 / Stage and completion events are committed in the same transaction as their attempt. */
import type { Database } from "@ai-interview/db";
import {
  resumeProcessingAttempt as attempt,
  resumeProcessingOutbox as outbox,
} from "@ai-interview/db/schema";
import { and, asc, eq, isNull, lte } from "drizzle-orm";
import type { ResumeStageQueue, ResumeWorkflowRuntime, StageMessage } from "./contracts";

export function outboxEntry(
  topic: "start" | "stage" | "finished",
  runId: string,
  executionId: string,
  attemptId?: string,
) {
  return {
    attemptId,
    availableAt: new Date(),
    executionId,
    id: `${topic}-${attemptId ?? executionId}`,
    runId,
    topic,
  };
}

export async function dispatchResumeOutbox(
  db: Database,
  queue: ResumeStageQueue,
  workflow: ResumeWorkflowRuntime,
  runId?: string,
) {
  const entries = await db
    .select({ entry: outbox, stage: attempt.stage })
    .from(outbox)
    .leftJoin(attempt, eq(attempt.id, outbox.attemptId))
    .where(
      and(
        isNull(outbox.sentAt),
        lte(outbox.availableAt, new Date()),
        runId ? eq(outbox.runId, runId) : undefined,
      ),
    )
    .orderBy(asc(outbox.availableAt), asc(outbox.id))
    .limit(100);
  await Promise.allSettled(
    entries.map(async ({ entry, stage }) => {
      if (entry.topic === "start") {
        await workflow.start(entry.executionId, { runId: entry.runId, version: 1 });
      } else {
        const message: StageMessage = {
          attemptId: entry.attemptId!,
          runId: entry.runId,
          version: 1,
        };
        await (entry.topic === "stage"
          ? queue.publish(stage!, message)
          : workflow.notifyAttemptFinished(entry.executionId, message));
      }
      await db.update(outbox).set({ sentAt: new Date() }).where(eq(outbox.id, entry.id));
    }),
  );
}
