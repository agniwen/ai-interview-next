import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccountPageSkeleton } from "@/components/skeletons/pages/account-page-skeleton";
import { AgentPageSkeleton } from "@/components/skeletons/pages/agent-page-skeleton";
import { AgentTrashPageSkeleton } from "@/components/skeletons/pages/agent-trash-page-skeleton";
import { InvitationPageSkeleton } from "@/components/skeletons/pages/invitation-page-skeleton";
import { WorkspaceSettingsPageSkeleton } from "@/components/skeletons/pages/workspace-settings-page-skeleton";
import { WorkspacesPageSkeleton } from "@/components/skeletons/pages/workspaces-page-skeleton";
import { UserMenuSkeleton } from "@/components/skeletons/components/user-menu-skeleton";
import { SignInSessionSkeleton } from "@/components/skeletons/components/sign-in-session-skeleton";

describe("skeleton accessibility", () => {
  it.each([
    AccountPageSkeleton,
    AgentPageSkeleton,
    AgentTrashPageSkeleton,
    InvitationPageSkeleton,
    WorkspaceSettingsPageSkeleton,
    WorkspacesPageSkeleton,
    SignInSessionSkeleton,
  ])("%s labels loading without exposing fake controls", (Loading) => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/aria-label="[^"]+"/u);
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toMatch(/<(?:button|input|select|a)\b/u);
  });

  it.each([
    { collapsed: false, iconOnly: false },
    { collapsed: true, iconOnly: false },
    { collapsed: false, iconOnly: true },
  ])("keeps a loading user menu out of the tab order (%o)", (props) => {
    const html = renderToStaticMarkup(<UserMenuSkeleton {...props} />);
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toMatch(/<(?:button|a)\b|tabindex=/u);
  });
});
