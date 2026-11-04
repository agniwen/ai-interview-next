import { AccountPageSkeleton } from "@/components/skeletons/pages/account-page-skeleton";
import { IconArrowLeft } from "@tabler/icons-react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { AccountPageContent } from "@/components/settings/account-page";
import { UserMenu } from "@/components/auth/user-menu";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";

function AccountPage() {
  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={m.account_back()}
            render={<Link to="/workspaces" />}
          >
            <IconArrowLeft aria-hidden="true" />
          </Button>
          <span className="truncate text-sm font-medium">{m.account_title()}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <ThemeSwitcher />
          <LanguageSwitcher iconOnly />
          <UserMenu iconOnly />
        </div>
      </header>
      <div className="flex flex-1 p-4 md:p-6">
        <AccountPageContent />
      </div>
    </>
  );
}

export const Route = createFileRoute("/_a/account")({
  pendingComponent: AccountPageSkeleton,
  beforeLoad: ({ context }) => {
    const { workspaces, lastWorkspaceId } = context.workspaceSession;
    const workspace = workspaces.find((item) => item.id === lastWorkspaceId) ?? workspaces[0];
    if (workspace) {
      throw redirect({ to: "/w/$workspaceId/account", params: { workspaceId: workspace.id } });
    }
  },
  head: () => ({ meta: [{ title: `${m.account_title()} — Sainoa` }] }),
  component: AccountPage,
});
