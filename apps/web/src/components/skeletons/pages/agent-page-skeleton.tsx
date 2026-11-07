import { Skeleton } from "@/components/ui/skeleton";
import { ChatTranscriptSkeleton } from "../components/chat-transcript-skeleton";

/**
 * Agent 页面加载占位，保留聊天正文和底部输入区的布局。
 * Agent-page loading placeholder retaining transcript and bottom composer layout.
 */
export function AgentPageSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ChatTranscriptSkeleton />
      <div
        aria-hidden="true"
        className="mx-auto w-full max-w-3xl shrink-0 px-4 pb-[38px] md:px-6 md:pb-[42px]"
      >
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}
