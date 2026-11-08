import type { ReceivedMessage } from "@livekit/components-react";

const USER_TRANSCRIPT_TYPE = "userTranscript";
const USER_TURN_STARTED_AT = "interview.user_turn_started_at_ms";

function participantIdentity(message: ReceivedMessage): string | undefined {
  return message.from?.identity;
}

function isUserTranscript(message: ReceivedMessage): message is ReceivedMessage & {
  message: string;
  type: typeof USER_TRANSCRIPT_TYPE;
} {
  return message.type === USER_TRANSCRIPT_TYPE;
}

// 完整快照到齐后替换旧消息，不能按文字去重真实的重复回答。
// Replace old messages only after the full snapshot arrives; equal text can be separate answers.
export function applyReplaySnapshot(messages: ReceivedMessage[]): ReceivedMessage[] {
  const batches = new Map<
    string,
    { start: number; count: number; turns: Map<number, ReceivedMessage> }
  >();
  let latest: { start: number; count: number; turns: Map<number, ReceivedMessage> } | undefined;
  for (const [position, message] of messages.entries()) {
    if (message.type === "chatMessage") {
      continue;
    }
    const { attributes } = message;
    const id = attributes?.["interview.replay_batch"];
    if (!id) {
      continue;
    }
    const index = Number(attributes?.["interview.replay_index"]);
    const count = Number(attributes?.["interview.replay_count"]);
    if (!Number.isInteger(index) || !Number.isInteger(count) || index < 0 || index >= count) {
      continue;
    }
    const batch = batches.get(id) ?? {
      count,
      start: position,
      turns: new Map<number, ReceivedMessage>(),
    };
    batches.set(id, batch);
    if (batch.count !== count) {
      continue;
    }
    batch.turns.set(index, message);
    if (batch.turns.size === count && (!latest || batch.start > latest.start)) {
      latest = batch;
    }
  }
  if (!latest) {
    return messages;
  }
  const snapshotEntries = [...latest.turns.entries()];
  snapshotEntries.sort(([a], [b]) => a - b);
  const snapshot = snapshotEntries.map(([, message]) => message);
  const retained = messages.filter(
    (message, position) =>
      message.type === "chatMessage" ||
      (position > latest.start && !message.attributes?.["interview.replay_batch"]),
  );
  return [...snapshot, ...retained];
}

function userTurnStart(message: ReceivedMessage): number | null {
  const raw = message.attributes?.[USER_TURN_STARTED_AT];
  if (!isUserTranscript(message) || !raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function comparableText(message: ReceivedMessage): string {
  return message.message.trim().replace(/[。！？.!?]+$/u, "");
}

// 使用供应商实际开口时间排列迟到转写，不根据到达延迟猜测轮次。
// Order delayed transcripts by the provider speech-start time, not an arrival-delay heuristic.
export function orderSessionMessages(
  input: ReceivedMessage[],
  { includeChatMessages = true }: { includeChatMessages?: boolean } = {},
): ReceivedMessage[] {
  // 文本回答也会收到确认转写，避免同时展示本地发送副本。
  // Typed answers also receive confirmed transcripts; avoid showing the optimistic copy twice.
  const messages = applyReplaySnapshot(
    includeChatMessages ? input : input.filter((message) => message.type !== "chatMessage"),
  );
  const duplicatedStockMessages = new Set<ReceivedMessage>();
  for (const ordered of messages) {
    const startedAt = userTurnStart(ordered);
    if (startedAt === null) {
      continue;
    }
    // RoomIO 同时发送不带开口时间的副本，仅配对同一说话人在该轮开始后的相同转写。
    // Pair RoomIO copies only with equal transcripts from the same speaker after this turn began.
    const matching = messages.filter(
      (message) =>
        isUserTranscript(message) &&
        userTurnStart(message) === null &&
        !message.attributes?.["interview.replay_batch"] &&
        !duplicatedStockMessages.has(message) &&
        participantIdentity(message) === participantIdentity(ordered) &&
        message.timestamp >= startedAt &&
        comparableText(message) === comparableText(ordered),
    );
    matching.sort(
      (left, right) =>
        Math.abs(left.timestamp - ordered.timestamp) -
        Math.abs(right.timestamp - ordered.timestamp),
    );
    const [matchingStock] = matching;
    if (matchingStock) {
      duplicatedStockMessages.add(matchingStock);
    }
  }
  const retained = messages.filter((message) => !duplicatedStockMessages.has(message));
  const replayCount = retained.findIndex(
    (message) => !message.attributes?.["interview.replay_batch"],
  );
  const replayLength = replayCount === -1 ? retained.length : replayCount;
  const live = retained.slice(replayLength);
  live.sort((left, right) => {
    const leftTime = userTurnStart(left) ?? left.timestamp;
    const rightTime = userTurnStart(right) ?? right.timestamp;
    return leftTime - rightTime;
  });
  return [...retained.slice(0, replayLength), ...live];
}
