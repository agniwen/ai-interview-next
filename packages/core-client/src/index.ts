import type { AppType } from "@ai-interview/api/types";
import { hc } from "hono/client";

export interface CoreClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export function createCoreClient({ baseUrl, fetch: transport }: CoreClientOptions) {
  return hc<AppType>(baseUrl, { fetch: transport });
}

export type CoreClient = ReturnType<typeof createCoreClient>;
