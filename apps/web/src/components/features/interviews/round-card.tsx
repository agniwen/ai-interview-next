import { applicationDetailSearch } from "../ats/list-search";
import { Link, useLocation } from "@tanstack/react-router";
import { LocalTime, LocalTimeZone } from "@/components/local-time";
import {
  IconCalendarEvent,
  IconClipboardList,
  IconMessageCircle,
  IconRobot,
  IconPencil,
  IconTrash,
} from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Frame, FrameHeader, FramePanel, FrameTitle } from "@/components/ui/frame";
import {
  Popover,
  PopoverClose,
  PopoverDescription,
  PopoverPopup,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { UserColumn } from "@/components/user-column";
import * as m from "@/paraglide/messages";
import { deleteInterviewMutation } from "./client";
import type { InterviewRound } from "./client";
import { InvitationButton } from "./invitation-button";
import { EvaluationStatus } from "./evaluation-status";
import { interviewKindLabel, interviewRoundStatusLabel } from "./round-labels";

function DeleteInterviewPopover({
  round,
  workspaceId,
  applicationId,
}: {
  round: InterviewRound;
  workspaceId: string;
  applicationId: string;
}) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const remove = useMutation(deleteInterviewMutation(client, workspaceId, applicationId));
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label={m.interviews_delete_round({ number: round.sequence })}
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive-foreground"
                />
              }
              onClick={() => remove.reset()}
            />
          }
        >
          <IconTrash aria-hidden="true" />
        </TooltipTrigger>
        <TooltipPopup>{m.interviews_delete_round({ number: round.sequence })}</TooltipPopup>
      </Tooltip>
      <PopoverPopup align="end" className="w-80 max-w-[calc(100vw-2rem)]">
        <div className="flex flex-col gap-3">
          <PopoverTitle className="text-sm">
            {m.interviews_delete_round({ number: round.sequence })}
          </PopoverTitle>
          <PopoverDescription>{m.interviews_delete_help()}</PopoverDescription>
          {remove.isError && (
            <Alert variant="error">
              <AlertDescription>{m.interviews_delete_error()}</AlertDescription>
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <PopoverClose
              render={<Button variant="outline" size="sm" disabled={remove.isPending} />}
            >
              {m.interviews_cancel()}
            </PopoverClose>
            <Button
              variant="destructive"
              size="sm"
              loading={remove.isPending}
              onClick={() => remove.mutate(round.id, { onSuccess: () => setOpen(false) })}
            >
              <IconTrash aria-hidden="true" />
              {m.interviews_delete()}
            </Button>
          </div>
        </div>
      </PopoverPopup>
    </Popover>
  );
}

function ScheduledTime({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <IconCalendarEvent aria-hidden="true" className="size-3.5 shrink-0" />
        {label}
      </dt>
      <dd className="flex flex-col gap-0.5">
        <LocalTime
          value={value}
          format="time"
          className="text-xl font-medium tabular-nums tracking-tight"
        />
        <LocalTime value={value} format="weekdayDate" className="text-xs text-muted-foreground" />
      </dd>
    </div>
  );
}

/**
 * 面试轮次摘要卡，展示类型、人员、时间和题量，并承载编辑、删除与邀请操作。
 * Interview-round summary with type, people, schedule and question counts, plus edit, delete and invite actions.
 */
export function InterviewRoundCard({
  round,
  workspaceId,
  applicationId,
  onEdit,
}: {
  round: InterviewRound;
  workspaceId: string;
  applicationId: string;
  onEdit: () => void;
}) {
  const location = useLocation();
  const { questionSelection } = round;
  const ai = round.kind === "ai";
  return (
    <Frame className="min-w-0">
      <FrameHeader className="flex-row items-start justify-between gap-3 px-4 py-3">
        <FrameTitle className="min-w-0 self-center">
          <h4 className="wrap-anywhere leading-6">
            {m.interviews_round({ number: round.sequence })}
            {round.label ? ` · ${round.label}` : ""}
          </h4>
        </FrameTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={round.status === "completed" ? "success" : "info"}>
            {interviewRoundStatusLabel(round)}
          </Badge>
          {round.canEdit && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={m.interviews_edit()}
                    onClick={onEdit}
                  />
                }
              >
                <IconPencil aria-hidden="true" />
              </TooltipTrigger>
              <TooltipPopup>{m.interviews_edit()}</TooltipPopup>
            </Tooltip>
          )}
          {round.canDelete && (
            <DeleteInterviewPopover
              round={round}
              workspaceId={workspaceId}
              applicationId={applicationId}
            />
          )}
        </div>
      </FrameHeader>
      <FramePanel className="flex flex-col gap-4 p-4">
        {!ai && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b pb-4">
            <ScheduledTime label={m.interviews_start()} value={round.scheduledAt} />
            <ScheduledTime label={m.interviews_deadline()} value={round.admissionDeadline} />
            <div className="col-span-2 text-xs text-muted-foreground">
              <dt className="sr-only">{m.time_zone()}</dt>
              <dd>
                <LocalTimeZone />
              </dd>
            </div>
          </dl>
        )}
        <Badge variant="outline" className="w-fit">
          {interviewKindLabel(round.kind)}
        </Badge>
        {round.kind === "human" ? (
          <dl className="min-w-0">
            <dt className="mb-2 text-xs text-muted-foreground">{m.interviews_interviewers()}</dt>
            <dd className="flex flex-wrap gap-x-5 gap-y-2">
              {round.interviewers.map((person) => (
                <UserColumn key={person.id} user={person} className="max-w-full" />
              ))}
            </dd>
          </dl>
        ) : (
          <dl className="grid min-w-0 grid-cols-2 gap-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className="text-xs text-muted-foreground">{m.interviewer_agents_title()}</dt>
              <dd className="flex min-w-0 items-center gap-2 text-sm">
                <IconRobot aria-hidden="true" className="size-4.5 shrink-0 text-muted-foreground" />
                <span className="truncate" title={round.interviewerName ?? undefined}>
                  {round.interviewerName ?? "—"}
                </span>
              </dd>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <dt className="text-xs text-muted-foreground">{m.interviews_reviewer()}</dt>
              <dd className="min-w-0">
                {round.confirmationName ? (
                  <UserColumn
                    className="max-w-full"
                    user={{ image: round.confirmationImage, name: round.confirmationName }}
                  />
                ) : (
                  <span className="text-sm">{m.interviews_any_member()}</span>
                )}
              </dd>
            </div>
          </dl>
        )}
        {ai && (
          <div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconMessageCircle aria-hidden="true" className="size-3.5" />
              {m.interviews_conversation_count({
                count: questionSelection.conversationQuestionSetIds.length,
              })}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconClipboardList aria-hidden="true" className="size-3.5" />
              {m.interviews_form_count({ count: questionSelection.formQuestionSetIds.length })}
            </span>
          </div>
        )}
        {round.status === "completed" && (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <EvaluationStatus summary={round.evaluation} />
            <span>
              {m.interview_evaluation_progress({
                submitted: round.evaluation.submittedCount,
                total: round.evaluation.requiredCount,
              })}
            </span>
          </div>
        )}
        <div className="flex flex-wrap items-start gap-2">
          {round.status === "completed" ? (
            <Button
              size="sm"
              variant="outline"
              render={
                <Link
                  to="/w/$workspaceId/hub/applications/overlay/$id/result/$roundId"
                  params={{ id: applicationId, roundId: round.id, workspaceId }}
                  search={
                    location.pathname.includes("/applications/")
                      ? applicationDetailSearch.parse(location.search)
                      : { page: 1, pageSize: 20, search: "", tab: "interviews" }
                  }
                  mask={{
                    params: { id: applicationId, roundId: round.id, workspaceId },
                    to: "/w/$workspaceId/hub/applications/$id/result/$roundId",
                    unmaskOnReload: true,
                  }}
                />
              }
            >
              {m.interviews_view_record()}
            </Button>
          ) : (
            <>
              {round.canJoin && (
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      to="/meet/$workspaceId/$roundId"
                      params={{ roundId: round.id, workspaceId }}
                      rel="noopener noreferrer"
                      target="_blank"
                    />
                  }
                >
                  {m.meeting_join()}
                </Button>
              )}
              <InvitationButton kind={round.kind} workspaceId={workspaceId} roundId={round.id} />
            </>
          )}
        </div>
      </FramePanel>
    </Frame>
  );
}
