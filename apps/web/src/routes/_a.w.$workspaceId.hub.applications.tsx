import { createFileRoute, getRouteApi, Outlet, useMatch } from "@tanstack/react-router";
import { Activity } from "react";
import { ApplicationsPage } from "@/components/features/ats/applications-page";
import { applicationListSearch } from "@/components/features/ats/list-search";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/applications");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const showingDetail = useMatch({
    from: "/_a/w/$workspaceId/hub/applications/overlay/$id",
    select: () => true,
    shouldThrow: false,
  });
  return (
    <>
      {/* Activity 只保留列表组件状态；地址遮罩由入口 Link 的原生 mask 处理。
          Activity only preserves list component state; the entry Link's native mask handles the URL. */}
      <Activity mode={showingDetail ? "hidden" : "visible"}>
        <ApplicationsPage
          workspaceId={workspaceId}
          query={query}
          onQueryChange={(changes) => {
            void navigate({ search: (prev) => ({ ...prev, ...changes }) });
          }}
        />
      </Activity>
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/applications")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_applications()} — Sainoa` }] }),
  validateSearch: applicationListSearch,
});
