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
  validateSearch: z.object({ choose: z.boolean().optional() }),
  beforeLoad: ({ context, search }) => {
    const { workspaces, lastWorkspaceId } = context.workspaceSession;
    const last = workspaces.find((workspace) => workspace.id === lastWorkspaceId);
    if (!search.choose && last) {
      throw redirect({ to: "/w/$workspaceId/agent", params: { workspaceId: last.id } });
    }
  },
  head: () => ({ meta: [{ title: `${m.ws_choose()} — Sainoa` }] }),
  component: WorkspaceSelection,
});
