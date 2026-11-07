import { Skeleton } from "@/components/ui/skeleton";
import * as m from "@/paraglide/messages";

/**
 * 聊天记录初次加载或重连的占位，按连接状态提供不同的无障碍提示。
 * Chat transcript placeholder for initial load or reconnection, with connection-specific accessible labels.
 */
export function ChatTranscriptSkeleton({ reconnecting = false }: { reconnecting?: boolean }) {
  return (
    <output
      aria-label={reconnecting ? m.agent_reconnecting() : m.agent_loading()}
      aria-busy="true"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pt-20 md:px-6"
    >
      <div aria-hidden="true" className="contents">
        <Skeleton className="h-10 w-2/5 self-end rounded-2xl" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </output>
  );
}
