import { recordCandidateConnectionEvents } from "./client";
import type { CandidateConnectionEvent } from "./client";

/** 断网期间保留连接事件，恢复或浏览器重新上线后按原 ID 补交。
 * Retain connection events offline and submit their original IDs after reconnection or the browser's online event. */
export function createConnectionRecorder(token: string) {
  const runId = crypto.randomUUID();
  const pending: CandidateConnectionEvent[] = [];
  let saving: Promise<void> | undefined;
  async function send() {
    while (pending.length) {
      const batch = pending.slice(0, 50);
      // 按顺序确认后移除队列，失败时保留尚未写入的事件。
      // Acknowledge batches in order; preserve unwritten events after a failed write.
      // oxlint-disable-next-line no-await-in-loop
      await recordCandidateConnectionEvents(token, batch);
      pending.splice(0, batch.length);
    }
  }
  function flush() {
    saving ??= send()
      .catch(() => {
        console.warn("Interview connection events will be retried after connectivity returns");
      })
      .finally(() => {
        saving = undefined;
      });
    return saving;
  }
  return {
    flush,
    record(kind: CandidateConnectionEvent["content"]["kind"], reason: string | null = null) {
      pending.push({
        at: Date.now(),
        content: {
          attempt: null,
          kind,
          reason,
          recoverable: kind !== "candidate_left",
          version: 1,
        },
        id: crypto.randomUUID(),
        runId,
      });
      return flush();
    },
  };
}
