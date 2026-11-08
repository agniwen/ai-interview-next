import { useState } from "react";
import type { ReactNode } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import {
  IconPhoneOff,
  IconMessageCircle,
  IconFiles,
  IconLayoutGrid,
  IconX,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { InterviewTimer } from "../candidate-interview/timer";
import type { InterviewDevices } from "../candidate-interview/device-check";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import type { HumanMeeting, MeetingConnection } from "./client";
import { MeetingChat } from "./chat";
import { MediaControl, ScreenControl, controlClass } from "./controls";
import { MeetingView } from "./view";

interface MeetingRoomProps {
  connection: MeetingConnection;
  devices: InterviewDevices;
  title: string;
  materials?: HumanMeeting["materials"];
  onLeave: () => void;
  onEntered: () => Promise<{ startedAt: string | null }>;
  onEnd?: () => Promise<void>;
  ending?: boolean;
  endError?: boolean;
  evaluation?: ReactNode;
}

function MeetingHeader({
  title,
  startedAt,
  chatOpen,
  canEnd,
  onChat,
  onHangup,
}: {
  title: string;
  startedAt: string | null;
  chatOpen: boolean;
  canEnd: boolean;
  onChat: () => void;
  onHangup: () => void;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 px-3 md:px-4">
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium" title={title}>
        {title}
      </h1>
      <div className="hidden sm:block">
        <InterviewTimer startedAt={startedAt} />
      </div>
      <ThemeSwitcher />
      <Button
        variant={chatOpen ? "secondary" : "ghost"}
        size="icon"
        aria-label={m.meeting_chat()}
        aria-expanded={chatOpen}
        onClick={onChat}
        className="md:hidden"
      >
        <IconMessageCircle />
      </Button>
      <Button
        variant="destructive"
        size="icon"
        className="md:hidden"
        aria-label={canEnd ? m.meeting_end() : m.meeting_leave()}
        onClick={onHangup}
      >
        <IconPhoneOff />
      </Button>
    </header>
  );
}

function MeetingStage({
  connection,
  title,
  materials,
  onEnd,
  ending,
  endError,
  evaluation,
  mediaError,
  onMediaError,
  onClearError,
}: MeetingRoomProps & { mediaError: boolean; onMediaError: () => void; onClearError: () => void }) {
  const room = useRoomContext();
  const state = useConnectionState();
  const [view, setView] = useState<"meeting" | "materials">("meeting");
  const [chatOpen, setChatOpen] = useState(false);
  const [confirm, setConfirm] = useState<"leave" | "end">("leave");
  const [confirmOpen, setConfirmOpen] = useState(false);
  function requestConfirmation(action: "leave" | "end") {
    setConfirm(action);
    setConfirmOpen(true);
  }
  const [focused, setFocused] = useState<string | null>(null);
  const tracks = useTracks(
    [
      { source: Track.Source.ScreenShare, withPlaceholder: false },
      { source: Track.Source.Camera, withPlaceholder: true },
    ],
    { onlySubscribed: false },
  ).filter((track) => !track.participant.isAgent);
  const reconnecting =
    state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting;
  const connecting = state === ConnectionState.Connecting;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <MeetingHeader
        title={title}
        startedAt={connection.startedAt}
        chatOpen={chatOpen}
        canEnd={Boolean(onEnd)}
        onChat={() => setChatOpen(!chatOpen)}
        onHangup={() => requestConfirmation(onEnd ? "end" : "leave")}
      />
      {(reconnecting || connecting) && (
        <output className="bg-muted px-4 py-2 text-center text-xs">
          {reconnecting ? m.meeting_reconnecting() : m.meeting_connecting()}
        </output>
      )}
      {mediaError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-destructive/10 px-4 py-2 text-xs text-destructive-foreground"
        >
          <span>{m.meeting_media_error()}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={m.meeting_close_panel()}
            onClick={onClearError}
          >
            <IconX />
          </Button>
        </div>
      )}
      <div className="relative flex min-h-0 flex-1">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <MeetingView
            materials={view === "materials" ? materials : undefined}
            tracks={tracks}
            focused={focused}
            onFocus={(key) => {
              setView("meeting");
              setFocused(key);
            }}
            onReset={() => setFocused(null)}
          />
          {tracks.length === 1 && !connecting && view === "meeting" && (
            <output className="pointer-events-none absolute inset-x-0 top-4 text-center text-xs text-muted-foreground">
              <span className="rounded-full bg-background/90 px-4 py-2">{m.meeting_waiting()}</span>
            </output>
          )}
        </div>
        <MeetingChat open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
      <footer className="flex shrink-0 items-center justify-center gap-1 border-t bg-background px-2 pt-2 pb-[max(.75rem,env(safe-area-inset-bottom))] md:gap-3 md:px-4">
        <MediaControl source={Track.Source.Microphone} onError={onMediaError} />
        <MediaControl source={Track.Source.Camera} onError={onMediaError} />
        <ScreenControl onError={onMediaError} onShare={() => setView("meeting")} />
        {evaluation && (
          <div className="max-md:flex max-md:flex-1 max-md:justify-center max-md:[&>button]:h-12 max-md:[&>button]:flex-col max-md:[&>button]:gap-1 max-md:[&>button]:border-0 max-md:[&>button]:bg-transparent max-md:[&>button]:text-[10px] max-md:[&>button]:shadow-none">
            {evaluation}
          </div>
        )}
        {materials && (
          <Button
            variant="outline"
            className={controlClass}
            aria-pressed={view === "materials"}
            onClick={() => setView(view === "meeting" ? "materials" : "meeting")}
          >
            {view === "meeting" ? <IconFiles /> : <IconLayoutGrid />}
            <span>{view === "meeting" ? m.meeting_materials() : m.meeting_view()}</span>
          </Button>
        )}
        <Button
          variant="outline"
          className={cn(controlClass, "hidden md:inline-flex")}
          aria-expanded={chatOpen}
          onClick={() => setChatOpen(!chatOpen)}
        >
          <IconMessageCircle />
          {m.meeting_chat()}
        </Button>
        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" onClick={() => requestConfirmation("leave")}>
            {m.meeting_leave()}
          </Button>
          {onEnd && (
            <Button
              variant="destructive"
              loading={ending}
              onClick={() => requestConfirmation("end")}
            >
              <IconPhoneOff />
              {m.meeting_end()}
            </Button>
          )}
        </div>
      </footer>
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogPopup className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {confirm === "end" ? m.meeting_end_title() : m.meeting_leave_title()}
            </DialogTitle>
            <DialogDescription>
              {confirm === "end" ? m.meeting_end_help() : m.meeting_leave_help()}
            </DialogDescription>
          </DialogHeader>
          {endError && (
            <p role="alert" className="px-6 pb-4 text-sm text-destructive-foreground">
              {m.meeting_end_error()}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={ending} onClick={() => setConfirmOpen(false)}>
              {m.interviews_cancel()}
            </Button>
            <Button
              variant="destructive"
              loading={ending}
              onClick={async () => {
                await (confirm === "end" ? onEnd?.() : room.disconnect());
              }}
            >
              {confirm === "end" ? m.meeting_end() : m.meeting_leave()}
            </Button>
          </DialogFooter>
        </DialogPopup>
      </Dialog>
    </div>
  );
}

export default function MeetingRoom(props: MeetingRoomProps) {
  const [error, setError] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [startedAt, setStartedAt] = useState(props.connection.startedAt);
  const { connection, devices } = props;
  return (
    <LiveKitRoom
      token={connection.participantToken}
      serverUrl={connection.serverUrl}
      audio={devices.microphoneEnabled ? { deviceId: devices.microphoneId } : false}
      video={
        devices.cameraEnabled
          ? { deviceId: devices.cameraId, resolution: { height: 720, width: 1280 } }
          : false
      }
      options={{ adaptiveStream: true, dynacast: true }}
      onDisconnected={props.onLeave}
      onConnected={async () => {
        try {
          const result = await props.onEntered();
          setStartedAt(result.startedAt);
        } catch {
          setConnectionError(true);
        }
      }}
      onError={() => setConnectionError(true)}
      onMediaDeviceFailure={() => setError(true)}
      className="fixed inset-0 z-50 h-dvh bg-background text-left text-foreground"
    >
      <RoomAudioRenderer />
      {connectionError ? (
        <div role="alert" className="grid h-full place-items-center p-6">
          <div className="flex max-w-sm flex-col gap-4 text-center">
            <p>{m.meeting_join_error()}</p>
            <Button variant="outline" onClick={props.onLeave}>
              {m.candidate_interview_back()}
            </Button>
          </div>
        </div>
      ) : (
        <MeetingStage
          {...props}
          connection={{ ...connection, startedAt }}
          mediaError={error}
          onMediaError={() => setError(true)}
          onClearError={() => setError(false)}
        />
      )}
    </LiveKitRoom>
  );
}
