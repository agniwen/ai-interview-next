import { InterviewCompleted } from "./completed";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { InterviewEntryShell } from "@/components/interview-entry-shell";
import { CandidateInterviewSkeleton } from "@/components/skeletons/pages/candidate-interview-skeleton";
import { HumanInterviewPreparationSkeleton } from "@/components/skeletons/pages/human-interview-preparation-skeleton";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { candidateInterviewQuery } from "./client";
import { InterviewPreparation } from "./preparation";

/**
 * 候选人邀请入口，加载凭证对应的面试并分流加载、失效、失败和准备流程状态。
 * Candidate invitation entry loading the token's interview and selecting loading, unavailable, error or preparation views.
 */
export function CandidateInterviewEntry({
  token,
  humanInvitation = false,
}: {
  token: string;
  humanInvitation?: boolean;
}) {
  const query = useQuery(candidateInterviewQuery(token));
  const phase = useSkeletonPhase(query.isPending);
  const human = query.data ? query.data.kind === "human" : humanInvitation;
  return (
    <InterviewEntryShell>
      {phase === "skeleton" &&
        (human ? <HumanInterviewPreparationSkeleton /> : <CandidateInterviewSkeleton />)}
      {phase === "ready" && query.isError && !query.data && (
        <div role="alert" className="flex max-w-sm flex-col items-center gap-4">
          <h1 className="text-xl font-medium">{m.candidate_interview_load_error()}</h1>
          <Button variant="outline" onClick={() => query.refetch()}>
            {m.ats_retry()}
          </Button>
        </div>
      )}
      {phase === "ready" && query.data === null && (
        <div className="max-w-sm">
          <h1 className="text-xl font-medium">{m.candidate_interview_unavailable()}</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {m.candidate_interview_unavailable_help()}
          </p>
        </div>
      )}
      {phase === "ready" && query.data?.status === "completed" && (
        <InterviewCompleted token={token} interview={query.data} />
      )}
      {phase === "ready" && query.data && query.data.status !== "completed" && (
        <InterviewPreparation key={token} interview={query.data} token={token} />
      )}
    </InterviewEntryShell>
  );
}
