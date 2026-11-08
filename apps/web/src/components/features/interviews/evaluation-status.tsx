import { Badge } from "@/components/ui/badge";
import * as m from "@/paraglide/messages";
import type { EvaluationDraft, InterviewResult } from "./client";

export function evaluationConclusionLabel(value: EvaluationDraft["conclusion"]) {
  if (value === "pass") {
    return m.interview_evaluation_pass();
  }
  if (value === "fail") {
    return m.interview_evaluation_fail();
  }
  if (value === "pending") {
    return m.interview_evaluation_pending();
  }
  return m.interview_evaluation_unconfirmed();
}

export function EvaluationStatus({
  summary,
}: {
  summary: InterviewResult["evaluation"]["summary"];
}) {
  let variant: "success" | "warning" | "error" = "warning";
  if (summary.complete) {
    variant = summary.conclusion === "fail" ? "error" : "success";
  }
  return (
    <Badge variant={variant}>
      {summary.complete
        ? evaluationConclusionLabel(summary.conclusion)
        : m.interview_evaluation_unconfirmed()}
    </Badge>
  );
}
