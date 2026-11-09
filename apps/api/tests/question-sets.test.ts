import { questionSetContentSchema } from "@ai-interview/db/question-set";
import { member, questionSet } from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { hc } from "hono/client";
import { expect, expectTypeOf, it } from "vitest";
import { app } from "../src/app";
import type { AppType } from "../src/types";
import { account, atsTest, read } from "./ats-fixture";

const formContent = {
  kind: "form" as const,
  questions: [
    {
      content: "  可到岗时间？  ",
      options: ["  两周内  ", "一个月内"],
      type: "single_choice" as const,
    },
    { content: "工作地点？", options: ["上海", "北京"], type: "multiple_choice" as const },
    { content: "介绍最近的项目。", description: "  简要描述你的职责。  ", type: "text" as const },
  ],
  version: 1 as const,
};

const conversationContent = {
  kind: "conversation" as const,
  questions: [
    {
      content: "描述一次架构取舍。",
      difficulty: "hard" as const,
      evaluationCriteria: "  结合约束解释方案收益和代价。  ",
      evaluationFocus: "技术判断",
      followUpDirections: "其他方案为何不合适？",
    },
    { content: "介绍最近的项目。", difficulty: "easy" as const },
  ],
  version: 1 as const,
};

it("round-trips all form question types and preserves question and option order on edits", async () => {
  const owner = await account("question-set-form@example.com");
  const client = hc<AppType>("https://sainoa.example", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      owner.request(input.toString(), init ?? {}),
  });
  const endpoint = client.api["question-sets"][":workspaceId"];
  const created = await endpoint.$post({
    json: { content: formContent, description: "  入场资料  ", name: "  基础表单  ", version: 1 },
    param: { workspaceId: owner.workspaceId },
  });
  expectTypeOf(created.status).toEqualTypeOf<201 | 400>();
  expect(created.status).toBe(201);
  if (created.status !== 201) {
    throw new Error("Expected question set creation to succeed");
  }
  const { id, version } = await created.json();
  expectTypeOf(version).toEqualTypeOf<1>();
  const param = { id, workspaceId: owner.workspaceId };
  const detail = await endpoint[":id"].$get({ param });
  expect(detail.status).toBe(200);
  if (detail.status !== 200) {
    throw new Error("Expected question set detail to be available");
  }
  const saved = await detail.json();
  expectTypeOf(saved.content.kind).toEqualTypeOf<"form" | "conversation">();
  expect(saved).toMatchObject({
    content: {
      kind: "form",
      questions: [
        {
          content: "可到岗时间？",
          description: "",
          options: ["两周内", "一个月内"],
          type: "single_choice",
        },
        {
          content: "工作地点？",
          description: "",
          options: ["上海", "北京"],
          type: "multiple_choice",
        },
        { content: "介绍最近的项目。", description: "简要描述你的职责。", type: "text" },
      ],
      version: 1,
    },
    createdBy: owner.userId,
    description: "入场资料",
    id,
    name: "基础表单",
    version: 1,
    workspaceId: owner.workspaceId,
  });
  expect(saved.createdAt).toBe(saved.updatedAt);
  if (saved.content.kind !== "form") {
    throw new Error("Expected form content");
  }
  const reordered = {
    ...saved.content,
    questions: [
      saved.content.questions[2],
      { ...formContent.questions[1], options: ["北京", "上海"] },
      saved.content.questions[2],
    ],
  };
  const edited = await endpoint[":id"].$put({
    json: { content: reordered, description: "", name: "更新后的表单", version: 1 },
    param,
  });
  expect(edited.status).toBe(200);
  expect(await edited.json()).toEqual({ id, version: 1 });
  const updated = await read(owner.call(`question-sets/${owner.workspaceId}/${id}`));
  expect(updated).toMatchObject({
    content: reordered,
    createdAt: saved.createdAt,
    createdBy: owner.userId,
    description: "",
    name: "更新后的表单",
  });
  const stored = await atsTest.platform.database.query.questionSet.findFirst({
    where: eq(questionSet.id, id),
  });
  expect(stored?.content).toEqual(updated.content);
});

it("stores conversation guidance and allows workspace members to edit while preserving creator metadata", async () => {
  const owner = await account("question-set-conversation@example.com");
  const editor = await account("question-set-editor@example.com");
  const path = `question-sets/${owner.workspaceId}`;
  const { id } = await read(
    owner.call(path, {
      content: conversationContent,
      description: "技术面",
      name: "技术沟通",
      version: 1,
    }),
  );
  const initial = await read(owner.call(`${path}/${id}`));
  expect(initial.content).toEqual({
    kind: "conversation",
    questions: [
      { ...conversationContent.questions[0], evaluationCriteria: "结合约束解释方案收益和代价。" },
      {
        content: "介绍最近的项目。",
        difficulty: "easy",
        evaluationCriteria: "",
        evaluationFocus: "",
        followUpDirections: "",
      },
    ],
    version: 1,
  });
  await atsTest.platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: owner.workspaceId,
    role: "member",
    userId: editor.userId,
  });
  await atsTest.platform.database
    .update(questionSet)
    .set({ updatedAt: new Date(0) })
    .where(eq(questionSet.id, id));
  const content = {
    ...initial.content,
    questions: [
      initial.content.questions[1],
      { ...initial.content.questions[0], difficulty: "medium" },
    ],
  };
  const edited = await editor.request(`${path}/${id}`, {
    body: JSON.stringify({ content, name: "技术面试", version: 1 }),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
  expect(edited.status).toBe(200);
  const updated = await read(owner.call(`${path}/${id}`));
  expect(updated).toMatchObject({
    content,
    createdAt: initial.createdAt,
    createdBy: owner.userId,
    description: "技术面",
    name: "技术面试",
  });
  expect(Date.parse(updated.updatedAt)).toBeGreaterThan(0);
});

it.each(["form", "conversation"])(
  "saves and clears an empty %s set for later editing",
  async (kind) => {
    const owner = await account(`question-set-empty-${kind}@example.com`);
    const path = `question-sets/${owner.workspaceId}`;
    const content = { kind, questions: [], version: 1 };
    const input = { content, name: "Draft", version: 1 };
    const { id } = await read(owner.call(path, input));
    expect(await read(owner.call(`${path}/${id}`))).toMatchObject({ content, description: "" });
    const put = (nextContent: object) =>
      owner.request(`${path}/${id}`, {
        body: JSON.stringify({ ...input, content: nextContent }),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
    expect(await put(kind === "form" ? formContent : conversationContent)).toMatchObject({
      status: 200,
    });
    expect(await put(content)).toMatchObject({ status: 200 });
    expect(await read(owner.call(path))).toMatchObject({
      rows: [{ id, kind, questionCount: 0 }],
      total: 1,
    });
  },
);

it("combines kind and search filters before pagination with deterministic totals and ordering", async () => {
  const owner = await account("question-set-list@example.com");
  const outsider = await account("question-set-list-outsider@example.com");
  const path = `question-sets/${owner.workspaceId}`;
  expect(await read(owner.call(path))).toEqual({
    page: 1,
    pageSize: 20,
    rows: [],
    total: 0,
    version: 1,
  });
  const rows = Array.from({ length: 5 }, (_, index) => ({
    content: questionSetContentSchema.parse(index === 4 ? conversationContent : formContent),
    createdAt: new Date(0),
    createdBy: owner.userId,
    description: index === 3 ? "Engineering" : "",
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: index === 3 ? "Basics" : `Engineering ${index}`,
    updatedAt: new Date(0),
    workspaceId: owner.workspaceId,
  }));
  await atsTest.platform.database.insert(questionSet).values(rows);
  await owner.call(path, { content: formContent, name: "Sales", version: 1 });
  await outsider.call(`question-sets/${outsider.workspaceId}`, {
    content: formContent,
    name: "Engineering",
    version: 1,
  });
  const first = await read(owner.call(`${path}?kind=form&search=%20ENGINEERING%20&pageSize=2`));
  const second = await read(owner.call(`${path}?kind=form&search=engineering&page=2&pageSize=2`));
  expect(first).toMatchObject({ page: 1, pageSize: 2, total: 4, version: 1 });
  expect(second).toMatchObject({ page: 2, pageSize: 2, total: 4, version: 1 });
  expect(first.rows.map((row: { id: string }) => row.id)).toEqual([rows[3].id, rows[2].id]);
  expect(second.rows.map((row: { id: string }) => row.id)).toEqual([rows[1].id, rows[0].id]);
  expect(first.rows[0]).toMatchObject({ kind: "form", questionCount: 3 });
  expect(first.rows[0]).not.toHaveProperty("content");
  expect(
    await read(owner.call(`${path}?kind=form&search=engineering&page=3&pageSize=2`)),
  ).toMatchObject({ rows: [], total: 4 });
  expect(await read(owner.call(`${path}?kind=conversation`))).toMatchObject({
    rows: [{ id: rows[4].id, questionCount: 2 }],
    total: 1,
  });
  expect(await read(owner.call(`${path}?search=%20%20`))).toMatchObject({ total: 6 });
  expect(await read(owner.call(`${path}?search=%25`))).toMatchObject({ rows: [], total: 0 });
});

it("isolates lists, creation, details and edits by authenticated workspace membership", async () => {
  const owner = await account("question-set-access@example.com");
  const outsider = await account("question-set-access-outsider@example.com");
  const path = `question-sets/${owner.workspaceId}`;
  const input = { content: formContent, name: "Form", version: 1 };
  const { id } = await read(owner.call(path, input));
  const putOptions = {
    body: JSON.stringify({ ...input, name: "Changed" }),
    headers: { "content-type": "application/json" },
    method: "PUT",
  };
  const anonymous = await app.request(`/api/${path}`, undefined, atsTest.env, atsTest.platform.ctx);
  expect(anonymous.status).toBe(401);
  expect(await outsider.call(path)).toMatchObject({ status: 404 });
  expect(await outsider.call(path, input)).toMatchObject({ status: 404 });
  expect(await outsider.call(`${path}/${id}`)).toMatchObject({ status: 404 });
  expect(await outsider.request(`${path}/${id}`, putOptions)).toMatchObject({ status: 404 });
  const otherPath = `question-sets/${outsider.workspaceId}/${id}`;
  const unavailable = { error: "QUESTION_SET_UNAVAILABLE", version: 1 };
  const missing = `${path}/${crypto.randomUUID()}`;
  await Promise.all(
    [
      outsider.call(otherPath),
      outsider.request(otherPath, putOptions),
      owner.call(missing),
      owner.request(missing, putOptions),
    ].map(async (request) => {
      const response = await request;
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(unavailable);
    }),
  );
  expect(await read(owner.call(`${path}/${id}`))).toMatchObject({ name: "Form" });
});

it("validates versioned type-specific content once at the HTTP boundary without changing saved data", async () => {
  const owner = await account("question-set-input@example.com");
  const path = `question-sets/${owner.workspaceId}`;
  const input = { content: formContent, name: "Form", version: 1 };
  const { id } = await read(owner.call(path, input));
  const initial = await read(owner.call(`${path}/${id}`));
  const invalidQuestions = [
    { content: "  ", type: "text" },
    { content: "x".repeat(1001), type: "text" },
    { content: "Q", description: "x".repeat(501), type: "text" },
    { content: "Q", required: false, type: "text" },
    { content: "Q", options: ["A", "B"], type: "text" },
    { content: "Q", type: "single_choice" },
    { content: "Q", options: ["A"], type: "single_choice" },
    { content: "Q", options: ["A", "  "], type: "multiple_choice" },
    { content: "Q", options: ["A", "x".repeat(201)], type: "multiple_choice" },
    {
      content: "Q",
      options: Array.from({ length: 21 }, (_, index) => String(index)),
      type: "multiple_choice",
    },
    { content: "Q", type: "unsupported" },
    { content: "Q", difficulty: "easy" },
  ];
  const invalidContents = [
    { kind: "form", questions: [] },
    { ...formContent, version: null },
    { ...formContent, version: 2 },
    { ...formContent, kind: "unknown" },
    {
      ...formContent,
      questions: Array.from({ length: 51 }, () => ({ content: "Q", type: "text" })),
    },
    ...invalidQuestions.map((question) => ({ ...formContent, questions: [question] })),
    { ...conversationContent, questions: [{ content: "Q", difficulty: "unknown" }] },
    { ...conversationContent, questions: [{ content: "Q" }] },
    {
      ...conversationContent,
      questions: [{ ...conversationContent.questions[0], evaluationCriteria: "x".repeat(2001) }],
    },
    {
      ...conversationContent,
      questions: [{ ...conversationContent.questions[0], evaluationFocus: "x".repeat(501) }],
    },
    {
      ...conversationContent,
      questions: [{ ...conversationContent.questions[0], followUpDirections: "x".repeat(1001) }],
    },
    { ...conversationContent, questions: [formContent.questions[0]] },
  ];
  const invalidInputs = [
    { content: input.content, name: input.name },
    { ...input, version: null },
    { ...input, version: 2 },
    { ...input, name: "  " },
    { ...input, name: "x".repeat(201) },
    { ...input, description: "x".repeat(30_001) },
    { ...input, createdBy: "forged-user" },
    { ...input, workspaceId: "other-workspace" },
    ...invalidContents.map((content) => ({ ...input, content })),
  ];
  await Promise.all(
    invalidInputs.map(async (body) => {
      const created = await owner.call(path, body);
      const edited = await owner.request(`${path}/${id}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      expect([created.status, edited.status]).toEqual([400, 400]);
      expect(await created.json()).toEqual({ error: "INVALID_INPUT", version: 1 });
      expect(await edited.json()).toEqual({ error: "INVALID_INPUT", version: 1 });
    }),
  );
  await Promise.all(
    [
      "kind=unknown",
      "page=0",
      "page=1.5",
      "page=1000001",
      "pageSize=0",
      "pageSize=101",
      `search=${"x".repeat(201)}`,
    ].map(async (query) => {
      expect(await owner.call(`${path}?${query}`)).toMatchObject({ status: 400 });
    }),
  );
  expect(await owner.call(`${path}/invalid-id`)).toMatchObject({ status: 400 });
  expect(await read(owner.call(`${path}/${id}`))).toEqual(initial);
  expect(await read(owner.call(path))).toMatchObject({ rows: [{ id }], total: 1 });
});

it("binds multiple jobs, filters sets before paging, replaces and clears defaults without crossing workspaces", async () => {
  const owner = await account("question-defaults@example.com");
  const other = await account("question-defaults-other@example.com");
  const jobs = await Promise.all(
    ["Frontend", "Backend"].map((title) =>
      read(owner.ats("jobs", { requirements: "Experience", title, version: 1 })),
    ),
  );
  const foreign = await read(
    other.ats("jobs", { requirements: "Experience", title: "Other", version: 1 }),
  );
  const path = `question-sets/${owner.workspaceId}`;
  const input = {
    content: formContent,
    defaultJobIds: [jobs[0].id, jobs[1].id, jobs[0].id],
    name: "Defaults",
    version: 1,
  };
  const response = await owner.call(path, input);
  expect(await response.clone().json()).toMatchObject({ id: expect.any(String) });
  const { id } = await read(response);
  const detail = () => read(owner.call(`${path}/${id}`));
  const firstDetail = await detail();
  expect(firstDetail.defaultJobs.map((row: { id: string }) => row.id).toSorted()).toEqual(
    jobs.map((row) => row.id).toSorted(),
  );
  await owner.call(path, { ...input, content: conversationContent, name: "Second" });
  expect(await read(owner.call(`${path}?jobId=${jobs[0].id}&pageSize=1&page=2`))).toMatchObject({
    rows: [
      {
        defaultAllJobs: false,
        defaultJobs: [
          { id: jobs[1].id, title: "Backend" },
          { id: jobs[0].id, title: "Frontend" },
        ],
        id,
      },
    ],
    total: 2,
  });
  expect(await read(owner.call(`${path}?jobId=${jobs[0].id}&pageSize=1&page=3`))).toMatchObject({
    rows: [],
    total: 2,
  });
  expect(await read(owner.call(`${path}?jobId=${jobs[0].id}&kind=conversation`))).toMatchObject({
    total: 1,
  });
  const put = (body: object) =>
    owner.request(`${path}/${id}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  const initial = await detail();
  await Promise.all(
    [foreign.id, "missing-job"].map(async (jobId) => {
      expect(await owner.call(path, { ...input, defaultJobIds: [jobId] })).toMatchObject({
        status: 400,
      });
      expect(await put({ ...input, defaultJobIds: [jobId], name: "Invalid change" })).toMatchObject(
        {
          status: 400,
        },
      );
    }),
  );
  expect(await detail()).toEqual(initial);
  expect(await put({ ...input, defaultJobIds: [jobs[1].id] })).toMatchObject({ status: 200 });
  const replaced = await detail();
  expect(replaced.defaultJobs).toEqual([{ id: jobs[1].id, title: "Backend" }]);
  expect(await put({ content: formContent, name: "Keep bindings", version: 1 })).toMatchObject({
    status: 200,
  });
  const kept = await detail();
  expect(kept.defaultJobs).toHaveLength(1);
  expect(await put({ ...input, defaultJobIds: [] })).toMatchObject({ status: 200 });
  const cleared = await detail();
  expect(cleared.defaultJobs).toEqual([]);
});

it("applies all-job defaults to future jobs and switches back to specific jobs", async () => {
  const owner = await account("question-all-jobs@example.com");
  const other = await account("question-all-jobs-other@example.com");
  const path = `question-sets/${owner.workspaceId}`;
  const input = { content: formContent, defaultAllJobs: true, name: "All jobs", version: 1 };
  const { id } = await read(owner.call(path, input));
  const newJob = await read(
    owner.ats("jobs", { requirements: "Experience", title: "Future job", version: 1 }),
  );
  expect(await read(owner.call(`${path}/${id}`))).toMatchObject({
    defaultAllJobs: true,
    defaultJobs: [],
  });
  expect(await read(owner.call(`${path}?jobId=${newJob.id}`))).toMatchObject({
    rows: [{ defaultAllJobs: true, defaultJobs: [], id }],
    total: 1,
  });
  expect(
    await read(other.call(`question-sets/${other.workspaceId}?jobId=${newJob.id}`)),
  ).toMatchObject({ rows: [], total: 0 });
  const put = (body: object) =>
    owner.request(`${path}/${id}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  expect(await put({ ...input, defaultAllJobs: false, defaultJobIds: [newJob.id] })).toMatchObject({
    status: 200,
  });
  expect(await read(owner.call(`${path}/${id}`))).toMatchObject({
    defaultAllJobs: false,
    defaultJobs: [{ id: newJob.id }],
  });
  expect(await put({ ...input, defaultJobIds: [newJob.id] })).toMatchObject({ status: 200 });
  expect(await read(owner.call(`${path}/${id}`))).toMatchObject({
    defaultAllJobs: true,
    defaultJobs: [],
  });
  expect(await put({ ...input, defaultAllJobs: false, defaultJobIds: [] })).toMatchObject({
    status: 200,
  });
  expect(await read(owner.call(`${path}?jobId=${newJob.id}`))).toMatchObject({
    rows: [],
    total: 0,
  });
});
