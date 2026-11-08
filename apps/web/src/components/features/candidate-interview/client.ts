import { createCoreClient } from "@ai-interview/core-client";
import { createQueryKeys } from "@lukemorales/query-key-factory";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

const api = createCoreClient({ baseUrl: "" }).api["candidate-interviews"];
const candidateInterviewKeys = createQueryKeys("candidate-interview", {
  connection: (token: string) => [token],
  entry: (token: string) => [token],
});

export type CandidateConnectionEvent = Parameters<
  (typeof api)[":token"]["events"]["$post"]
>[0]["json"]["events"][number];
export async function recordCandidateConnectionEvents(
  token: string,
  events: CandidateConnectionEvent[],
) {
  const response = await api[":token"].events.$post({
    json: { events, version: 1 },
    param: { token },
  });
  if (!response.ok) {
    throw new Error("INTERVIEW_EVENT_WRITE_FAILED");
  }
}

async function readCandidateInterview(token: string, signal: AbortSignal) {
  const response = await api[":token"].entry.$post({ param: { token } }, { init: { signal } });
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error("INTERVIEW_ENTRY_FAILED");
  }
  return response.json();
}

export type CandidateInterview = NonNullable<Awaited<ReturnType<typeof readCandidateInterview>>>;
export type CandidateForm = NonNullable<CandidateInterview["form"]>;
export type CandidateFormContent = CandidateForm["content"];
export type CandidateFormAnswers = CandidateFormContent["answers"];
export type CandidateFormQuestion = NonNullable<CandidateInterview["questions"]>["form"][number];

export function candidateFormMutation(client: QueryClient, token: string) {
  const key = candidateInterviewKeys.entry(token).queryKey;
  return mutationOptions({
    mutationFn: async ({ content, submit }: { content: CandidateFormContent; submit: boolean }) => {
      const input = { json: content, param: { token } };
      const response = submit
        ? await api[":token"].form.submit.$post(input)
        : await api[":token"].form.$put(input);
      const result = await response.json();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result.form;
    },
    mutationKey: key,
    onError: async (error) => {
      if (error.message === "INTERVIEW_FORM_LOCKED" || error.message === "INTERVIEW_UNAVAILABLE") {
        await client.invalidateQueries({ queryKey: key });
      }
    },
    onSuccess: (form) => {
      client.setQueryData<CandidateInterview | null>(key, (entry) =>
        entry ? { ...entry, form } : entry,
      );
    },
    // 自动保存和正式提交共用串行队列，最后提交的内容不会被较早的草稿覆盖。
    // Autosaves and submissions share a serial queue so an earlier draft cannot overwrite a later submission.
    scope: { id: JSON.stringify(key) },
  });
}

export function candidateInterviewQuery(token: string) {
  return queryOptions({
    queryFn: ({ signal }) => readCandidateInterview(token, signal),
    queryKey: candidateInterviewKeys.entry(token).queryKey,
    refetchInterval: (query) =>
      query.state.data?.kind === "human" && query.state.data.status === "in_progress"
        ? 15_000
        : false,
    retry: false,
  });
}

export function candidateStartMutation(client: QueryClient, token: string) {
  const key = candidateInterviewKeys.entry(token).queryKey;
  return mutationOptions({
    mutationFn: async () => {
      const response = await api[":token"].start.$post({ json: { version: 1 }, param: { token } });
      const result = await response.json();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result;
    },
    mutationKey: key,
    onSuccess: async (result) => {
      client.setQueryData<CandidateInterview | null>(key, (entry) =>
        entry ? { ...entry, startedAt: result.startedAt, status: "in_progress" } : entry,
      );
      await client.invalidateQueries({ queryKey: key });
    },
  });
}

export async function candidateConnection(token: string) {
  const response = await api[":token"].connection.$post({ param: { token } });
  const result = await response.json();
  if ("error" in result) {
    throw new Error(result.error);
  }
  return result;
}

export function candidateConnectionQuery(client: QueryClient, token: string) {
  return queryOptions({
    gcTime: 0,
    queryFn: async () => {
      try {
        return await candidateConnection(token);
      } catch (error) {
        await client.invalidateQueries({ queryKey: candidateInterviewKeys.entry(token).queryKey });
        throw error;
      }
    },
    queryKey: candidateInterviewKeys.connection(token).queryKey,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function candidateEndMutation(client: QueryClient, token: string) {
  const key = candidateInterviewKeys.entry(token).queryKey;
  return mutationOptions({
    mutationFn: async () => {
      const response = await api[":token"].end.$post({ json: { version: 1 }, param: { token } });
      const result = await response.json();
      if ("error" in result) {
        throw new Error(result.error);
      }
      return result;
    },
    mutationKey: key,
    onSuccess: async ({ endedAt }) => {
      client.setQueryData<CandidateInterview | null>(key, (entry) =>
        entry ? { ...entry, endedAt, status: "completed" } : entry,
      );
      await client.invalidateQueries({ queryKey: key });
    },
  });
}

export function candidateFeedbackMutation(client: QueryClient, token: string) {
  const key = candidateInterviewKeys.entry(token).queryKey;
  return mutationOptions({
    mutationFn: async (json: { version: 1; rating: number; comment: string }) => {
      const response = await api[":token"].feedback.$post({ json, param: { token } });
      const result = await response.json();
      if ("error" in result) {
        throw new Error("INTERVIEW_FEEDBACK_FAILED");
      }
      return result.feedback;
    },
    onSuccess: async (feedback) => {
      client.setQueryData<CandidateInterview | null>(key, (entry) =>
        entry ? { ...entry, feedback } : entry,
      );
      await client.invalidateQueries({ queryKey: key });
    },
  });
}
