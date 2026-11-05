import { z } from "zod";

export const stageMessage = z.strictObject({
  attemptId: z.string(),
  runId: z.string(),
  version: z.literal(1),
});
export const workflowInput = z.strictObject({ runId: z.string(), version: z.literal(1) });

export type StageMessage = z.infer<typeof stageMessage>;
export type WorkflowInput = z.infer<typeof workflowInput>;
export type ResumeStage = "extract_text" | "structure" | "evaluate";

export interface ResumeObjectStore {
  signUpload: (objectKey: string) => Promise<string>;
  head: (objectKey: string) => Promise<{ size: number } | null>;
  read: (objectKey: string) => Promise<Uint8Array>;
  write: (objectKey: string, bytes: ArrayBuffer) => Promise<void>;
}

export interface ResumeStageQueue {
  publish: (stage: ResumeStage, message: StageMessage) => Promise<void>;
}

export interface ResumeWorkflowRuntime {
  start: (executionId: string, input: WorkflowInput) => Promise<void>;
  notifyAttemptFinished: (executionId: string, event: StageMessage) => Promise<void>;
}

export interface ResumeWorkflowSteps {
  checkpoint: <T extends Record<string, string | number | boolean | null>>(
    name: string,
    fn: () => Promise<T>,
  ) => Promise<T>;
  waitForAttempt: (name: string, attemptId: string, timeoutMs: number) => Promise<void>;
  sleep: (name: string, milliseconds: number) => Promise<void>;
}
