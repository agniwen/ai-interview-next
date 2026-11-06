import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ProjectsPage } from "@/components/ats/projects-page";
import { listSearch } from "@/components/ats/list-search";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/projects");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <ProjectsPage
      workspaceId={workspaceId}
      query={query}
      onQueryChange={(changes) => {
        void navigate({ search: (prev) => ({ ...prev, ...changes }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/projects")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_projects()} — Sainoa` }] }),
  validateSearch: listSearch,
});
