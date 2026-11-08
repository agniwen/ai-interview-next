import { z } from "zod";
import type { InterviewDevices } from "./device-check";

const resumeSchema = z.object({
  autoResume: z.boolean(),
  devices: z.object({
    cameraEnabled: z.boolean(),
    cameraId: z.string().optional(),
    microphoneEnabled: z.boolean(),
    microphoneId: z.string().optional(),
  }),
  version: z.literal(1),
});
export type InterviewResumeState = z.output<typeof resumeSchema>;

export function parseInterviewResumeState(value: string | null): InterviewResumeState | null {
  try {
    const result = resumeSchema.safeParse(JSON.parse(value ?? "null"));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function readInterviewResumeState(token: string) {
  try {
    return parseInterviewResumeState(sessionStorage.getItem(`interview:${token}`));
  } catch {
    return null;
  }
}

export function saveInterviewResumeState(
  token: string,
  devices: InterviewDevices,
  autoResume: boolean,
) {
  try {
    sessionStorage.setItem(
      `interview:${token}`,
      JSON.stringify({ autoResume, devices, version: 1 } satisfies InterviewResumeState),
    );
  } catch {
    // 浏览器禁用存储时仍可通话，刷新后使用关闭的媒体开关。
    // Calls still work with storage disabled; refresh then uses disabled media switches.
  }
}

export function restoredInterviewDevices(
  status: string,
  saved: InterviewResumeState | null,
): InterviewDevices | null {
  if (status !== "in_progress" || saved?.autoResume === false) {
    return null;
  }
  return saved?.devices ?? { cameraEnabled: false, microphoneEnabled: false };
}
