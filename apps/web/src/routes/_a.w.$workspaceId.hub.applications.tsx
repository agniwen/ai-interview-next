import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";
import { ApplicationsPage } from "@/components/ats/applications-page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/applications");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const { page } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <ApplicationsPage
      workspaceId={workspaceId}
      page={page}
      onPage={(next) => {
        void navigate({ search: { page: next } });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/applications")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_applications()} — Sainoa` }] }),
  validateSearch: z.object({ page: z.number().int().min(1).max(1_000_000).catch(1).default(1) }),
});
