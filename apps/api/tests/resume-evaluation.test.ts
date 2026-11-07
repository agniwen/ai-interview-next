import type { QualitativeEvaluation } from "@ai-interview/db/application-evaluation";
import { expect, it, vi } from "vitest";
import { createResumeEvaluator } from "../src/lib/resume-evaluation";

const result: QualitativeEvaluation = {
  conciseOverall: "Relevant API experience; confirm project ownership",
  detailedOverall: {
    judgment: "Interview to confirm the candidate's contribution.",
    matchingEvidence: [
      {
        content: "Built APIs",
        jobRequirement: "API development",
        point: "APIs",
        resumeEvidence: "Built API services",
      },
    ],
    risks: [
      {
        content: "Confirm leadership",
        jobRequirement: "Mentoring",
        point: "Leadership",
        resumeEvidence: null,
      },
    ],
  },
  recommendationLevel: "undecided",
  version: 3,
};
const evaluate = createResumeEvaluator({
  apiKey: "test",
  baseUrl: "https://model.example/v1",
  model: "test",
  timeoutMs: 1000,
});

it("evaluates the resume against both job requirements and internal criteria", async () => {
  const input = {
    internalCriteria: "Mentoring",
    profile: { identity: { name: "Candidate" }, version: 1 },
    requirements: "API development",
  };
  const transport = vi.fn<typeof fetch>(async (url, init) => {
    const request = new Request(url, init);
    expect(request.url).toBe("https://model.example/v1/chat/completions");
    expect(await request.json()).toMatchObject({
      max_tokens: 8192,
      messages: [
        { content: expect.stringContaining("岗位匹配评价"), role: "system" },
        { content: JSON.stringify({ ...input, version: 1 }), role: "user" },
      ],
    });
    return Response.json({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(result) } }],
    });
  });
  await expect(evaluate(input, transport)).resolves.toEqual(result);
});

it.each([
  { content: JSON.stringify({ ...result, version: 2 }), finish: "stop" },
  { content: JSON.stringify({ ...result, dimensions: {} }), finish: "stop" },
  {
    content: JSON.stringify({
      ...result,
      detailedOverall: { judgment: "Missing evidence arrays" },
    }),
    finish: "stop",
  },
  { content: JSON.stringify(result), finish: "length" },
])("rejects incompatible or truncated AI output ($finish)", async ({ content, finish }) => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json({ choices: [{ finish_reason: finish, message: { content } }] }),
    );
  await expect(
    evaluate({ internalCriteria: "", profile: null, requirements: "APIs" }, transport),
  ).rejects.toThrow();
});
