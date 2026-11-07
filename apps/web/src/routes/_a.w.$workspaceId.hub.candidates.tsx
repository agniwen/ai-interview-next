import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { CandidatesPage } from "@/components/features/ats/candidates-page";
import { listSearch } from "@/components/features/ats/list-search";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/candidates");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <CandidatesPage
      workspaceId={workspaceId}
      query={query}
      onQueryChange={(changes) => {
        void navigate({ search: (prev) => ({ ...prev, ...changes }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/candidates")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_candidates()} — Sainoa` }] }),
  validateSearch: listSearch,
});
