import { useState } from "react";
import { IconMicrophone, IconVideo, IconVolume } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import * as m from "@/paraglide/messages";
import type { CandidateInterview } from "./client";
import { InterviewDetails } from "./interview-details";
import { InterviewFlowProgress, interviewPreparationSteps } from "./flow-progress";
import type { PreparationStep } from "./flow-progress";

function focusHeading(element: HTMLHeadingElement | null) {
  element?.focus({ preventScroll: true });
}

function InterviewNotice() {
  return (
    <section
      aria-label={m.candidate_interview_notice()}
      className="mt-6 w-full text-left text-xs leading-5 text-muted-foreground"
    >
      <h2 className="mb-2 font-medium text-foreground">{m.candidate_interview_notice()}</h2>
      <p>{m.candidate_interview_recording_notice()}</p>
      <p className="mt-2">{m.candidate_interview_camera_notice()}</p>
    </section>
  );
}

export function PreparationStage({
  interview,
  step,
  onContinue,
  onBack,
}: {
  interview: CandidateInterview;
  step: PreparationStep;
  onContinue: () => void;
  onBack: () => void;
}) {
  const hasForms = (interview.questions?.form.length ?? 0) > 0;
  const titles = {
    forms: m.candidate_form_heading(),
    intro: m.candidate_interview_welcome(),
    ready: m.candidate_ready_heading(),
  };
  const descriptions = {
    forms: m.candidate_form_intro({ count: interview.questions?.form.length ?? 0 }),
    intro:
      interview.kind === "ai"
        ? m.candidate_interview_ai_intro()
        : m.candidate_interview_human_intro(),
    ready: m.candidate_ready_intro(),
  };
  return (
    <>
      <InterviewFlowProgress step={step} steps={interviewPreparationSteps(hasForms)} />
      <h1
        key={step}
        tabIndex={-1}
        ref={focusHeading}
        className="text-balance text-3xl font-medium tracking-[-0.03em] outline-none sm:text-4xl"
      >
        {titles[step]}
      </h1>
      <p className="mt-4 text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
        {descriptions[step]}
      </p>
      <p className="mt-2 text-xs text-muted-foreground wrap-anywhere">
        {m.interviews_round({ number: interview.sequence })}
        {interview.label ? ` · ${interview.label}` : ""}
      </p>
      <div className="mt-8 flex w-full max-w-sm flex-col items-center">
        {step === "intro" && (
          <>
            <InterviewDetails interview={interview} />
            <InterviewNotice />
          </>
        )}
        {step === "forms" && (
          <section
            aria-label={m.candidate_form_heading()}
            className="w-full rounded-xl bg-card p-5 text-left text-sm leading-6 shadow-default"
          >
            <p>{m.candidate_form_requirements()}</p>
          </section>
        )}
        {step === "ready" && (
          <Card
            render={<section />}
            aria-label={m.candidate_ready_heading()}
            className="w-full p-5 text-left"
          >
            <ul className="flex flex-col gap-4 text-sm leading-6">
              <li className="flex items-start gap-3">
                <IconMicrophone
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-muted-foreground"
                />
                <span>{m.candidate_ready_microphone()}</span>
              </li>
              <li className="flex items-start gap-3">
                <IconVideo
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-muted-foreground"
                />
                <span>{m.candidate_ready_camera()}</span>
              </li>
              <li className="flex items-start gap-3">
                <IconVolume
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-muted-foreground"
                />
                <span>{m.candidate_ready_environment()}</span>
              </li>
            </ul>
          </Card>
        )}
        <div className="mt-8 flex w-full justify-center gap-2">
          {step === "intro" ? (
            <Button variant="outline" className="w-full sm:w-auto sm:min-w-32" onClick={onContinue}>
              {m.candidate_interview_next()}
            </Button>
          ) : (
            <Button variant="outline" className="w-full sm:w-auto sm:min-w-32" onClick={onBack}>
              {m.candidate_interview_back()}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

export function InterviewPreparation({ interview }: { interview: CandidateInterview }) {
  const [stepIndex, setStepIndex] = useState(0);
  const steps = interviewPreparationSteps((interview.questions?.form.length ?? 0) > 0);
  return (
    <PreparationStage
      interview={interview}
      step={steps[stepIndex]}
      onContinue={() => setStepIndex(1)}
      onBack={() => setStepIndex(0)}
    />
  );
}
