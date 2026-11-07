import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { ResumeProcessingPage } from "@/components/features/ats/resume-processing-page";
import { ResumeProcessingSkeleton } from "@/components/skeletons/pages/resume-processing-skeleton";
import * as m from "@/paraglide/messages";
import { resumeListSearch } from "@/components/features/ats/list-search";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/resumes_/$id");
function Page() {
  const { id, workspaceId } = routeApi.useParams();
  const search = routeApi.useSearch();
  return <ResumeProcessingPage id={id} workspaceId={workspaceId} search={search} />;
}
export const Route = createFileRoute("/_a/w/$workspaceId/hub/resumes_/$id")({
  component: Page,
  pendingComponent: ResumeProcessingSkeleton,
  head: () => ({ meta: [{ title: `${m.resume_processing_title()} — Sainoa` }] }),
  validateSearch: resumeListSearch,
});
