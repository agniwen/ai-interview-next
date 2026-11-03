import { createFileRoute } from "@tanstack/react-router";
import { IconChartBar } from "@tabler/icons-react";
import { PageHeaderContent } from "@/components/layout/page-header";
import * as m from "@/paraglide/messages";

function DashboardPage() {
  return (
    <>
      <PageHeaderContent>
        <IconChartBar className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h1 className="truncate text-sm font-medium">{m.workspace_dashboard()}</h1>
      </PageHeaderContent>
      <div className="flex flex-1 items-center justify-center">
        <p className="text-center text-sm text-muted-foreground">
          {m.workspace_dashboard_placeholder()}
        </p>
      </div>
    </>
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/hub/dashboard")({
  head: () => ({ meta: [{ title: `${m.workspace_dashboard()} — Sainoa` }] }),
  component: DashboardPage,
});
