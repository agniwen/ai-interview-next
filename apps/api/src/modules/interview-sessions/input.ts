import { z } from "zod";
import { interviewEventKinds } from "@ai-interview/db/interview-report";

const evidence = z.strictObject({
  quote: z.string().trim().min(1).max(8000),
  turnId: z.string().min(1).max(200),
});
export const interviewPlanInput = z.strictObject({
  questions: z
    .array(
      z.strictObject({
        code: z.string().regex(/^q[1-9][0-9]*$/u),
        content: z.string().min(1).max(1000),
        id: z.uuid(),
        points: z
          .array(
            z.strictObject({
              id: z.string().regex(/^q[1-9][0-9]*\.p[1-9][0-9]*$/u),
              label: z.string().trim().min(1).max(300),
            }),
          )
          .min(1)
          .max(8),
      }),
    )
    .min(1)
    .max(200),
  version: z.literal(1),
});
export const interviewProgressInput = z.strictObject({
  answers: z
    .array(
      z.strictObject({
        evidence: z.array(evidence).min(1).max(20),
        pointId: z.string().min(1).max(100),
        status: z.enum(["answered", "declined", "unknown", "insufficient"]),
        summary: z.string().trim().min(1).max(3000),
      }),
    )
    .max(1600),
  asked: z
    .array(z.strictObject({ evidence: z.array(evidence).min(1).max(20), questionId: z.uuid() }))
    .max(200),
  endReason: z.enum(["completed", "candidate_requested", "interrupted"]).nullable(),
  finalized: z.boolean(),
  revision: z.number().int().min(1),
  summary: z.string().max(12_000),
  usage: z.strictObject({
    cachedInputTokens: z.number().int().nonnegative(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
  version: z.literal(1),
});
export const interviewTurnsInput = z.strictObject({
  turns: z
    .array(
      z.strictObject({
        at: z.number().int().nonnegative(),
        id: z.string().min(1).max(200),
        interrupted: z.boolean(),
        role: z.enum(["user", "assistant"]),
        speakerName: z.string().trim().min(1).max(200).optional(),
        text: z.string().trim().min(1).max(32_000),
      }),
    )
    .min(1)
    .max(100),
  version: z.literal(1),
});
export const interviewEndInput = z.strictObject({
  reason: z.enum(["completed", "candidate_requested"]),
  version: z.literal(1),
});

const eventContent = z.strictObject({
  attempt: z.number().int().min(0).max(1000).nullable(),
  kind: z.enum(interviewEventKinds),
  reason: z.string().max(100).nullable(),
  recoverable: z.boolean().nullable(),
  version: z.literal(1),
});
const event = z.strictObject({
  at: z.number().int().nonnegative(),
  content: eventContent,
  id: z.uuid(),
  runId: z.string().min(1).max(200),
});
export const agentEventsInput = z.strictObject({
  events: z
    .array(
      event.extend({
        content: eventContent.extend({
          kind: z.enum([
            "agent_started",
            "agent_resumed",
            "agent_ready",
            "agent_closed",
            "system_error",
            "candidate_connected",
            "candidate_disconnected",
            "realtime_reconnecting",
            "realtime_reconnected",
            "realtime_rotated",
            "realtime_failed",
            "report_ready",
            "report_failed",
          ]),
        }),
      }),
    )
    .min(1)
    .max(50),
  version: z.literal(1),
});
export const candidateEventsInput = z.strictObject({
  events: z
    .array(
      event.extend({
        content: eventContent.extend({
          kind: z.enum([
            "candidate_left",
            "room_reconnecting",
            "room_reconnected",
            "room_disconnected",
          ]),
        }),
      }),
    )
    .min(1)
    .max(50),
  version: z.literal(1),
});
