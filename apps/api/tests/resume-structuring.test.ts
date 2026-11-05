import { describe, expect, it, vi } from "vitest";
import { createDefaultResumeStructurer } from "../src/lib/resume-structuring/default";

const options = {
  apiKey: "test-agent-key",
  baseUrl: "https://agent-chat.example/v1/",
  model: "test-agent-model",
};

describe("Default resume structuring", () => {
  it("passes resume text to the configured model and returns the validated v1 profile", async () => {
    const text = "2020.08–至今 甲公司 高级产品经理\n2024–至今 运营负责人\n生物科学 学士";
    const profile = {
      education: [{ degree: "学士", level: null }],
      employment: [
        {
          employer: "甲公司",
          stages: [{ period: { end: "ongoing", start: { year: 2024 } }, title: "运营负责人" }],
          title: "高级产品经理",
        },
      ],
      version: 1,
    };
    const request = vi.fn<typeof fetch>(async (url, init) => {
      const call = new Request(url, init);
      expect(call.url).toBe("https://agent-chat.example/v1/chat/completions");
      expect(call.headers.get("authorization")).toBe("Bearer test-agent-key");
      expect(await call.json()).toMatchObject({
        messages: [
          { content: expect.stringContaining('"const":1'), role: "system" },
          { content: text, role: "user" },
        ],
        model: "test-agent-model",
        response_format: { type: "json_object" },
      });
      return Response.json({
        choices: [{ finish_reason: "stop", message: { content: JSON.stringify(profile) } }],
      });
    });
    const structureResume = createDefaultResumeStructurer({
      ...options,
      fetch: request,
    });

    await expect(structureResume(text)).resolves.toEqual(profile);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("rejects a response with the experimental version", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        choices: [{ finish_reason: "stop", message: { content: '{"version":2}' } }],
      }),
    );
    const structureResume = createDefaultResumeStructurer({
      ...options,
      fetch: request,
    });

    await expect(structureResume("简历")).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ["version"] })],
    });
  });
});
