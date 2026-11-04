import "./cloudflare";
import "../worker-configuration";
import type { D1Database as WorkerD1Database } from "@cloudflare/workers-types";

declare global {
  // 仅提供绑定需要的类型，避免替换 DOM 全局类型。Only supply binding types to preserve DOM globals.
  type D1Database = WorkerD1Database;
}

export type ApiBindings = ApiEnv & { AGENT_CHAT_KEY: string };
