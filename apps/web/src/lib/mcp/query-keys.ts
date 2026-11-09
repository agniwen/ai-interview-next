import { createQueryKeys } from "@lukemorales/query-key-factory";

export const mcpKeys = createQueryKeys("remote-mcp", {
  context: (clientId: string, userId: string) => [clientId, userId],
  grants: (workspaceId: string) => [workspaceId],
  settings: (workspaceId: string) => [workspaceId],
});
