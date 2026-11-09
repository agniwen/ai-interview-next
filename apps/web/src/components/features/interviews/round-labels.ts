import * as m from "@/paraglide/messages";
import type { InterviewRound } from "./client";

const flowStatuses: Record<
  string,
  { label: () => string; variant: "info" | "secondary" | "success" }
> = {
  completed: { label: m.interviews_completed, variant: "success" },
  in_progress: { label: m.interviews_in_progress, variant: "info" },
  scheduled: { label: m.interviews_not_started, variant: "secondary" },
};

export function interviewKindLabel(kind: InterviewRound["kind"]) {
  return kind === "ai" ? m.interviews_ai() : m.interviews_human();
}

export function interviewFlowStatus(status: InterviewRound["status"]) {
  return flowStatuses[status];
}

export function interviewRoundStatusLabel({
  kind,
  status,
}: Pick<InterviewRound, "kind" | "status">) {
  return kind === "human" && status === "scheduled"
    ? m.interviews_scheduled()
    : interviewFlowStatus(status).label();
}
