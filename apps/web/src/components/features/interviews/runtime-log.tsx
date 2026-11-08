import { IconCircleCheck, IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import * as m from "@/paraglide/messages";
import type { InterviewResult } from "./client";
import { ResultSection } from "./result-section";

export function interviewRuntimeState(data: {
  round: { status: string };
  events: Pick<InterviewResult["events"][number], "content">[];
}) {
  if (data.round.status === "completed") {
    return "completed";
  }
  // 共享类型检查使用 ES2022，先复制再反转，不修改查询缓存。
  // Shared type checks target ES2022; reverse a copy without mutating cached data.
  // oxlint-disable-next-line unicorn/no-array-reverse
  const newest = [...data.events].reverse();
  const model = newest.find(({ content }) =>
    [
      "agent_started",
      "agent_resumed",
      "agent_ready",
      "agent_closed",
      "system_error",
      "realtime_reconnecting",
      "realtime_reconnected",
      "realtime_failed",
    ].includes(content.kind),
  );
  if (model && ["system_error", "realtime_failed", "agent_closed"].includes(model.content.kind)) {
    return "interrupted";
  }
  if (
    model &&
    ["realtime_reconnecting", "agent_started", "agent_resumed"].includes(model.content.kind)
  ) {
    return "reconnecting";
  }
  const presence = newest.find(({ content }) =>
    ["candidate_connected", "room_reconnected", "candidate_left"].includes(content.kind),
  );
  if (presence?.content.kind === "candidate_left") {
    return "paused";
  }
  const connection = newest.find(({ content }) =>
    [
      "candidate_connected",
      "candidate_disconnected",
      "candidate_left",
      "room_reconnecting",
      "room_reconnected",
      "room_disconnected",
    ].includes(content.kind),
  );
  if (
    connection &&
    ["candidate_disconnected", "room_disconnected"].includes(connection.content.kind)
  ) {
    return "interrupted";
  }
  if (connection?.content.kind === "room_reconnecting") {
    return "reconnecting";
  }
  return "active";
}

export function RuntimeBadge({ data }: { data: InterviewResult }) {
  const state = interviewRuntimeState(data);
  const labels = {
    active: m.interviews_in_progress,
    completed: m.interviews_completed,
    interrupted: m.interviews_interrupted,
    paused: m.interviews_paused,
    reconnecting: m.interviews_reconnecting,
  };
  const variants = {
    active: "info",
    completed: "success",
    interrupted: "warning",
    paused: "info",
    reconnecting: "info",
  } as const;
  const icons = {
    active: IconRefresh,
    completed: IconCircleCheck,
    interrupted: IconAlertCircle,
    paused: IconRefresh,
    reconnecting: IconRefresh,
  };
  const Icon = icons[state];
  return (
    <Badge variant={variants[state]} size="lg">
      <Icon />
      {labels[state]()}
    </Badge>
  );
}

export function InterviewRuntimeLog({ data }: { data: InterviewResult }) {
  const labels = {
    agent_closed: m.interviews_event_agent_closed,
    agent_ready: m.interviews_event_agent_ready,
    agent_resumed: m.interviews_event_agent_resumed,
    agent_started: m.interviews_event_agent_started,
    candidate_connected: m.interviews_event_candidate_connected,
    candidate_disconnected: m.interviews_event_candidate_disconnected,
    candidate_left: m.interviews_event_candidate_left,
    interview_ended: m.interviews_event_interview_ended,
    realtime_failed: m.interviews_event_realtime_failed,
    realtime_reconnected: m.interviews_event_realtime_reconnected,
    realtime_reconnecting: m.interviews_event_realtime_reconnecting,
    realtime_rotated: m.interviews_event_realtime_rotated,
    report_failed: m.interviews_event_report_failed,
    report_ready: m.interviews_event_report_ready,
    room_disconnected: m.interviews_event_room_disconnected,
    room_reconnected: m.interviews_event_room_reconnected,
    room_reconnecting: m.interviews_event_room_reconnecting,
    system_error: m.interviews_event_system_error,
  };
  const sources = {
    agent: m.interviews_event_source_agent,
    candidate: m.interviews_event_source_candidate,
    system: m.interviews_event_source_system,
  };
  return (
    <ResultSection
      icon={IconRefresh}
      title={m.interviews_runtime_log()}
      description={m.interviews_runtime_help()}
    >
      {data.events.length ? (
        <ol className="flex flex-col gap-5">
          {data.events.map((event) => (
            <li key={event.id} className="flex items-start gap-3">
              <span
                className={`mt-1.5 size-2 shrink-0 rounded-full ${["system_error", "realtime_failed", "report_failed"].includes(event.content.kind) ? "bg-warning" : "bg-border"}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <p className="text-sm">
                    {event.content.kind !== "interview_ended" && labels[event.content.kind]()}
                    {event.content.kind === "interview_ended" &&
                      (event.content.reason === "candidate_requested"
                        ? m.interviews_candidate_ended()
                        : m.interviews_agent_ended())}
                  </p>
                  <LocalTime
                    value={new Date(event.at).toISOString()}
                    format="time"
                    className="text-xs text-muted-foreground"
                  />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {sources[event.source]()}
                  {event.content.attempt !== null &&
                    event.content.attempt > 0 &&
                    ` · ${m.interviews_reconnect_attempt({ count: event.content.attempt })}`}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">{m.interviews_no_runtime_events()}</p>
      )}
    </ResultSection>
  );
}
