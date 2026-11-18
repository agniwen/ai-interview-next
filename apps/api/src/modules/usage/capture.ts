import { z } from "zod";
import type { modelUsage } from "@ai-interview/db/schema";

type UsageRow = typeof modelUsage.$inferInsert;
export type UsageCall = Omit<
  UsageRow,
  "id" | "submissionId" | "userId" | "workspaceId" | "interviewRoundId"
>;
const tokens = z.number().int().nonnegative();
const usageResponse = z.object({
  choices: z.array(z.object({ finish_reason: z.string().nullish() })).optional(),
  id: z.string().optional(),
  model: z.string().optional(),
  page_count: tokens.optional(),
  pages: z.array(z.object({ finish_reason: z.string().nullish() })).optional(),
  usage: z.unknown().optional(),
});

const tokenUsage = z.object({
  completion_tokens: tokens,
  prompt_cache_hit_tokens: tokens.optional(),
  prompt_tokens: tokens,
  prompt_tokens_details: z.object({ cached_tokens: tokens.optional() }).nullish(),
});

export function captureUsage(
  stage: UsageCall["stage"],
  provider: UsageCall["provider"],
  model: string,
) {
  const calls: UsageCall[] = [];

  async function observe(response: Response) {
    const parsed = usageResponse.safeParse(
      await response
        .clone()
        .json()
        .catch(() => null),
    );
    if (!parsed.success) {
      return;
    }
    const { data } = parsed;
    const reported = tokenUsage.safeParse(data.usage).data;
    const retry =
      !response.ok ||
      Boolean(data.pages?.some((page) => page.finish_reason === "length")) ||
      Boolean(data.choices?.some((choice) => choice.finish_reason !== "stop"));
    const measurements =
      stage === "resume_ocr"
        ? { pages: data.page_count ?? data.pages?.length }
        : reported && {
            cachedInputTokens:
              reported.prompt_cache_hit_tokens ?? reported.prompt_tokens_details?.cached_tokens,
            inputTokens: reported.prompt_tokens,
            outputTokens: reported.completion_tokens,
          };
    if (!measurements || (!("inputTokens" in measurements) && measurements.pages === undefined)) {
      return;
    }

    calls.push({
      ...measurements,
      model: data.model || model,
      occurredAt: new Date(),
      provider,
      requestId:
        data.id ?? response.headers.get("x-request-id") ?? response.headers.get("request-id"),
      retry,
      stage,
    });
  }

  const rows = (failed: boolean) => calls.map((call) => (failed ? { ...call, retry: true } : call));
  return { observe, rows };
}
