import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { ReceivedMessage } from "@livekit/components-react";
import { InterviewTranscript } from "../src/components/features/candidate-interview/transcript";

const replay = (index: number): ReceivedMessage => ({
  attributes: {
    "interview.replay_batch": "batch1",
    "interview.replay_count": "2",
    "interview.replay_index": String(index),
  },
  id: `replay-${index}`,
  message: `历史${index}`,
  timestamp: 5000,
  type: "agentTranscript",
});

it("places a late candidate transcript before the reply it prompted", () => {
  const messages: ReceivedMessage[] = [
    { id: "reply", message: "为什么选择这个设计？", timestamp: 3000, type: "agentTranscript" },
    {
      attributes: { "interview.user_turn_started_at_ms": "2000" },
      id: "answer",
      message: "我负责订单接口。",
      timestamp: 4000,
      type: "userTranscript",
    },
  ];
  const html = renderToStaticMarkup(<InterviewTranscript messages={messages} state="listening" />);
  expect(html.indexOf("我负责订单接口")).toBeLessThan(html.indexOf("为什么选择这个设计"));
});

it("removes the RoomIO copy without merging separate identical answers", async () => {
  const { orderSessionMessages } =
    await import("../src/components/features/candidate-interview/transcript-order");
  const messages: ReceivedMessage[] = [
    { id: "stock1", message: "可以。", timestamp: 2500, type: "userTranscript" },
    {
      attributes: { "interview.user_turn_started_at_ms": "2000" },
      id: "ordered1",
      message: "可以",
      timestamp: 2600,
      type: "userTranscript",
    },
    { id: "reply", message: "继续吗？", timestamp: 3000, type: "agentTranscript" },
    { id: "stock2", message: "可以。", timestamp: 4500, type: "userTranscript" },
    {
      attributes: { "interview.user_turn_started_at_ms": "4000" },
      id: "ordered2",
      message: "可以",
      timestamp: 4600,
      type: "userTranscript",
    },
  ];
  expect(orderSessionMessages(messages).map((message) => message.id)).toEqual([
    "ordered1",
    "reply",
    "ordered2",
  ]);
});

it("replaces old transcripts only when the reconnect snapshot is complete", async () => {
  const { orderSessionMessages } =
    await import("../src/components/features/candidate-interview/transcript-order");
  const old: ReceivedMessage = {
    id: "old",
    message: "旧消息",
    timestamp: 1000,
    type: "agentTranscript",
  };
  const next: ReceivedMessage = {
    id: "new",
    message: "继续",
    timestamp: 6000,
    type: "agentTranscript",
  };
  expect(orderSessionMessages([old, replay(1)]).map((message) => message.id)).toContain("old");
  expect(
    orderSessionMessages([old, replay(1), replay(0), next]).map((message) => message.id),
  ).toEqual(["replay-0", "replay-1", "new"]);
});
