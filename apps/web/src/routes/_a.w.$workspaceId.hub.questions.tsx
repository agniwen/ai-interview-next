import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { questionSetListSearch } from "@/components/features/question-sets/list-search";
import { QuestionSetsPage } from "@/components/features/question-sets/page";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/questions");

function Page() {
  const { workspaceId } = routeApi.useParams();
  const query = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  return (
    <QuestionSetsPage
      key={workspaceId}
      workspaceId={workspaceId}
      query={query}
      onQueryChange={(changes) => {
        void navigate({ search: (prev) => ({ ...prev, ...changes }) });
      }}
    />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/questions")({
  component: Page,
  head: () => ({ meta: [{ title: `${m.question_sets_title()} — Sainoa` }] }),
  validateSearch: questionSetListSearch,
});
