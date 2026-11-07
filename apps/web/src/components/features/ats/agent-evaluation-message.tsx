import { IconChevronLeft, IconChevronRight, IconRefresh } from "@tabler/icons-react";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
import { Button } from "@/components/ui/button";
import { Message, MessageAvatar, MessageContent, MessageHeader } from "@/components/ui/message";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import * as m from "@/paraglide/messages";
import type { ApplicationDetail } from "./application-detail-page";
import { atsDate } from "./client";
import { EvaluationResult } from "./evaluation-result";

export function AgentEvaluationMessage({
  application,
  versions,
  onReevaluate,
  reevaluating,
}: {
  application: Pick<ApplicationDetail["application"], "closedAt" | "evaluationStatus">;
  versions: ApplicationDetail["evaluations"];
  onReevaluate: () => void;
  reevaluating: boolean;
}) {
  const [index, setIndex] = useState(versions.length - 1);
  const evaluation = versions[index];
  const processing =
    application.evaluationStatus === "queued" || application.evaluationStatus === "running";
  let pendingLabel = m.ats_empty_evaluations();
  if (processing) {
    pendingLabel = m.ats_evaluation_processing();
  } else if (application.evaluationStatus === "failed") {
    pendingLabel = m.ats_evaluation_failed();
  }

  return (
    <Message>
      <MessageAvatar className="self-start">
        <BrandMark className="size-8" />
      </MessageAvatar>
      <MessageContent className="sm:pe-11">
        <MessageHeader className="flex-wrap gap-x-2 gap-y-1">
          <span>{m.ats_evaluation_ai()}</span>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={m.ats_evaluation_previous_version()}
                    size="icon-xs"
                    variant="ghost"
                    disabled={index <= 0}
                    onClick={() => setIndex(index - 1)}
                  />
                }
              >
                <IconChevronLeft aria-hidden="true" />
              </TooltipTrigger>
              <TooltipPopup>{m.ats_evaluation_previous_version()}</TooltipPopup>
            </Tooltip>
            {evaluation && (
              <span
                className="px-1 tabular-nums"
                aria-label={m.ats_evaluation_version({
                  current: index + 1,
                  total: versions.length,
                })}
              >
                {index + 1} / {versions.length}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label={m.ats_evaluation_next_version()}
                    size="icon-xs"
                    variant="ghost"
                    disabled={index >= versions.length - 1}
                    onClick={() => setIndex(index + 1)}
                  />
                }
              >
                <IconChevronRight aria-hidden="true" />
              </TooltipTrigger>
              <TooltipPopup>{m.ats_evaluation_next_version()}</TooltipPopup>
            </Tooltip>
            {!application.closedAt && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label={m.ats_evaluation_regenerate()}
                      size="icon-xs"
                      variant="ghost"
                      disabled={processing}
                      loading={reevaluating}
                      onClick={onReevaluate}
                    />
                  }
                >
                  <IconRefresh aria-hidden="true" />
                </TooltipTrigger>
                <TooltipPopup>{m.ats_evaluation_regenerate()}</TooltipPopup>
              </Tooltip>
            )}
          </div>
          {evaluation && (
            <time dateTime={evaluation.createdAt}>{atsDate(evaluation.createdAt, "short")}</time>
          )}
        </MessageHeader>
        <Bubble variant="muted" className="w-full max-w-full">
          <BubbleContent className="flex w-full flex-col gap-4 px-4 py-3">
            {(!evaluation || processing || application.evaluationStatus === "failed") && (
              <output
                className="flex items-center gap-2 text-sm text-muted-foreground"
                aria-live="polite"
              >
                {processing && <Spinner />}
                {pendingLabel}
              </output>
            )}
            {evaluation && <EvaluationResult key={evaluation.id} result={evaluation.result} />}
          </BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}
