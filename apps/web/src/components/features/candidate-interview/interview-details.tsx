import type { ReactNode } from "react";
import {
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconClipboardList,
  IconMessageCircle,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import { LocalTime, LocalTimeZone } from "@/components/local-time";
import { Card } from "@/components/ui/card";
import * as m from "@/paraglide/messages";
import type { CandidateInterview } from "./client";

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: TablerIcon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-12 items-start justify-between gap-4 px-3.5 py-3">
      <dt className="flex shrink-0 items-center gap-2 text-sm">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        {label}
      </dt>
      <dd className="min-w-0 text-right text-sm text-muted-foreground wrap-anywhere">{children}</dd>
    </div>
  );
}

export function InterviewDetails({ interview }: { interview: CandidateInterview }) {
  return (
    <Card
      render={<section />}
      aria-label={m.candidate_interview_details()}
      className="w-full text-left"
    >
      <h2 className="px-3.5 py-3 text-xs text-muted-foreground">
        {m.candidate_interview_details()}
      </h2>
      <dl className="divide-y divide-border/70 border-t border-border/70">
        <DetailRow icon={IconBriefcase} label={m.candidate_interview_role()}>
          {interview.jobTitle}
        </DetailRow>
        <DetailRow icon={IconBuilding} label={m.candidate_interview_team()}>
          {interview.workspaceName}
        </DetailRow>
        {interview.questions && (
          <>
            {interview.questions.form.length > 0 && (
              <DetailRow icon={IconClipboardList} label={m.question_sets_form()}>
                {m.question_sets_question_count({ count: interview.questions.form.length })}
              </DetailRow>
            )}
            <DetailRow icon={IconMessageCircle} label={m.question_sets_conversation()}>
              {m.question_sets_question_count({ count: interview.questions.conversationCount })}
            </DetailRow>
          </>
        )}
        {interview.kind === "human" && (
          <>
            <DetailRow icon={IconCalendarEvent} label={m.interviews_start()}>
              <LocalTime value={interview.scheduledAt} />
            </DetailRow>
            <DetailRow icon={IconCalendarEvent} label={m.interviews_deadline()}>
              <LocalTime value={interview.admissionDeadline} />
            </DetailRow>
          </>
        )}
      </dl>
      {interview.kind === "human" && (
        <p className="border-t border-border/70 px-3.5 py-3 text-xs text-muted-foreground">
          <LocalTimeZone />
        </p>
      )}
    </Card>
  );
}
