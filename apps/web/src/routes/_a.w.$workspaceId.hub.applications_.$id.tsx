import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ApplicationDetailPage } from "@/components/ats/application-detail-page";
import { applicationListSearch } from "@/components/ats/list-search";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/applications_/$id");

function Page() {
  const { id, workspaceId } = routeApi.useParams();
  const search = routeApi.useSearch();
  return <ApplicationDetailPage id={id} workspaceId={workspaceId} search={search} />;
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/applications_/$id")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_application_detail()} — Sainoa` }] }),
  validateSearch: applicationListSearch,
});
