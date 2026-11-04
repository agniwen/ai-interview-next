import type { AgentRuntime } from "./runtime";

/** 合并连续更新，但不丢失读取期间到达的最后一次变更。
 * Coalesce bursts without dropping the final update arriving during a snapshot read. */
export function chatEvents(runtime: AgentRuntime) {
  const encoder = new TextEncoder();
  let detach: (() => void) | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  let reading = false;
  let dirty = false;
  const close = () => {
    closed = true;
    detach?.();
    clearInterval(heartbeat);
  };
  const stream = new ReadableStream<Uint8Array>({
    cancel: close,
    start(controller) {
      const flush = async () => {
        if (closed || reading) {
          return;
        }
        reading = true;
        try {
          while (dirty) {
            dirty = false;
            // 后一快照必须晚于前一快照，防止状态倒退。Snapshots are read sequentially to prevent state regression.
            // oxlint-disable-next-line no-await-in-loop
            const snapshot = await runtime.snapshot();
            if (closed) {
              break;
            }
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`));
          }
        } catch (error) {
          if (!closed) {
            controller.error(error);
          }
          close();
        } finally {
          reading = false;
        }
      };
      detach = runtime.subscribe(() => {
        dirty = true;
        void flush();
      });
      heartbeat = setInterval(() => {
        if (!closed) {
          controller.enqueue(encoder.encode(": keepalive\n\n"));
        }
      }, 15_000);
      dirty = true;
      void flush();
    },
  });
  return new Response(stream, {
    headers: { "Cache-Control": "no-cache, no-transform", "Content-Type": "text/event-stream" },
  });
}
