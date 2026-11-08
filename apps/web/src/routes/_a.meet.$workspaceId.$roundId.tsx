import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { InterviewerMeetingPage } from "@/components/features/human-interview/interviewer";
import { CandidateInterviewPageSkeleton } from "@/components/skeletons/pages/candidate-interview-skeleton";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/_a/meet/$workspaceId/$roundId");

function MeetingPage() {
  const { workspaceId, roundId } = routeApi.useParams();
  return <InterviewerMeetingPage workspaceId={workspaceId} roundId={roundId} />;
}

export const Route = createFileRoute("/_a/meet/$workspaceId/$roundId")({
  component: MeetingPage,
  pendingComponent: CandidateInterviewPageSkeleton,
  head: () => ({
    meta: [
      { title: `${m.meeting_title()} — Sainoa` },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
});
