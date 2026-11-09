import { useEffect, useEffectEvent, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  RoomAudioRenderer,
  SessionProvider,
  useAudioPlayback,
  useSession,
  useTracks,
  useParticipants,
  useConnectionState,
} from "@livekit/components-react";
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  TokenSource,
  Track,
} from "livekit-client";
import {
  IconPhoneOff,
  IconSubtitles,
  IconMessageCircle,
  IconFiles,
  IconLayoutGrid,
  IconLogout,
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
import type { HumanMeeting, MeetingConnection, MeetingEntry } from "./client";
import { MeetingEnteredError } from "./client";
import { MeetingError } from "./error";
import { MeetingParticipants } from "./participants";
import { MeetingTranscript } from "./transcript";
import { MeetingChat } from "./chat";
import { MediaControl, ScreenControl, controlClass } from "./controls";
import { MeetingView } from "./view";
import { MeetingJobPreview } from "./job-preview";

interface MeetingRoomProps {
  connection: MeetingConnection;
  devices: InterviewDevices;
  title: string;
  materials?: HumanMeeting["materials"];
  onLeave: (interrupted: boolean) => void;
  onDevicesChange: (patch: Partial<InterviewDevices>) => void;
  onEntered: () => Promise<MeetingEntry>;
  onEnd?: () => Promise<void>;
  ending?: boolean;
  endError?: boolean;
  evaluation?: ReactNode;
}

function MeetingHeader({
  title,
  materials,
  startedAt,
  chatOpen,
  canEnd,
  onChat,
  onHangup,
  onLeave,
  children,
}: {
  title: string;
  materials?: HumanMeeting["materials"];
  startedAt: string | null;
  chatOpen: boolean;
  canEnd: boolean;
  onChat: () => void;
  onHangup: () => void;
  onLeave: () => void;
  children?: ReactNode;
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 px-3 md:px-4">
      <h1 className="min-w-0 flex-1 text-sm font-medium">
        {materials ? (
          <MeetingJobPreview title={title} job={materials.job} />
        ) : (
          <span className="block truncate" title={title}>
            {title}
          </span>
        )}
      </h1>
      <div className="hidden sm:block">
        <InterviewTimer startedAt={startedAt} variant="ghost" />
      </div>
      {children}
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
      {canEnd && (
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={m.meeting_leave()}
          onClick={onLeave}
        >
          <IconLogout />
        </Button>
      )}
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

function MeetingHeaderActions({
  materials,
  participants,
  transcriptOpen,
  onTranscript,
}: {
  materials?: HumanMeeting["materials"];
  participants: ReturnType<typeof useParticipants>;
  transcriptOpen: boolean;
  onTranscript: () => void;
}) {
  return (
    <>
      {materials && (
        <div className="hidden md:block">
          <MeetingParticipants participants={participants} people={materials.people} />
        </div>
      )}
      <Button
        variant={transcriptOpen ? "secondary" : "ghost"}
        size="sm"
        aria-expanded={transcriptOpen}
        onClick={onTranscript}
      >
        <IconSubtitles />
        {m.meeting_subtitles()}
      </Button>
    </>
  );
}

function MeetingAudioPlayback({ onError }: { onError: () => void }) {
  const { canPlayAudio, startAudio } = useAudioPlayback();
  return canPlayAudio ? null : (
    <div className="flex justify-center bg-muted p-2">
      <Button size="sm" variant="outline" onClick={() => startAudio().catch(onError)}>
        {m.meeting_enable_audio()}
      </Button>
    </div>
  );
}

function MeetingStage({
  connection,
  title,
  materials,
  onEnd,
  onLeave,
  ending,
  endError,
  evaluation,
  mediaError,
  onMediaError,
  onClearError,
  onDevicesChange,
  turns,
}: MeetingRoomProps & {
  mediaError: boolean;
  onMediaError: () => void;
  onClearError: () => void;
  turns: MeetingEntry["turns"];
}) {
  const state = useConnectionState();
  const [view, setView] = useState<"meeting" | "materials">("meeting");
  const [chatOpen, setChatOpen] = useState(false);
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const participants = useParticipants().filter((person) => !person.isAgent);
  function toggleChat() {
    setTranscriptOpen(false);
    setChatOpen((value) => !value);
  }
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
        materials={materials}
        startedAt={connection.startedAt}
        chatOpen={chatOpen}
        canEnd={Boolean(onEnd)}
        onChat={toggleChat}
        onHangup={() => requestConfirmation(onEnd ? "end" : "leave")}
        onLeave={() => requestConfirmation("leave")}
      >
        <MeetingHeaderActions
          materials={view === "materials" ? materials : undefined}
          participants={participants}
          transcriptOpen={transcriptOpen}
          onTranscript={() => {
            setChatOpen(false);
            setTranscriptOpen((value) => !value);
          }}
        />
      </MeetingHeader>
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
      <MeetingAudioPlayback onError={onMediaError} />
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
        <MeetingTranscript
          open={transcriptOpen}
          onClose={() => setTranscriptOpen(false)}
          turns={turns}
        />
        <MeetingChat open={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
      <footer className="flex shrink-0 items-center justify-center gap-1 border-t bg-background px-2 pt-2 pb-[max(.75rem,env(safe-area-inset-bottom))] md:gap-3 md:px-4">
        <MediaControl
          source={Track.Source.Microphone}
          onError={onMediaError}
          onDevicesChange={onDevicesChange}
        />
        <MediaControl
          source={Track.Source.Camera}
          onError={onMediaError}
          onDevicesChange={onDevicesChange}
        />
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
          onClick={toggleChat}
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
                if (confirm === "end") {
                  await onEnd?.();
                } else {
                  onLeave(false);
                }
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
  const { connection, devices } = props;
  const [mediaError, setMediaError] = useState(false);
  const [connectionError, setConnectionError] = useState<Error>();
  const [entry, setEntry] = useState<MeetingEntry>();
  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        audioCaptureDefaults: { deviceId: devices.microphoneId },
        dynacast: true,
        videoCaptureDefaults: {
          deviceId: devices.cameraId,
          resolution: { height: 720, width: 1280 },
        },
      }),
    [devices],
  );
  const tokenSource = useMemo(() => TokenSource.literal(connection), [connection]);
  const session = useSession(tokenSource, { room });
  const { start } = session;
  const entered = useMutation({
    mutationFn: props.onEntered,
    retry: (count, error) =>
      count < 2 && (!(error instanceof MeetingEnteredError) || error.status >= 500),
  });
  const confirmEntry = useEffectEvent(async () => {
    setEntry(await entered.mutateAsync());
  });
  const rememberDevices = useEffectEvent(props.onDevicesChange);
  const leave = useEffectEvent(props.onLeave);
  useEffect(() => {
    const controller = new AbortController();
    const disconnected = (reason?: DisconnectReason) => {
      if (reason !== DisconnectReason.CLIENT_INITIATED) {
        leave(true);
      }
    };
    room.on(RoomEvent.Disconnected, disconnected);

    async function connect() {
      try {
        await start({ signal: controller.signal, tracks: {} });
        if (controller.signal.aborted) {
          return;
        }
        await confirmEntry();
        if (controller.signal.aborted) {
          return;
        }
        rememberDevices({});
        const publications = await Promise.allSettled([
          room.localParticipant.setMicrophoneEnabled(devices.microphoneEnabled),
          room.localParticipant.setCameraEnabled(devices.cameraEnabled),
        ]);
        if (publications.some((result) => result.status === "rejected")) {
          setMediaError(true);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setConnectionError(error instanceof Error ? error : new Error(m.meeting_join_error()));
          void room.disconnect();
        }
      }
    }
    void connect();
    return () => {
      room.off(RoomEvent.Disconnected, disconnected);
      controller.abort();
    };
  }, [devices, room, start]);
  return (
    <SessionProvider session={session}>
      <div className="fixed inset-0 z-50 h-dvh bg-background text-left text-foreground">
        {connectionError ? (
          <div className="grid h-full place-items-center p-6">
            <div className="flex max-w-sm flex-col gap-4 text-center">
              <MeetingError error={connectionError} />
              <Button variant="outline" onClick={() => props.onLeave(true)}>
                {m.candidate_session_back_devices()}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {entry && <RoomAudioRenderer />}
            <MeetingStage
              {...props}
              connection={{ ...connection, startedAt: entry?.startedAt ?? connection.startedAt }}
              turns={entry?.turns ?? []}
              mediaError={mediaError}
              onMediaError={() => setMediaError(true)}
              onClearError={() => setMediaError(false)}
            />
          </>
        )}
      </div>
    </SessionProvider>
  );
}
