import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ApplicationsPage } from "@/components/ats/applications-page";
import { applicationListSearch } from "@/components/ats/list-search";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/applications");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <ApplicationsPage
      workspaceId={workspaceId}
      query={query}
      onQueryChange={(changes) => {
        void navigate({ search: (prev) => ({ ...prev, ...changes }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/applications")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_applications()} — Sainoa` }] }),
  validateSearch: applicationListSearch,
});
