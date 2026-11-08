import { useEffect, useRef } from "react";
import { useRoomContext, useTranscriptions } from "@livekit/components-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import * as m from "@/paraglide/messages";
import { MeetingPanel } from "./panel";

export function MeetingTranscript({ open, onClose }: { open: boolean; onClose: () => void }) {
  const room = useRoomContext();
  const messages = useTranscriptions();
  const viewport = useRef<HTMLDivElement>(null);
  const latest = messages.at(-1);
  useEffect(() => {
    if (open && latest?.text && viewport.current) {
      viewport.current.scrollTop = viewport.current.scrollHeight;
    }
  }, [open, latest?.text]);
  return (
    <>
      {!open && latest && (
        <output className="pointer-events-none absolute inset-x-4 bottom-3 mx-auto max-w-2xl rounded-xl bg-background/90 px-4 py-2 text-sm shadow-sm">
          <span className="mr-2 font-medium">
            {room.getParticipantByIdentity(latest.participantInfo.identity)?.name}
          </span>
          {latest.text}
        </output>
      )}
      <MeetingPanel open={open} onClose={onClose} title={m.meeting_transcript_title()}>
        <ScrollArea className="min-h-0 flex-1" overscrollContain viewportProps={{ ref: viewport }}>
          <div
            role="log"
            aria-label={m.meeting_transcript_title()}
            className="flex flex-col gap-5 p-4"
          >
            {!messages.length && (
              <p className="text-sm text-muted-foreground">{m.meeting_transcript_empty()}</p>
            )}
            {messages.map((item) => (
              <div key={item.streamInfo.id} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">
                  {room.getParticipantByIdentity(item.participantInfo.identity)?.name ||
                    m.meeting_interviewer()}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-6 wrap-anywhere">{item.text}</p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </MeetingPanel>
    </>
  );
}
