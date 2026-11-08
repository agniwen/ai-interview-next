import { lazy, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { HumanMeetingSkeleton } from "@/components/skeletons/pages/human-meeting-skeleton";
import { HumanInterviewPreparation } from "../candidate-interview/human-preparation";
import type { InterviewDevices } from "../candidate-interview/device-check";
import type { CandidateInterview } from "../candidate-interview/client";
import { candidateInterviewQuery } from "../candidate-interview/client";
import { enterCandidateMeeting, joinCandidateMeeting } from "./client";
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
  const [devices, setDevices] = useState<InterviewDevices | null>(null);
  const [left, setLeft] = useState(false);
  const join = useMutation({ mutationFn: () => joinCandidateMeeting(token) });
  async function leave() {
    setDevices(null);
    setLeft(true);
    join.reset();
    await client.invalidateQueries({ queryKey: candidateInterviewQuery(token).queryKey });
  }
  if (devices && join.data) {
    return (
      <SkeletonSuspense fallback={<HumanMeetingSkeleton />}>
        <MeetingRoom
          connection={join.data}
          devices={devices}
          title={`${interview.jobTitle} · ${interview.candidateName}`}
          onLeave={leave}
          onEntered={async () => {
            const result = await enterCandidateMeeting(token);
            await client.invalidateQueries({ queryKey: candidateInterviewQuery(token).queryKey });
            return result;
          }}
        />
      </SkeletonSuspense>
    );
  }
  return (
    <HumanInterviewPreparation
      interview={interview}
      starting={join.isPending}
      error={join.error}
      onStart={async (selection) => {
        try {
          await join.mutateAsync();
          setDevices(selection);
          await client.invalidateQueries({ queryKey: candidateInterviewQuery(token).queryKey });
        } catch {
          /* 错误由 mutation 状态显示。 / Mutation state renders the error. */
        }
      }}
    >
      {left && (
        <output className="text-sm text-muted-foreground">{m.meeting_disconnected()}</output>
      )}
    </HumanInterviewPreparation>
  );
}
