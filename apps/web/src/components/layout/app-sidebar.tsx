import { SidebarPageTarget } from "./sidebar-page";
import {
  IconBriefcase,
  IconBuilding,
  IconChartBar,
  IconFileCv,
  IconFolders,
  IconListDetails,
  IconUsers,
  IconSparkle,
  IconStack2,
  IconSettings,
  IconUser,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { BrandMark } from "@/components/brand-mark";
import { UserMenu } from "@/components/features/auth/user-menu";
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

export function AppSidebar({
  section,
  workspaceId,
}: {
  section: "agent" | "hub";
  workspaceId: string;
}) {
  const { setOpenMobile, state, isMobile } = useSidebar();
  const collapsed = !isMobile && state === "collapsed";

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-4">
        <div className="group/sidebar-brand relative h-8">
          <SidebarMenuButton
            render={<Link to="/" tabIndex={collapsed ? -1 : undefined} />}
            aria-label={m.login_back()}
            aria-hidden={collapsed}
            className="h-8 w-[calc(var(--sidebar-width)-5rem)] p-0 font-medium hover:bg-transparent hover:text-sidebar-foreground active:bg-transparent active:text-sidebar-foreground transition-[width,padding,opacity] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0"
          >
            <BrandMark />
            <span>Sainoa</span>
          </SidebarMenuButton>
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0 right-0 flex size-8 items-center justify-center opacity-0 transition-opacity duration-150 motion-reduce:transition-none group-data-[collapsible=icon]:opacity-100 group-data-[collapsible=icon]:group-hover/sidebar-brand:opacity-0 group-data-[collapsible=icon]:group-has-[:focus-visible]/sidebar-brand:opacity-0"
          >
            <BrandMark />
          </span>
          <SidebarTrigger
            className="absolute top-0 right-0 size-8 transition-opacity duration-150 motion-reduce:transition-none group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:group-hover/sidebar-brand:opacity-100 group-data-[collapsible=icon]:focus-visible:opacity-100"
            aria-label={m.workspace_toggle_sidebar()}
          />
        </div>
        {/* 用可插值的位置和尺寸切换横纵布局，避免 flex-direction 瞬间跳变。
            Interpolate positions and sizes between layouts instead of switching flex-direction abruptly. */}
        <SegmentedControl
          render={<nav aria-label={m.workspace_navigation()} />}
          className="block h-9.5 w-full transition-[width,height,margin] duration-200 ease-linear motion-reduce:transition-none sm:h-8.5 group-data-[collapsible=icon]:-mx-0.5 group-data-[collapsible=icon]:h-[4.375rem] group-data-[collapsible=icon]:w-9"
        >
          <SegmentedControlItem
            className="absolute top-0.5 w-[calc((100%-0.375rem)/2)] transition-[width,height,top,left,gap,padding,color,outline-color] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 left-0.5"
            aria-label={m.workspace_agent()}
            data-checked={section === "agent" ? "" : undefined}
            render={<Link to="/w/$workspaceId/agent" params={{ workspaceId }} preload="render" />}
            onClick={() => setOpenMobile(false)}
          >
            <IconSparkle className="size-4" aria-hidden="true" />
            <span className="max-w-20 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
              {m.workspace_agent()}
            </span>
          </SegmentedControlItem>
          <SegmentedControlItem
            className="absolute top-0.5 w-[calc((100%-0.375rem)/2)] transition-[width,height,top,left,gap,padding,color,outline-color] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:h-8! group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 left-[calc(50%+0.0625rem)] group-data-[collapsible=icon]:top-9 group-data-[collapsible=icon]:left-0.5"
            aria-label={m.workspace_hub()}
            data-checked={section === "hub" ? "" : undefined}
            render={
              <Link to="/w/$workspaceId/hub/dashboard" params={{ workspaceId }} preload="render" />
            }
            onClick={() => setOpenMobile(false)}
          >
            <IconStack2 className="size-4" aria-hidden="true" />
            <span className="max-w-20 overflow-hidden opacity-100 transition-[max-width,opacity] duration-200 ease-linear motion-reduce:transition-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:opacity-0">
              {m.workspace_hub()}
            </span>
          </SegmentedControlItem>
        </SegmentedControl>
      </SidebarHeader>
      <SidebarContent className="overflow-hidden">
        {section === "agent" && <SidebarPageTarget className="flex min-h-0 flex-1 flex-col" />}
        {section === "hub" && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel>{m.workspace_studio()}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={m.workspace_dashboard()}
                    aria-label={m.workspace_dashboard()}
                    render={
                      <Link
                        to="/w/$workspaceId/hub/dashboard"
                        params={{ workspaceId }}
                        activeProps={{ "data-active": true }}
                      />
                    }
                    onClick={() => setOpenMobile(false)}
                  >
                    <IconChartBar className="size-4" aria-hidden="true" />
                    <span>{m.workspace_dashboard()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>

                {(
                  [
                    { icon: IconFileCv, label: m.ats_resumes(), to: "/w/$workspaceId/hub/resumes" },
                    {
                      icon: IconUsers,
                      label: m.ats_candidates(),
                      to: "/w/$workspaceId/hub/candidates",
                    },
                    {
                      icon: IconListDetails,
                      label: m.ats_applications(),
                      to: "/w/$workspaceId/hub/applications",
                    },
                    {
                      icon: IconFolders,
                      label: m.ats_projects(),
                      to: "/w/$workspaceId/hub/projects",
                    },
                    {
                      icon: IconBuilding,
                      label: m.ats_departments(),
                      to: "/w/$workspaceId/hub/departments",
                    },
                    { icon: IconBriefcase, label: m.ats_job(), to: "/w/$workspaceId/hub/jobs" },
                  ] as const
                ).map(({ icon: Icon, label, to }) => (
                  <SidebarMenuItem key={to}>
                    <SidebarMenuButton
                      tooltip={label}
                      aria-label={label}
                      render={
                        <Link
                          to={to}
                          params={{ workspaceId }}
                          activeProps={{ "data-active": true }}
                        />
                      }
                      onClick={() => setOpenMobile(false)}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
            <SidebarGroup>
              <SidebarGroupLabel>{m.ws_settings_group()}</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={m.ws_settings()}
                    render={
                      <Link
                        to="/w/$workspaceId/settings"
                        params={{ workspaceId }}
                        activeProps={{ "data-active": true }}
                      />
                    }
                    onClick={() => setOpenMobile(false)}
                  >
                    <IconSettings aria-hidden="true" />
                    <span>{m.ws_settings()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip={m.account_title()}
                    render={
                      <Link
                        to="/w/$workspaceId/account"
                        params={{ workspaceId }}
                        activeProps={{ "data-active": true }}
                      />
                    }
                    onClick={() => setOpenMobile(false)}
                  >
                    <IconUser aria-hidden="true" />
                    <span>{m.account_title()}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>
      <SidebarFooter className="px-1 pt-2 pb-1">
        <UserMenu variant="sidebar" collapsed={collapsed} workspaceId={workspaceId} />
      </SidebarFooter>
      <SidebarRail aria-label={m.workspace_toggle_sidebar()} title={m.workspace_toggle_sidebar()} />
    </Sidebar>
  );
}
