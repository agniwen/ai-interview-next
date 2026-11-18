import type { Database } from "@ai-interview/db";
import { z } from "zod";
import { insertUsage, interviewUsageOwner } from "../usage/service";
import { agentReportSession } from "./report";

const tokens = z.number().int().nonnegative();

export const agentUsageInput = z.strictObject({
  cachedInputTokens: tokens.optional(),
  inputAudioTokens: tokens.optional(),
  inputTokens: tokens,
  model: z.string().trim().min(1).max(200),
  occurredAt: z.number().int().min(0).max(253_402_300_799_999),
  outputAudioTokens: tokens.optional(),
  outputTokens: tokens,
  requestId: z.string().trim().min(1).max(200),
  retry: z.boolean(),
  stage: z.enum(["interview_realtime", "interview_reconciliation"]),
  version: z.literal(1),
});

export async function recordInterviewUsage(
  db: Database,
  id: string,
  credential: string,
  input: z.output<typeof agentUsageInput>,
) {
  const entry = await agentReportSession(db, id, credential);
  if (entry?.round.kind !== "ai") {
    return null;
  }
  const owner = await interviewUsageOwner(db, entry.round.workspaceId, entry.session.content);
  if (owner) {
    const { occurredAt, version: _version, ...call } = input;
    await insertUsage(
      db,
      owner,
      [
        {
          ...call,
          id: `${input.stage}:${id}:${input.requestId}`,
          occurredAt: new Date(occurredAt),
          provider: input.stage === "interview_realtime" ? "dashscope" : "openai",
        },
      ],
      id,
    );
  }
  return { version: 1 as const };
}
