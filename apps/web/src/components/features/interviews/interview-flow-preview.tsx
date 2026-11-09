import { IconRobot } from "@tabler/icons-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { applicationDetailLinkOptions } from "@/components/features/ats/detail-navigation";
import type { ApplicationListSearch } from "@/components/features/ats/list-search";
import { RecordPreviewCard } from "@/components/features/ats/record-preview-card";
import { LocalTime } from "@/components/local-time";
import { InterviewFlowPreviewSkeleton } from "@/components/skeletons/components/interview-flow-preview-skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserColumn } from "@/components/user-column";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import * as m from "@/paraglide/messages";
import { roundsQuery } from "./client";
import type { InterviewRound } from "./client";
import { interviewFlowStatus, interviewKindLabel } from "./round-labels";

function RoundInterviewers({ round }: { round: InterviewRound }) {
  if (round.kind === "human") {
    return round.interviewers.map((person) => (
      <UserColumn className="max-w-full text-xs" key={person.id} user={person} />
    ));
  }
  return (
    round.interviewerName && (
      <span className="inline-flex min-w-0 items-center gap-2 text-xs">
        <Avatar aria-hidden="true" className="[--avatar-size:18px]">
          <AvatarFallback>
            <IconRobot className="size-3" />
          </AvatarFallback>
        </Avatar>
        <span className="truncate" title={round.interviewerName}>
          {round.interviewerName}
        </span>
      </span>
    )
  );
}

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
          const status = interviewFlowStatus(round.status);
          return (
            <li key={round.id} className="flex min-w-0 flex-col gap-1.5 border-t pt-3">
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium wrap-anywhere">
                  {m.interviews_round({ number: round.sequence })}
                  {round.label && ` · ${round.label}`}
                </span>
                <Badge variant={status.variant}>{status.label()}</Badge>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs text-muted-foreground">
                  {interviewKindLabel(round.kind)}
                </span>
                <RoundInterviewers round={round} />
              </div>
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
  search,
  workspaceId,
}: {
  applicationId: string;
  round: Pick<InterviewRound, "kind" | "sequence" | "status"> | null;
  search: ApplicationListSearch;
  workspaceId: string;
}) {
  const link = (
    <Link
      {...applicationDetailLinkOptions(workspaceId, applicationId, {
        ...search,
        tab: "interviews",
      })}
      preload={false}
    />
  );
  if (!round) {
    return (
      <Badge render={link} variant="secondary">
        {m.interviews_not_scheduled()}
      </Badge>
    );
  }
  const status = interviewFlowStatus(round.status);
  return (
    <RecordPreviewCard
      title={m.ats_interview_flow()}
      trigger={{
        content: (
          <Badge variant={status.variant}>
            {m.interviews_round({ number: round.sequence })} · {interviewKindLabel(round.kind)} ·{" "}
            {status.label()}
          </Badge>
        ),
        link,
      }}
    >
      <InterviewFlowContent applicationId={applicationId} workspaceId={workspaceId} />
    </RecordPreviewCard>
  );
}
