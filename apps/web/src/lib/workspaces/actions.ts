import { workspaceKeys } from "@/lib/workspaces/query-keys";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";

import { workspaceSessionQueryOptions } from "./session-query";

type AuthResult<T> =
  | { data: T; error: null }
  | { data: null; error: { code?: string; message?: string } };

export function authData<T>(result: AuthResult<T>) {
  if (result.error) {
    const lastOwner = result.error.code === "YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER";
    throw new Error(lastOwner ? m.ws_last_owner() : (result.error.message ?? m.ws_error()));
  }
  if (result.data === null) {
    throw new Error(m.ws_error());
  }
  return result.data;
}

export function useWorkspaceAction<T = unknown>() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: () => Promise<T>) => action(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceSessionQueryOptions.queryKey });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: workspaceKeys.details._def }),
        queryClient.invalidateQueries({ queryKey: workspaceKeys.invitations.queryKey }),
        router.invalidate(),
      ]);
    },
  });
}
