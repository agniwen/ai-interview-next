import { setTimeout } from "node:timers/promises";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { expect, it, vi } from "vitest";
import { agentSessionsQueryOptions } from "@/lib/agent/queries";

it("keeps the chat list available when returning from Hub", async () => {
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ sessions: [] }));
  const client = new QueryClient();
  const options = agentSessionsQueryOptions("workspace");
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  await observer.refetch();
  unsubscribe();
  await setTimeout(10);
  const returning = new QueryObserver(client, options);
  expect(returning.getCurrentResult().isPending).toBe(false);
  const leave = returning.subscribe(() => {});
  await setTimeout(10);
  expect(request).toHaveBeenCalledTimes(1);
  leave();
  client.clear();
  request.mockRestore();
});
