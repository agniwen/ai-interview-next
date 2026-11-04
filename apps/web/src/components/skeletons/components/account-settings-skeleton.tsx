import { SettingsGroupSkeleton } from "./settings-group-skeleton";
import * as m from "@/paraglide/messages";

export function AccountSettingsSkeleton() {
  return (
    <output aria-label={m.auth_loading()} aria-busy="true" className="flex min-w-0 flex-col gap-7">
      <SettingsGroupSkeleton rows={5} avatar />
      <SettingsGroupSkeleton rows={2} />
    </output>
  );
}
