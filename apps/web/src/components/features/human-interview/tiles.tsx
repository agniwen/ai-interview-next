import {
  VideoTrack,
  ConnectionQualityIndicator,
  useIsSpeaking,
  useIsMuted,
} from "@livekit/components-react";
import type { TrackReferenceOrPlaceholder } from "@livekit/components-react";
import { Track } from "livekit-client";
import { IconScreenShare, IconMicrophoneOff } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";

export function trackKey(track: TrackReferenceOrPlaceholder) {
  return `${track.participant.identity}:${track.source}`;
}

export function MeetingTile({
  track,
  onFocus,
  onReset,
}: {
  track: TrackReferenceOrPlaceholder;
  onFocus?: () => void;
  onReset?: () => void;
}) {
  const speaking = useIsSpeaking(track.participant);
  const muted = useIsMuted({ participant: track.participant, source: Track.Source.Microphone });
  const videoMuted = useIsMuted(track);
  const name = track.participant.name || m.meeting_interviewer();
  const screen = track.source === Track.Source.ScreenShare;
  return (
    <div
      data-speaking={speaking}
      className={cn(
        "relative isolate h-full min-h-0 overflow-hidden rounded-sm border bg-muted/40 transition-colors",
        speaking && !screen ? "border-green-500" : "border-border/50",
      )}
    >
      {track.publication && !videoMuted ? (
        <VideoTrack
          trackRef={track}
          className={cn(
            "h-full w-full",
            screen ? "object-contain" : "object-cover",
            track.participant.isLocal && !screen && "-scale-x-100",
          )}
        />
      ) : (
        <div className="grid h-full min-h-28 place-items-center">
          <span className="grid size-16 place-items-center rounded-full bg-muted text-2xl font-medium text-muted-foreground">
            {name.slice(0, 1)}
          </span>
        </div>
      )}
      {onFocus && (
        <button
          type="button"
          aria-label={`${m.meeting_focus()} · ${name}`}
          className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          onClick={onFocus}
        />
      )}
      {onReset && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-2 right-2 z-20"
          onClick={onReset}
        >
          {m.meeting_auto_layout()}
        </Button>
      )}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 rounded-md bg-background/95 px-2 py-1 text-xs">
          {screen && <IconScreenShare className="size-3.5 shrink-0" />}
          {!screen && muted && (
            <IconMicrophoneOff className="size-3.5 shrink-0 text-destructive-foreground" />
          )}
          <span className="truncate">
            {name}
            {track.participant.isLocal ? ` (${m.meeting_you()})` : ""}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {track.participant.attributes.role === "candidate"
              ? m.meeting_candidate()
              : m.meeting_interviewer()}
          </span>
        </div>
        <ConnectionQualityIndicator
          participant={track.participant}
          className="shrink-0 rounded-md bg-background/95 p-1 text-muted-foreground data-[lk-quality=excellent]:text-success-foreground data-[lk-quality=poor]:text-destructive-foreground [&_svg]:size-4"
        />
      </div>
    </div>
  );
}
