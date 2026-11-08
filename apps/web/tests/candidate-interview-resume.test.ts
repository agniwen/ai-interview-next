import { expect, it } from "vitest";
import {
  parseInterviewResumeState,
  restoredInterviewDevices,
} from "@/components/features/candidate-interview/resume-state";

it("restores the selected devices and disabled media switches for an active round", () => {
  const devices = {
    cameraEnabled: false,
    cameraId: "camera-1",
    microphoneEnabled: false,
    microphoneId: "mic-1",
  };
  const saved = parseInterviewResumeState(
    JSON.stringify({ autoResume: true, devices, version: 1 }),
  );
  expect(restoredInterviewDevices("in_progress", saved)).toEqual(devices);
  expect(restoredInterviewDevices("in_progress", null)).toEqual({
    cameraEnabled: false,
    microphoneEnabled: false,
  });
});

it("does not auto-resume after leaving, removal, completion or cancellation", () => {
  const devices = { cameraEnabled: true, microphoneEnabled: true };
  expect(
    restoredInterviewDevices("in_progress", { autoResume: false, devices, version: 1 }),
  ).toBeNull();
  for (const status of ["scheduled", "completed", "cancelled"]) {
    expect(restoredInterviewDevices(status, { autoResume: true, devices, version: 1 })).toBeNull();
  }
});

it("rejects corrupt, incomplete and unsupported stored formats", () => {
  for (const value of [
    null,
    "{",
    '{"version":2}',
    '{"version":1,"autoResume":true,"devices":{}}',
  ]) {
    expect(parseInterviewResumeState(value)).toBeNull();
  }
});
