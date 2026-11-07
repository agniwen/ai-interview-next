import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toastManager } from "@/components/ui/toast";
import { Toolbar, ToolbarButton } from "@/components/ui/toolbar";
import * as m from "@/paraglide/messages";
import { candidateFormMutation } from "./client";
import type { CandidateFormContent, CandidateFormQuestion, CandidateInterview } from "./client";
import { FormQuestion } from "./form-question";
import { isFormAnswerComplete } from "./form-progress";

/**
 * 表单作答与草稿自动保存；提交或返回前立即保存当前答案，成功提交后才进入沟通准备。
 * Owns form answers and autosave; saves current answers before submitting or going back, and advances only after submission succeeds.
 */
export function CandidateFormStage({
  interview,
  questions,
  token,
  onSubmitted,
  onBack,
}: {
  interview: CandidateInterview;
  questions: CandidateFormQuestion[];
  token: string;
  onSubmitted: () => void;
  onBack: () => void;
}) {
  const [content, setContent] = useState<CandidateFormContent>(
    () => interview.form?.content ?? { answers: {}, version: 1 },
  );
  const [savedContent, setSavedContent] = useState(content);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const options = candidateFormMutation(useQueryClient(), token);
  const mutation = useMutation({
    ...options,
    onSuccess: (...args) => {
      options.onSuccess?.(...args);
      setSavedContent(args[1].content);
    },
  });
  useEffect(() => () => clearTimeout(timer.current), []);
  const submitting = mutation.isPending && mutation.variables.submit;
  const locked = interview.status !== "scheduled";

  let saveStatus = m.candidate_form_autosave();
  if (interview.form || mutation.isSuccess) {
    saveStatus = m.candidate_form_saved();
  }
  if (mutation.isPending || content !== savedContent) {
    saveStatus = m.candidate_form_saving();
  }

  function save(submit: boolean, onSuccess?: () => void) {
    if (submit) {
      const incomplete = questions.findIndex(
        (question) => !isFormAnswerComplete(question, content.answers[question.id]),
      );
      if (incomplete !== -1) {
        toastManager.add({
          title: m.candidate_form_incomplete({ number: incomplete + 1 }),
          type: "error",
        });
        return;
      }
    }
    clearTimeout(timer.current);
    mutation.mutate({ content, submit }, { onSuccess });
  }

  return (
    <div className="mt-8 flex w-full flex-col gap-6 pb-4">
      <Card className="gap-5 p-5 text-left sm:p-6">
        {questions.map((question, index) => (
          <FormQuestion
            key={question.id}
            question={question}
            index={index}
            value={content.answers[question.id]}
            disabled={locked || submitting}
            onChange={(value) => {
              const next = {
                answers: { ...content.answers, [question.id]: value },
                version: 1 as const,
              };
              setContent(next);
              clearTimeout(timer.current);
              timer.current = setTimeout(
                () => mutation.mutate({ content: next, submit: false }),
                600,
              );
            }}
          />
        ))}
      </Card>
      <div className="text-sm text-muted-foreground" aria-live="polite">
        {locked && <p>{m.candidate_form_locked()}</p>}
        {!locked && mutation.isError && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-center gap-2 text-destructive-foreground"
          >
            <span>{m.candidate_form_save_failed()}</span>
            <Button variant="outline" size="sm" onClick={() => save(false)}>
              {m.ats_retry()}
            </Button>
          </div>
        )}
        {!locked && !mutation.isError && <p>{saveStatus}</p>}
      </div>
      <Toolbar
        aria-label={m.ats_action()}
        className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-20 mx-auto w-fit max-w-full items-center gap-1 border-border/70 bg-card/95 p-1.5 shadow-xs/5 backdrop-blur-md"
      >
        <ToolbarButton
          render={<Button variant="outline" size="sm" />}
          disabled={mutation.isPending}
          onClick={() => (content === savedContent || locked ? onBack() : save(false, onBack))}
        >
          {m.candidate_interview_back()}
        </ToolbarButton>
        <ToolbarButton
          render={<Button variant="outline" size="sm" loading={submitting} />}
          disabled={locked || mutation.isPending}
          onClick={() => save(true, onSubmitted)}
        >
          {m.candidate_form_submit()}
        </ToolbarButton>
      </Toolbar>
    </div>
  );
}
