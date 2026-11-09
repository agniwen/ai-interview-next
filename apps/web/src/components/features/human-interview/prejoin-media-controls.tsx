import { useState } from "react";
import {
  IconChevronDown,
  IconMicrophone,
  IconMicrophoneOff,
  IconVideo,
  IconVideoOff,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
} from "@/components/ui/menu";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import * as m from "@/paraglide/messages";
import type { InterviewDevices } from "../candidate-interview/device-check";

async function listMicrophones() {
  const media = navigator.mediaDevices;
  const devices = await media.enumerateDevices();
  const microphones = devices.filter((device) => device.kind === "audioinput");
  if (microphones.some((device) => device.label)) {
    return microphones;
  }

  const stream = await media.getUserMedia({ audio: true });
  try {
    const authorizedDevices = await media.enumerateDevices();
    return authorizedDevices.filter((device) => device.kind === "audioinput");
  } finally {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

export function PrejoinMediaControls({
  devices,
  onChange,
  disabled,
}: {
  devices: InterviewDevices;
  onChange: (patch: Partial<InterviewDevices>) => void;
  disabled?: boolean;
}) {
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const MicrophoneIcon = devices.microphoneEnabled ? IconMicrophone : IconMicrophoneOff;
  const CameraIcon = devices.cameraEnabled ? IconVideo : IconVideoOff;

  async function loadMicrophones() {
    setStatus("loading");
    try {
      setMicrophones(await listMicrophones());
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Group
        aria-label={m.candidate_device_microphone()}
        className="items-center rounded-lg border border-transparent hover:border-border hover:bg-accent has-[button[data-popup-open]]:border-border has-[button[data-popup-open]]:bg-accent"
      >
        <Button
          aria-pressed={devices.microphoneEnabled}
          className={cn(
            "hover:bg-transparent",
            !devices.microphoneEnabled && "text-destructive-foreground",
          )}
          disabled={disabled}
          onClick={() => onChange({ microphoneEnabled: !devices.microphoneEnabled })}
          size="sm"
          variant="ghost"
        >
          <MicrophoneIcon aria-hidden="true" />
          {devices.microphoneEnabled ? m.meeting_mic_enabled() : m.meeting_mic_disabled()}
        </Button>
        <GroupSeparator className="h-4" />
        <Menu
          onOpenChange={(open) => {
            if (open) {
              void loadMicrophones();
            }
          }}
        >
          <MenuTrigger
            aria-label={m.meeting_select_microphone()}
            render={
              <Button
                disabled={disabled}
                size="icon-sm"
                variant="ghost"
                className="hover:bg-transparent data-pressed:bg-transparent"
              />
            }
          >
            <IconChevronDown aria-hidden="true" />
          </MenuTrigger>
          <MenuPopup align="start" className="w-64 max-w-[calc(100vw-2rem)]">
            <MenuRadioGroup
              value={devices.microphoneId ?? "default"}
              onValueChange={(id) => onChange({ microphoneId: id === "default" ? undefined : id })}
            >
              <MenuRadioItem value="default">{m.meeting_default_microphone()}</MenuRadioItem>
              {microphones
                .filter(({ deviceId }) => deviceId && deviceId !== "default")
                .map(({ deviceId, label }, index) => (
                  <MenuRadioItem key={deviceId} value={deviceId}>
                    <span className="block truncate" title={label}>
                      {label || `${m.candidate_device_microphone()} ${index + 1}`}
                    </span>
                  </MenuRadioItem>
                ))}
            </MenuRadioGroup>
            {status === "loading" && (
              <MenuItem disabled>
                <Spinner />
                {m.meeting_loading_microphones()}
              </MenuItem>
            )}
            {status === "error" && (
              <p role="alert" className="px-2 py-1 text-xs text-destructive-foreground">
                {m.candidate_device_unavailable()}
              </p>
            )}
          </MenuPopup>
        </Menu>
      </Group>
      <Button
        aria-pressed={devices.cameraEnabled}
        className={cn(
          "hover:border-border",
          !devices.cameraEnabled && "text-destructive-foreground",
        )}
        disabled={disabled}
        onClick={() => onChange({ cameraEnabled: !devices.cameraEnabled })}
        size="sm"
        variant="ghost"
      >
        <CameraIcon aria-hidden="true" />
        {devices.cameraEnabled ? m.meeting_camera_enabled() : m.meeting_camera_disabled()}
      </Button>
    </div>
  );
}
