import { createQueryKeys } from "@lukemorales/query-key-factory";

export const workspaceKeys = createQueryKeys("workspaces", {
  details: (workspaceId: string) => [workspaceId],
  invitations: {
    contextQueries: {
      detail: (invitationId: string) => [invitationId],
    },
    queryKey: null,
  },
  session: null,
});
