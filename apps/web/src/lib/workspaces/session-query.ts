import { queryOptions } from "@tanstack/react-query";
import { getWorkspaceSession } from "./session.functions";

export const workspaceSessionQueryOptions = queryOptions({
  queryFn: () => getWorkspaceSession(),
  queryKey: ["workspace-session"],
  staleTime: Infinity,
});
