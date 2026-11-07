import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InterviewDeviceCheck } from "@/components/features/candidate-interview/device-check";
import {
  deviceFailure,
  microphoneLevel,
  openDevicePreview,
} from "@/components/features/candidate-interview/device-preview";
import * as m from "@/paraglide/messages";

function browserMedia() {
  const track = Object.assign(new EventTarget(), {
    getSettings: () => ({ deviceId: "mic-1" }),
    stop: vi.fn(),
  });
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const devices = [
    { deviceId: "mic-1", kind: "audioinput", label: "Microphone" },
    { deviceId: "camera-1", kind: "videoinput", label: "Camera" },
    { deviceId: "speaker-1", kind: "audiooutput", label: "Speakers" },
  ];
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  const enumerateDevices = vi.fn().mockResolvedValue(devices);
  const resume = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);
  class TestAudioContext {
    close = close;
    resume = resume;
  }
  vi.stubGlobal("navigator", { mediaDevices: { enumerateDevices, getUserMedia } });
  vi.stubGlobal("AudioContext", TestAudioContext);
  return { close, enumerateDevices, getUserMedia, resume, stream, track };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it("opens only the selected microphone, resumes audio, lists inputs and releases resources", async () => {
  const browser = browserMedia();
  const ended = vi.fn();
  const request = openDevicePreview("audio", "mic-1", ended);
  expect(browser.resume).toHaveBeenCalledOnce();
  const preview = await request.ready;
  expect(browser.getUserMedia).toHaveBeenCalledWith({
    audio: {
      autoGainControl: true,
      deviceId: { exact: "mic-1" },
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: false,
  });
  expect(preview.devices).toEqual([{ deviceId: "mic-1", kind: "audioinput", label: "Microphone" }]);
  expect(preview.deviceId).toBe("mic-1");
  browser.track.dispatchEvent(new Event("ended"));
  expect(ended).toHaveBeenCalledOnce();
  await request.release();
  expect(browser.track.stop).toHaveBeenCalledOnce();
  expect(browser.close).toHaveBeenCalledOnce();
  browser.track.dispatchEvent(new Event("ended"));
  expect(ended).toHaveBeenCalledOnce();
});

it("opens optional video separately without microphone or audio context", async () => {
  const browser = browserMedia();
  const request = openDevicePreview("video", "camera-1", vi.fn());
  const preview = await request.ready;
  expect(browser.getUserMedia).toHaveBeenCalledWith({
    audio: false,
    video: { deviceId: { exact: "camera-1" } },
  });
  expect(preview.context).toBeNull();
  expect(preview.devices).toEqual([{ deviceId: "camera-1", kind: "videoinput", label: "Camera" }]);
  expect(browser.resume).not.toHaveBeenCalled();
  await request.release();
  expect(browser.track.stop).toHaveBeenCalledOnce();
});

it("releases a stream even when permission is accepted after leaving the check", async () => {
  const browser = browserMedia();
  let accept!: (stream: MediaStream) => void;
  // eslint-disable-next-line promise/avoid-new -- 模拟用户稍后确认权限。 / Simulate a user accepting permission later.
  const permission = new Promise<MediaStream>((resolve) => {
    accept = resolve;
  });
  browser.getUserMedia.mockReturnValue(permission);
  const ended = vi.fn();
  const request = openDevicePreview("audio", undefined, ended);
  const released = request.release();
  accept(browser.stream);
  await Promise.all([request.ready, released]);
  expect(browser.track.stop).toHaveBeenCalledOnce();
  expect(browser.close).toHaveBeenCalledOnce();
  browser.track.dispatchEvent(new Event("ended"));
  expect(ended).not.toHaveBeenCalled();
});

it("surfaces denied access and can release the failed request", async () => {
  const browser = browserMedia();
  browser.getUserMedia.mockRejectedValue(new DOMException("Denied", "NotAllowedError"));
  const request = openDevicePreview("audio", undefined, vi.fn());
  await expect(request.ready).rejects.toMatchObject({ name: "NotAllowedError" });
  await request.release();
  expect(browser.close).toHaveBeenCalledOnce();
});

it.each([
  ["NotAllowedError", "denied"],
  ["NotFoundError", "missing"],
  ["OverconstrainedError", "missing"],
  ["NotReadableError", "busy"],
  ["NotSupportedError", "unsupported"],
  ["UnknownError", "unavailable"],
])("explains %s as %s", (name, failure) => {
  expect(deviceFailure(new DOMException("Device error", name))).toBe(failure);
});

it("reports unsupported browsers before attempting capture", () => {
  vi.stubGlobal("navigator", {});
  expect(() => openDevicePreview("audio", undefined, vi.fn())).toThrow(
    expect.objectContaining({ name: "NotSupportedError" }),
  );
});

it("measures silence and audio amplitude, clamping the visual meter", () => {
  expect(microphoneLevel(new Float32Array([0, 0, 0, 0]))).toBe(0);
  expect(microphoneLevel(new Float32Array([0.1, -0.1]))).toBeCloseTo(0.6);
  expect(microphoneLevel(new Float32Array([1, -1]))).toBe(1);
});

it("renders the initial check without requesting device permission", () => {
  const browser = browserMedia();
  const markup = renderToStaticMarkup(<InterviewDeviceCheck hasForms onBack={() => {}} />);
  expect(browser.getUserMedia).not.toHaveBeenCalled();
  expect(markup).toContain(m.candidate_device_check_microphone());
  expect(markup).toContain('aria-checked="false"');
  expect(markup).toContain(m.candidate_form_edit());
  expect(markup).not.toContain("<video");
  expect(markup).not.toContain(m.candidate_device_ready());
});
