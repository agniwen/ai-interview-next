import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { InterviewEvaluationDialog } from "../interviews/evaluation-section";
import { resultQuery } from "../interviews/client";
import * as m from "@/paraglide/messages";

export function MeetingEvaluation({
  workspaceId,
  roundId,
}: {
  workspaceId: string;
  roundId: string;
}) {
  const query = useQuery(resultQuery(workspaceId, roundId));
  const phase = useSkeletonPhase(query.isPending);
  if (phase === "skeleton") {
    return <Skeleton className="h-8 w-24" aria-label={m.interview_evaluation_title()} />;
  }
  if (query.isError) {
    return (
      <Button variant="outline" size="sm" onClick={() => query.refetch()}>
        {m.ats_retry()}
      </Button>
    );
  }
  return query.data ? <InterviewEvaluationDialog data={query.data} /> : null;
}
