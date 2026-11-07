import { createCoreClient } from "@ai-interview/core-client";
import { createQueryKeys } from "@lukemorales/query-key-factory";
import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";

const api = createCoreClient({ baseUrl: "" }).api["candidate-interviews"];
const candidateInterviewKeys = createQueryKeys("candidate-interview", {
  entry: (token: string) => [token],
});

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
    retry: false,
  });
}
