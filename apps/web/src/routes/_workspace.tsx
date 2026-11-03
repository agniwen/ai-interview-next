import type { CSSProperties } from "react";
import { createFileRoute, Outlet, useMatchRoute } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { PageHeaderProvider, PageHeaderTarget } from "@/components/layout/page-header";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import * as m from "@/paraglide/messages";

function WorkspaceLayout() {
  const matchRoute = useMatchRoute();
  const section = matchRoute({ to: "/hub/dashboard", fuzzy: true }) ? "hub" : "agent";

  return (
    <PageHeaderProvider>
      <TooltipProvider>
        <SidebarProvider
          className="h-dvh min-h-0 overflow-hidden"
          style={{ "--sidebar-width": "18rem" } as CSSProperties}
        >
          <AppSidebar section={section} />
          <SidebarInset className="min-h-0 min-w-0 overflow-hidden md:rounded-2xl md:ring-1 md:ring-border/50">
            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <SidebarTrigger className="md:hidden" aria-label={m.workspace_toggle_sidebar()} />
                <PageHeaderTarget className="flex min-w-0 items-center gap-2" />
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <ThemeSwitcher />
                <LanguageSwitcher />
              </div>
            </header>
            <ScrollArea className="min-h-0 flex-1" fill overscrollContain>
              <div className="flex min-h-full flex-col p-4 md:p-6">
                <Outlet />
              </div>
            </ScrollArea>
          </SidebarInset>
        </SidebarProvider>
      </TooltipProvider>
    </PageHeaderProvider>
  );
}

export const Route = createFileRoute("/_workspace")({
  component: WorkspaceLayout,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
});
