import { describe, expect, it, vi } from "vitest";
import { createVercelGatewayPdfTextExtractor } from "../src/lib/pdf-text/vercel-gateway";

const pdf = new TextEncoder().encode("x%PDF-1.7x").subarray(1, -1);
const apiKey = "test-gateway-key";

describe("Vercel AI Gateway PDF text extraction", () => {
  it("sends the PDF bytes to Haiku in one request and returns its Markdown", async () => {
    const text = "# 工作经历\n\n- 软件工程师\n";
    const fetchPdf = vi.fn<typeof fetch>(async (url, init) => {
      const request = new Request(url, init);
      expect(new URL(request.url).origin).toBe("https://ai-gateway.vercel.sh");
      expect(request.method).toBe("POST");
      expect(request.headers.get("authorization")).toBe(`Bearer ${apiKey}`);
      expect(request.headers.get("ai-language-model-id")).toBe("anthropic/claude-haiku-5.5");
      expect(await request.json()).toMatchObject({
        prompt: [
          {
            content: [
              {
                data: { data: "JVBERi0xLjc=", type: "data" },
                mediaType: "application/pdf",
                type: "file",
              },
              { text: expect.stringContaining("Return only Markdown"), type: "text" },
            ],
            role: "user",
          },
        ],
      });
      return Response.json({
        content: [{ text, type: "text" }],
        finishReason: { raw: "STOP", unified: "stop" },
        usage: {
          inputTokens: { noCache: 10, total: 10 },
          outputTokens: { text: 8, total: 8 },
        },
      });
    });
    const extractPdfText = createVercelGatewayPdfTextExtractor({ apiKey, fetch: fetchPdf });

    await expect(extractPdfText(pdf)).resolves.toEqual({ text });
    expect(fetchPdf).toHaveBeenCalledTimes(1);
  });

  it("propagates a gateway failure without retrying the request", async () => {
    const fetchPdf = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({ error: { message: "Rate limit exceeded" } }, { status: 429 }),
      );
    const extractPdfText = createVercelGatewayPdfTextExtractor({ apiKey, fetch: fetchPdf });

    await expect(extractPdfText(pdf)).rejects.toThrow("Rate limit exceeded");
    expect(fetchPdf).toHaveBeenCalledTimes(1);
  });
});
