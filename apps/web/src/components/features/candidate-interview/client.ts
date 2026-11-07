import { createCoreClient } from "@ai-interview/core-client";
import { createQueryKeys } from "@lukemorales/query-key-factory";
import { queryOptions } from "@tanstack/react-query";

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

export function candidateInterviewQuery(token: string) {
  return queryOptions({
    queryFn: ({ signal }) => readCandidateInterview(token, signal),
    queryKey: candidateInterviewKeys.entry(token).queryKey,
    retry: false,
  });
}
