import { DurableObject } from "cloudflare:workers";
import { openDurableObjectSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/cloudflare";
import { createDatabase } from "@ai-interview/db";
import { createRegistry } from "@earendil-works/pi-durable";
import { recruitingTools } from "./recruiting-tools";
import type { Wake } from "@earendil-works/pi-durable";
import { chatEvents } from "./events";
import { AgentRuntime } from "./runtime";
import { createAgentModels } from "./model";
import type { AgentCommand } from "@ai-interview/agent";
import type { ApiBindings } from "../../env";

/** 每条聊天一个 DO；运行、停止和清理的边界不会跨越其他聊天。
 * One DO per chat keeps execution, cancellation and deletion isolated from other chats. */
export class AgentSessionObject extends DurableObject<ApiBindings> {
  private runtime?: Promise<AgentRuntime>;
  private alarmWrites: Promise<void> = Promise.resolve();
  private async arm(wake: Wake) {
    const at = wake.active ? Math.min(Date.now() + 30_000, wake.at ?? Infinity) : wake.at;
    this.alarmWrites = this.alarmWrites.then(() =>
      at === undefined ? this.ctx.storage.deleteAlarm() : this.ctx.storage.setAlarm(at),
    );
    await this.alarmWrites;
  }
  private async open() {
    const identity = await this.ctx.storage.get<{ scope: string; id: string }>("identity");
    if (!identity) {
      throw new Error("CHAT_NOT_FOUND");
    }
    const { models } = createAgentModels(this.env);
    const [workspaceId, userId]: [string, string] = JSON.parse(identity.scope);
    const registry = createRegistry();
    registry.install(
      recruitingTools({
        actor: { source: "internal_agent", userId, workspaceId },
        db: createDatabase(this.env.AUTH_DB),
        env: this.env,
      }),
    );
    const runtime = await AgentRuntime.open(
      await openDurableObjectSqliteStorage(this.ctx.storage),
      {
        background: (work) => this.ctx.waitUntil(work),
        changed: (summary) =>
          this.env.REDIS.getByName(identity.scope).hset(
            "sessions",
            summary.id,
            JSON.stringify(summary),
          ),
        modelId: this.env.AGENT_CHAT_MODEL,
        models,
        onWake: () => {
          this.ctx.waitUntil(this.refreshAlarm());
        },
        registry,
      },
    );
    await runtime.initialize(identity.id);
    await this.arm({ active: true });
    this.ctx.waitUntil(runtime.recover());
    return runtime;
  }
  private getRuntime() {
    this.runtime ??= this.open();
    return this.runtime;
  }
  async initialize(scope: string, id: string) {
    await this.ctx.storage.put("identity", { id, scope });
    await this.getRuntime();
  }
  async command(command: AgentCommand) {
    const runtime = await this.getRuntime();
    await this.arm({ active: true });
    await runtime.command(command);
    await this.arm(await runtime.wake());
    return runtime.snapshot();
  }
  async snapshot() {
    const runtime = await this.getRuntime();
    return runtime.snapshot();
  }
  async events() {
    return chatEvents(await this.getRuntime());
  }
  private async refreshAlarm() {
    try {
      const runtime = await this.getRuntime();
      await this.arm(await runtime.wake());
    } catch {
      this.ctx.abort("Agent alarm failed");
    }
  }
  async destroy() {
    const runtime = await this.getRuntime();
    await runtime.stop();
    await runtime.close();
    await this.ctx.storage.deleteAll();
    this.runtime = undefined;
  }
  override async alarm() {
    await this.arm({ active: true });
    const runtime = await this.getRuntime();
    await runtime.recover();
    await this.arm(await runtime.wake());
  }
}
