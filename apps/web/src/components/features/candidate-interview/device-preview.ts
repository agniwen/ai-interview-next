export type PreviewKind = "audio" | "video";
export type DeviceFailure =
  | "denied"
  | "missing"
  | "busy"
  | "unsupported"
  | "disconnected"
  | "unavailable";

export interface DevicePreview {
  context: AudioContext | null;
  deviceId: string | undefined;
  devices: MediaDeviceInfo[];
  stream: MediaStream;
}

export function deviceFailure(error: unknown): DeviceFailure {
  const name = error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "denied";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "missing";
  }
  if (name === "NotReadableError" || name === "AbortError") {
    return "busy";
  }
  if (name === "NotSupportedError") {
    return "unsupported";
  }
  return "unavailable";
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

/**
 * 取得本地预览资源；release 也会释放仍在等待用户授权的请求最终返回的媒体轨道。
 * Acquires local preview resources; release also stops tracks returned after a pending permission request resolves.
 */
export function openDevicePreview(
  kind: PreviewKind,
  deviceId: string | undefined,
  onEnded: () => void,
) {
  if (!navigator.mediaDevices?.getUserMedia || (kind === "audio" && !globalThis.AudioContext)) {
    throw new DOMException("Media capture is unavailable", "NotSupportedError");
  }
  // 在点击事件中恢复音频上下文；等待权限后再创建会被部分浏览器的自动播放策略挂起。
  // Resume the audio context in the click event; creating it after permission can trigger browser autoplay suspension.
  const lifetime = new AbortController();
  const context = kind === "audio" ? new AudioContext() : null;
  const audioReady = context?.resume();
  const device = deviceId ? { deviceId: { exact: deviceId } } : {};
  const capture = navigator.mediaDevices.getUserMedia(
    kind === "audio"
      ? {
          audio: {
            ...device,
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true,
          },
          video: false,
        }
      : { audio: false, video: device },
  );
  const ready = Promise.all([capture, audioReady]).then(
    async ([stream]): Promise<DevicePreview> => {
      const [track] = stream.getTracks();
      track.addEventListener("ended", onEnded, { signal: lifetime.signal });
      const devices = await navigator.mediaDevices.enumerateDevices();
      return {
        context,
        deviceId: deviceId ?? track.getSettings().deviceId,
        devices: devices.filter((item) => item.kind === `${kind}input`),
        stream,
      };
    },
  );
  return {
    ready,
    release: async () => {
      lifetime.abort();
      await Promise.allSettled([capture.then(stopStream), context?.close()]);
    },
  };
}

export function microphoneLevel(samples: Float32Array) {
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  // 只放大音量表的视觉反馈，不改变录音轨道的增益。
  // Amplify the meter's visual feedback without changing the recording track's gain.
  return Math.min(1, Math.sqrt(sum / samples.length) * 6);
}
