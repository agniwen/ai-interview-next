import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * Agent 回收站列表的内容占位，预留会话信息和恢复、删除操作。
 * Agent trash-list placeholder reserving session metadata and restore/delete actions.
 */
export function TrashListSkeleton() {
  return (
    <output aria-label={m.agent_loading()} aria-busy="true" className="block divide-y">
      {["first", "second", "third"].map((key) => (
        <div key={key} aria-hidden="true" className="flex items-center gap-3 p-4">
          <Skeleton className="size-4 shrink-0" />
          <Skeleton className="h-4 w-1/2" />
          <div className="ml-auto flex gap-3">
            <Skeleton className="size-8" />
            <Skeleton className="size-8" />
          </div>
        </div>
      ))}
    </output>
  );
}
