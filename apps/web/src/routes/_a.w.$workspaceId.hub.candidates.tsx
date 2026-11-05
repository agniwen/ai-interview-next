import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { z } from "zod";
import { CandidatesPage } from "@/components/ats/candidates-page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/candidates");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const { page } = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <CandidatesPage
      workspaceId={workspaceId}
      page={page}
      onPage={(next) => {
        void navigate({ search: { page: next } });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/candidates")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.ats_candidates()} — Sainoa` }] }),
  validateSearch: z.object({ page: z.number().int().min(1).max(1_000_000).catch(1).default(1) }),
});
