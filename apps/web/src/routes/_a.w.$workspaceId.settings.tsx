import { IconSettings } from "@tabler/icons-react";
import { WorkspaceSettingsPageSkeleton } from "@/components/skeletons/pages/workspace-settings-page-skeleton";
import { getRouteApi, createFileRoute } from "@tanstack/react-router";
import { WorkspaceSettings } from "@/components/workspaces/workspace-settings";
import { PageHeaderContent } from "@/components/layout/page-header";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/settings");

function Settings() {
  const { workspaceId } = routeApi.useParams();
  const { workspace } = routeApi.useRouteContext();
  return (
    <>
      <PageHeaderContent>
        <IconSettings className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h1 className="truncate text-sm font-medium">{m.ws_settings()}</h1>
      </PageHeaderContent>
      {workspace && (
        <WorkspaceSettings
          key={workspaceId}
          workspaceId={workspaceId}
          name={workspace.name}
          role={workspace.role}
        />
      )}
    </>
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/settings")({
  pendingComponent: WorkspaceSettingsPageSkeleton,
  head: () => ({ meta: [{ title: `${m.ws_settings()} — Sainoa` }] }),
  component: Settings,
});
