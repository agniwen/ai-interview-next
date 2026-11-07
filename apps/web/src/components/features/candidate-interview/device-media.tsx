import { useEffect, useRef, useState } from "react";
import { Meter } from "@/components/ui/meter";
import * as m from "@/paraglide/messages";
import { microphoneLevel } from "./device-preview";

/**
 * 只分析本地麦克风输入，显示音量并在检测到声音后通知外层；不连接扬声器、不上传音频。
 * Analyzes local microphone input and reports detected sound without connecting speakers or uploading audio.
 */
export function MicrophoneMeter({
  stream,
  context,
  onDetected,
}: {
  stream: MediaStream;
  context: AudioContext;
  onDetected: (stream: MediaStream) => void;
}) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    const source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    let detected = false;
    const interval = setInterval(() => {
      analyser.getFloatTimeDomainData(samples);
      const next = microphoneLevel(samples);
      setLevel(Math.round(next * 100));
      if (!detected && next > 0.05) {
        detected = true;
        onDetected(stream);
      }
    }, 100);
    return () => {
      clearInterval(interval);
      source.disconnect();
      analyser.disconnect();
    };
  }, [context, onDetected, stream]);
  return (
    <Meter aria-label={m.candidate_device_volume()} value={level} max={100} className="w-auto">
      <span aria-hidden="true" className="flex h-3 items-end gap-0.5">
        {[40, 55, 70, 85, 100].map((height, index) => (
          <span
            key={height}
            data-active={index < Math.round(level / 20)}
            className="w-1 rounded-full bg-input transition-colors duration-100 data-[active=true]:bg-success-foreground"
            style={{ height: `${height}%` }}
          />
        ))}
      </span>
    </Meter>
  );
}

/**
 * 本地摄像头预览使用静音内联播放，卸载时解除视频元素对媒体流的引用。
 * Local camera preview plays muted and inline, detaching the video element from its stream on unmount.
 */
export function CameraPreview({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
    }
    return () => {
      if (video) {
        video.srcObject = null;
      }
    };
  }, [stream]);
  return (
    <video
      ref={videoRef}
      aria-label={m.candidate_device_camera_preview()}
      autoPlay
      muted
      playsInline
      className="aspect-video w-full -scale-x-100 rounded-lg bg-muted object-cover"
    />
  );
}
