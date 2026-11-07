import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * Agent 侧栏会话列表的局部占位，不包含聊天正文区域。
 * Local Agent sidebar session-list placeholder, excluding transcript content.
 */
export function SessionListSkeleton() {
  return (
    <output
      aria-label={m.agent_loading()}
      aria-busy="true"
      className="flex flex-col gap-4 px-2 py-3"
    >
      <div aria-hidden="true" className="contents">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </output>
  );
}
