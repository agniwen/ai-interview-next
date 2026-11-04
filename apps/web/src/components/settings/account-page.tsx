import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ListActions, ListContent, ListDescription, ListItem } from "@/components/ui/list";
import { SettingsGroup } from "./settings-group";
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
        <SettingsGroup title={m.agent_trash()}>
          <ListItem className="flex-row items-center gap-4">
            <ListContent>
              <ListDescription className="break-normal">
                {m.agent_trash_description()}
              </ListDescription>
            </ListContent>
            <ListActions>
              <Button
                variant="outline"
                render={<Link to="/w/$workspaceId/account/trash" params={{ workspaceId }} />}
              >
                {m.agent_trash_view()}
              </Button>
            </ListActions>
          </ListItem>
        </SettingsGroup>
      )}
    </main>
  );
}
