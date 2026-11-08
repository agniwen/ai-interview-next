import { lazy, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { InterviewEntryShell } from "@/components/interview-entry-shell";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { CandidateInterviewSkeleton } from "@/components/skeletons/pages/candidate-interview-skeleton";
import { HumanMeetingSkeleton } from "@/components/skeletons/pages/human-meeting-skeleton";
import { Button } from "@/components/ui/button";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { HumanInterviewPreparation } from "../candidate-interview/human-preparation";
import type { InterviewDevices } from "../candidate-interview/device-check";
import {
  meetingQuery,
  joinInterviewerMeeting,
  enterInterviewerMeeting,
  endMeetingMutation,
} from "./client";
import type { HumanMeeting } from "./client";
import { interviewKeys } from "../interviews/client";
import { atsKeys } from "../ats/query-keys";
import { MeetingError } from "./error";
import { MeetingEvaluation } from "./evaluation";
import * as m from "@/paraglide/messages";

const MeetingRoom = lazy(() => import("./room"));

function InterviewerMeeting({ data }: { data: HumanMeeting }) {
  const { round } = data;
  const client = useQueryClient();
  const [devices, setDevices] = useState<InterviewDevices | null>(null);
  const [left, setLeft] = useState(false);
  const join = useMutation({
    mutationFn: () => joinInterviewerMeeting(round.workspaceId, round.id),
  });
  const end = useMutation(
    endMeetingMutation(client, round.workspaceId, round.id, round.applicationId),
  );
  async function leave() {
    setDevices(null);
    setLeft(true);
    join.reset();
    await client.invalidateQueries({
      queryKey: meetingQuery(round.workspaceId, round.id).queryKey,
    });
  }
  const back = (
    <Button
      variant="outline"
      render={
        <Link
          to="/w/$workspaceId/hub/applications/$id"
          params={{ id: round.applicationId, workspaceId: round.workspaceId }}
          search={{ page: 1, pageSize: 20, search: "", tab: "interviews" }}
        />
      }
    >
      {m.meeting_return()}
    </Button>
  );
  if (round.status === "completed") {
    return (
      <div className="flex max-w-md flex-col items-center gap-5">
        <h1 className="text-3xl font-medium">{m.meeting_completed()}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{m.meeting_completed_help()}</p>
        <Button
          render={
            <Link
              to="/w/$workspaceId/hub/applications/$id/result/$roundId"
              params={{
                id: round.applicationId,
                roundId: round.id,
                workspaceId: round.workspaceId,
              }}
              search={{ page: 1, pageSize: 20, search: "", tab: "interviews" }}
            />
          }
        >
          {m.interview_evaluation_review()}
        </Button>
        {back}
      </div>
    );
  }
  if (devices && join.data) {
    return (
      <SkeletonSuspense fallback={<HumanMeetingSkeleton />}>
        <MeetingRoom
          connection={join.data}
          devices={devices}
          title={`${data.jobTitle} · ${data.candidateName}`}
          materials={data.materials}
          evaluation={<MeetingEvaluation workspaceId={round.workspaceId} roundId={round.id} />}
          onLeave={leave}
          onEntered={async () => {
            const result = await enterInterviewerMeeting(round.workspaceId, round.id);
            await Promise.all([
              client.invalidateQueries({
                queryKey: interviewKeys.workspace(round.workspaceId).queryKey,
              }),
              client.invalidateQueries({
                queryKey: atsKeys.applications(round.workspaceId)._ctx.detail(round.applicationId)
                  .queryKey,
              }),
            ]);
            return result;
          }}
          onEnd={async () => {
            try {
              await end.mutateAsync();
            } catch {
              /* 保留会议以允许重试。 / Keep the meeting available for retry. */
            }
          }}
          ending={end.isPending}
          endError={end.isError}
        />
      </SkeletonSuspense>
    );
  }
  return (
    <HumanInterviewPreparation
      interviewer
      interview={{ ...data, ...round }}
      starting={join.isPending}
      error={join.error}
      onStart={async (selection) => {
        try {
          await join.mutateAsync();
          setDevices(selection);
          await client.invalidateQueries({
            queryKey: meetingQuery(round.workspaceId, round.id).queryKey,
          });
        } catch {
          /* 错误由 mutation 状态显示。 / Mutation state renders the error. */
        }
      }}
    >
      {left && (
        <output className="text-sm text-muted-foreground">{m.meeting_disconnected()}</output>
      )}
      <div>{back}</div>
    </HumanInterviewPreparation>
  );
}

export function InterviewerMeetingPage({
  workspaceId,
  roundId,
}: {
  workspaceId: string;
  roundId: string;
}) {
  const query = useQuery(meetingQuery(workspaceId, roundId));
  const phase = useSkeletonPhase(query.isPending);
  return (
    <InterviewEntryShell>
      {phase === "skeleton" && <CandidateInterviewSkeleton />}
      {phase === "ready" && query.data && <InterviewerMeeting key={roundId} data={query.data} />}
      {phase === "ready" && query.isError && !query.data && (
        <div className="flex max-w-md flex-col gap-4">
          <MeetingError error={query.error} />
          <Button variant="outline" onClick={() => query.refetch()}>
            {m.ats_retry()}
          </Button>
        </div>
      )}
    </InterviewEntryShell>
  );
}
