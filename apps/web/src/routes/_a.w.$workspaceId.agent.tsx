import { AgentPageSkeleton } from "@/components/skeletons/pages/agent-page-skeleton";
import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AgentPage } from "@/components/agent/page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/agent");

function AgentRoute() {
  const { workspaceId } = routeApi.useParams();
  return <AgentPage workspaceId={workspaceId} />;
}
export const Route = createFileRoute("/_a/w/$workspaceId/agent")({
  pendingComponent: AgentPageSkeleton,
  validateSearch: z.object({
    session: z.string().uuid().optional(),
  }),
  beforeLoad: ({ params, search }) => {
    if (search.session) {
      throw redirect({
        to: "/w/$workspaceId/agent/$sessionId",
        params: { workspaceId: params.workspaceId, sessionId: search.session },
        search: {},
        replace: true,
      });
    }
  },
  head: () => ({ meta: [{ title: `${m.workspace_agent()} — Sainoa` }] }),
  component: AgentRoute,
});
