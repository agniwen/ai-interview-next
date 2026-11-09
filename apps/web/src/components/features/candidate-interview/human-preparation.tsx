import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { IconLogin } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { LocalTime, LocalTimeZone } from "@/components/local-time";
import * as m from "@/paraglide/messages";
import type { CandidateInterview } from "./client";
import { InterviewJobDescription } from "./role-context";
import type { InterviewDevices } from "./device-check";
import { MeetingError } from "../human-interview/error";
import { PrejoinMediaControls } from "../human-interview/prejoin-media-controls";

export function HumanInterviewPreparation({
  interview,
  onStart,
  starting,
  error,
  interviewerMaterials,
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
  >;
  onStart: (devices: InterviewDevices) => Promise<void>;
  starting?: boolean;
  error?: Error | null;
  interviewerMaterials?: ReactNode;
  children?: ReactNode;
}) {
  const interviewer = interviewerMaterials !== undefined;
  const [devices, setDevices] = useState<InterviewDevices>({
    cameraEnabled: false,
    microphoneEnabled: true,
  });
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
        <PrejoinMediaControls
          devices={devices}
          disabled={starting}
          onChange={(patch) => setDevices((current) => ({ ...current, ...patch }))}
        />
        <div className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:border-t max-md:bg-background max-md:px-5 max-md:pt-3 max-md:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            disabled={early || expired}
            loading={starting}
            size="lg"
            className="max-md:h-11 max-md:w-full md:min-w-36"
            onClick={() => onStart(devices)}
          >
            <IconLogin aria-hidden="true" />
            {m.meeting_enter_room()}
          </Button>
        </div>
        {!interviewer && (
          <p className="text-xs leading-5 text-muted-foreground">{m.candidate_human_contact()}</p>
        )}
        {children}
      </div>
      <section
        className="flex min-w-0 flex-col gap-6 pb-4 md:pt-1"
        aria-labelledby="interview-preparation-materials-title"
      >
        <h2 id="interview-preparation-materials-title" className="text-base font-semibold">
          {interviewer ? m.meeting_materials() : m.candidate_job_description()}
        </h2>
        {interviewer ? interviewerMaterials : <InterviewJobDescription interview={interview} />}
      </section>
    </section>
  );
}
