/* oxlint-disable no-await-in-loop -- 后续阶段和重试依赖上一次尝试的结果。 / Later stages and retries depend on the previous attempt's outcome. */
/* oxlint-disable typescript/no-non-null-assertion -- 工作流只读取其发件箱已持久化的运行、尝试和阶段产物。 / The workflow reads runs, attempts and stage artifacts committed before outbox dispatch. */
import type { Database } from "@ai-interview/db";
import {
  resume,
  resumeProcessingAttempt as attempt,
  resumeProcessingOutbox as outbox,
  resumeProcessingRun as run,
} from "@ai-interview/db/schema";
import { and, eq } from "drizzle-orm";
import type { ResumeWorkflowSteps, WorkflowInput } from "./contracts";
import { resolveParsedResume } from "./identity";
import { outboxEntry } from "./outbox";

async function enqueueAttempt(
  db: Database,
  runId: string,
  executionId: string,
  stage: typeof run.$inferSelect.stage,
  ordinal: number,
) {
  const id = `${executionId}-${stage}-${ordinal}`;
  await db.batch([
    db
      .update(run)
      .set({ stage, status: "running" })
      .where(and(eq(run.id, runId), eq(run.executionId, executionId))),
    db
      .insert(attempt)
      .values({ createdAt: new Date(), executionId, id, ordinal, runId, stage, status: "queued" })
      .onConflictDoNothing(),
    db
      .insert(outbox)
      .values(outboxEntry("stage", runId, executionId, id))
      .onConflictDoNothing(),
  ]);
  return id;
}

async function awaitAttempt(db: Database, steps: ResumeWorkflowSteps, id: string) {
  let poll = 0;
  while (true) {
    const state = await steps.checkpoint(`${id}-status-${poll}`, async () => {
      const [current] = await db.select().from(attempt).where(eq(attempt.id, id));
      const now = Date.now();
      if (current!.status === "running" && current!.deadlineAt!.getTime() <= now) {
        const [changed] = await db
          .update(attempt)
          .set({
            error: "ATTEMPT_TIMED_OUT",
            finishedAt: new Date(now),
            retryable: true,
            status: "failed",
          })
          .where(and(eq(attempt.id, id), eq(attempt.status, "running")))
          .returning();
        if (changed) {
          return { retryAfterMs: 0, retryable: true, status: "failed", timeout: 0 };
        }
        const [completed] = await db.select().from(attempt).where(eq(attempt.id, id));
        return {
          retryAfterMs: Math.max(0, (completed!.retryAfterAt?.getTime() ?? now) - now),
          retryable: completed!.retryable,
          status: completed!.status,
          timeout: 0,
        };
      }
      return {
        retryAfterMs: Math.max(0, (current!.retryAfterAt?.getTime() ?? now) - now),
        retryable: current!.retryable,
        status: current!.status,
        timeout: current!.deadlineAt
          ? Math.max(1000, current!.deadlineAt.getTime() - now)
          : 120_000,
      };
    });
    if (state.status !== "queued" && state.status !== "running") {
      return state;
    }
    await steps.waitForAttempt(`${id}-wait-${poll}`, id, state.timeout);
    poll += 1;
  }
}

export async function runResumeWorkflow(
  db: Database,
  steps: ResumeWorkflowSteps,
  input: WorkflowInput,
  executionId: string,
  dispatch: (runId: string) => Promise<void>,
) {
  const { runId } = input;
  const entry = await steps.checkpoint("start", async () => {
    const [current] = await db
      .select()
      .from(run)
      .where(and(eq(run.id, runId), eq(run.executionId, executionId)));
    return { stage: current!.stage };
  });
  const stages =
    entry.stage === "extract_text" ? (["extract_text", "structure"] as const) : [entry.stage];
  for (const stage of stages) {
    let succeeded = false;
    for (let ordinal = 1; ordinal <= 3; ordinal += 1) {
      const { id } = await steps.checkpoint(`enqueue-${stage}-${ordinal}`, async () => {
        const attemptId = await enqueueAttempt(db, runId, executionId, stage, ordinal);
        await dispatch(runId);
        return { id: attemptId };
      });
      const outcome = await awaitAttempt(db, steps, id);
      if (outcome.status === "succeeded") {
        succeeded = true;
        break;
      }
      if (outcome.status === "skipped" || !outcome.retryable || ordinal === 3) {
        break;
      }
      await steps.sleep(
        `retry-${stage}-${ordinal}`,
        Math.max(ordinal === 1 ? 30_000 : 120_000, outcome.retryAfterMs),
      );
    }
    const state = await steps.checkpoint(`finish-${stage}`, async () => {
      const [current] = await db.select().from(run).where(eq(run.id, runId));
      if (current!.status === "succeeded" || current!.status === "skipped") {
        return { done: true };
      }
      if (!succeeded) {
        await db.batch([
          db.update(run).set({ status: "failed" }).where(eq(run.id, runId)),
          db
            .update(resume)
            .set({ parseStatus: "failed" })
            .where(eq(resume.id, current!.kind === "parse" ? (current!.resumeId ?? "") : "")),
        ]);
        return { done: true };
      }
      if (stage !== "extract_text") {
        if (stage === "structure") {
          await resolveParsedResume(db, current!.resumeId!);
        }
        await db.update(run).set({ status: "succeeded" }).where(eq(run.id, runId));
        return { done: true };
      }
      return { done: false };
    });
    if (state.done) {
      return;
    }
  }
}
