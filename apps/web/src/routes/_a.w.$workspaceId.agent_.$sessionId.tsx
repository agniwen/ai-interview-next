import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";
import { AgentPage } from "@/components/features/agent/page";
import { AgentPageSkeleton } from "@/components/skeletons/pages/agent-page-skeleton";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/agent_/$sessionId");

function AgentSessionPage() {
  const { workspaceId, sessionId } = routeApi.useParams();
  return <AgentPage workspaceId={workspaceId} sessionId={sessionId} />;
}

export const Route = createFileRoute("/_a/w/$workspaceId/agent_/$sessionId")({
  params: {
    parse: ({ sessionId }) => ({ sessionId: z.string().uuid().parse(sessionId) }),
  },
  pendingComponent: AgentPageSkeleton,
  head: () => ({ meta: [{ title: `${m.workspace_agent()} — Sainoa` }] }),
  component: AgentSessionPage,
});
