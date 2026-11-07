import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { CandidateInterview } from "@/components/features/candidate-interview/client";
import {
  InterviewPreparation,
  PreparationStage,
} from "@/components/features/candidate-interview/preparation";
import { interviewPreparationSteps } from "@/components/features/candidate-interview/flow-progress";
import { CandidateInterviewSkeleton } from "@/components/skeletons/pages/candidate-interview-skeleton";
import { InterviewEntryBackground } from "@/components/interview-entry-background";
import * as m from "@/paraglide/messages";

const interview = {
  admissionDeadline: null,
  jobTitle: "Platform Engineer",
  kind: "ai",
  label: "Technical discussion",
  questions: {
    capturedAt: "2026-11-07T00:00:00.000Z",
    conversationCount: 3,
    form: [{ content: "Your experience?", description: "", id: "form-question", type: "text" }],
    version: 1,
  },
  scheduledAt: null,
  sequence: 1,
  status: "scheduled",
  version: 1,
  workspaceName: "Hiring team name",
} satisfies CandidateInterview;

it("introduces the actual role, counts and recording policy without showing AI schedule fields", () => {
  const markup = renderToStaticMarkup(<InterviewPreparation interview={interview} />);
  expect(markup).toContain("Platform Engineer");
  expect(markup).toContain("Hiring team name");
  expect(markup).toContain(m.candidate_interview_ai_intro());
  expect(markup).toContain(m.question_sets_question_count({ count: 3 }));
  expect(markup).toContain(m.question_sets_question_count({ count: 1 }));
  expect(markup).toContain(m.candidate_interview_recording_notice());
  expect(markup).toContain(m.candidate_interview_camera_notice());
  expect(markup).toContain(m.candidate_interview_next());
  expect(markup).not.toContain(m.interviews_start());
  expect(markup).not.toContain(m.interviews_deadline());
  expect(markup).not.toContain("Your experience?");
});

it.each([false, true])(
  "moves from introduction to the correct next stage with forms: %s",
  (hasForms) => {
    const details: CandidateInterview = {
      ...interview,
      questions: { ...interview.questions, form: hasForms ? interview.questions.form : [] },
    };
    const steps = interviewPreparationSteps(hasForms);
    const markup = renderToStaticMarkup(
      <PreparationStage
        interview={details}
        step={steps[1]}
        onContinue={() => {}}
        onBack={() => {}}
      />,
    );
    expect(markup).toContain(hasForms ? m.candidate_form_heading() : m.candidate_ready_heading());
    expect(markup).toContain(m.candidate_interview_back());
    expect(markup).not.toContain(m.candidate_interview_next());
    expect(markup).toContain('aria-current="step"');
    expect(markup).toContain(m.candidate_step_completed());
    if (hasForms) {
      expect(markup).toContain(m.candidate_form_intro({ count: 1 }));
      expect(markup).toContain(m.candidate_form_requirements());
    } else {
      expect(markup).not.toContain(m.candidate_step_forms());
      expect(markup).toContain(m.candidate_ready_microphone());
      expect(markup).toContain(m.candidate_ready_camera());
    }
  },
);

it("shows human appointment instants with hydration-safe local time and no question stage", () => {
  const human: CandidateInterview = {
    ...interview,
    admissionDeadline: "2027-01-01T03:00:00.000Z",
    kind: "human",
    questions: null,
    scheduledAt: "2027-01-01T02:00:00.000Z",
  };
  const markup = renderToStaticMarkup(<InterviewPreparation interview={human} />);
  expect(markup).toContain(m.candidate_interview_human_intro());
  expect(markup).toContain(m.interviews_start());
  expect(markup).toContain(m.interviews_deadline());
  expect(markup).toContain('dateTime="2027-01-01T02:00:00.000Z"');
  expect(markup).toContain('dateTime="2027-01-01T03:00:00.000Z"');
  expect(markup).toContain('aria-busy="true"');
  expect(markup).not.toContain(m.candidate_step_forms());
});

it("renders a labelled skeleton without interactive placeholder controls", () => {
  const markup = renderToStaticMarkup(<CandidateInterviewSkeleton />);
  expect(markup).toContain('aria-busy="true"');
  expect(markup).toContain(m.candidate_interview_loading());
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).not.toMatch(/<(?:button|input|select|a)\b/u);
});

it("renders the same decorative grain on the server without browser APIs or random hydration data", () => {
  const first = renderToStaticMarkup(<InterviewEntryBackground />);
  expect(renderToStaticMarkup(<InterviewEntryBackground />)).toBe(first);
  expect(first).toContain('aria-hidden="true"');
  expect(first).not.toContain("canvas");
});
