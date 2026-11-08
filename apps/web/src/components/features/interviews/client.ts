import { createQueryKeys } from "@lukemorales/query-key-factory";
import { infiniteQueryOptions, mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { workspaceApi } from "@/lib/workspaces/client";
import { readAts } from "../ats/client";
import { questionSetKeys } from "../question-sets/query-keys";
import { interviewerAgentKeys } from "../interviewer-agents/query-keys";
import { atsKeys } from "../ats/query-keys";

export const interviewsApi = workspaceApi.api.interviews[":workspaceId"];
export const interviewKeys = createQueryKeys("interviews", {
  workspace: (workspaceId: string) => ({
    contextQueries: {
      edit: (id: string) => [id],
      meeting: (id: string) => [id],
      members: (search: string) => [search],
      result: (id: string) => [id],
      rounds: (applicationId: string) => [applicationId],
      setup: (applicationId: string) => [applicationId],
    },
    queryKey: [workspaceId],
  }),
});
const applicationApi = interviewsApi.applications[":applicationId"];
export type InterviewInput = Parameters<typeof applicationApi.$post>[0]["json"];
export interface Choice {
  id: string;
  name: string;
  questionCount?: number;
  image?: string | null;
  email?: string;
}
export type ChoiceKind = "agent" | "member" | "form" | "conversation";

async function readRounds(
  workspaceId: string,
  applicationId: string,
  page: number,
  signal: AbortSignal,
) {
  return readAts(
    await applicationApi.$get(
      { param: { applicationId, workspaceId }, query: { page: String(page), pageSize: "20" } },
      { init: { signal } },
    ),
  );
}
type RoundPage = Awaited<ReturnType<typeof readRounds>>;
export type InterviewRound = RoundPage["rows"][number];
export function roundsQuery(workspaceId: string, applicationId: string) {
  return infiniteQueryOptions({
    getNextPageParam: (page: RoundPage) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: ({ pageParam, signal }) => readRounds(workspaceId, applicationId, pageParam, signal),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.rounds(applicationId).queryKey,
  });
}
async function readSetup(workspaceId: string, applicationId: string, signal: AbortSignal) {
  return readAts(
    await interviewsApi.applications[":applicationId"].setup.$get(
      { param: { applicationId, workspaceId } },
      { init: { signal } },
    ),
  );
}
export type InterviewSetup = Awaited<ReturnType<typeof readSetup>>;
export function setupQuery(workspaceId: string, applicationId: string) {
  return queryOptions({
    queryFn: ({ signal }) => readSetup(workspaceId, applicationId, signal),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.setup(applicationId).queryKey,
    staleTime: 0,
  });
}
export function createInterviewMutation(
  client: QueryClient,
  workspaceId: string,
  applicationId: string,
) {
  return mutationOptions({
    mutationFn: async (json: InterviewInput) =>
      readAts(
        await interviewsApi.applications[":applicationId"].$post({
          json,
          param: { applicationId, workspaceId },
        }),
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: interviewKeys.workspace(workspaceId).queryKey }),
        client.invalidateQueries({
          queryKey: atsKeys.applications(workspaceId)._ctx.detail(applicationId).queryKey,
        }),
      ]);
    },
  });
}
interface ChoicePage {
  version: 1;
  rows: Choice[];
  page: number;
  pageSize: number;
  total: number;
}
export function choicesQuery(workspaceId: string, kind: ChoiceKind, search: string) {
  let queryKey;
  if (kind === "agent") {
    ({ queryKey } = interviewerAgentKeys.workspace(workspaceId)._ctx.options(search));
  } else if (kind === "member") {
    ({ queryKey } = interviewKeys.workspace(workspaceId)._ctx.members(search));
  } else {
    ({ queryKey } = questionSetKeys.workspace(workspaceId)._ctx.options(kind, search));
  }
  return infiniteQueryOptions({
    getNextPageParam: (page: ChoicePage) =>
      page.page * page.pageSize < page.total ? page.page + 1 : undefined,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }): Promise<ChoicePage> => {
      const args = {
        param: { workspaceId },
        query: { page: String(pageParam), pageSize: "20", search },
      };
      const init = { init: { signal } };
      if (kind === "agent") {
        return readAts(
          await workspaceApi.api["interviewer-agents"][":workspaceId"].$get(args, init),
        );
      }
      if (kind === "member") {
        return readAts(await interviewsApi.members.$get(args, init));
      }
      return readAts(
        await workspaceApi.api["question-sets"][":workspaceId"].$get(
          { ...args, query: { ...args.query, kind } },
          init,
        ),
      );
    },
    queryKey,
  });
}

export function deleteInterviewMutation(
  client: QueryClient,
  workspaceId: string,
  applicationId: string,
) {
  return mutationOptions({
    mutationFn: async (id: string) =>
      readAts(await interviewsApi[":id"].$delete({ param: { id, workspaceId } })),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: interviewKeys.workspace(workspaceId)._ctx.rounds(applicationId).queryKey,
      });
    },
  });
}

async function readEdit(workspaceId: string, id: string, signal: AbortSignal) {
  return readAts(
    await interviewsApi[":id"].edit.$get({ param: { id, workspaceId } }, { init: { signal } }),
  );
}
export function editQuery(workspaceId: string, id: string) {
  return queryOptions({
    queryFn: ({ signal }) => readEdit(workspaceId, id, signal),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.edit(id).queryKey,
    staleTime: 0,
  });
}
export function updateInterviewMutation(
  client: QueryClient,
  workspaceId: string,
  applicationId: string,
  id: string,
) {
  return mutationOptions({
    mutationFn: async (json: InterviewInput) =>
      readAts(await interviewsApi[":id"].$put({ json, param: { id, workspaceId } })),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({
          queryKey: interviewKeys.workspace(workspaceId)._ctx.rounds(applicationId).queryKey,
        }),
        client.invalidateQueries({
          queryKey: interviewKeys.workspace(workspaceId)._ctx.edit(id).queryKey,
        }),
      ]);
    },
  });
}

export function createInvitationMutation(client: QueryClient, workspaceId: string) {
  return mutationOptions({
    mutationFn: async (id: string) =>
      readAts(await interviewsApi[":id"].invitation.$post({ param: { id, workspaceId } })),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: interviewKeys.workspace(workspaceId).queryKey });
    },
  });
}

async function readResult(workspaceId: string, id: string, signal: AbortSignal) {
  return readAts(
    await interviewsApi[":id"].result.$get({ param: { id, workspaceId } }, { init: { signal } }),
  );
}
export type InterviewResult = Awaited<ReturnType<typeof readResult>>;
export type EvaluationDraft = Parameters<
  (typeof interviewsApi)[":id"]["evaluation"]["$put"]
>[0]["json"];
export type EvaluationContent = Parameters<
  (typeof interviewsApi)[":id"]["evaluation"]["submit"]["$post"]
>[0]["json"];

export function saveEvaluationMutation(client: QueryClient, workspaceId: string, id: string) {
  return mutationOptions({
    mutationFn: async (
      input:
        | { submit: false; content: EvaluationDraft }
        | { submit: true; content: EvaluationContent },
    ) => {
      const args = { json: input.content, param: { id, workspaceId } };
      if (input.submit) {
        return readAts(
          await interviewsApi[":id"].evaluation.submit.$post({ ...args, json: input.content }),
        );
      }
      return readAts(await interviewsApi[":id"].evaluation.$put(args));
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: interviewKeys.workspace(workspaceId).queryKey }),
        client.invalidateQueries({ queryKey: atsKeys.applications(workspaceId).queryKey }),
      ]);
    },
  });
}

export function generateEvaluationMutation(client: QueryClient, workspaceId: string, id: string) {
  return mutationOptions({
    mutationFn: async () =>
      readAts(
        await interviewsApi[":id"].evaluation.generate.$post({
          json: { version: 1 },
          param: { id, workspaceId },
        }),
      ),
    onSettled: async () => {
      await client.invalidateQueries({
        queryKey: interviewKeys.workspace(workspaceId)._ctx.result(id).queryKey,
      });
    },
  });
}

export function resultQuery(workspaceId: string, id: string) {
  return queryOptions({
    queryFn: ({ signal }) => readResult(workspaceId, id, signal),
    queryKey: interviewKeys.workspace(workspaceId)._ctx.result(id).queryKey,
    refetchInterval: ({ state }) =>
      state.data?.round.status === "in_progress" ||
      state.data?.reportStatus === "processing" ||
      state.data?.evaluation.original?.status === "generating"
        ? 3000
        : false,
  });
}
