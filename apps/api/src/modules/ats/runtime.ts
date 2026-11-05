import type { Database } from "@ai-interview/db";
import type { ApiBindings } from "../../env";
import type { ResumeStageQueue, ResumeWorkflowRuntime } from "./contracts";
import { dispatchResumeOutbox } from "./outbox";

export function flushResumeOutbox(env: ApiBindings, database: Database, runId?: string) {
  const queues = {
    evaluate: env.RESUME_EVALUATE_QUEUE,
    extract_text: env.RESUME_EXTRACT_QUEUE,
    structure: env.RESUME_STRUCTURE_QUEUE,
  };
  const queue: ResumeStageQueue = {
    async publish(stage, message) {
      await queues[stage].send(message);
    },
  };
  const workflow: ResumeWorkflowRuntime = {
    async notifyAttemptFinished(executionId, event) {
      const instance = await env.RESUME_WORKFLOW.get(executionId);
      await instance.sendEvent({ payload: event, type: `attempt-${event.attemptId}` });
    },
    async start(executionId, input) {
      const { errors } = await env.RESUME_WORKFLOW.createBatch({
        instances: [{ id: executionId, params: input }],
      });
      const error = errors.find((entry) => entry.code !== 10_405);
      if (error) {
        throw new Error(error.message);
      }
    },
  };
  return dispatchResumeOutbox(database, queue, workflow, runId);
}
