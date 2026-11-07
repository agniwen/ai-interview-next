import { createCoreClient } from "@ai-interview/core-client";
import { createQueryKeys } from "@lukemorales/query-key-factory";
import { queryOptions } from "@tanstack/react-query";

const api = createCoreClient({ baseUrl: "" }).api["candidate-interviews"];
const candidateInterviewKeys = createQueryKeys("candidate-interview", {
  entry: (token: string) => [token],
});

export function candidateInterviewQuery(token: string) {
  return queryOptions({
    queryFn: async ({ signal }) => {
      const response = await api[":token"].entry.$post({ param: { token } }, { init: { signal } });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error("INTERVIEW_ENTRY_FAILED");
      }
      return response.json();
    },
    queryKey: candidateInterviewKeys.entry(token).queryKey,
    retry: false,
  });
}
