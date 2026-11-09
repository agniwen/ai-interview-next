import * as m from "@/paraglide/messages";
import type { InterviewRound } from "./client";

export function interviewKindLabel(kind: InterviewRound["kind"]) {
  return kind === "ai" ? m.interviews_ai() : m.interviews_human();
}

export function interviewRoundStatusLabel({
  kind,
  status,
}: Pick<InterviewRound, "kind" | "status">) {
  const labels: Record<string, string> = {
    completed: m.interviews_completed(),
    in_progress: m.interviews_in_progress(),
    scheduled: kind === "ai" ? m.interviews_not_started() : m.interviews_scheduled(),
  };
  return labels[status];
}
