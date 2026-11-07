import { IconCheck, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export type PreparationStep = "intro" | "forms" | "ready";

export function interviewPreparationSteps(hasForms: boolean): PreparationStep[] {
  return hasForms ? ["intro", "forms", "ready"] : ["intro", "ready"];
}

export function InterviewFlowProgress({
  step,
  steps,
}: {
  step: PreparationStep;
  steps: PreparationStep[];
}) {
  const labels = {
    forms: m.candidate_step_forms(),
    intro: m.candidate_step_intro(),
    ready: m.candidate_step_ready(),
  };
  const currentIndex = steps.indexOf(step);
  return (
    <nav aria-label={m.candidate_interview_flow()} className="mb-9 max-w-full">
      <ol className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-card p-1 shadow-default">
        {steps.map((id, index) => (
          <li
            key={id}
            aria-current={id === step ? "step" : undefined}
            className="flex min-w-0 items-center gap-0.5"
          >
            {index > 0 && (
              <IconChevronRight aria-hidden="true" className="size-3 shrink-0 text-foreground/25" />
            )}
            <span
              className={cn(
                "flex min-h-7 items-center gap-1.5 rounded-full px-2 text-xs transition-colors motion-reduce:transition-none sm:px-3",
                id === step ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {index < currentIndex ? (
                <IconCheck
                  aria-hidden="true"
                  className="size-3.5 shrink-0 text-success-foreground"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="size-3 shrink-0 rounded-full border-[1.5px] border-current opacity-50"
                />
              )}
              <span>{labels[id]}</span>
              {index < currentIndex && (
                <span className="sr-only">{m.candidate_step_completed()}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
