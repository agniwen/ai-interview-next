import { WorkspacesPageSkeleton } from "@/components/skeletons/pages/workspaces-page-skeleton";
import { getRouteApi, createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { WorkspacePicker } from "@/components/workspaces/workspace-picker";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/workspaces");

function WorkspaceSelection() {
  const { workspaceSession } = routeApi.useRouteContext();
  return <WorkspacePicker workspaces={workspaceSession.workspaces} />;
}

export const Route = createFileRoute("/_a/workspaces")({
  pendingComponent: WorkspacesPageSkeleton,
  validateSearch: z.object({
    choose: z.boolean().optional(),
    destination: z.enum(["agent", "hub"]).optional(),
  }),
  beforeLoad: ({ context, search }) => {
    const { workspaces, lastWorkspaceId } = context.workspaceSession;
    const last = workspaces.find((workspace) => workspace.id === lastWorkspaceId);
    const workspace = last ?? (search.destination ? workspaces[0] : undefined);
    if (!search.choose && workspace) {
      throw redirect({
        to:
          search.destination === "hub" ? "/w/$workspaceId/hub/dashboard" : "/w/$workspaceId/agent",
        params: { workspaceId: workspace.id },
      });
    }
  },
  head: () => ({ meta: [{ title: `${m.ws_choose()} — Sainoa` }] }),
  component: WorkspaceSelection,
});
