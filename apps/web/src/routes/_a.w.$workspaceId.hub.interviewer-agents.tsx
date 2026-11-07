import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { listSearch } from "@/components/features/ats/list-search";
import { InterviewerAgentsPage } from "@/components/features/interviewer-agents/page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/interviewer-agents");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <InterviewerAgentsPage
      key={workspaceId}
      workspaceId={workspaceId}
      query={query}
      onQueryChange={(changes) => {
        void navigate({ search: (prev) => ({ ...prev, ...changes }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/interviewer-agents")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.interviewer_agents_title()} — Sainoa` }] }),
  validateSearch: listSearch,
});
