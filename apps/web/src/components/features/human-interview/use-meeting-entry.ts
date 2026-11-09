import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { InterviewDevices } from "../candidate-interview/device-check";
import {
  readInterviewResumeState,
  saveInterviewResumeState,
} from "../candidate-interview/resume-state";
import type { MeetingConnection } from "./client";

export function useMeetingEntry({
  key,
  status,
  connect,
  refresh,
}: {
  key: string;
  status: string;
  connect: () => Promise<MeetingConnection>;
  refresh: () => Promise<void>;
}) {
  const saved = useMemo(() => readInterviewResumeState(key), [key]);
  const [devices, setDevices] = useState(saved?.devices);
  const [departure, setDeparture] = useState<"left" | "interrupted">();
  const latestDevices = useRef(saved?.devices);
  const checkedResume = useRef(false);
  const { data, error, isPending, mutate, reset } = useMutation({ mutationFn: connect });

  useEffect(() => {
    if (checkedResume.current) {
      return;
    }
    checkedResume.current = true;
    if (status === "in_progress" && saved?.autoResume) {
      mutate();
    }
  }, [mutate, saved, status]);

  function handleStart(selection: InterviewDevices) {
    latestDevices.current = selection;
    setDevices(selection);
    setDeparture(undefined);
    mutate();
  }

  function handleDevicesChange(patch: Partial<InterviewDevices>) {
    if (!latestDevices.current) {
      return;
    }
    latestDevices.current = { ...latestDevices.current, ...patch };
    saveInterviewResumeState(key, latestDevices.current, true);
  }

  function handleLeave(interrupted: boolean) {
    const selection = latestDevices.current;
    if (selection) {
      saveInterviewResumeState(key, selection, false);
      setDevices(selection);
    }
    setDeparture(interrupted ? "interrupted" : "left");
    reset();
    void refresh();
  }

  return {
    connection: data,
    departure,
    devices,
    error,
    handleDevicesChange,
    handleLeave,
    handleStart,
    isPending,
  };
}
