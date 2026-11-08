import type { ReactNode } from "react";
import { useCallback } from "react";
import { useMediaDeviceSelect } from "@livekit/components-react";
import { IconChevronDown } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Group, GroupSeparator } from "@/components/ui/group";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectPrimitive,
} from "@/components/ui/select";
import * as m from "@/paraglide/messages";

export function InterviewMicrophoneControl({
  children,
  onChange,
  onError,
}: {
  children: ReactNode;
  onChange: (deviceId: string) => void;
  onError: () => void;
}) {
  const deviceError = useCallback(() => onError(), [onError]);
  const { devices, activeDeviceId, setActiveMediaDevice } = useMediaDeviceSelect({
    kind: "audioinput",
    onError: deviceError,
  });
  return (
    <Group className="min-w-0 flex-1">
      {children}
      <GroupSeparator />
      <Select
        value={activeDeviceId}
        onValueChange={async (id) => {
          if (id === null) {
            return;
          }
          try {
            await setActiveMediaDevice(id);
            onChange(id);
          } catch {
            onError();
          }
        }}
      >
        <SelectPrimitive.Trigger
          render={<Button variant="outline" className="h-11 min-w-0 flex-1 px-0 sm:h-11 md:h-10" />}
          aria-label={m.candidate_device_microphone()}
        >
          <IconChevronDown aria-hidden="true" />
        </SelectPrimitive.Trigger>
        <SelectPopup>
          <SelectGroup>
            {devices.map((device, index) => (
              <SelectItem key={device.deviceId} value={device.deviceId}>
                {device.label || `${m.candidate_device_microphone()} ${index + 1}`}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectPopup>
      </Select>
    </Group>
  );
}

export function InterviewMicrophoneLabel() {
  const { devices, activeDeviceId } = useMediaDeviceSelect({ kind: "audioinput" });
  const label =
    devices.find((device) => device.deviceId === activeDeviceId)?.label ||
    m.candidate_device_microphone();
  return (
    <div className="flex w-full min-w-0 justify-center px-1 text-xs leading-4 text-muted-foreground">
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
    </div>
  );
}
