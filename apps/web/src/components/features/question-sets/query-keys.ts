import { createQueryKeys } from "@lukemorales/query-key-factory";
import type { QuestionSetListSearch } from "./list-search";

export const questionSetKeys = createQueryKeys("question-sets", {
  workspace: (workspaceId: string) => ({
    contextQueries: {
      detail: (id: string) => [id],
      list: (query: QuestionSetListSearch) => [query],
    },
    queryKey: [workspaceId],
  }),
});
