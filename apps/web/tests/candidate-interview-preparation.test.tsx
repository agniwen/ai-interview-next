import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { CandidateInterview } from "@/components/features/candidate-interview/client";
import {
  InterviewPreparation,
  PreparationStage,
} from "@/components/features/candidate-interview/preparation";
import { interviewPreparationSteps } from "@/components/features/candidate-interview/flow-progress";
import { CandidateInterviewSkeleton } from "@/components/skeletons/pages/candidate-interview-skeleton";
import { InterviewNotice } from "@/components/features/candidate-interview/notice";
import { InterviewEntryBackground } from "@/components/interview-entry-background";
import * as m from "@/paraglide/messages";
import {
  initialPreparationStep,
  isFormAnswerComplete,
} from "@/components/features/candidate-interview/form-progress";
import { CandidateFormStage } from "@/components/features/candidate-interview/form-stage";

function renderWithQuery(children: ReactNode) {
  return renderToStaticMarkup(
    <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>,
  );
}

const token = "a".repeat(64);

const interview = {
  admissionDeadline: null,
  candidateName: "Test Candidate",
  endedAt: null,
  feedback: null,
  form: null,
  jobDescription: "Build reliable systems.",
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
  startedAt: null,
  status: "scheduled",
  version: 1,
  workspaceName: "Hiring team name",
} satisfies CandidateInterview;

it("introduces the candidate, actual role and counts without showing AI schedule fields", () => {
  const markup = renderWithQuery(<InterviewPreparation interview={interview} token={token} />);
  expect(markup).toContain("Platform Engineer");
  expect(markup).toContain("Hiring team name");
  expect(markup).toContain(m.candidate_interview_ai_intro());
  expect(markup).toContain(m.question_sets_question_count({ count: 3 }));
  expect(markup).toContain(m.question_sets_question_count({ count: 1 }));
  expect(markup).toContain(m.candidate_welcome_name({ name: interview.candidateName }));
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
    const markup = renderWithQuery(
      <PreparationStage interview={details} step={steps[1]} onContinue={() => {}} onBack={() => {}}>
        {hasForms && (
          <QueryClientProvider client={new QueryClient()}>
            <CandidateFormStage
              questions={details.questions?.form ?? []}
              interview={details}
              token={token}
              onSubmitted={() => {}}
              onBack={() => {}}
            />
          </QueryClientProvider>
        )}
      </PreparationStage>,
    );
    expect(markup).toContain(
      hasForms
        ? m.candidate_form_heading()
        : m.candidate_welcome_name({ name: interview.candidateName }),
    );
    expect(markup).toContain(m.candidate_interview_back());
    expect(markup).not.toContain(m.candidate_interview_next());
    if (hasForms) {
      expect(markup).toContain('aria-current="step"');
      expect(markup).toContain(m.candidate_step_completed());
    } else {
      expect(markup).not.toContain('aria-current="step"');
    }
    if (hasForms) {
      expect(markup).toContain(m.candidate_form_intro({ count: 1 }));
      expect(markup).not.toContain(m.candidate_form_requirements());
    } else {
      expect(markup).not.toContain(`>${m.candidate_step_forms()}</span>`);
      expect(markup).toContain(m.candidate_device_check_microphone());
      expect(markup).toContain(m.candidate_device_camera_optional());
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
  const markup = renderWithQuery(<InterviewPreparation interview={human} token={token} />);
  expect(markup).toContain(m.meeting_prejoin_help());
  expect(markup).toContain(m.interviews_start());
  expect(markup).toContain(m.interviews_deadline());
  expect(markup).toContain('dateTime="2027-01-01T02:00:00.000Z"');
  expect(markup).toContain('dateTime="2027-01-01T03:00:00.000Z"');
  expect(markup).toContain('aria-busy="true"');
  expect(markup).not.toContain(`>${m.candidate_step_forms()}</span>`);
});

it("resumes a draft at the form and a submitted form at preparation", () => {
  expect(initialPreparationStep(interview)).toBe("intro");
  const form = {
    content: { answers: {}, version: 1 as const },
    submittedAt: null,
    updatedAt: "2026-11-07T00:00:00Z",
    version: 1 as const,
  };
  expect(initialPreparationStep({ ...interview, form })).toBe("forms");
  expect(
    initialPreparationStep({ ...interview, form: { ...form, submittedAt: form.updatedAt } }),
  ).toBe("ready");
  const markup = renderWithQuery(
    <InterviewPreparation
      interview={{ ...interview, form: { ...form, submittedAt: form.updatedAt } }}
      token={token}
    />,
  );
  expect(markup).toContain(m.candidate_welcome_name({ name: interview.candidateName }));
  expect(markup).toContain(m.candidate_form_edit());
});

it("requires meaningful text and a choice, including option zero", () => {
  const [text] = interview.questions.form;
  expect(isFormAnswerComplete(text, "  \n")).toBe(false);
  expect(isFormAnswerComplete(text, "**Experience**")).toBe(true);
  expect(isFormAnswerComplete(text, "x".repeat(30_001))).toBe(false);
  const single = { ...text, options: ["A", "B"], type: "single_choice" as const };
  expect(isFormAnswerComplete(single, 0)).toBe(true);
  expect(isFormAnswerComplete(single, null)).toBe(false);
  const multi = { ...single, type: "multiple_choice" as const };
  expect(isFormAnswerComplete(multi, [])).toBe(false);
  expect(isFormAnswerComplete(multi, [0, 1])).toBe(true);
});

it("renders saved choice answers and locks controls once conversation starts", () => {
  const details: CandidateInterview = {
    ...interview,
    form: {
      content: { answers: { multi: [1], single: 0 }, version: 1 },
      submittedAt: null,
      updatedAt: "2026-11-07T00:00:00Z",
      version: 1,
    },
    questions: {
      ...interview.questions,
      form: [
        {
          content: "**Choose one**",
          description: "Pick one option",
          id: "single",
          options: ["A", "B"],
          type: "single_choice",
        },
        {
          content: "Choose several",
          description: "",
          id: "multi",
          options: ["X", "Y"],
          type: "multiple_choice",
        },
      ],
    },
    status: "in_progress",
  };
  const markup = renderWithQuery(
    <QueryClientProvider client={new QueryClient()}>
      <CandidateFormStage
        questions={details.questions?.form ?? []}
        interview={details}
        token={token}
        onSubmitted={() => {}}
        onBack={() => {}}
      />
    </QueryClientProvider>,
  );
  expect(markup).toContain("<strong>Choose one</strong>");
  expect(markup).not.toContain(m.candidate_form_progress({ completed: 2, total: 2 }));
  expect(markup).toContain(m.candidate_form_locked());
  expect(markup).toContain('aria-checked="true"');
  expect(markup).toContain("disabled");
});

it("renders a labelled skeleton without interactive placeholder controls", () => {
  const markup = renderWithQuery(<CandidateInterviewSkeleton />);
  expect(markup).toContain('aria-busy="true"');
  expect(markup).toContain(m.candidate_interview_loading());
  expect(markup).toContain('aria-hidden="true"');
  expect(markup).not.toMatch(/<(?:button|input|select|a)\b/u);
});

it("renders the same decorative grain on the server without browser APIs or random hydration data", () => {
  const first = renderWithQuery(<InterviewEntryBackground />);
  expect(renderWithQuery(<InterviewEntryBackground />)).toBe(first);
  expect(first).toContain('aria-hidden="true"');
  expect(first).not.toContain("canvas");
});

it("restores an already-started interview to device setup, without reopening forms", () => {
  expect(
    initialPreparationStep({
      ...interview,
      startedAt: "2026-11-08T00:00:00Z",
      status: "in_progress",
    }),
  ).toBe("ready");
});

it("shows the actual recording and reconnect policy at the final checkpoint", () => {
  const markup = renderWithQuery(
    <InterviewNotice pending={false} error={false} onBack={() => {}} onConfirm={() => {}} />,
  );
  expect(markup).toContain(m.candidate_interview_recording_notice());
  expect(markup).toContain(m.candidate_interview_camera_notice());
  expect(markup).toContain(m.candidate_notice_reconnect());
  expect(markup).toContain(m.candidate_session_start());
});

it("opens device preparation directly when the AI round has no forms", () => {
  const details: CandidateInterview = {
    ...interview,
    questions: { ...interview.questions, form: [] },
  };
  expect(initialPreparationStep(details)).toBe("ready");
  const markup = renderWithQuery(<InterviewPreparation interview={details} token={token} />);
  expect(markup).toContain(m.candidate_device_check_microphone());
  expect(markup).toContain(m.candidate_start_muted());
  expect(markup).not.toContain('aria-current="step"');
});
