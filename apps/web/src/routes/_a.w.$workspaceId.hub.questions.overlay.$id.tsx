import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { QuestionSetEditorPage } from "@/components/features/question-sets/editor-page";
import { QuestionSetEditorPageSkeleton } from "@/components/skeletons/pages/question-set-editor-page-skeleton";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/questions/overlay/$id");

function Page() {
  const { id, workspaceId } = routeApi.useParams();
  const search = routeApi.useSearch();
  return (
    <QuestionSetEditorPage
      key={`${workspaceId}:${id}`}
      id={id}
      workspaceId={workspaceId}
      search={search}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/questions/overlay/$id")({
  component: Page,
  pendingComponent: QuestionSetEditorPageSkeleton,
  head: () => ({ meta: [{ title: `${m.question_sets_title()} — Sainoa` }] }),
});
