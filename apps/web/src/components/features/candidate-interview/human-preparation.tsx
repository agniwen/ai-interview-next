import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { LocalTime, LocalTimeZone } from "@/components/local-time";
import * as m from "@/paraglide/messages";
import type { CandidateInterview } from "./client";
import { InterviewJobDescription } from "./role-context";
import { InterviewDeviceCheck } from "./device-check";
import type { InterviewDevices } from "./device-check";
import { MeetingError } from "../human-interview/error";

export function HumanInterviewPreparation({
  interview,
  onStart,
  starting,
  error,
  interviewer = false,
  children,
}: {
  interview: Pick<
    CandidateInterview,
    | "jobTitle"
    | "jobDescription"
    | "candidateName"
    | "label"
    | "sequence"
    | "scheduledAt"
    | "admissionDeadline"
    | "workspaceName"
    | "startedAt"
  >;
  onStart?: (devices: InterviewDevices) => Promise<void>;
  starting?: boolean;
  error?: Error | null;
  interviewer?: boolean;
  children?: React.ReactNode;
}) {
  const [preparing, setPreparing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);
  const early =
    interview.scheduledAt !== null && now < Date.parse(interview.scheduledAt) - 10 * 60_000;
  const expired =
    interview.admissionDeadline !== null && now > Date.parse(interview.admissionDeadline);
  return (
    <section
      className="grid w-full max-w-5xl items-start gap-6 text-left md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-10 lg:gap-20"
      aria-labelledby="candidate-invitation-title"
    >
      <div className="flex min-w-0 flex-col gap-4 pr-1 md:sticky md:top-24 md:gap-6 [@media(min-height:800px)]:gap-8">
        <header className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {interviewer ? m.meeting_interviewer() : m.candidate_human_invitation()}
          </p>
          <h1
            id="candidate-invitation-title"
            className="text-balance text-2xl font-semibold leading-tight sm:text-3xl [@media(min-height:800px)]:sm:text-4xl"
          >
            {interview.jobTitle}
          </h1>
        </header>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 [@media(min-height:800px)]:gap-y-6">
          <div className="flex flex-col gap-1.5">
            <dt className="text-sm text-muted-foreground">{m.candidate_name()}</dt>
            <dd className="font-medium">{interview.candidateName}</dd>
          </div>
          <div className="flex flex-col gap-1.5">
            <dt className="text-sm text-muted-foreground">{m.candidate_round_label()}</dt>
            <dd className="font-medium">
              {interview.label || m.interviews_round({ number: interview.sequence })}
            </dd>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <dt className="text-sm text-muted-foreground">{m.interviews_start()}</dt>
            <dd className="font-medium">
              <LocalTime value={interview.scheduledAt} />
            </dd>
          </div>
          <div className="col-span-2 flex flex-col gap-1.5">
            <dt className="text-sm text-muted-foreground">{m.interviews_deadline()}</dt>
            <dd className="font-medium">
              <LocalTime value={interview.admissionDeadline} />
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          <LocalTimeZone />
        </p>
        <output className="text-sm leading-6 text-muted-foreground">
          {m.meeting_prejoin_help()}
        </output>
        {early && (
          <output className="text-sm text-muted-foreground">{m.meeting_too_early()}</output>
        )}
        {expired && <output className="text-sm text-muted-foreground">{m.meeting_closed()}</output>}
        {error && <MeetingError error={error} />}
        {preparing && !early && !expired ? (
          <InterviewDeviceCheck
            hasForms={false}
            onBack={() => setPreparing(false)}
            onStart={onStart}
            starting={starting}
            started={Boolean(interview.startedAt)}
          />
        ) : (
          <div>
            <Button
              disabled={early || expired}
              size="lg"
              variant="secondary"
              className="min-w-36"
              onClick={() => setPreparing(true)}
            >
              {m.candidate_ready_heading()}
            </Button>
          </div>
        )}
        {!interviewer && (
          <p className="text-xs leading-5 text-muted-foreground">{m.candidate_human_contact()}</p>
        )}
        {children}
      </div>
      <section
        className="flex min-w-0 flex-col gap-6 pb-4 md:pt-1"
        aria-labelledby="candidate-job-description-title"
      >
        <h2 id="candidate-job-description-title" className="text-base font-semibold">
          {m.candidate_job_description()}
        </h2>
        <InterviewJobDescription interview={interview} />
        <p className="text-sm text-muted-foreground">{interview.workspaceName}</p>
      </section>
    </section>
  );
}
