import { resumeParsedProfileSchema } from "@ai-interview/db/resume-profile";
import { z } from "zod";
import { resumeStructuringPrompt } from "./prompt";
import type { ResumeStructurer } from "./index";

interface DefaultResumeStructurerOptions {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
}

const completionSchema = z.object({
  choices: z.tuple([
    z.object({
      finish_reason: z.literal("stop"),
      message: z.object({ content: z.string() }),
    }),
  ]),
});

export function createDefaultResumeStructurer({
  apiKey,
  baseUrl,
  model,
  fetch: request = fetch,
  timeoutMs = 120_000,
}: DefaultResumeStructurerOptions): ResumeStructurer {
  const endpoint = `${baseUrl.replace(/\/$/u, "")}/chat/completions`;

  return async (text) => {
    const response = await request(endpoint, {
      body: JSON.stringify({
        enable_thinking: false,
        max_tokens: 8192,
        messages: [
          { content: resumeStructuringPrompt, role: "system" },
          { content: text, role: "user" },
        ],
        model,
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Resume structuring request failed with HTTP ${response.status}`);
    }

    const {
      choices: [choice],
    } = completionSchema.parse(await response.json());
    return resumeParsedProfileSchema.parse(JSON.parse(choice.message.content));
  };
}
