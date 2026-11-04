import { useCallback, useEffect, useState } from "react";
import { replaceEqualDeep } from "@tanstack/react-query";
import { chatSnapshot } from "@ai-interview/agent";
import type { ChatSnapshot, ChatSummary } from "@ai-interview/agent";
import { agentClient } from "./client";

export function useChat(
  workspaceId: string,
  sessionId: string | undefined,
  onSummary: (summary: ChatSummary) => void,
) {
  const [snapshot, setSnapshot] = useState<ChatSnapshot>();
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);
  const acceptSnapshot = useCallback((next: ChatSnapshot) => {
    // 流式快照复用未变化的消息和队列，避免历史 Markdown 重渲染。
    // Share unchanged messages and queue entries across stream snapshots to skip historical Markdown renders.
    setSnapshot((previous) => replaceEqualDeep(previous, next));
  }, []);
  const summary = snapshot?.summary;
  useEffect(() => {
    if (summary) {
      onSummary(summary);
    }
  }, [summary, onSummary]);
  useEffect(() => {
    if (!sessionId) {
      return;
    }
    const source = new EventSource(agentClient(workspaceId).events(sessionId));
    source.addEventListener("message", (event) => {
      const parsed = chatSnapshot.safeParse(JSON.parse(event.data));
      if (!parsed.success) {
        source.close();
        setConnected(false);
        setFailed(true);
        return;
      }
      const next = parsed.data;
      acceptSnapshot(next);
      setConnected(true);
      setFailed(false);
    });
    source.addEventListener("error", () => {
      setConnected(false);
      setFailed(true);
    });
    // 卸载只取消订阅，服务端任务由用户显式停止。
    // Unmounting closes only the subscription; stopping server work requires an explicit command.
    return () => source.close();
  }, [workspaceId, sessionId, acceptSnapshot]);
  return { acceptSnapshot, connected, failed, snapshot };
}
