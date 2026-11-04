import { queryOptions } from "@tanstack/react-query";
import { agentClient } from "./client";

export function agentSessionsQueryOptions(workspaceId: string) {
  return queryOptions({
    queryFn: () => agentClient(workspaceId).list(),
    queryKey: ["agent-sessions", workspaceId],
    staleTime: 5000,
  });
}
