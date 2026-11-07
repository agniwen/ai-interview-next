import { useCallback, useEffect, useRef, useState } from "react";
import { deviceFailure, openDevicePreview } from "./device-preview";
import type { DeviceFailure, DevicePreview, PreviewKind } from "./device-preview";

export type DeviceState =
  | { status: "idle" | "requesting" }
  | { status: "ready"; preview: DevicePreview }
  | { status: "error"; failure: DeviceFailure };

/**
 * 按用户操作开启或切换设备，退出准备页时释放预览；麦克风与摄像头分别管理。
 * Opens or switches a device on user action and releases previews on exit; microphone and camera are managed independently.
 */
export function useDevicePreview(kind: PreviewKind) {
  const [state, setState] = useState<DeviceState>({ status: "idle" });
  const resource = useRef<ReturnType<typeof openDevicePreview> | null>(null);
  const release = useCallback(() => {
    const { current } = resource;
    resource.current = null;
    return current?.release();
  }, []);
  useEffect(
    () => () => {
      void release();
    },
    [release],
  );

  async function request(requestedId?: string) {
    const deviceId = requestedId ?? (state.status === "ready" ? state.preview.deviceId : undefined);
    setState({ status: "requesting" });
    await release();
    try {
      const pending = openDevicePreview(kind, deviceId, () => {
        setState({ failure: "disconnected", status: "error" });
      });
      resource.current = pending;
      const preview = await pending.ready;
      setState({ preview, status: "ready" });
    } catch (error) {
      void release();
      setState({ failure: deviceFailure(error), status: "error" });
    }
  }

  function stop() {
    void release();
    setState({ status: "idle" });
  }

  return { request, state, stop };
}
