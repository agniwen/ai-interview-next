import { createFileRoute } from "@tanstack/react-router";
import { AccountPageContent } from "@/components/settings/account-page";
import { PageHeaderContent } from "@/components/layout/page-header";
import * as m from "@/paraglide/messages";

function AccountPage() {
  return (
    <>
      <PageHeaderContent>
        <span className="truncate text-sm font-medium">{m.account_title()}</span>
      </PageHeaderContent>
      <AccountPageContent />
    </>
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/account")({
  head: () => ({ meta: [{ title: `${m.account_title()} — Sainoa` }] }),
  component: AccountPage,
});
