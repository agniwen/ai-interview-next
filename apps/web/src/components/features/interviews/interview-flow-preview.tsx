import { useInfiniteQuery } from "@tanstack/react-query";
import { RecordPreviewCard } from "@/components/features/ats/record-preview-card";
import { LocalTime } from "@/components/local-time";
import { InterviewFlowPreviewSkeleton } from "@/components/skeletons/components/interview-flow-preview-skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { roundsQuery } from "./client";
import type { InterviewRound } from "./client";
import { interviewKindLabel, interviewRoundStatusLabel } from "./round-labels";

function InterviewFlowContent({
  applicationId,
  workspaceId,
}: {
  applicationId: string;
  workspaceId: string;
}) {
  const query = useInfiniteQuery(roundsQuery(workspaceId, applicationId));
  const phase = useSkeletonPhase(query.isPending);
  if (phase === "skeleton") {
    return <InterviewFlowPreviewSkeleton />;
  }
  if (phase === "pending") {
    return null;
  }
  if (!query.data) {
    return <output>{m.ats_error()}</output>;
  }
  const rounds = query.data.pages.flatMap((page) => page.rows);
  if (rounds.length === 0) {
    return <p className="text-muted-foreground">{m.interviews_empty()}</p>;
  }

  return (
    <>
      <ol className="flex flex-col gap-3">
        {rounds.map((round) => {
          const interviewers =
            round.kind === "ai"
              ? round.interviewerName
              : round.interviewers.map(({ name }) => name).join(", ");
          return (
            <li key={round.id} className="flex min-w-0 flex-col gap-1.5 border-t pt-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium wrap-anywhere">
                  {m.interviews_round({ number: round.sequence })}
                  {round.label && ` · ${round.label}`}
                </span>
                <Badge variant="secondary">{interviewRoundStatusLabel(round)}</Badge>
              </div>
              <p className="text-xs text-muted-foreground wrap-anywhere">
                {interviewKindLabel(round.kind)}
                {interviewers && ` · ${interviewers}`}
              </p>
              {round.scheduledAt && (
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">{m.interviews_start()}</dt>
                    <dd>
                      <LocalTime value={round.scheduledAt} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{m.interviews_deadline()}</dt>
                    <dd>
                      <LocalTime value={round.admissionDeadline} />
                    </dd>
                  </div>
                </dl>
              )}
            </li>
          );
        })}
      </ol>
      {query.hasNextPage && (
        <Button
          size="sm"
          variant="outline"
          loading={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
        >
          {m.ats_load_more()}
        </Button>
      )}
    </>
  );
}

export function InterviewFlowPreview({
  applicationId,
  round,
  workspaceId,
}: {
  applicationId: string;
  round: Pick<InterviewRound, "kind" | "sequence">;
  workspaceId: string;
}) {
  const label = `${m.interviews_round({ number: round.sequence })} · ${interviewKindLabel(round.kind)}`;
  return (
    <RecordPreviewCard
      title={m.ats_interview_flow()}
      trigger={{
        content: <Badge variant={round.kind === "ai" ? "info" : "secondary"}>{label}</Badge>,
        label,
      }}
    >
      <InterviewFlowContent applicationId={applicationId} workspaceId={workspaceId} />
    </RecordPreviewCard>
  );
}
