import { useTrackToggle, useMediaDeviceSelect, useRoomContext } from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  IconMicrophone,
  IconMicrophoneOff,
  IconVideo,
  IconVideoOff,
  IconScreenShare,
  IconChevronDown,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectPrimitive,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import type { InterviewDevices } from "../candidate-interview/device-check";

export const controlClass =
  "max-md:h-12 max-md:flex-1 max-md:flex-col max-md:gap-1 max-md:border-0 max-md:bg-transparent max-md:px-1 max-md:text-[10px] max-md:shadow-none max-md:[&_svg]:size-5";

function MeetingDeviceSelect({
  kind,
  label,
  onError,
  onSelect,
}: {
  kind: MediaDeviceKind;
  label: string;
  onError: () => void;
  onSelect: (id: string) => void;
}) {
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({ kind, onError });
  return (
    <Select
      value={activeDeviceId}
      onValueChange={async (id) => {
        if (id !== null) {
          try {
            await setActiveMediaDevice(id);
            onSelect(id);
          } catch {
            onError();
          }
        }
      }}
    >
      <SelectPrimitive.Trigger
        aria-label={label}
        render={
          <Button
            variant="outline"
            className="px-1.5 max-md:h-12 max-md:border-0 max-md:bg-transparent max-md:px-0 max-md:shadow-none"
          />
        }
      >
        <IconChevronDown className="size-3" />
      </SelectPrimitive.Trigger>
      <SelectPopup>
        <SelectGroup>
          {devices.map((device, index) => (
            <SelectItem key={device.deviceId} value={device.deviceId}>
              {device.label || `${label} ${index + 1}`}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
}

export function MediaControl({
  source,
  onError,
  onDevicesChange,
}: {
  source: Track.Source.Microphone | Track.Source.Camera;
  onError: () => void;
  onDevicesChange: (patch: Partial<InterviewDevices>) => void;
}) {
  const microphone = source === Track.Source.Microphone;
  const { localParticipant } = useRoomContext();
  const { enabled, toggle, pending } = useTrackToggle({ onDeviceError: onError, source });
  const controls = microphone
    ? {
        DisabledIcon: IconMicrophoneOff,
        EnabledIcon: IconMicrophone,
        disabledLabel: m.meeting_mic_on(),
        enabledLabel: m.meeting_mic_off(),
        label: m.candidate_device_microphone(),
      }
    : {
        DisabledIcon: IconVideoOff,
        EnabledIcon: IconVideo,
        disabledLabel: m.meeting_camera_on(),
        enabledLabel: m.meeting_camera_off(),
        label: m.candidate_device_camera(),
      };
  const { label } = controls;
  const Icon = enabled ? controls.EnabledIcon : controls.DisabledIcon;
  const action = enabled ? controls.enabledLabel : controls.disabledLabel;
  return (
    <Group className="max-md:min-w-0 max-md:flex-1">
      <Button
        variant="outline"
        className={controlClass}
        aria-label={action}
        aria-pressed={enabled}
        disabled={pending}
        onClick={async () => {
          try {
            await toggle();
            onDevicesChange(
              microphone
                ? { microphoneEnabled: localParticipant.isMicrophoneEnabled }
                : { cameraEnabled: localParticipant.isCameraEnabled },
            );
          } catch {
            onError();
          }
        }}
      >
        <Icon />
        <span>{label}</span>
      </Button>
      <GroupSeparator className="max-md:hidden" />
      <MeetingDeviceSelect
        kind={microphone ? "audioinput" : "videoinput"}
        label={label}
        onError={onError}
        onSelect={(id) => onDevicesChange(microphone ? { microphoneId: id } : { cameraId: id })}
      />
    </Group>
  );
}

export function ScreenControl({ onError, onShare }: { onError: () => void; onShare: () => void }) {
  const { enabled, toggle, pending } = useTrackToggle({
    onDeviceError: onError,
    source: Track.Source.ScreenShare,
  });
  return (
    <Button
      variant="outline"
      disabled={pending}
      className={cn(controlClass, "hidden md:inline-flex")}
      aria-pressed={enabled}
      onClick={async () => {
        try {
          await toggle();
          if (!enabled) {
            onShare();
          }
        } catch {
          onError();
        }
      }}
    >
      <IconScreenShare />
      {enabled ? m.meeting_screen_stop() : m.meeting_screen()}
    </Button>
  );
}
