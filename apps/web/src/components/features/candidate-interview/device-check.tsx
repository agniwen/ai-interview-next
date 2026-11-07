import { useState } from "react";
import { IconCheck, IconChevronDown, IconMicrophone, IconVideo } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectGroup,
  SelectItem,
  SelectPopup,
  SelectPrimitive,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import * as m from "@/paraglide/messages";
import { CameraPreview, MicrophoneMeter } from "./device-media";
import type { DeviceFailure, DevicePreview, PreviewKind } from "./device-preview";
import { useDevicePreview } from "./use-device-preview";

function DeviceError({ failure }: { failure: DeviceFailure }) {
  const messages = {
    busy: m.candidate_device_busy,
    denied: m.candidate_device_denied,
    disconnected: m.candidate_device_disconnected,
    missing: m.candidate_device_missing,
    unavailable: m.candidate_device_unavailable,
    unsupported: m.candidate_device_unsupported,
  };
  return (
    <p role="alert" className="text-xs leading-5 text-destructive-foreground">
      {messages[failure]()}
    </p>
  );
}

function DeviceSelect({
  kind,
  preview,
  onChange,
}: {
  kind: PreviewKind;
  preview: DevicePreview;
  onChange: (id: string | undefined) => void;
}) {
  const title = kind === "audio" ? m.candidate_device_microphone() : m.candidate_device_camera();
  const items = preview.devices.map((device, index) => ({
    label: device.label || `${title} ${index + 1}`,
    value: device.deviceId,
  }));
  return (
    <Select
      items={items}
      value={preview.deviceId ?? null}
      onValueChange={(value) => onChange(value ?? undefined)}
    >
      <SelectPrimitive.Trigger
        aria-label={title}
        render={<Button variant="ghost" size="xs" className="min-w-0 shrink" />}
      >
        <SelectValue placeholder={title} />
        <IconChevronDown aria-hidden="true" data-icon="inline-end" />
      </SelectPrimitive.Trigger>
      <SelectPopup>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
}

/**
 * 候选人本地设备检查：麦克风检测到声音后就绪，摄像头可选；此组件不创建房间或开始面试。
 * Candidate local device check: microphone sound marks readiness, camera is optional; this component neither creates a room nor starts an interview.
 */
export function InterviewDeviceCheck({
  onBack,
  hasForms,
}: {
  onBack: () => void;
  hasForms: boolean;
}) {
  const microphone = useDevicePreview("audio");
  const camera = useDevicePreview("video");
  const [heardStream, setHeardStream] = useState<MediaStream | null>(null);
  const ready =
    microphone.state.status === "ready" && microphone.state.preview.stream === heardStream;
  return (
    <div className="mt-8 flex w-full max-w-sm flex-col gap-5 text-left">
      <Card render={<section aria-labelledby="devices-heading" />} className="overflow-hidden">
        <h2 id="devices-heading" className="px-3.5 py-2 text-xs text-muted-foreground">
          {m.candidate_device_heading()}
        </h2>
        <Separator />
        <section aria-labelledby="microphone-heading" className="flex flex-col gap-2 px-3.5 py-3">
          <div className="flex min-h-7 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconMicrophone
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground"
              />
              <h3 id="microphone-heading" className="shrink-0 text-sm font-medium">
                {m.candidate_device_microphone()}
              </h3>
              {microphone.state.status === "ready" && (
                <DeviceSelect
                  kind="audio"
                  preview={microphone.state.preview}
                  onChange={(id) => microphone.request(id)}
                />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {microphone.state.status === "requesting" && (
                <Spinner aria-label={m.candidate_device_check_microphone()} />
              )}
              {microphone.state.status === "ready" && (
                <>
                  {microphone.state.preview.context && (
                    <MicrophoneMeter
                      context={microphone.state.preview.context}
                      stream={microphone.state.preview.stream}
                      onDetected={setHeardStream}
                    />
                  )}
                  {ready && (
                    <span className="text-success-foreground">
                      <IconCheck aria-hidden="true" className="size-4" />
                      <span className="sr-only">{m.candidate_device_sound_detected()}</span>
                    </span>
                  )}
                </>
              )}
              {(microphone.state.status === "idle" || microphone.state.status === "error") && (
                <Button size="xs" variant="outline" onClick={() => microphone.request()}>
                  {microphone.state.status === "idle"
                    ? m.candidate_device_check_microphone()
                    : m.candidate_device_recheck()}
                </Button>
              )}
            </div>
          </div>
          {microphone.state.status === "error" && (
            <DeviceError failure={microphone.state.failure} />
          )}
          {microphone.state.status === "ready" && !ready && (
            <output className="text-xs leading-5 text-muted-foreground">
              {m.candidate_device_speak()}
            </output>
          )}
        </section>
        <Separator />
        <section aria-labelledby="camera-heading" className="flex flex-col gap-3 px-3.5 py-3">
          <div className="flex min-h-7 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <IconVideo aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
              <h3 id="camera-heading" className="shrink-0 text-sm font-medium">
                {m.candidate_device_camera_optional()}
              </h3>
              {camera.state.status === "ready" && (
                <DeviceSelect
                  kind="video"
                  preview={camera.state.preview}
                  onChange={(id) => camera.request(id)}
                />
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {camera.state.status === "requesting" && (
                <Spinner aria-label={m.candidate_device_requesting()} />
              )}
              <Switch
                aria-labelledby="camera-heading"
                checked={camera.state.status === "requesting" || camera.state.status === "ready"}
                disabled={camera.state.status === "requesting"}
                onCheckedChange={(checked) => (checked ? camera.request() : camera.stop())}
              />
            </div>
          </div>
          {camera.state.status === "error" && <DeviceError failure={camera.state.failure} />}
          {camera.state.status === "ready" && (
            <CameraPreview stream={camera.state.preview.stream} />
          )}
        </section>
      </Card>
      <p className="text-xs leading-5 text-muted-foreground">{m.candidate_ready_environment()}</p>
      {ready && (
        <output className="flex items-center justify-center gap-2 text-sm text-success-foreground">
          <IconCheck aria-hidden="true" className="size-4" />
          {m.candidate_device_ready()}
        </output>
      )}
      <div className="flex justify-center">
        <Button variant="outline" onClick={onBack}>
          {hasForms ? m.candidate_form_edit() : m.candidate_interview_back()}
        </Button>
      </div>
    </div>
  );
}
