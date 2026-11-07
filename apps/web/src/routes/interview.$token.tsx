import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { CandidateInterviewEntry } from "@/components/features/candidate-interview/entry-page";
import { CandidateInterviewPageSkeleton } from "@/components/skeletons/pages/candidate-interview-skeleton";
import * as m from "@/paraglide/messages";

const routeApi = getRouteApi("/interview/$token");

function InterviewEntry() {
  const { token } = routeApi.useParams();
  return <CandidateInterviewEntry key={token} token={token} />;
}

export const Route = createFileRoute("/interview/$token")({
  // 只有浏览器实际呈现入口时才绑定题目，SSR 与路由预加载不执行进入请求。
  // Bind questions only when the browser renders the entry; SSR and route preloads do not send entry requests.
  ssr: false,
  pendingComponent: CandidateInterviewPageSkeleton,
  head: () => ({
    meta: [
      { title: `${m.candidate_interview_title()} — Sainoa` },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: InterviewEntry,
});
