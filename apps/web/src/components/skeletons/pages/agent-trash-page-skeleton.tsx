import { Skeleton } from "@/components/ui/skeleton";
import { TrashListSkeleton } from "../components/trash-list-skeleton";

/**
 * Agent 回收站页面占位，组合页标题与已删除会话列表骨架。
 * Agent trash-page placeholder combining the heading and deleted-session list skeleton.
 */
export function AgentTrashPageSkeleton() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 py-2 md:py-4">
      <Skeleton aria-hidden="true" className="h-8 w-40" />
      <div className="rounded-xl border">
        <TrashListSkeleton />
      </div>
    </div>
  );
}
