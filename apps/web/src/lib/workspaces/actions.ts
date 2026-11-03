import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";

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

export function useWorkspaceAction() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspace-details"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] }),
        router.invalidate(),
      ]);
    },
  });
}
