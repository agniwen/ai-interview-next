import { createFileRoute, getRouteApi, stripSearchParams } from "@tanstack/react-router";
import { ApplicationDetailPage } from "@/components/features/ats/application-detail-page";
import { applicationDetailSearch } from "@/components/features/ats/list-search";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/applications_/$id");

function Page() {
  const { id, workspaceId } = routeApi.useParams();
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <ApplicationDetailPage
      id={id}
      workspaceId={workspaceId}
      search={search}
      onTabChange={(tab) => {
        void navigate({ replace: true, resetScroll: false, search: (prev) => ({ ...prev, tab }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/applications_/$id")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_application_detail()} — Sainoa` }] }),
  validateSearch: applicationDetailSearch,
  search: { middlewares: [stripSearchParams({ tab: "overview" })] },
});
