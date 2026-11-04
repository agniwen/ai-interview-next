import { z } from "zod";

/** 单次输入的文本边界；HTTP 入口校验后，内部直接使用已验证值。
 * Text bounds for one input; internal code consumes the value validated at the HTTP boundary. */
const text = z.string().trim().min(1).max(32_000);
/** 客户端生成的稳定消息 ID，重试沿用它以避免重复提交。
 * Stable client-generated message ID, reused on retries to prevent duplicate submissions. */
const id = z.string().uuid();

/** 会话命令协议。排队、插队和停止是不同操作，不能由连接状态隐式触发。
 * Chat command protocol. Queueing, steering and stopping are explicit operations, independent of connection state. */
export const agentCommand = z.discriminatedUnion("type", [
  // send 在运行中追加到产品队列；edit/remove 只作用于尚未执行的消息。
  // send appends to the product queue while running; edit/remove only affect pending messages.
  z.object({ id, text, type: z.literal("send") }),
  z.object({ id, text, type: z.literal("edit") }),
  z.object({ id, type: z.literal("remove") }),
  // ids 是完整的新顺序；服务端与当前队列核对，避免覆盖已经开始处理的消息。
  // ids is the complete new order, checked against the current queue to avoid overwriting started work.
  z.object({ ids: z.array(id), type: z.literal("reorder") }),
  // steer 参与当前任务，不代表移到队首，也不强制取消模型请求。
  // steer joins the current run; it neither moves an item to the queue head nor forcibly cancels the model request.
  z.object({ id, type: z.literal("steer") }),
  // stop 暂停队列并停止本会话全部工作；resume 只恢复待处理队列。
  // stop pauses the queue and aborts this chat's work; resume restarts only pending inputs.
  z.object({ type: z.literal("stop") }),
  z.object({ type: z.literal("resume") }),
  z.object({ title: z.string().trim().min(1).max(100), type: z.literal("rename") }),
  // trash 保留历史和队列；restore 不自动恢复执行。永久删除使用独立接口。
  // trash retains history and queue; restore does not resume execution. Permanent deletion has a separate endpoint.
  z.object({ type: z.literal("trash") }),
  z.object({ type: z.literal("restore") }),
]);
export type AgentCommand = z.infer<typeof agentCommand>;

/** 已持久化但尚未交给模型的输入，数组位置就是执行顺序。
 * Persisted input not yet dispatched to the model; array position defines execution order. */
export const queueItem = z.object({ id: z.string(), text: z.string() });

/** 侧栏投影；权限范围由服务器决定，不接受客户端指定所有者。
 * Sidebar projection; the server determines ownership, never the client. */
export const chatSummary = z.object({
  id: z.string(),
  // 仅用户发送更新此时间；流式输出、重命名和排序不会让列表跳动。
  // Only user sends update this timestamp; streaming, renaming and queue sorting do not reorder chats.
  lastSentAt: z.number(),
  title: z.string(),
  trashed: z.boolean(),
});

/** UI 消息投影，不向浏览器泄漏 pi 内部任务结构或供应商凭据。
 * UI message projection, without internal pi task structures or provider credentials. */
export const chatMessage = z.object({
  id: z.string(),
  interrupted: z.boolean(),
  reasoning: z.string(),
  role: z.enum(["user", "assistant"]),
  text: z.string(),
});

/** 重连发送完整快照；历史和实时片段由服务端统一合并，避免客户端重复追加。
 * Reconnection delivers a full snapshot; the server merges history and live partials to avoid duplicate appends. */
export const chatSnapshot = z.object({
  error: z.string().nullable(),
  messages: z.array(chatMessage),
  queue: z.array(queueItem),
  // stopping 表示尚未完成取消；paused 保留队列，等待用户继续。
  // stopping means cancellation is unfinished; paused retains queued inputs until explicit resume.
  status: z.enum(["idle", "running", "stopping", "paused"]),
  summary: chatSummary,
});
export const chatList = z.object({ sessions: z.array(chatSummary) });
export type QueueItem = z.infer<typeof queueItem>;
export type ChatSummary = z.infer<typeof chatSummary>;
export type ChatMessage = z.infer<typeof chatMessage>;
export type ChatSnapshot = z.infer<typeof chatSnapshot>;
