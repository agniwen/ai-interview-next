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
  head: () => ({ meta: [{ title: `${m.ws_settings()} — Sainoa` }] }),
  component: Settings,
});
