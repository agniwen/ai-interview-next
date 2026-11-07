import { createDatabase } from "@ai-interview/db";
import pdfiumWasm from "@embedpdf/pdfium/pdfium.wasm";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { MessageBatch } from "@cloudflare/workers-types";
import type { ApiBindings } from "../../env";
import { createVercelGatewayPdfTextExtractor } from "../../lib/pdf-text/vercel-gateway";
import { createResumeAvatarExtractor } from "../../lib/resume-avatar";
import {
  jevAvatarModel,
  jevAvatarPromptVersion,
  jevAvatarTimeoutMs,
} from "../../lib/resume-avatar/jev";
import { createPdfFirstPageRenderer } from "../../lib/resume-avatar/pdf-first-page";
import { createResumeEvaluator } from "../../lib/resume-evaluation";
import { createDefaultResumeStructurer } from "../../lib/resume-structuring/default";
import { stageMessage, workflowInput } from "./contracts";
import type { WorkflowInput } from "./contracts";
import { flushResumeOutbox } from "./runtime";
import { consumeResumeStage } from "./stages";
import { resumeObjectStore } from "./storage";
import { runResumeWorkflow } from "./workflow";

const renderPdfFirstPage = createPdfFirstPageRenderer(pdfiumWasm);

export class ResumeWorkflow extends WorkflowEntrypoint<ApiBindings, WorkflowInput> {
  async run(event: WorkflowEvent<WorkflowInput>, step: WorkflowStep) {
    const { env } = this;
    const db = createDatabase(env.AUTH_DB);
    await runResumeWorkflow(
      db,
      {
        async checkpoint(name, fn) {
          const serialized = await step.do(name, async () =>
            JSON.stringify({ value: await fn(), version: 1 }),
          );
          return JSON.parse(serialized).value;
        },
        sleep: (name, milliseconds) => step.sleep(name, milliseconds),
        async waitForAttempt(name, attemptId, timeout) {
          await step.waitForEvent(name, { timeout, type: `attempt-${attemptId}` }).catch(() => {
            // 等候超时后，工作流会重新读取数据库。 / After the wait expires, the workflow reads the database again.
          });
        },
      },
      workflowInput.parse(event.payload),
      event.instanceId,
      (runId) => flushResumeOutbox(env, db, runId),
    );
    await step.do("dispatch-follow-up", async () => {
      await flushResumeOutbox(env, db);
    });
  }
}

export async function resumeQueueHandler(batch: MessageBatch, env: ApiBindings) {
  const db = createDatabase(env.AUTH_DB);
  const { AGENT_CHAT_BASE_URL: baseUrl, AGENT_CHAT_MODEL: model, AGENT_CHAT_KEY: apiKey } = env;
  const timeoutMs = 120_000;
  const extractAvatar = createResumeAvatarExtractor(renderPdfFirstPage, env.AI_GATEWAY_API_KEY);
  const structuring = {
    endpoint: baseUrl,
    maxTokens: 8192,
    model,
    promptVersion: 1,
    temperature: 0.1,
    timeoutMs,
  };
  await Promise.all(
    batch.messages.map(async (message) => {
      const parsed = stageMessage.safeParse(message.body);
      if (!parsed.success) {
        message.ack();
        return;
      }
      try {
        await consumeResumeStage(
          db,
          {
            avatarParameters: {
              model: jevAvatarModel,
              promptVersion: jevAvatarPromptVersion,
              timeoutMs: jevAvatarTimeoutMs,
              version: 1,
            },
            evaluate: createResumeEvaluator({ apiKey, baseUrl, model, timeoutMs }),
            evaluateParameters: { ...structuring, promptVersion: 3 },
            extract: (transport) =>
              createVercelGatewayPdfTextExtractor({
                apiKey: env.AI_GATEWAY_API_KEY,
                fetch: transport,
                timeoutMs,
              }),
            extractAvatar,
            extractParameters: {
              endpoint: "https://ai-gateway.vercel.sh",
              model: "anthropic/claude-haiku-5.5",
              promptVersion: 1,
              timeoutMs,
            },
            storage: resumeObjectStore(env),
            structure: (transport) =>
              createDefaultResumeStructurer({
                apiKey,
                baseUrl,
                fetch: transport,
                model,
                timeoutMs,
              }),
            structureParameters: structuring,
          },
          parsed.data,
        );
        await flushResumeOutbox(env, db, parsed.data.runId);
        message.ack();
      } catch {
        message.retry();
      }
    }),
  );
}

export function resumeScheduledHandler(_controller: unknown, env: ApiBindings) {
  return flushResumeOutbox(env, createDatabase(env.AUTH_DB));
}
