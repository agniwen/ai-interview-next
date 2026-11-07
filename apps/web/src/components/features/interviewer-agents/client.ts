import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspaces/client";
import { readAts } from "../ats/client";
import { listParams } from "../ats/list-search";
import type { ListSearch } from "../ats/list-search";
import { interviewerAgentKeys } from "./query-keys";

const api = workspaceApi.api["interviewer-agents"][":workspaceId"];

export function interviewerAgentsQuery(workspaceId: string, query: ListSearch) {
  return queryOptions({
    queryFn: async ({ signal }) =>
      readAts(
        await api.$get({ param: { workspaceId }, query: listParams(query) }, { init: { signal } }),
      ),
    queryKey: interviewerAgentKeys.workspace(workspaceId)._ctx.list(query).queryKey,
  });
}

/** 完整提示词仅在编辑时读取，列表缓存保持轻量。
 * Fetch the full prompt for editing only, keeping list caches small. */
export function interviewerAgentQuery(workspaceId: string, id: string) {
  return queryOptions({
    queryFn: async ({ signal }) =>
      readAts(await api[":id"].$get({ param: { id, workspaceId } }, { init: { signal } })),
    queryKey: interviewerAgentKeys.workspace(workspaceId)._ctx.detail(id).queryKey,
    staleTime: 30_000,
  });
}

type AgentInput = Parameters<typeof api.$post>[0]["json"];

export function saveInterviewerAgentMutation(
  client: QueryClient,
  workspaceId: string,
  id?: string,
) {
  return mutationOptions({
    mutationFn: async (json: AgentInput) =>
      readAts(
        id
          ? await api[":id"].$put({ json, param: { id, workspaceId } })
          : await api.$post({ json, param: { workspaceId } }),
      ),
    // 保存完成前刷新本工作区的列表和详情，所有入口共用相同的失效范围。
    // Refresh this workspace's lists and details before completing a save, consistently across entry points.
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: interviewerAgentKeys.workspace(workspaceId).queryKey,
      });
    },
  });
}
