import "./cloudflare";
import "../worker-configuration";
import type {
  D1Database as WorkerD1Database,
  Queue as WorkerQueue,
  R2Bucket as WorkerR2Bucket,
  Workflow as WorkerWorkflow,
} from "@cloudflare/workers-types";

declare global {
  // 仅提供绑定需要的类型，避免替换 DOM 全局类型。Only supply binding types to preserve DOM globals.
  type D1Database = WorkerD1Database;
  type R2Bucket = WorkerR2Bucket;
  type Queue<T = unknown> = WorkerQueue<T>;
  type Workflow<T = unknown> = WorkerWorkflow<T>;
}

export type ApiBindings = ApiEnv & {
  AGENT_CHAT_KEY: string;
  INTERVIEW_AGENT_API_URL?: string;
  LIVEKIT_URL?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_AGENT_NAME?: string;
  RESUME_S3_ACCESS_KEY_ID?: string;
  RESUME_S3_SECRET_ACCESS_KEY?: string;
  RESUME_S3_ENDPOINT?: string;
};
