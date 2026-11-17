import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { IconChartBar } from "@tabler/icons-react";
import { PageHeader, PageHeaderContent } from "@/components/layout/page-header";
import { Overview, overviewSearch } from "@/components/features/dashboard/overview";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/hub/dashboard");

function DashboardPage() {
  const { workspaceId } = routeApi.useParams();
  const search = routeApi.useSearch();
  const navigate = routeApi.useNavigate();
  const title = m.workspace_dashboard();
  return (
    <>
      <PageHeaderContent>
        <IconChartBar className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-sm font-medium">{title}</span>
      </PageHeaderContent>
      <section aria-label={title} className="flex min-w-0 flex-col gap-4">
        <PageHeader title={title} />
        <Overview
          key={workspaceId}
          workspaceId={workspaceId}
          search={search}
          onSearchChange={(changes) => {
            void navigate({ search: (previous) => ({ ...previous, ...changes }) });
          }}
        />
      </section>
    </>
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/dashboard")({
  head: () => ({ meta: [{ title: `${m.workspace_dashboard()} — Sainoa` }] }),
  component: DashboardPage,
  validateSearch: overviewSearch,
});
