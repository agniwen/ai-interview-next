import { createQueryKeys } from "@lukemorales/query-key-factory";
import { queryOptions } from "@tanstack/react-query";
import { agentClient } from "./client";

const agentKeys = createQueryKeys("agent", {
  sessions: (workspaceId: string) => [workspaceId],
});

export function agentSessionsQueryOptions(workspaceId: string) {
  return queryOptions({
    queryFn: () => agentClient(workspaceId).list(),
    queryKey: agentKeys.sessions(workspaceId).queryKey,
    staleTime: 5000,
  });
}
