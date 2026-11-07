import type { CandidateFormAnswers, CandidateFormQuestion, CandidateInterview } from "./client";
import type { PreparationStep } from "./flow-progress";

export function isFormAnswerComplete(
  question: CandidateFormQuestion,
  value: CandidateFormAnswers[string] | undefined,
) {
  if (question.type === "text") {
    return typeof value === "string" && value.trim().length > 0 && value.length <= 30_000;
  }
  if (question.type === "single_choice") {
    return typeof value === "number";
  }
  return Array.isArray(value) && value.length > 0;
}

export function initialPreparationStep(interview: CandidateInterview): PreparationStep {
  if (interview.form?.submittedAt) {
    return "ready";
  }
  return interview.form ? "forms" : "intro";
}
