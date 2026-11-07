import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { JobEditorPage } from "@/components/features/ats/job-editor-page";
import { JobEditorPageSkeleton } from "@/components/skeletons/pages/job-editor-page-skeleton";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/jobs/overlay/$id");

function Page() {
  const { id, workspaceId } = routeApi.useParams();
  const search = routeApi.useSearch();
  return (
    <JobEditorPage key={`${workspaceId}:${id}`} id={id} workspaceId={workspaceId} search={search} />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/jobs/overlay/$id")({
  component: Page,
  pendingComponent: JobEditorPageSkeleton,
  head: () => ({ meta: [{ title: `${m.ats_job()} — Sainoa` }] }),
});
