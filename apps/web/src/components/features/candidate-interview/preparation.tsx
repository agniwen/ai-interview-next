import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";
import type { CandidateInterview } from "./client";
import { InterviewDetails } from "./interview-details";
import { InterviewFlowProgress, interviewPreparationSteps } from "./flow-progress";
import type { PreparationStep } from "./flow-progress";
import { CandidateFormStage } from "./form-stage";
import { initialPreparationStep } from "./form-progress";
import { InterviewDeviceCheck } from "./device-check";

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

/**
 * 受控的单步视图，父组件决定当前步骤和前后切换；这里不持久化面试进度。
 * Controlled single-step view; the parent selects the step and navigation, and this view does not persist interview progress.
 */
export function PreparationStage({
  interview,
  step,
  onContinue,
  onBack,
  children,
}: {
  interview: CandidateInterview;
  step: PreparationStep;
  onContinue: () => void;
  onBack: () => void;
  children?: ReactNode;
}) {
  const questions = interview.questions?.form ?? [];
  const hasForms = questions.length > 0;
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
      <p className="mt-4 max-w-xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
        {descriptions[step]}
      </p>
      <p className="mt-2 text-xs text-muted-foreground wrap-anywhere">
        {m.interviews_round({ number: interview.sequence })}
        {interview.label ? ` · ${interview.label}` : ""}
      </p>
      {step === "forms" && children}
      {step === "ready" && <InterviewDeviceCheck hasForms={hasForms} onBack={onBack} />}
      {step === "intro" && (
        <div className="mt-8 flex w-full max-w-sm flex-col items-center">
          <InterviewDetails interview={interview} />
          <InterviewNotice />
          <div className="mt-8 flex w-full justify-center">
            <Button variant="outline" className="w-full sm:w-auto sm:min-w-32" onClick={onContinue}>
              {m.candidate_interview_next()}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 从已保存草稿或提交状态恢复准备步骤，连接介绍、作答与沟通准备页面。
 * Restores preparation from saved drafts or submission state and connects introduction, answers and conversation readiness.
 */
export function InterviewPreparation({
  interview,
  token,
}: {
  interview: CandidateInterview;
  token: string;
}) {
  const [step, setStep] = useState(() => initialPreparationStep(interview));
  const questions = interview.questions?.form ?? [];
  const hasForms = questions.length > 0;
  return (
    <PreparationStage
      interview={interview}
      step={step}
      onContinue={() => setStep(hasForms ? "forms" : "ready")}
      onBack={() => setStep(hasForms ? "forms" : "intro")}
    >
      {step === "forms" && (
        <CandidateFormStage
          questions={questions}
          interview={interview}
          token={token}
          onSubmitted={() => setStep("ready")}
          onBack={() => setStep("intro")}
        />
      )}
    </PreparationStage>
  );
}
