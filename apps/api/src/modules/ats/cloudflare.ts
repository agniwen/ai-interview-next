import { createDatabase } from "@ai-interview/db";
import pdfiumWasm from "@embedpdf/pdfium/pdfium.wasm";
import { WorkflowEntrypoint } from "cloudflare:workers";
import type { WorkflowEvent, WorkflowStep } from "cloudflare:workers";
import type { MessageBatch } from "@cloudflare/workers-types";
import type { ApiBindings } from "../../env";
import { createDeepSeekTextExtractor } from "../../lib/pdf-text/deepseek";
import { createResumeAvatarExtractor } from "../../lib/resume-avatar";
import {
  avatarPromptVersion,
  avatarTimeoutMs,
  createDeepSeekPortraitLocator,
} from "../../lib/resume-avatar/deepseek";
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
  const { DEEPSEEK_BASE_URL: baseUrl, DEEPSEEK_MODEL: model, DEEPSEEK_API_KEY: apiKey } = env;
  const timeoutMs = 120_000;
  const ocrTimeoutMs = 185_000;
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
              model,
              promptVersion: avatarPromptVersion,
              timeoutMs: avatarTimeoutMs,
              version: 1,
            },
            evaluate: createResumeEvaluator({ apiKey, baseUrl, model, timeoutMs }),
            evaluateParameters: { ...structuring, promptVersion: 3 },
            extract: (transport) =>
              createDeepSeekTextExtractor({
                apiKey,
                baseUrl,
                fetch: transport,
                timeoutMs: ocrTimeoutMs,
              }),
            extractAvatar: (bytes, mediaType, transport) =>
              createResumeAvatarExtractor(
                renderPdfFirstPage,
                createDeepSeekPortraitLocator({
                  apiKey,
                  baseUrl,
                  fetch: transport,
                  model,
                }),
              )(bytes, mediaType),
            extractParameters: {
              endpoint: `${baseUrl}/v1/tools/ocr`,
              model: "deepseek-ocr",
              promptVersion: 1,
              timeoutMs: ocrTimeoutMs * 2,
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
