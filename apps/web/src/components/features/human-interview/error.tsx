import * as m from "@/paraglide/messages";

export function MeetingError({ error }: { error: Error }) {
  const messages: Record<string, () => string> = {
    INTERVIEW_ADMISSION_CLOSED: m.meeting_closed,
    INTERVIEW_CONNECTION_UNAVAILABLE: m.meeting_unavailable,
    INTERVIEW_MEETING_FORBIDDEN: m.meeting_forbidden,
    INTERVIEW_TOO_EARLY: m.meeting_too_early,
    INTERVIEW_UNAVAILABLE: m.meeting_unavailable,
  };
  return (
    <p role="alert" className="text-sm leading-6 text-destructive-foreground">
      {(messages[error.message] ?? m.meeting_join_error)()}
    </p>
  );
}
