import {
  application,
  interviewFormResponse,
  interviewRound,
  questionSet,
} from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { app } from "../src/app";
import { atsTest, read } from "./ats-fixture";
import { fixture } from "./interview-fixture";

function request(token: string, action: "entry" | "form" | "form/submit", body?: object) {
  return app.request(
    `https://sainoa.example/api/candidate-interviews/${token}/${action}`,
    {
      body: body ? JSON.stringify(body) : undefined,
      headers: { "content-type": "application/json", origin: "https://sainoa.example" },
      method: action === "form" ? "PUT" : "POST",
    },
    atsTest.env,
    atsTest.platform.ctx,
  );
}

async function setup(name: string) {
  const f = await fixture(`candidate-form-${name}@example.com`);
  await atsTest.platform.database
    .update(questionSet)
    .set({
      content: {
        kind: "form",
        questions: [
          { content: "Experience?", description: "", type: "text" },
          {
            content: "Choose one",
            description: "",
            options: ["Same", "Same"],
            type: "single_choice",
          },
          {
            content: "Choose several",
            description: "",
            options: ["A", "B", "C"],
            type: "multiple_choice",
          },
          { content: "Experience?", description: "", type: "text" },
        ],
        version: 1,
      },
    })
    .where(eq(questionSet.id, f.form.id));
  const { id } = await read(f.owner.call(f.path, f.input));
  const { token } = await read(
    f.owner.request(`interviews/${f.owner.workspaceId}/${id}/invitation`, { method: "POST" }),
  );
  const entry = await read(request(token, "entry"));
  const [text, single, multiple, duplicate] = entry.questions.form.map((q: { id: string }) => q.id);
  const answers = {
    [duplicate]: "Another example",
    [multiple]: [2, 0],
    [single]: 0,
    [text]: "Built a platform",
  };
  return { ...f, answers, duplicate, entry, id, multiple, single, text, token };
}

it("saves incomplete drafts and restores exact answers independently of question text and library changes", async () => {
  const f = await setup("draft");
  expect(f.entry.form).toBeNull();
  const input = {
    answers: { [f.text]: "  Draft **Markdown**  ", [f.single]: null, [f.multiple]: [] },
    version: 1,
  };
  const saved = await read(request(f.token, "form", input));
  expect(saved).toMatchObject({
    form: { content: input, submittedAt: null, updatedAt: expect.any(String), version: 1 },
    version: 1,
  });
  await atsTest.platform.database
    .update(questionSet)
    .set({ content: { kind: "form", questions: [], version: 1 } })
    .where(eq(questionSet.id, f.form.id));
  const resumed = await read(request(f.token, "entry"));
  expect(resumed.form).toEqual(saved.form);
  expect(resumed.questions).toEqual(f.entry.questions);
  expect(resumed.status).toBe("scheduled");
  expect(resumed.form.content.answers).not.toHaveProperty(f.duplicate);
});

it("submits answers, reopens them as a draft before communication, and resubmits the latest answers", async () => {
  const f = await setup("submit");
  const submitted = await read(request(f.token, "form/submit", { answers: f.answers, version: 1 }));
  expect(submitted.form.submittedAt).toEqual(expect.any(String));
  const resumed = await read(request(f.token, "entry"));
  expect(resumed.form).toEqual(submitted.form);
  const changed = {
    answers: { ...f.answers, [f.text]: "Updated answer", [f.single]: 1 },
    version: 1,
  };
  expect(await read(request(f.token, "form", changed))).toMatchObject({
    form: { content: changed, submittedAt: null },
  });
  const resubmitted = await read(request(f.token, "form/submit", changed));
  expect(resubmitted.form).toMatchObject({
    content: changed,
    submittedAt: expect.any(String),
  });
  expect(
    await atsTest.platform.database
      .select()
      .from(interviewFormResponse)
      .where(eq(interviewFormResponse.interviewRoundId, f.id)),
  ).toHaveLength(1);
});

it("requires every question on submit, including a second question with identical text", async () => {
  const f = await setup("required");
  await Promise.all(
    [
      {},
      { ...f.answers, [f.text]: "  \n " },
      { ...f.answers, [f.single]: null },
      { ...f.answers, [f.multiple]: [] },
      Object.fromEntries(Object.entries(f.answers).filter(([id]) => id !== f.duplicate)),
    ].map(async (answers) => {
      // 每种缺失情况都经过真实提交接口。 / Exercise each incomplete case through the real submission endpoint.
      const response = await request(f.token, "form/submit", { answers, version: 1 });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INTERVIEW_FORM_INCOMPLETE", version: 1 });
    }),
  );
  const resumed = await read(request(f.token, "entry"));
  expect(resumed.form).toBeNull();
});

it("rejects unknown questions, incorrect types, invalid indices and malformed payloads without overwriting a draft", async () => {
  const f = await setup("invalid");
  const valid = { answers: f.answers, version: 1 };
  await request(f.token, "form", valid);
  const before = await read(request(f.token, "entry"));
  await Promise.all(
    [
      { answers: f.answers },
      { ...valid, version: 2 },
      { ...valid, extra: true },
      { ...valid, answers: { [crypto.randomUUID()]: "Foreign question" } },
      { ...valid, answers: { [f.text]: 1 } },
      { ...valid, answers: { [f.text]: "x".repeat(30_001) } },
      { ...valid, answers: { [f.single]: "Same" } },
      { ...valid, answers: { [f.single]: 2 } },
      { ...valid, answers: { [f.single]: -1 } },
      { ...valid, answers: { [f.single]: 0.5 } },
      { ...valid, answers: { [f.multiple]: [0, 0] } },
      { ...valid, answers: { [f.multiple]: [3] } },
      { ...valid, answers: { [f.multiple]: 0 } },
    ].map(async (input) => {
      // 无效请求不能覆盖已保存的草稿。 / Invalid requests must not replace the stored draft.
      const response = await request(f.token, "form", input);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INTERVIEW_FORM_INVALID", version: 1 });
    }),
  );
  const after = await read(request(f.token, "entry"));
  expect(after.form).toEqual(before.form);
});

it.each(["in_progress", "completed"])(
  "locks draft and submit writes when the round is %s",
  async (status) => {
    const f = await setup(status);
    const input = { answers: f.answers, version: 1 };
    const submitted = await read(request(f.token, "form/submit", input));
    await atsTest.platform.database
      .update(interviewRound)
      .set({ status })
      .where(eq(interviewRound.id, f.id));
    await Promise.all(
      (["form", "form/submit"] as const).map(async (action) => {
        // 草稿和提交遵守同一轮次锁定规则。 / Draft and submit share the round lock rule.
        const response = await request(f.token, action, input);
        expect(response.status).toBe(409);
        expect(await response.json()).toEqual({ error: "INTERVIEW_FORM_LOCKED", version: 1 });
      }),
    );
    const resumed = await read(request(f.token, "entry"));
    expect(resumed.form).toEqual(submitted.form);
  },
);

it("rejects invalid invitations and another round's answers, and cascades deletion", async () => {
  const f = await setup("access");
  const other = await setup("other");
  const input = { answers: f.answers, version: 1 };
  expect(await request("a".repeat(64), "form", input)).toMatchObject({ status: 404 });
  expect(await request("invalid", "form/submit", input)).toMatchObject({ status: 404 });
  expect(await request(other.token, "form", input)).toMatchObject({ status: 400 });
  await request(f.token, "form", input);
  await atsTest.platform.database
    .update(application)
    .set({ deletedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await request(f.token, "form", input)).toMatchObject({ status: 404 });
  await atsTest.platform.database
    .update(application)
    .set({ deletedAt: null })
    .where(eq(application.id, f.applicationId));
  await f.owner.request(`interviews/${f.owner.workspaceId}/${f.id}`, { method: "DELETE" });
  expect(await request(f.token, "form", input)).toMatchObject({ status: 404 });
  expect(
    await atsTest.platform.database
      .select()
      .from(interviewFormResponse)
      .where(eq(interviewFormResponse.interviewRoundId, f.id)),
  ).toEqual([]);
});

it.each(["ai", "human"])("does not create answers for form-free %s rounds", async (kind) => {
  const f = await fixture(`candidate-form-unavailable-${kind}@example.com`);
  const input =
    kind === "ai"
      ? { ...f.input, formQuestionSetIds: [] }
      : {
          admissionDeadline: "2099-01-01T01:00:00Z",
          interviewerUserIds: [f.owner.userId],
          kind: "human",
          scheduledAt: "2099-01-01T00:00:00Z",
          version: 1,
        };
  const { id } = await read(f.owner.call(f.path, input));
  const { token } = await read(
    f.owner.request(`interviews/${f.owner.workspaceId}/${id}/invitation`, { method: "POST" }),
  );
  await request(token, "entry");
  expect(await request(token, "form", { answers: {}, version: 1 })).toMatchObject({ status: 409 });
  expect(await request(token, "form/submit", { answers: {}, version: 1 })).toMatchObject({
    status: 409,
  });
});
