import { z } from "zod";
import type { PdfTextExtractor } from "./index";

const pageSchema = z.object({
  finish_reason: z.enum(["stop", "length"]),
  index: z.number().int(),
  text: z.string(),
});

const resultSchema = z.object({ pages: z.array(pageSchema).min(1) });
const completePageSchema = pageSchema.extend({ finish_reason: z.literal("stop") });

export function createDeepSeekTextExtractor({
  apiKey,
  baseUrl,
  fetch: request = fetch,
  timeoutMs,
}: {
  apiKey: string;
  baseUrl: string;
  fetch?: typeof fetch;
  timeoutMs: number;
}): PdfTextExtractor {
  return async (document, mediaType = "application/pdf") => {
    const file = new Blob([new Uint8Array(document)], { type: mediaType });
    const recognize = async (purpose: "text_recognition" | "rich_layout_recognition") => {
      const form = new FormData();
      form.set("file", file, `resume.${mediaType.split("/")[1]}`);
      form.set("purpose", purpose);
      const response = await request(`${baseUrl}/v1/tools/ocr`, {
        body: form,
        headers: { Authorization: `Bearer ${apiKey}` },
        method: "POST",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`DeepSeek OCR returned HTTP ${response.status}`);
      }
      return resultSchema.parse(await response.json()).pages;
    };

    const pages = await recognize("text_recognition");
    const layoutPages = pages.some((page) => page.finish_reason === "length")
      ? await recognize("rich_layout_recognition")
      : [];
    const recoveredPages = new Map(layoutPages.map((page) => [page.index, page]));
    // API 类型也由较早 ES 版本的客户端消费。 / The client also consumes API types with an older ES target.
    // oxlint-disable-next-line unicorn/no-array-sort
    pages.sort((a, b) => a.index - b.index);
    const text = pages
      .map((page) =>
        completePageSchema
          .parse(page.finish_reason === "length" ? recoveredPages.get(page.index) : page)
          .text.replaceAll(
            /<[|｜]ref[|｜]>[^<]*<[|｜]\/ref[|｜]>\s*<[|｜]box[|｜]>[^<]*<[|｜]\/box[|｜]>/gu,
            "",
          )
          .trim(),
      )
      .join("\n\n")
      .trim();
    return { text };
  };
}
