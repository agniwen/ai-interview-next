import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { JobsPage } from "@/components/features/ats/jobs-page";
import { jobListSearch } from "@/components/features/ats/list-search";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/jobs");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <JobsPage
      workspaceId={workspaceId}
      query={query}
      onQueryChange={(changes) => {
        void navigate({ search: (prev) => ({ ...prev, ...changes }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/jobs")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_job()} — Sainoa` }] }),
  validateSearch: jobListSearch,
});
