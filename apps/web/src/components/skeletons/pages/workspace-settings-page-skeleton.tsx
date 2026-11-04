import { Skeleton } from "@/components/ui/skeleton";
import { SettingsGroupSkeleton } from "../components/settings-group-skeleton";
import * as m from "@/paraglide/messages";

export function WorkspaceSettingsPageSkeleton() {
  return (
    <output
      aria-label={m.auth_loading()}
      aria-busy="true"
      className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-2 md:py-4"
    >
      <div aria-hidden="true" className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <SettingsGroupSkeleton rows={1} />
      <SettingsGroupSkeleton />
      <SettingsGroupSkeleton rows={2} />
    </output>
  );
}
