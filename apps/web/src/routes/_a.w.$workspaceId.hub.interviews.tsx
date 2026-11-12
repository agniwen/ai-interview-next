import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import {
  WorkspaceInterviewsPage,
  workspaceInterviewsSearch,
} from "@/components/features/interviews/workspace-interviews-page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/interviews");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <WorkspaceInterviewsPage
      workspaceId={workspaceId}
      query={query}
      onQueryChange={(changes) => {
        void navigate({ search: (previous) => ({ ...previous, ...changes }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/interviews")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.interviews_title()} — Sainoa` }] }),
  validateSearch: workspaceInterviewsSearch,
});
