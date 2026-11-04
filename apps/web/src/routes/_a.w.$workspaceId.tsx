import { SidebarPageProvider } from "@/components/layout/sidebar-page";
import type { CSSProperties } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PageHeaderProvider, PageHeaderTarget } from "@/components/layout/page-header";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceSwitcher } from "@/components/workspaces/workspace-switcher";

import { useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { getRouteApi, createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import * as m from "@/paraglide/messages";
import { workspaceApi } from "@/lib/workspaces/client";
import { WorkspaceFeedback } from "@/components/workspaces/workspace-feedback";
import { WorkspacePicker } from "@/components/workspaces/workspace-picker";

const routeApi = getRouteApi("/_a/w/$workspaceId");

function WorkspaceShell() {
  const { workspaceSession } = routeApi.useRouteContext();
  const { workspaceId } = routeApi.useParams();
  const matchRoute = useMatchRoute();
  const section =
    matchRoute({ to: "/w/$workspaceId/settings", params: { workspaceId } }) ||
    matchRoute({ to: "/w/$workspaceId/account", params: { workspaceId }, fuzzy: true }) ||
    matchRoute({
      to: "/w/$workspaceId/hub/dashboard",
      params: { workspaceId },
      fuzzy: true,
    })
      ? "hub"
      : "agent";

  const { mutate: activate, error } = useMutation({
    mutationFn: async (id: string) => {
      const response = await workspaceApi.api.workspaces[":workspaceId"].activate.$post({
        param: { workspaceId: id },
      });
      if (!response.ok) {
        throw new Error(m.ws_activation_error());
      }
    },
  });

  useEffect(() => {
    activate(workspaceId);
  }, [activate, workspaceId]);

  return (
    <SidebarPageProvider>
      <PageHeaderProvider>
        <TooltipProvider>
          <SidebarProvider
            className="h-dvh min-h-0 overflow-hidden"
            style={{ "--sidebar-width": "18rem" } as CSSProperties}
          >
            <AppSidebar section={section} workspaceId={workspaceId} />
            <SidebarInset className="min-h-0 min-w-0 overflow-hidden md:rounded-2xl md:ring-1 md:ring-border/50">
              <ScrollArea
                className="min-h-0 flex-1 [&>[data-slot=scroll-area-scrollbar]]:z-20"
                fill
                viewportClassName={section === "agent" ? "overflow-hidden!" : undefined}
                overscrollContain
              >
                <div
                  className={
                    section === "agent"
                      ? "flex h-full min-h-0 flex-col"
                      : "flex min-h-full flex-col"
                  }
                >
                  <header className="isolate sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between gap-2 px-3 after:pointer-events-none after:absolute after:inset-0 after:-bottom-6 after:-z-1 after:bg-linear-to-b after:from-background after:from-20% after:via-background/85 after:via-50% after:to-transparent md:px-4">
                    <div className="flex min-w-0 items-center gap-2">
                      <SidebarTrigger
                        className="md:hidden"
                        aria-label={m.workspace_toggle_sidebar()}
                      />
                      <PageHeaderTarget className="flex min-w-0 items-center gap-2" />
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <ThemeSwitcher />
                      <LanguageSwitcher iconOnly />
                      <WorkspaceSwitcher
                        workspaceId={workspaceId}
                        workspaces={workspaceSession.workspaces}
                      />
                    </div>
                  </header>
                  <div
                    className={
                      section === "agent"
                        ? "-mt-12 flex min-h-0 flex-1 flex-col"
                        : "flex flex-1 flex-col p-4 md:p-6"
                    }
                  >
                    <WorkspaceFeedback error={error} />
                    <Outlet />
                  </div>
                </div>
              </ScrollArea>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </PageHeaderProvider>
    </SidebarPageProvider>
  );
}

function WorkspaceLayout() {
  const { workspace, workspaceSession } = routeApi.useRouteContext();
  return workspace ? (
    <WorkspaceShell />
  ) : (
    <WorkspacePicker workspaces={workspaceSession.workspaces} unavailable />
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId")({
  params: {
    parse: (params) => ({ workspaceId: params.workspaceId.toLowerCase() }),
    stringify: (params) => ({ workspaceId: params.workspaceId.toLowerCase() }),
  },
  beforeLoad: ({ context, params }) => ({
    workspace: context.workspaceSession.workspaces.find(
      (workspace) => workspace.id === params.workspaceId,
    ),
  }),
  component: WorkspaceLayout,
});
