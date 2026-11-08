import { SkeletonSuspense } from "@/components/skeletons/skeleton-suspense";
import { lazy, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import * as m from "@/paraglide/messages";
import type { CandidateInterview } from "./client";
import { candidateStartMutation } from "./client";
import type { InterviewDevices } from "./device-check";
import { InterviewConversationSkeleton } from "@/components/skeletons/pages/interview-conversation-skeleton";
import {
  readInterviewResumeState,
  restoredInterviewDevices,
  saveInterviewResumeState,
} from "./resume-state";
import { InterviewDetails } from "./interview-details";
import { InterviewFlowProgress, interviewPreparationSteps } from "./flow-progress";
import type { PreparationStep } from "./flow-progress";
import { CandidateFormStage } from "./form-stage";
import { initialPreparationStep } from "./form-progress";
import { InterviewDeviceCheck } from "./device-check";
import { InterviewNotice } from "./notice";
import { HumanCandidateInterview } from "../human-interview/candidate";

const InterviewConversation = lazy(() => import("./conversation"));

function focusHeading(element: HTMLHeadingElement | null) {
  element?.focus({ preventScroll: true });
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
  devices,
}: {
  interview: CandidateInterview;
  step: PreparationStep;
  onContinue: () => void;
  onBack: () => void;
  children?: ReactNode;
  devices?: ReactNode;
}) {
  const questions = interview.questions?.form ?? [];
  const hasForms = questions.length > 0;
  const titles = {
    forms: m.candidate_form_heading(),
    intro: m.candidate_welcome_name({ name: interview.candidateName }),
    ready: m.candidate_welcome_name({ name: interview.candidateName }),
  };
  const descriptions = {
    forms: m.candidate_form_intro({ count: interview.questions?.form.length ?? 0 }),
    intro:
      interview.kind === "ai"
        ? m.candidate_interview_ai_intro()
        : m.candidate_interview_human_intro(),
    ready: m.candidate_interview_ai_intro(),
  };
  return (
    <>
      {hasForms && (
        <InterviewFlowProgress step={step} steps={interviewPreparationSteps(hasForms)} />
      )}
      <h1
        key={step}
        tabIndex={-1}
        ref={focusHeading}
        className="text-balance text-3xl tracking-[-0.03em] outline-none sm:text-4xl"
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
      {step === "ready" &&
        (devices ?? (
          <InterviewDeviceCheck
            hasForms={hasForms}
            onBack={onBack}
            details={<InterviewDetails interview={interview} embedded />}
          />
        ))}
      {step === "intro" && (
        <div className="mt-8 flex w-full max-w-sm flex-col items-center">
          <InterviewDetails interview={interview} />
          <div className="mt-8 flex w-full justify-center">
            <Button className="w-full sm:w-auto sm:min-w-32" onClick={onContinue}>
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
  const [devices, setDevices] = useState<InterviewDevices | null>(() =>
    interview.kind === "ai"
      ? restoredInterviewDevices(interview.status, readInterviewResumeState(token))
      : null,
  );
  const [pendingDevices, setPendingDevices] = useState<InterviewDevices | null>(null);
  const start = useMutation(candidateStartMutation(useQueryClient(), token));
  const questions = interview.questions?.form ?? [];
  const hasForms = questions.length > 0;
  const started = Boolean(interview.startedAt) || start.isSuccess;
  if (interview.kind === "human") {
    return <HumanCandidateInterview interview={interview} token={token} />;
  }
  if (devices) {
    return (
      <SkeletonSuspense fallback={<InterviewConversationSkeleton />}>
        <InterviewConversation
          token={token}
          devices={devices}
          startedAt={interview.startedAt}
          onLeave={() => setDevices(null)}
        />
      </SkeletonSuspense>
    );
  }
  async function startConversation(selection: InterviewDevices) {
    try {
      if (!started) {
        await start.mutateAsync();
      }
      saveInterviewResumeState(token, selection, true);
      setPendingDevices(null);
      setDevices(selection);
    } catch {
      // 失败时保留须知和设备选择，让候选人可以重试。
      // Keep the notice and selected devices available for retry after a failed start.
    }
  }
  if (pendingDevices) {
    return (
      <InterviewNotice
        pending={start.isPending}
        error={start.isError}
        onBack={() => setPendingDevices(null)}
        onConfirm={() => {
          void startConversation(pendingDevices);
        }}
      />
    );
  }
  return (
    <PreparationStage
      interview={interview}
      step={step}
      onContinue={() => setStep(hasForms ? "forms" : "ready")}
      onBack={() => setStep(hasForms ? "forms" : "intro")}
      devices={
        <InterviewDeviceCheck
          hasForms={hasForms}
          started={started}
          starting={start.isPending}
          error={start.isError}
          onBack={() => setStep(hasForms ? "forms" : "intro")}
          details={<InterviewDetails interview={interview} embedded />}
          onStart={async (selection) => {
            if (started) {
              await startConversation(selection);
            } else {
              setPendingDevices(selection);
            }
          }}
        />
      }
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
