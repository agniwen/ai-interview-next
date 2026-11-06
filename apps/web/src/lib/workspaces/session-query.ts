import { workspaceKeys } from "@/lib/workspaces/query-keys";
import { queryOptions } from "@tanstack/react-query";
import { getWorkspaceSession } from "./session.functions";

export const workspaceSessionQueryOptions = queryOptions({
  queryFn: () => getWorkspaceSession(),
  queryKey: workspaceKeys.session.queryKey,
  staleTime: Infinity,
});
