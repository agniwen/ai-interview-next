import { Skeleton } from "@/components/ui/skeleton";
import { InvitationCardSkeleton } from "../components/invitation-card-skeleton";

/**
 * 工作区邀请详情页面加载占位，包含邀请卡片及上下操作区域。
 * Workspace invitation-page placeholder with the invitation card and surrounding action areas.
 */
export function InvitationPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-6 p-6">
      <Skeleton aria-hidden="true" className="size-9 self-end" />
      <InvitationCardSkeleton />
      <Skeleton aria-hidden="true" className="h-9 w-32 self-center" />
    </div>
  );
}
