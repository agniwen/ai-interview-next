import { lazy } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { HumanMeetingSkeleton } from "@/components/skeletons/pages/human-meeting-skeleton";
import { HumanInterviewPreparation } from "../candidate-interview/human-preparation";
import type { CandidateInterview } from "../candidate-interview/client";
import { candidateInterviewQuery } from "../candidate-interview/client";
import { enterCandidateMeeting, joinCandidateMeeting } from "./client";
import { useMeetingEntry } from "./use-meeting-entry";
import * as m from "@/paraglide/messages";

const MeetingRoom = lazy(() => import("./room"));

export function HumanCandidateInterview({
  interview,
  token,
}: {
  interview: CandidateInterview;
  token: string;
}) {
  const client = useQueryClient();
  const entry = useMeetingEntry({
    connect: () => joinCandidateMeeting(token),
    key: token,
    refresh: () => client.invalidateQueries({ queryKey: candidateInterviewQuery(token).queryKey }),
    status: interview.status,
  });
  if (entry.devices && entry.connection) {
    const title = `${interview.jobTitle} · ${interview.candidateName}`;
    return (
      <SkeletonSuspense fallback={<HumanMeetingSkeleton title={title} />}>
        <MeetingRoom
          connection={entry.connection}
          devices={entry.devices}
          title={title}
          onLeave={entry.handleLeave}
          onDevicesChange={entry.handleDevicesChange}
          onEntered={() => enterCandidateMeeting(client, token)}
        />
      </SkeletonSuspense>
    );
  }
  return (
    <HumanInterviewPreparation
      interview={interview}
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
