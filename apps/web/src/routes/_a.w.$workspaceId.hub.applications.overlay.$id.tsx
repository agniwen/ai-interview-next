import {
  createFileRoute,
  getRouteApi,
  stripSearchParams,
  Outlet,
  useMatch,
} from "@tanstack/react-router";
import { ApplicationDetailPage } from "@/components/features/ats/application-detail-page";
import { applicationDetailSearch } from "@/components/features/ats/list-search";
import { applicationDetailLinkOptions } from "@/components/features/ats/detail-navigation";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/applications/overlay/$id");

function Page() {
  const { id, workspaceId } = routeApi.useParams();
  const result = useMatch({
    from: "/_a/w/$workspaceId/hub/applications/overlay/$id/result/$roundId",
    shouldThrow: false,
  });
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  if (result) {
    return <Outlet />;
  }
  return (
    <ApplicationDetailPage
      id={id}
      workspaceId={workspaceId}
      search={search}
      onTabChange={(tab) => {
        void navigate({
          ...applicationDetailLinkOptions(workspaceId, id, { ...search, tab }),
          replace: true,
          resetScroll: false,
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/applications/overlay/$id")({
  component: Page,
  validateSearch: applicationDetailSearch,
  search: { middlewares: [stripSearchParams({ tab: "overview" })] },
  head: () => ({ meta: [{ title: `${m.ats_application_detail()} — Sainoa` }] }),
});
