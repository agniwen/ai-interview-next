import { lazy } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { InterviewEntryShell } from "@/components/interview-entry-shell";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { HumanInterviewPreparationSkeleton } from "@/components/skeletons/pages/human-interview-preparation-skeleton";
import { HumanMeetingSkeleton } from "@/components/skeletons/pages/human-meeting-skeleton";
import { Button } from "@/components/ui/button";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { HumanInterviewPreparation } from "../candidate-interview/human-preparation";
import {
  meetingQuery,
  joinInterviewerMeeting,
  enterInterviewerMeeting,
  endMeetingMutation,
} from "./client";
import type { HumanMeeting } from "./client";
import { useMeetingEntry } from "./use-meeting-entry";
import { MeetingError } from "./error";
import { MeetingEvaluation } from "./evaluation";
import { MeetingCandidateMaterials } from "./materials";
import * as m from "@/paraglide/messages";

const MeetingRoom = lazy(() => import("./room"));

function InterviewerMeeting({ data }: { data: HumanMeeting }) {
  const { round } = data;
  const client = useQueryClient();
  const entry = useMeetingEntry({
    connect: () => joinInterviewerMeeting(round.workspaceId, round.id),
    key: `meeting:${round.workspaceId}:${round.id}`,
    refresh: () =>
      client.invalidateQueries({ queryKey: meetingQuery(round.workspaceId, round.id).queryKey }),
    status: round.status,
  });
  const end = useMutation(
    endMeetingMutation(client, round.workspaceId, round.id, round.applicationId),
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
      </div>
    );
  }
  if (entry.devices && entry.connection) {
    const title = `${data.jobTitle} · ${data.candidateName}`;
    return (
      <SkeletonSuspense fallback={<HumanMeetingSkeleton interviewer title={title} />}>
        <MeetingRoom
          connection={entry.connection}
          devices={entry.devices}
          title={title}
          materials={data.materials}
          evaluation={<MeetingEvaluation workspaceId={round.workspaceId} roundId={round.id} />}
          onLeave={entry.handleLeave}
          onDevicesChange={entry.handleDevicesChange}
          onEntered={() => enterInterviewerMeeting(client, round)}
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
      interviewerMaterials={
        <MeetingCandidateMaterials materials={data.materials} showTimeline={false} />
      }
      interview={{ ...data, ...round }}
      initialDevices={entry.devices}
      starting={entry.isPending}
      error={entry.error}
      onStart={entry.handleStart}
    >
      {entry.departure && (
        <output className="text-sm text-muted-foreground">
          {entry.departure === "left" ? m.meeting_disconnected() : m.meeting_join_error()}
        </output>
      )}
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
      {phase === "skeleton" && <HumanInterviewPreparationSkeleton interviewer />}
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
