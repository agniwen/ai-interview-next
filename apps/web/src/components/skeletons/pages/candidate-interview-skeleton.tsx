import { Skeleton } from "@/components/ui/skeleton";
import { InterviewEntryShell } from "@/components/interview-entry-shell";
import * as m from "@/paraglide/messages";

/**
 * 在邀请数据返回前显示通用占位，此时面试类型尚未确定。
 * Shared invitation placeholder shown before the response identifies the interview type.
 */
export function CandidateInterviewSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label={m.candidate_interview_loading()}
      className="flex w-full flex-col items-center"
    >
      <div aria-hidden="true" className="flex w-full max-w-sm flex-col items-center gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-60 max-w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
    </div>
  );
}

/**
 * 路由加载时使用的整页骨架，自带候选人入口外壳。
 * Full-page route fallback including the candidate-entry shell.
 */
export function CandidateInterviewPageSkeleton() {
  return (
    <InterviewEntryShell>
      <CandidateInterviewSkeleton />
    </InterviewEntryShell>
  );
}
