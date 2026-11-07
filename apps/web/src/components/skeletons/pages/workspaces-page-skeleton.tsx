import { Skeleton } from "@/components/ui/skeleton";
import { InvitationCardSkeleton } from "../components/invitation-card-skeleton";
import * as m from "@/paraglide/messages";

/**
 * 工作区选择页面加载占位，保留居中的选择和说明布局。
 * Workspace-picker page placeholder retaining the centered selection and explanation layout.
 */
export function WorkspacesPageSkeleton() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <div
        aria-hidden="true"
        className="flex h-14 shrink-0 items-center justify-end gap-2 border-b px-4 md:px-6"
      >
        <Skeleton className="size-8" />
        <Skeleton className="size-8" />
        <Skeleton className="h-8 w-40 max-w-1/2" />
      </div>
      <output
        aria-label={m.auth_loading()}
        aria-busy="true"
        className="flex flex-1 flex-col items-center justify-center gap-4 p-6"
      >
        <div aria-hidden="true" className="flex w-full max-w-sm flex-col items-center gap-4">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-9 w-32" />
        </div>
      </output>
      <div className="mx-auto w-full max-w-xl px-6 pb-6">
        <InvitationCardSkeleton />
      </div>
    </div>
  );
}
