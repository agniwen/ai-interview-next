import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspaces/client";
import { readAts } from "../ats/client";
import { listParams } from "../ats/list-search";
import type { QuestionSetListSearch } from "./list-search";
import { questionSetKeys } from "./query-keys";

const api = workspaceApi.api["question-sets"][":workspaceId"];
export type QuestionSetInput = Parameters<typeof api.$post>[0]["json"];
export type FormSetContent = Extract<QuestionSetInput["content"], { kind: "form" }>;

export function questionSetsQuery(workspaceId: string, query: QuestionSetListSearch) {
  return queryOptions({
    queryFn: async ({ signal }) =>
      readAts(
        await api.$get({ param: { workspaceId }, query: listParams(query) }, { init: { signal } }),
      ),
    queryKey: questionSetKeys.workspace(workspaceId)._ctx.list(query).queryKey,
  });
}

/** 列表只读摘要；编辑时按工作区加载带格式版本的完整题套。
 * Lists use summaries; editing loads the complete versioned set within its workspace. */
export function questionSetQuery(workspaceId: string, id: string) {
  return queryOptions({
    queryFn: async ({ signal }) =>
      readAts(await api[":id"].$get({ param: { id, workspaceId } }, { init: { signal } })),
    queryKey: questionSetKeys.workspace(workspaceId)._ctx.detail(id).queryKey,
    staleTime: 30_000,
  });
}

export function saveQuestionSetMutation(client: QueryClient, workspaceId: string, id?: string) {
  return mutationOptions({
    mutationFn: async (json: QuestionSetInput) =>
      readAts(
        id
          ? await api[":id"].$put({ json, param: { id, workspaceId } })
          : await api.$post({ json, param: { workspaceId } }),
      ),
    // 所有保存入口等待题套资源刷新，覆盖分页、题数和详情。
    // Every save waits for question-set refreshes, covering pages, question counts and details.
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: questionSetKeys.workspace(workspaceId).queryKey });
    },
  });
}
