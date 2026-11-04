import { AgentPageSkeleton } from "@/components/skeletons/pages/agent-page-skeleton";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";
import { AgentPage } from "@/components/agent/page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/agent");

function AgentRoute() {
  const { workspaceId } = routeApi.useParams();
  const { session } = routeApi.useSearch();
  return <AgentPage workspaceId={workspaceId} sessionId={session} />;
}
export const Route = createFileRoute("/_a/w/$workspaceId/agent")({
  pendingComponent: AgentPageSkeleton,
  validateSearch: z.object({
    session: z.string().uuid().optional(),
  }),
  head: () => ({ meta: [{ title: `${m.workspace_agent()} — Sainoa` }] }),
  component: AgentRoute,
});
