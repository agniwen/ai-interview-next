import { AccountSettings } from "./account-settings";
import * as m from "@/paraglide/messages";

export function AccountPageContent() {
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
    </main>
  );
}
