import { createQueryKeys } from "@lukemorales/query-key-factory";
import type { ListSearch } from "../ats/list-search";

export const interviewerAgentKeys = createQueryKeys("interviewer-agents", {
  workspace: (workspaceId: string) => ({
    contextQueries: {
      detail: (id: string) => [id],
      list: (query: ListSearch) => [query],
      options: (search: string) => [search],
    },
    queryKey: [workspaceId],
  }),
});
