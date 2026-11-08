import { cn } from "@/lib/utils";
import { useSkeletonPhase } from "@/hooks/use-skeleton-phase";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarVisualizer,
  RoomAudioRenderer,
  SessionProvider,
  StartAudio,
  useAgent,
  useSession,
  useSessionContext,
  useSessionMessages,
  useTrackToggle,
} from "@livekit/components-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  TokenSource,
  Track,
} from "livekit-client";
import { useTheme } from "next-themes";
import { AgentAudioVisualizerAura } from "@/components/agents-ui/agent-audio-visualizer-aura";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { InterviewMicrophoneControl, InterviewMicrophoneLabel } from "./microphone-control";
import { InterviewTranscript } from "./transcript";
import { InterviewTimer } from "./timer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconVideo,
  IconVideoOff,
  IconPhoneOff,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogPopup,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from "@/components/ui/dialog";
import * as m from "@/paraglide/messages";
import { candidateConnectionQuery, candidateEndMutation, candidateInterviewQuery } from "./client";
import { saveInterviewResumeState } from "./resume-state";
import { createConnectionRecorder } from "./connection-recorder";
import { InterviewConversationSkeleton } from "@/components/skeletons/pages/interview-conversation-skeleton";
import type { InterviewDevices } from "./device-check";

function connectionStatus(
  roomState: ConnectionState,
  modelState: string | undefined,
  fallback: string,
) {
  if (
    roomState === ConnectionState.Reconnecting ||
    roomState === ConnectionState.SignalReconnecting
  ) {
    return m.candidate_session_reconnecting();
  }
  if (modelState === "reconnecting") {
    return m.candidate_realtime_reconnecting();
  }
  if (modelState === "failed") {
    return m.candidate_session_failed();
  }
  return fallback;
}

function ConversationContent({
  token,
  startedAt,
  onDeviceChange,
}: {
  token: string;
  startedAt: string | null;
  onDeviceChange: (patch: Partial<InterviewDevices>) => void;
}) {
  const end = useMutation(candidateEndMutation(useQueryClient(), token));
  const session = useSessionContext();
  const agent = useAgent();
  const modelConnection = agent.attributes["interview.connection"];
  const { messages } = useSessionMessages();
  const [deviceError, setDeviceError] = useState(false);
  const { resolvedTheme } = useTheme();
  const handleDeviceError = useCallback(() => setDeviceError(true), []);
  // 保持回调引用稳定，避免 pending 渲染提前清除 SDK 的用户操作标记。
  // Stable callbacks prevent pending renders from clearing the SDK user-interaction marker early.
  const microphone = useTrackToggle({
    onChange: useCallback(
      (enabled: boolean, userInitiated: boolean) => {
        if (userInitiated) {
          onDeviceChange({ microphoneEnabled: enabled });
        }
      },
      [onDeviceChange],
    ),
    onDeviceError: handleDeviceError,
    source: Track.Source.Microphone,
  });
  const camera = useTrackToggle({
    onChange: useCallback(
      (enabled: boolean, userInitiated: boolean) => {
        if (userInitiated) {
          onDeviceChange({ cameraEnabled: enabled });
        }
      },
      [onDeviceChange],
    ),
    onDeviceError: handleDeviceError,
    source: Track.Source.Camera,
  });
  const status = {
    connecting: m.candidate_session_connecting,
    disconnected: m.candidate_session_connecting,
    failed: m.candidate_session_failed,
    idle: m.candidate_session_connecting,
    initializing: m.candidate_session_connecting,
    listening: m.candidate_session_listening,
    "pre-connect-buffering": m.candidate_session_connecting,
    speaking: m.candidate_session_speaking,
    thinking: m.candidate_session_thinking,
  };
  const connectionLabel = connectionStatus(
    session.connectionState,
    modelConnection,
    status[agent.state](),
  );
  return (
    <section className="fixed inset-0 z-20 h-dvh overflow-hidden bg-background text-left [--interview-controls-space:136px] md:[--interview-controls-space:160px] [--interview-stage-height:calc(100dvh_-_64px_-_var(--interview-controls-space))] [--interview-visual-height:calc(var(--interview-stage-height)*0.4)] [--interview-messages-top:calc(64px_+_var(--interview-visual-height))]">
      <h1 className="sr-only">{m.candidate_session_heading()}</h1>
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4">
        <InterviewTimer startedAt={startedAt} />
      </div>
      <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 flex items-center gap-1">
        <LanguageSwitcher iconOnly />
        <ThemeSwitcher />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-16 flex h-[calc(var(--interview-visual-height)_-_32px)] items-center justify-center"
      >
        <AgentAudioVisualizerAura
          size="md"
          className="h-[min(224px,calc(var(--interview-visual-height)_-_32px))] sm:h-[min(288px,calc(var(--interview-visual-height)_-_32px))]"
          state={agent.state}
          colorShift={0.1}
          themeMode={resolvedTheme === "dark" ? "dark" : "light"}
          audioTrack={agent.microphoneTrack}
        />
      </div>
      <div className="absolute inset-x-4 top-[calc(var(--interview-messages-top)_-_48px)] flex justify-center">
        <Card
          render={<output />}
          className="rounded-lg px-2 py-1 text-xs text-muted-foreground before:rounded-[calc(var(--radius-lg)-1px)]"
          aria-live="polite"
        >
          {connectionLabel}
        </Card>
      </div>
      <div className="absolute inset-x-0 top-(--interview-messages-top) bottom-(--interview-controls-space) mx-auto w-full max-w-2xl">
        <InterviewTranscript messages={messages} state={agent.state} />
      </div>
      <div className="absolute inset-x-3 bottom-0 mx-auto flex max-w-2xl flex-col items-center bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-12">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-4 -translate-y-full bg-linear-to-t from-background to-transparent"
        />
        {messages.length === 0 && (
          <p className="mb-3 text-sm text-muted-foreground">{m.candidate_session_waiting()}</p>
        )}
        {deviceError && (
          <p role="alert" className="mb-3 text-sm text-destructive-foreground">
            {m.candidate_device_unavailable()}
          </p>
        )}
        <div
          className="flex w-full max-w-72 flex-col gap-3"
          aria-label={m.candidate_call_controls()}
        >
          <BarVisualizer
            state={microphone.enabled ? "speaking" : "disconnected"}
            track={microphone.enabled ? session.local.microphoneTrack : undefined}
            barCount={40}
            options={{ maxHeight: 100, minHeight: 20 }}
            className="flex h-5 w-full items-center gap-1 text-muted-foreground/70"
            aria-label={m.candidate_microphone_volume()}
          >
            <span className="min-h-1 min-w-0 flex-1 rounded-full bg-current/10 transition-colors duration-250 ease-linear data-[lk-highlighted=true]:bg-current" />
          </BarVisualizer>
          <div className="grid grid-cols-2 items-center gap-3">
            <div className="flex min-w-0 gap-1">
              <InterviewMicrophoneControl
                onChange={(id) => onDeviceChange({ microphoneId: id })}
                onError={handleDeviceError}
              >
                <Button
                  variant="outline"
                  {...microphone.buttonProps}
                  className={cn(
                    microphone.buttonProps.className,
                    "h-11 min-w-0 flex-1 px-0 sm:h-11 md:h-10",
                  )}
                  aria-label={
                    microphone.enabled ? m.candidate_session_mute() : m.candidate_session_unmute()
                  }
                  title={
                    microphone.enabled ? m.candidate_session_mute() : m.candidate_session_unmute()
                  }
                >
                  {microphone.enabled ? <IconMicrophone /> : <IconMicrophoneOff />}
                </Button>
              </InterviewMicrophoneControl>
              <Button
                variant="outline"
                size="icon"
                {...camera.buttonProps}
                className={cn(
                  camera.buttonProps.className,
                  "size-11 shrink-0 sm:size-11 md:size-10",
                )}
                aria-label={
                  camera.enabled
                    ? m.candidate_session_camera_off()
                    : m.candidate_session_camera_on()
                }
                title={
                  camera.enabled
                    ? m.candidate_session_camera_off()
                    : m.candidate_session_camera_on()
                }
              >
                {camera.enabled ? <IconVideo /> : <IconVideoOff />}
              </Button>
            </div>
            <Dialog>
              <DialogTrigger
                render={
                  <Button
                    variant="destructive"
                    className="h-11 w-full min-w-0 sm:h-11 md:h-10"
                    aria-label={m.candidate_session_end()}
                    title={m.candidate_session_end()}
                  />
                }
              >
                <IconPhoneOff aria-hidden="true" />
                {m.candidate_session_end()}
              </DialogTrigger>
              <DialogPopup>
                <DialogHeader>
                  <DialogTitle>{m.candidate_session_end_confirm()}</DialogTitle>
                  <DialogDescription>{m.candidate_session_end_confirm_help()}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose render={<Button variant="outline" />}>
                    {m.interviews_cancel()}
                  </DialogClose>
                  <Button
                    variant="destructive"
                    loading={end.isPending}
                    onClick={() => end.mutate()}
                  >
                    {m.candidate_session_end()}
                  </Button>
                </DialogFooter>
                {end.isError && (
                  <p role="alert" className="px-6 pb-4 text-sm text-destructive-foreground">
                    {m.candidate_session_end_error()}
                  </p>
                )}
              </DialogPopup>
            </Dialog>
          </div>
          <InterviewMicrophoneLabel />
        </div>
        <StartAudio
          label={m.candidate_session_play_audio()}
          className="mt-2 rounded-lg border px-4 py-2 text-sm"
        />
      </div>
      <RoomAudioRenderer />
    </section>
  );
}

interface ConversationProps {
  startedAt: string | null;
  token: string;
  devices: InterviewDevices;
  onLeave: () => void;
}

function ConnectedConversation({
  token,
  devices,
  onLeave,
  credentials,
  startedAt,
}: ConversationProps & {
  credentials: { serverUrl: string; participantToken: string };
}) {
  const client = useQueryClient();
  const recorder = useMemo(() => createConnectionRecorder(token), [token]);
  const tokenSource = useMemo(() => TokenSource.literal(credentials), [credentials]);
  const media = useRef(devices);
  const saveDevices = useCallback(
    (patch: Partial<InterviewDevices>) => {
      media.current = { ...media.current, ...patch };
      saveInterviewResumeState(token, media.current, true);
    },
    [token],
  );
  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: true,
        audioCaptureDefaults: { deviceId: devices.microphoneId },
        dynacast: true,
        videoCaptureDefaults: { deviceId: devices.cameraId },
      }),
    [devices],
  );
  const session = useSession(tokenSource, { room });
  const [error, setError] = useState(false);
  const { start, end } = session;
  useEffect(() => {
    const controller = new AbortController();
    const disconnected = (reason?: DisconnectReason) => {
      void recorder.record(
        "room_disconnected",
        reason === undefined ? "unknown" : String(DisconnectReason[reason]),
      );
      if (
        reason === DisconnectReason.ROOM_DELETED ||
        reason === DisconnectReason.PARTICIPANT_REMOVED ||
        reason === DisconnectReason.DUPLICATE_IDENTITY
      ) {
        saveInterviewResumeState(token, media.current, false);
      }
      setError(true);
      void client.invalidateQueries({ queryKey: candidateInterviewQuery(token).queryKey });
    };
    const reconnecting = () => {
      void recorder.record("room_reconnecting", "media");
    };
    const signalReconnecting = () => {
      void recorder.record("room_reconnecting", "signaling");
    };
    const reconnected = () => {
      void recorder.record("room_reconnected");
    };
    room.on(RoomEvent.Disconnected, disconnected);
    room.on(RoomEvent.Reconnecting, reconnecting);
    room.on(RoomEvent.SignalReconnecting, signalReconnecting);
    room.on(RoomEvent.Reconnected, reconnected);
    window.addEventListener("online", recorder.flush);
    void start({
      signal: controller.signal,
      tracks: {
        camera: { enabled: devices.cameraEnabled },
        microphone: { enabled: devices.microphoneEnabled },
      },
    }).catch(() => {
      if (!controller.signal.aborted) {
        void room.disconnect();
        setError(true);
      }
    });
    return () => {
      room.off(RoomEvent.Disconnected, disconnected);
      room.off(RoomEvent.Reconnecting, reconnecting);
      room.off(RoomEvent.SignalReconnecting, signalReconnecting);
      room.off(RoomEvent.Reconnected, reconnected);
      window.removeEventListener("online", recorder.flush);
      controller.abort();
    };
  }, [start, room, devices, client, token, recorder]);

  async function disconnectToPreparation() {
    saveInterviewResumeState(token, media.current, false);
    await end();
    onLeave();
  }

  if (error || session.connectionState === ConnectionState.Disconnected) {
    return (
      <div className="flex w-full max-w-xl flex-col items-center gap-4">
        {error ? (
          <p role="alert">{m.candidate_session_failed()}</p>
        ) : (
          <InterviewConversationSkeleton />
        )}
        <Button variant="outline" onClick={disconnectToPreparation}>
          {m.candidate_session_back_devices()}
        </Button>
      </div>
    );
  }
  return (
    <SessionProvider session={session}>
      <ConversationContent startedAt={startedAt} token={token} onDeviceChange={saveDevices} />
    </SessionProvider>
  );
}

export default function InterviewConversation(props: ConversationProps) {
  const credentials = useQuery(candidateConnectionQuery(useQueryClient(), props.token));
  const phase = useSkeletonPhase(credentials.isPending);
  if (credentials.isPending || phase !== "ready") {
    return phase === "skeleton" ? <InterviewConversationSkeleton /> : null;
  }
  if (credentials.isError) {
    return (
      <div className="flex max-w-sm flex-col items-center gap-4">
        <p role="alert">{m.candidate_session_failed()}</p>
        <Button
          variant="outline"
          onClick={() => {
            saveInterviewResumeState(props.token, props.devices, false);
            props.onLeave();
          }}
        >
          {m.candidate_session_back_devices()}
        </Button>
      </div>
    );
  }
  return <ConnectedConversation {...props} credentials={credentials.data} />;
}
