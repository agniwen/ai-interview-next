import { Link } from "@tanstack/react-router";
import { IconTrash, IconChevronRight } from "@tabler/icons-react";
import { AccountSettings } from "./account-settings";
import * as m from "@/paraglide/messages";

export function AccountPageContent({ workspaceId }: { workspaceId?: string }) {
  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 py-2 md:py-4"
    >
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{m.account_title()}</h1>
        <p className="text-sm text-muted-foreground">{m.account_description()}</p>
      </div>
      <AccountSettings />
      {workspaceId && (
        <Link
          to="/w/$workspaceId/account/trash"
          params={{ workspaceId }}
          className="flex items-center gap-3 rounded-xl border p-4 text-sm transition-colors hover:bg-muted/50"
        >
          <IconTrash className="size-4 text-muted-foreground" />
          <span className="flex-1 font-medium">{m.agent_trash()}</span>
          <IconChevronRight className="size-4 text-muted-foreground" />
        </Link>
      )}
    </main>
  );
}
