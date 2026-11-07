import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 工作区邀请卡片的加载占位，包含邀请信息和接受操作区域。
 * Workspace invitation-card placeholder for invitation details and acceptance actions.
 */
export function InvitationCardSkeleton() {
  return (
    <output aria-label={m.auth_loading()} aria-busy="true" className="block rounded-xl border p-6">
      <div aria-hidden="true" className="flex flex-col gap-4">
        <Skeleton className="h-5 w-40 max-w-full" />
        <Skeleton className="h-4 w-4/5" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </output>
  );
}
