import { AgentTrashPageSkeleton } from "@/components/skeletons/pages/agent-trash-page-skeleton";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AgentTrashPage } from "@/components/features/agent/trash-page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/account_/trash");
function TrashPage() {
  const { workspaceId } = routeApi.useParams();
  return <AgentTrashPage workspaceId={workspaceId} />;
}
export const Route = createFileRoute("/_a/w/$workspaceId/account_/trash")({
  pendingComponent: AgentTrashPageSkeleton,
  component: TrashPage,
  head: () => ({ meta: [{ title: `${m.agent_trash()} — Sainoa` }] }),
});
