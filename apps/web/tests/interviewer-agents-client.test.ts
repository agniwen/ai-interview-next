import { MutationObserver, QueryClient, QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import {
  interviewerAgentQuery,
  interviewerAgentsQuery,
  saveInterviewerAgentMutation,
} from "../src/components/features/interviewer-agents/client";
import { interviewerAgentKeys } from "../src/components/features/interviewer-agents/query-keys";
import { listSearch } from "../src/components/features/ats/list-search";

afterEach(() => vi.restoreAllMocks());

it("sends URL filters and loads full prompts through a workspace-scoped detail request", async () => {
  const response = { page: 3, pageSize: 50, rows: [], total: 0, version: 1 };
  const request = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json(response));
  const client = new QueryClient();
  const query = listSearch.parse({ page: 3, pageSize: 50, search: "  面试官  " });
  expect(await client.fetchQuery(interviewerAgentsQuery("workspace", query))).toEqual(response);
  const url = new URL(String(request.mock.calls[0][0]), "https://sainoa.example");
  expect(url.pathname).toBe("/api/interviewer-agents/workspace");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    page: "3",
    pageSize: "50",
    search: "面试官",
  });

  const detail = { description: "", id: "agent-id", name: "面试官", prompt: "提问", version: 1 };
  request.mockResolvedValueOnce(Response.json(detail));
  expect(await client.fetchQuery(interviewerAgentQuery("workspace", "agent-id"))).toEqual(detail);
  expect(request.mock.calls[1][0]).toBe("/api/interviewer-agents/workspace/agent-id");
  client.clear();
});

it.each([undefined, "agent-id"])(
  "waits for this workspace's active list refresh after saving %s",
  async (id) => {
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json({ id: "agent-id", version: 1 }));
    const client = new QueryClient();
    const keys = interviewerAgentKeys.workspace("workspace");
    const query = { page: 1, pageSize: 20, search: "" };
    const list = keys._ctx.list(query).queryKey;
    const nextPage = keys._ctx.list({ ...query, page: 2 }).queryKey;
    const detail = keys._ctx.detail("agent-id").queryKey;
    const otherWorkspace = interviewerAgentKeys.workspace("other")._ctx.list(query).queryKey;
    for (const queryKey of [list, nextPage, detail, otherWorkspace]) {
      client.setQueryData(queryKey, { version: 1 });
    }
    let resolveRefresh!: (value: { version: number }) => void;
    // eslint-disable-next-line promise/avoid-new -- 手动完成刷新以验证保存仍在等待。 / Control refresh completion to verify that saving waits.
    const refreshed = new Promise<{ version: number }>((resolve) => {
      resolveRefresh = resolve;
    });
    const observer = new QueryObserver(client, {
      queryFn: () => refreshed,
      queryKey: list,
      staleTime: Infinity,
    });
    const unsubscribe = observer.subscribe(() => {});
    const mutation = new MutationObserver(
      client,
      saveInterviewerAgentMutation(client, "workspace", id),
    );
    const input = { description: "", name: "面试官", prompt: "提问", version: 1 as const };
    const saved = mutation.mutate(input);
    await vi.waitFor(() => expect(client.getQueryState(list)?.fetchStatus).toBe("fetching"));
    expect(mutation.getCurrentResult().isPending).toBe(true);
    expect(request.mock.calls[0][0]).toBe(
      id ? "/api/interviewer-agents/workspace/agent-id" : "/api/interviewer-agents/workspace",
    );
    expect(request.mock.calls[0][1]?.method).toBe(id ? "PUT" : "POST");
    expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual(input);
    resolveRefresh({ version: 1 });
    await saved;
    for (const queryKey of [nextPage, detail]) {
      expect(client.getQueryState(queryKey)?.isInvalidated).toBe(true);
    }
    expect(client.getQueryState(otherWorkspace)?.isInvalidated).toBe(false);
    expect(mutation.getCurrentResult().isSuccess).toBe(true);
    unsubscribe();
    client.clear();
  },
);

it("keeps cached data valid when a save fails", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ error: "INVALID_INPUT", version: 1 }, { status: 400 }),
  );
  const client = new QueryClient();
  const list = interviewerAgentKeys.workspace("workspace")._ctx.list({
    page: 1,
    pageSize: 20,
    search: "",
  }).queryKey;
  client.setQueryData(list, { rows: [], version: 1 });
  const mutation = new MutationObserver(client, saveInterviewerAgentMutation(client, "workspace"));
  await expect(mutation.mutate({ name: "", prompt: "", version: 1 })).rejects.toThrow();
  expect(client.getQueryState(list)?.isInvalidated).toBe(false);
  client.clear();
});
