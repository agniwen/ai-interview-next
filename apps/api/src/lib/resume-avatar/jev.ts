import { Buffer } from "node:buffer";
import { z } from "zod";
import type { ResumeImageType } from "../resume-file";

export const jevAvatarModel = "typesafe-ai/jev-1.14.0";
export const jevAvatarPromptVersion = 2;
export const jevAvatarTimeoutMs = 15_000;
export const jevImageMinSide = 280;
export const jevImageMaxSide = 1568;

const fraction = z.number().min(0).max(1);
const boxSchema = z
  .object({ bottom: fraction, left: fraction, right: fraction, top: fraction })
  .refine(({ bottom, left, right, top }) => left < right && top < bottom);
const jevResponse = z.object({
  answers: z.object({
    hasPortrait: z.object({ probability: fraction, type: z.literal("boolean") }),
    portrait: z.object({ box: boxSchema, type: z.literal("box") }),
  }),
  providerMetadata: z.object({
    typesafe: z.object({ confidence: z.object({ portrait: fraction }) }),
  }),
});

export type PortraitBox = z.infer<typeof boxSchema>;

export async function locateResumePortrait(
  bytes: Uint8Array,
  mediaType: ResumeImageType,
  apiKey: string,
): Promise<PortraitBox | null> {
  const response = await fetch("https://ai-gateway.vercel.sh/v4/ai/decision-model", {
    body: JSON.stringify({
      questions: {
        hasPortrait: {
          instructions: "Does this resume contain a portrait photo?",
          type: "boolean",
        },
        portrait: {
          instructions:
            "Find the tight rectangle around the candidate's portrait photograph on this resume page, including the photograph's background but excluding the surrounding document text.",
          type: "box",
        },
      },
      stateParts: [
        {
          data: { data: Buffer.from(bytes).toString("base64"), type: "data" },
          mediaType,
          type: "file",
        },
      ],
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "TypeSafe-Danger-Zone-Images": "true",
      "ai-decision-model-specification-version": "4",
      "ai-gateway-auth-method": "api-key",
      "ai-gateway-protocol-version": "0.0.1",
      "ai-model-id": jevAvatarModel,
    },
    method: "POST",
    signal: AbortSignal.timeout(jevAvatarTimeoutMs),
  });
  if (!response.ok) {
    throw new Error(`JEV_AVATAR_HTTP_${response.status}`);
  }
  const { answers, providerMetadata } = jevResponse.parse(await response.json());
  return answers.hasPortrait.probability >= 0.8 &&
    providerMetadata.typesafe.confidence.portrait >= 0.5
    ? answers.portrait.box
    : null;
}
