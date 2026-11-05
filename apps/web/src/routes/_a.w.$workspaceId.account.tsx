import { IconUser } from "@tabler/icons-react";
import { AccountPageSkeleton } from "@/components/skeletons/pages/account-page-skeleton";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AccountPageContent } from "@/components/settings/account-page";
import { PageHeaderContent } from "@/components/layout/page-header";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/w/$workspaceId/account");

function AccountPage() {
  const { workspaceId } = routeApi.useParams();
  return (
    <>
      <PageHeaderContent>
        <IconUser className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate text-sm font-medium">{m.account_title()}</span>
      </PageHeaderContent>
      <AccountPageContent workspaceId={workspaceId} />
    </>
  );
}

export const Route = createFileRoute("/_a/w/$workspaceId/account")({
  pendingComponent: AccountPageSkeleton,
  head: () => ({ meta: [{ title: `${m.account_title()} — Sainoa` }] }),
  component: AccountPage,
});
