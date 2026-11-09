import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SettingsGroup, SettingsRow } from "@/components/features/settings/settings-group";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { mcpKeys } from "@/lib/mcp/query-keys";
import { workspaceApi } from "@/lib/workspaces/client";
import * as m from "@/paraglide/messages";

const api = workspaceApi.api["mcp-management"];

export function McpSettings({ manage, workspaceId }: { manage: boolean; workspaceId: string }) {
  const queryClient = useQueryClient();
  const setting = useQuery({
    ...mcpKeys.settings(workspaceId),
    queryFn: async () => {
      const response = await api.workspaces[":workspaceId"].$get({ param: { workspaceId } });
      if (!response.ok) {
        throw new Error(m.mcp_settings_error());
      }
      return response.json();
    },
  });
  const grants = useQuery({
    ...mcpKeys.grants(workspaceId),
    queryFn: async () => {
      const response = await api.workspaces[":workspaceId"].grants.$get({ param: { workspaceId } });
      if (!response.ok) {
        throw new Error(m.mcp_settings_error());
      }
      return response.json();
    },
  });
  const change = useMutation({
    mutationFn: async (enabled: boolean) => {
      const response = await api.workspaces[":workspaceId"].$put({
        json: { enabled, version: 1 },
        param: { workspaceId },
      });
      if (!response.ok) {
        throw new Error(m.mcp_settings_error());
      }
      return response.json();
    },
    onSuccess: async (result) => {
      queryClient.setQueryData(mcpKeys.settings(workspaceId).queryKey, result);
      await queryClient.invalidateQueries(mcpKeys.grants(workspaceId));
    },
  });
  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.workspaces[":workspaceId"].grants[":id"].$delete({
        param: { id, workspaceId },
      });
      if (!response.ok) {
        throw new Error(m.mcp_settings_error());
      }
    },
    onSuccess: () => queryClient.invalidateQueries(mcpKeys.grants(workspaceId)),
  });
  return (
    <SettingsGroup title={m.mcp_settings_title()}>
      <SettingsRow title={m.mcp_settings_title()} description={m.mcp_settings_description()}>
        <Switch
          aria-label={m.mcp_settings_title()}
          checked={setting.data?.enabled ?? false}
          disabled={!manage || !setting.data || change.isPending}
          onCheckedChange={(enabled) => change.mutate(enabled)}
        />
      </SettingsRow>
      {grants.data?.grants.map((grant) => (
        <SettingsRow
          key={grant.id}
          title={grant.clientName ?? m.mcp_unnamed_client()}
          description={m.mcp_connected()}
        >
          <Button
            size="sm"
            variant="outline"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate(grant.id)}
          >
            {m.mcp_revoke()}
          </Button>
        </SettingsRow>
      ))}
      {(setting.isError || grants.isError || change.isError || revoke.isError) && (
        <p role="alert" className="text-sm text-destructive">
          {m.mcp_settings_error()}
        </p>
      )}
    </SettingsGroup>
  );
}
