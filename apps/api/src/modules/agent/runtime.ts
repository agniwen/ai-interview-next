import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import { createRegistry, defineDoc, Harness, LiveDoc } from "@earendil-works/pi-durable";
import type {
  Conversation,
  Storage,
  SubmissionId,
  Wake,
  Cursor,
  Tx,
  WatchHandle,
  Submission,
} from "@earendil-works/pi-durable";
import type { Message, Models, Model } from "@earendil-works/pi-ai";
import type {
  AgentCommand,
  ChatMessage,
  ChatSnapshot,
  ChatSummary,
  QueueItem,
} from "@ai-interview/agent";

const context = BACKGROUND_CONTEXT;
interface ChatState {
  id: string;
  title: string;
  lastSentAt: number;
  trashed: boolean;
  manualTitle: boolean;
  generatedTitle: boolean;
  firstInput: string;
  queue: QueueItem[];
  steering: { id: string; text: string; submissionId: SubmissionId }[];
  accepted: string[];
  paused: boolean;
  stopping: boolean;
  active: SubmissionId | null;
  error: string | null;
}
export const ChatDoc = defineDoc<{ [K in keyof ChatState]: ChatState[K] }>({
  checkpointWhen: () => true,
  fork: "initial",
  history: "latest",
  initial: () => ({
    accepted: [],
    active: null,
    error: null,
    firstInput: "",
    generatedTitle: false,
    id: "",
    lastSentAt: 0,
    manualTitle: false,
    paused: false,
    queue: [],
    steering: [],
    stopping: false,
    title: "",
    trashed: false,
  }),
  kind: "sainoa.chat",
  // 为已有聊天补充插队回执。Backfill steering receipts for existing conversations.
  migrate: (value) => ({ ...value, steering: [] }) as unknown as ChatState,
  scope: "conversation",
  version: 2,
});

function messageView(id: string, message: Message): ChatMessage[] {
  if (message.role !== "user" && message.role !== "assistant") {
    return [];
  }
  const { content } = message;
  return [
    {
      id,
      interrupted:
        message.role === "assistant" &&
        (message.stopReason === "aborted" || message.stopReason === "error"),
      reasoning:
        typeof content === "string"
          ? ""
          : content
              .filter((part) => part.type === "thinking")
              .map((part) => part.thinking)
              .join(""),
      role: message.role,
      text:
        typeof content === "string"
          ? content
          : content
              .filter((part) => part.type === "text")
              .map((part) => part.text)
              .join(""),
    },
  ];
}

/** 平台无关的运行层：产品队列存在 pi 文档内，只有派发时才进入 pi 的 inbox。
 * Platform-neutral runtime: product inputs live in a pi document and enter its inbox only on dispatch. */
export class AgentRuntime {
  private listeners = new Set<() => void>();
  private monitoring = new Set<SubmissionId>();
  private titleController: AbortController | null = null;
  private titleWork: Promise<void> | null = null;
  private stopWork: Promise<void> | null = null;
  readonly harness: Harness;
  readonly conversation: Conversation;
  private models: Models;
  private modelId: string;
  private changed: (summary: ChatSummary) => Promise<void>;
  private runInBackground: (work: Promise<unknown>) => void;
  private constructor(
    harness: Harness,
    conversation: Conversation,
    models: Models,
    modelId: string,
    changed: (summary: ChatSummary) => Promise<void>,
    background: (work: Promise<unknown>) => void,
  ) {
    this.harness = harness;
    this.conversation = conversation;
    this.models = models;
    this.modelId = modelId;
    this.changed = changed;
    this.runInBackground = background;
  }

  static async open(
    storage: Storage,
    options: {
      models: Models;
      modelId: string;
      onWake?: (wake: Wake) => void;
      changed: (summary: ChatSummary) => Promise<void>;
      background: (work: Promise<unknown>) => void;
    },
  ) {
    const harness = await Harness.open(
      storage,
      { models: options.models, onWake: options.onWake, registry: createRegistry() },
      context,
    );
    const conversation = await harness.root(context, {
      agent: {
        instructions:
          "You are Sainoa, a helpful assistant. Reply in the user's language. Be accurate and concise.",
        model: { modelId: options.modelId, provider: "agent-chat" },
        thinkingLevel: "off",
      },
      init: async (tx, id) => {
        await tx.doc(ChatDoc, id);
      },
    });
    const runtime = new AgentRuntime(
      harness,
      conversation,
      options.models,
      options.modelId,
      options.changed,
      options.background,
    );
    const watch = await conversation.watch(context);
    watch.start(() => {
      runtime.notify();
      return Promise.resolve();
    });
    const stateWatch = await harness.watchDoc(ChatDoc, conversation.id, context);
    (stateWatch as WatchHandle<Readonly<ChatState>>).start(() => {
      runtime.notify();
      return Promise.resolve();
    });
    return runtime;
  }

  private notify() {
    for (const listener of this.listeners) {
      listener();
    }
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private async state() {
    return (await this.harness.snapshot(
      ChatDoc,
      this.conversation.id,
      context,
    )) as Readonly<ChatState>;
  }
  private update(change: (state: ChatState) => void) {
    return this.conversation.commit(async (tx) => {
      change(await tx.doc(ChatDoc, this.conversation.id));
    }, context);
  }
  async summary(): Promise<ChatSummary> {
    const state = await this.state();
    return {
      id: state.id,
      lastSentAt: state.lastSentAt,
      title: state.title,
      trashed: state.trashed,
    };
  }
  async initialize(id: string) {
    await this.update((state) => {
      state.id = id;
    });
  }
  async recover() {
    const state = await this.state();
    if (state.stopping) {
      await this.stop();
      return;
    }
    this.harness.resume();
    if (state.active === null) {
      await this.dispatch();
    } else {
      this.monitor(state.active);
    }
  }
  snapshot(): Promise<ChatSnapshot> {
    // 同一事务读取状态、历史和实时片段，避免完成瞬间重复显示回答。
    // Read state, history and live partials in one transaction to avoid duplicating a finishing response.
    return this.conversation.commit(async (tx) => {
      const state = await tx.doc(ChatDoc, this.conversation.id);
      const live = await tx.doc(LiveDoc, this.conversation.id);
      const history = await this.history(tx);
      const messages = history;
      if (live?.generation?.message) {
        messages.push(...messageView(`live-${live.run?.taskId}`, live.generation.message));
      }
      let status: ChatSnapshot["status"] = state.paused ? "paused" : "idle";
      if (state.active !== null || live.run) {
        status = "running";
      }
      return {
        error: state.error,
        messages,
        queue: state.queue.map((item) => ({ id: item.id, text: item.text })),
        status: state.stopping ? ("stopping" as const) : status,
        summary: {
          id: state.id,
          lastSentAt: state.lastSentAt,
          title: state.title,
          trashed: state.trashed,
        },
      };
    }, context);
  }
  private async history(tx: Tx) {
    const messages: ChatMessage[] = [];
    let cursor: Cursor | undefined;
    do {
      // 按存储游标顺序读取完整历史。Read history sequentially using storage cursors.
      // oxlint-disable-next-line no-await-in-loop
      const page = await tx.scanEntries(
        { conversationId: this.conversation.id, order: "ascending" },
        200,
        cursor,
      );
      for (const entry of page.items) {
        if (entry.kind !== "pi.user" && entry.kind !== "pi.assistant") {
          continue;
        }
        for (const [index, message] of (entry.model ?? []).entries()) {
          messages.push(...messageView(`${entry.id}-${index}`, message));
        }
      }
      cursor = page.next;
    } while (cursor);
    return messages;
  }
  async command(command: AgentCommand) {
    if (command.type === "stop" || command.type === "trash") {
      if (command.type === "trash") {
        await this.update((state) => {
          state.trashed = true;
        });
      }
      await this.stop();
      await this.changed(await this.summary());
      return;
    }
    if (command.type === "steer") {
      await this.steer(command.id);
      return;
    }
    await this.update((state) => {
      if (state.trashed && command.type !== "restore") {
        throw new Error("CHAT_TRASHED");
      }
      switch (command.type) {
        case "send": {
          if (state.accepted.includes(command.id)) {
            return;
          }
          state.accepted.push(command.id);
          state.queue.push({ id: command.id, text: command.text });
          state.lastSentAt = Date.now();
          if (!state.firstInput) {
            state.firstInput = command.text;
            state.title = command.text.slice(0, 48);
          }
          break;
        }
        case "edit": {
          const item = state.queue.find((entry) => entry.id === command.id);
          if (!item) {
            throw new Error("QUEUE_ITEM_STARTED");
          }
          item.text = command.text;
          break;
        }
        case "remove": {
          state.queue = state.queue.filter((item) => item.id !== command.id);
          break;
        }
        case "reorder": {
          const byId = new Map(state.queue.map((item) => [item.id, item]));
          if (
            command.ids.length !== byId.size ||
            new Set(command.ids).size !== byId.size ||
            command.ids.some((id) => !byId.has(id))
          ) {
            throw new Error("QUEUE_CHANGED");
          }
          state.queue = command.ids.map((id) => byId.get(id) as QueueItem);
          break;
        }
        case "resume": {
          if (state.stopping) {
            throw new Error("CHAT_STOPPING");
          }
          state.paused = false;
          state.error = null;
          break;
        }
        case "rename": {
          state.title = command.title;
          state.manualTitle = true;
          break;
        }
        case "restore": {
          state.trashed = false;
          state.paused = true;
          break;
        }
        default: {
          break;
        }
      }
    });
    await this.changed(await this.summary());
    await this.dispatch();
  }
  // 移出产品队列与提交给 pi 必须同事务，崩溃恢复才不会重复或丢失消息。
  // Queue removal and pi admission share one commit so crash recovery cannot lose or duplicate input.
  private async dispatch() {
    const submission = await this.conversation.commit(async (tx) => {
      const state = await tx.doc(ChatDoc, this.conversation.id);
      if (
        state.paused ||
        state.stopping ||
        state.trashed ||
        state.active !== null ||
        !state.queue.length
      ) {
        return null;
      }
      const [item] = state.queue;
      const id = await this.conversation.submit(tx, {
        content: item.text,
        type: "input",
        whenBusy: "reject",
      });
      state.queue.shift();
      state.active = id;
      state.error = null;
      return id;
    }, context);
    if (submission !== null) {
      this.harness.resume();
      this.monitor(submission);
    }
  }
  private monitor(id: SubmissionId) {
    if (this.monitoring.has(id)) {
      return;
    }
    this.monitoring.add(id);
    const work = (async () => {
      const submission = await this.harness.submission(id, context);
      const result = await (submission as Submission).wait(context);
      await this.conversation.waitForIdle(context);
      await this.update((state) => {
        if (state.active !== id) {
          return;
        }
        state.active = null;
        if (!state.stopping) {
          state.steering = [];
        }
        if (result.status === "unanswered") {
          state.paused = true;
          state.error = state.stopping ? null : "GENERATION_FAILED";
        }
      });
      await this.dispatch();
      this.startTitle();
    })().finally(() => this.monitoring.delete(id));
    this.runInBackground(work);
  }
  // whenIdle=reject 避免任务刚结束时把“插队”意外变为新任务；拒绝会回滚队列修改。
  // whenIdle=reject prevents a finishing run from turning a steer into a new run; rejection rolls back the queue edit.
  private async steer(id: string) {
    await this.conversation.commit(async (tx) => {
      const state = await tx.doc(ChatDoc, this.conversation.id);
      if (state.paused || state.stopping || state.trashed) {
        throw new Error("CHAT_PAUSED");
      }
      const item = state.queue.find((entry) => entry.id === id);
      if (!item) {
        throw new Error("QUEUE_ITEM_STARTED");
      }
      const submissionId = await this.conversation.submit(tx, {
        content: item.text,
        type: "input",
        whenBusy: "steer",
        whenIdle: "reject",
      });
      state.steering.push({ id: item.id, submissionId, text: item.text });
      state.queue = state.queue.filter((entry) => entry.id !== id);
    }, context);
    this.harness.resume();
  }
  // 先持久化暂停意图，再取消全部工作；恢复时也会完成未结束的停止。
  // Persist the pause intent before aborting all work; recovery finishes any interrupted stop.
  stop() {
    if (this.stopWork) {
      return this.stopWork;
    }
    this.stopWork = (async () => {
      await this.update((state) => {
        state.paused = true;
        state.stopping = true;
        state.error = null;
      });
      this.titleController?.abort();
      await Promise.all([this.conversation.abort(context, { background: true }), this.titleWork]);
      const stopped = await this.state();
      const receipts = await Promise.all(
        stopped.steering.map(async (item) => {
          const submission = (await this.harness.submission(
            item.submissionId,
            context,
          )) as Submission;
          return submission.status(context);
        }),
      );
      await this.update((state) => {
        // 未进入上下文的插队消息在取消后回到队首，已消费的消息不重复执行。
        // Return unplaced steering inputs to the queue after cancellation; never replay consumed inputs.
        const pending = state.steering.filter((_, index) => !receipts[index].entry);
        state.queue = [...pending.map(({ id, text }) => ({ id, text })), ...state.queue];
        state.steering = [];
        state.stopping = false;
        state.active = null;
        state.error = null;
      });
    })().finally(() => {
      this.stopWork = null;
    });
    return this.stopWork;
  }
  private startTitle() {
    if (this.titleWork) {
      return;
    }
    this.titleController = new AbortController();
    const { signal } = this.titleController;
    this.titleWork = (async () => {
      try {
        const state = await this.state();
        if (
          !state.firstInput ||
          state.generatedTitle ||
          state.manualTitle ||
          state.paused ||
          state.trashed
        ) {
          return;
        }
        const model = this.models.getModel(
          "agent-chat",
          this.modelId,
        ) as Model<"openai-completions">;
        const answer = await this.models.complete(
          model,
          {
            messages: [
              {
                content: `Write a short chat title in the same language, under 24 characters. Only output the title. Input: ${state.firstInput.slice(0, 1000)}`,
                role: "user",
                timestamp: Date.now(),
              },
            ],
          },
          { maxTokens: 80, signal },
        );
        const title = answer.content
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("")
          .trim()
          .slice(0, 100);
        if (signal.aborted || !title) {
          return;
        }
        await this.update((current) => {
          if (!current.manualTitle && !current.stopping && !current.trashed) {
            current.title = title;
            current.generatedTitle = true;
          }
        });
        await this.changed(await this.summary());
      } catch (error) {
        if (!signal.aborted) {
          console.error("Agent title generation failed", error);
        }
      } finally {
        this.titleWork = null;
        this.titleController = null;
      }
    })();
    this.runInBackground(this.titleWork);
  }
  async wake(): Promise<Wake> {
    const state = await this.state();
    const wake = this.harness.wake();
    return {
      ...wake,
      active:
        wake.active ||
        state.stopping ||
        state.active !== null ||
        (!state.paused && !state.trashed && state.queue.length > 0),
    };
  }
  async close() {
    await this.harness.close(context);
  }
}
