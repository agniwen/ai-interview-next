import { describe, expect, it, vi } from "vitest";
import { createDeepSeekTextExtractor } from "../src/lib/pdf-text/deepseek";

const options = { apiKey: "test-key", baseUrl: "https://api.deepseek.com", timeoutMs: 1000 };
const pdf = new TextEncoder().encode("x%PDF-1.7x").subarray(1, -1);

describe("DeepSeek resume OCR", () => {
  it.each(["application/pdf", "image/jpeg", "image/png"] as const)(
    "uploads %s with its filename and joins complete pages",
    async (mediaType) => {
      const send = vi.fn<typeof fetch>(async (url, init) => {
        const request = new Request(url, init);
        expect(request.url).toBe("https://api.deepseek.com/v1/tools/ocr");
        expect(request.headers.get("authorization")).toBe("Bearer test-key");
        const form = await request.formData();
        expect(form.get("purpose")).toBe("text_recognition");
        const file = form.get("file") as File;
        expect(file.type).toBe(mediaType);
        expect(file.name).toBe(`resume.${mediaType.split("/")[1]}`);
        expect(await file.text()).toBe("%PDF-1.7");
        return Response.json({
          pages: [
            { finish_reason: "stop", index: 1, text: "第二页" },
            {
              finish_reason: "stop",
              index: 0,
              text: "<｜ref｜>text<｜/ref｜><｜box｜>[[1,2,3,4]]<｜/box｜>第一页",
            },
          ],
        });
      });
      const extract = createDeepSeekTextExtractor({ ...options, fetch: send });
      await expect(extract(pdf, mediaType)).resolves.toEqual({ text: "第一页\n\n第二页" });
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it("replaces only truncated pages with their complete layout recognition output", async () => {
    const responses = [
      {
        pages: [
          { finish_reason: "stop", index: 0, text: "保留第一页" },
          { finish_reason: "length", index: 1, text: "截断内容" },
        ],
      },
      {
        pages: [
          { finish_reason: "stop", index: 0, text: "备用第一页" },
          { finish_reason: "stop", index: 1, text: "补齐第二页" },
        ],
      },
    ];
    const purposes: (FormDataEntryValue | null)[] = [];
    const extract = createDeepSeekTextExtractor({
      ...options,
      async fetch(url, init) {
        const form = await new Request(url, init).formData();
        purposes.push(form.get("purpose"));
        return Response.json(responses[purposes.length - 1]);
      },
    });
    await expect(extract(pdf)).resolves.toEqual({ text: "保留第一页\n\n补齐第二页" });
    expect(purposes).toEqual(["text_recognition", "rich_layout_recognition"]);
  });

  it.each([
    Response.json({ pages: [{ finish_reason: "length", index: 0, text: "partial" }] }),
    Response.json({ error: { code: "gateway_timeout_error" } }),
    Response.json({}, { status: 429 }),
  ])("rejects incomplete or failed recognition", async (response) => {
    const extract = createDeepSeekTextExtractor({
      ...options,
      fetch: () => Promise.resolve(response.clone()),
    });
    await expect(extract(pdf)).rejects.toThrow();
  });
});
