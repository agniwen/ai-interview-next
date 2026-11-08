import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { InterviewResultPage } from "@/components/features/interviews/result-page";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/applications/overlay/$id/result/$roundId");
function Page() {
  return <InterviewResultPage {...routeApi.useParams()} />;
}
export const Route = createFileRoute(
  "/_a/w/$workspaceId/hub/applications/overlay/$id/result/$roundId",
)({ component: Page });
