import { IconChartBar, IconSparkle, IconStack2 } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { UserMenu } from "@/components/auth/user-menu";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import * as m from "@/paraglide/messages";

export function AppSidebar({ section }: { section: "agent" | "hub" }) {
  const { setOpenMobile, state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-4">
        <div className="relative h-8">
          <SidebarMenuButton
            render={<Link to="/" tabIndex={collapsed ? -1 : undefined} />}
            aria-label={m.login_back()}
            aria-hidden={collapsed}
            className="h-8 w-[calc(var(--sidebar-width)-5rem)] p-0 font-medium hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground transition-[width,padding,opacity] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0"
          >
            <BrandMark />
            <span>Sainoa</span>
          </SidebarMenuButton>
          <SidebarTrigger
            className="absolute top-0 right-0 size-8"
            aria-label={m.workspace_toggle_sidebar()}
          />
        </div>
        <SegmentedControl
          render={<nav aria-label={m.workspace_navigation()} />}
          className="w-full group-data-[collapsible=icon]:-mx-0.5 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:flex-col"
        >
          <SegmentedControlItem
            className="flex-1 transition-[gap,color,outline-color] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
            aria-label={m.workspace_agent()}
            render={<Link to="/agent" />}
            onClick={() => setOpenMobile(false)}
          >
            <IconSparkle className="size-4" aria-hidden="true" />
            <span className="max-w-20 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
              {m.workspace_agent()}
            </span>
          </SegmentedControlItem>
          <SegmentedControlItem
            className="flex-1 transition-[gap,color,outline-color] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
            aria-label={m.workspace_hub()}
            render={<Link to="/hub/dashboard" />}
            onClick={() => setOpenMobile(false)}
          >
            <IconStack2 className="size-4" aria-hidden="true" />
            <span className="max-w-20 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
              {m.workspace_hub()}
            </span>
          </SegmentedControlItem>
        </SegmentedControl>
      </SidebarHeader>
      <SidebarContent>
        {section === "hub" && (
          <SidebarGroup>
            <SidebarGroupLabel>{m.workspace_studio()}</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive
                  tooltip={m.workspace_dashboard()}
                  aria-label={m.workspace_dashboard()}
                  render={<Link to="/hub/dashboard" />}
                  onClick={() => setOpenMobile(false)}
                >
                  <IconChartBar className="size-4" aria-hidden="true" />
                  <span>{m.workspace_dashboard()}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="px-1 pt-2 pb-1">
        <UserMenu variant="sidebar" collapsed={collapsed} />
      </SidebarFooter>
      <SidebarRail aria-label={m.workspace_toggle_sidebar()} title={m.workspace_toggle_sidebar()} />
    </Sidebar>
  );
}
