import { useEffect, useRef } from "react";
import { useRoomContext, useTranscriptions } from "@livekit/components-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as m from "@/paraglide/messages";
import { MeetingPanel } from "./panel";
import type { MeetingEntry } from "./client";

export function MeetingTranscript({
  open,
  onClose,
  turns,
}: {
  open: boolean;
  onClose: () => void;
  turns: MeetingEntry["turns"];
}) {
  const room = useRoomContext();
  const messages = useTranscriptions();
  const viewport = useRef<HTMLDivElement>(null);
  const lines = new Map(
    turns.map((turn) => [
      turn.id,
      {
        at: turn.at,
        speaker:
          turn.speakerName ??
          (turn.role === "user" ? m.meeting_candidate() : m.meeting_interviewer()),
        text: turn.text,
      },
    ]),
  );
  for (const message of messages) {
    const { attributes } = message.streamInfo;
    lines.set(attributes?.["lk.segment_id"] ?? message.streamInfo.id, {
      at: Number(attributes?.["interview.spoken_at_ms"] ?? message.streamInfo.timestamp),
      speaker:
        attributes?.["interview.speaker_name"] ??
        room.getParticipantByIdentity(message.participantInfo.identity)?.name ??
        m.meeting_interviewer(),
      text: message.text,
    });
  }
  // Web 类型检查使用 ES2022；只排序上面生成的副本。
  // Web type checking targets ES2022; sort only the generated copy.
  // oxlint-disable-next-line unicorn/no-array-sort
  const ordered = [...lines].sort(([, a], [, b]) => a.at - b.at);
  const latestText = ordered.at(-1)?.[1].text;
  useEffect(() => {
    if (open && latestText && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
    }
  }, [open, latestText]);
  return (
    <MeetingPanel open={open} onClose={onClose} title={m.meeting_transcript_title()}>
      <ScrollArea
        className="min-h-0 flex-1 touch-auto"
        overscrollContain
        viewportProps={{ ref: viewport }}
      >
        <div
          role="log"
          aria-label={m.meeting_transcript_title()}
          className="flex flex-col gap-5 p-4"
        >
          {!lines.size && (
            <p className="text-sm text-muted-foreground">{m.meeting_transcript_empty()}</p>
          )}
          {ordered.map(([id, line]) => (
            <div key={id} className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">{line.speaker}</p>
              <p className="whitespace-pre-wrap text-sm leading-6 wrap-anywhere">{line.text}</p>
            </div>
          ))}
        </div>
      </ScrollArea>
    </MeetingPanel>
  );
}
