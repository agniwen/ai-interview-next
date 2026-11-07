import { interviewerAgent, member } from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { hc } from "hono/client";
import { expect, expectTypeOf, it } from "vitest";
import { app } from "../src/app";
import type { AppType } from "../src/types";
import { account, atsTest, read } from "./ats-fixture";

it("creates and edits reusable interviewer configurations with inferred API types", async () => {
  const owner = await account("interviewer-owner@example.com");
  const editor = await account("interviewer-editor@example.com");
  const client = hc<AppType>("https://sainoa.example", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      owner.request(input.toString(), init ?? {}),
  });
  const endpoint = client.api["interviewer-agents"][":workspaceId"];
  const description = "## Interview style\n\nBrief and conversational.";
  const prompt = "Ask one question at a time.\nFollow up on concrete examples.";
  const created = await endpoint.$post({
    json: {
      description: `  ${description}  `,
      name: "  Engineering interviewer  ",
      prompt: `  ${prompt}  `,
      version: 1,
    },
    param: { workspaceId: owner.workspaceId },
  });
  expectTypeOf(created.status).toEqualTypeOf<201 | 400>();
  expect(created.status).toBe(201);
  if (created.status !== 201) {
    throw new Error("Expected interviewer creation to succeed");
  }
  const { id, version } = await created.json();
  expectTypeOf(id).toExtend<string>();
  expectTypeOf(version).toEqualTypeOf<1>();
  const path = `interviewer-agents/${owner.workspaceId}`;
  const detail = await read(owner.call(`${path}/${id}`));
  expect(detail).toEqual({
    createdAt: expect.any(String),
    createdBy: owner.userId,
    description,
    id,
    name: "Engineering interviewer",
    prompt,
    updatedAt: expect.any(String),
    version: 1,
    workspaceId: owner.workspaceId,
  });
  expect(detail.createdAt).toBe(detail.updatedAt);

  await atsTest.platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: owner.workspaceId,
    role: "member",
    userId: editor.userId,
  });
  await atsTest.platform.database
    .update(interviewerAgent)
    .set({ updatedAt: new Date(0) })
    .where(eq(interviewerAgent.id, id));
  const put = (body: object) =>
    editor.request(`${path}/${id}`, {
      body: JSON.stringify({ name: "  Technical interviewer  ", prompt, version: 1, ...body }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  expect(await read(put({}))).toEqual({ id, version: 1 });
  const edited = await read(owner.call(`${path}/${id}`));
  expect(edited).toMatchObject({
    createdAt: detail.createdAt,
    createdBy: owner.userId,
    description,
    name: "Technical interviewer",
    prompt,
  });
  expect(Date.parse(edited.updatedAt)).toBeGreaterThan(0);
  expect(await put({ description: "", prompt: "  Ask about collaboration.  " })).toMatchObject({
    status: 200,
  });
  expect(await read(owner.call(`${path}/${id}`))).toMatchObject({
    description: "",
    prompt: "Ask about collaboration.",
  });
  const { id: secondId } = await read(
    owner.call(path, { name: "General interviewer", prompt, version: 1 }),
  );
  expect(await read(owner.call(`${path}/${secondId}`))).toMatchObject({ description: "" });
});

it("filters before paging and preserves stable order and totals within the workspace", async () => {
  const owner = await account("interviewer-list@example.com");
  const outsider = await account("interviewer-list-outsider@example.com");
  const path = `interviewer-agents/${owner.workspaceId}`;
  expect(await read(owner.call(path))).toEqual({
    page: 1,
    pageSize: 20,
    rows: [],
    total: 0,
    version: 1,
  });
  const rows = Array.from({ length: 4 }, (_, index) => ({
    createdAt: new Date(0),
    createdBy: owner.userId,
    description: index === 3 ? "Engineering" : "People skills",
    id: `00000000-0000-4000-8000-00000000000${index}`,
    name: index === 3 ? "General interviewer" : `Engineering ${index}`,
    prompt: "Ask about experience.",
    updatedAt: new Date(0),
    workspaceId: owner.workspaceId,
  }));
  await atsTest.platform.database.insert(interviewerAgent).values(rows);
  await owner.call(path, { name: "Sales", prompt: "Engineering", version: 1 });
  await outsider.call(`interviewer-agents/${outsider.workspaceId}`, {
    name: "Engineering outside",
    prompt: "Ask about experience.",
    version: 1,
  });
  const first = await read(owner.call(`${path}?search=%20ENGINEERING%20&pageSize=2`));
  const second = await read(owner.call(`${path}?search=engineering&page=2&pageSize=2`));
  expect(first).toMatchObject({ page: 1, pageSize: 2, total: 4, version: 1 });
  expect(second).toMatchObject({ page: 2, pageSize: 2, total: 4, version: 1 });
  expect(first.rows.map((row: { id: string }) => row.id)).toEqual([rows[3].id, rows[2].id]);
  expect(second.rows.map((row: { id: string }) => row.id)).toEqual([rows[1].id, rows[0].id]);
  expect(first.rows[0]).not.toHaveProperty("prompt");
  expect(await read(owner.call(`${path}?search=engineering&page=3&pageSize=2`))).toMatchObject({
    rows: [],
    total: 4,
  });
  expect(await read(owner.call(`${path}?search=%20%20`))).toMatchObject({ total: 5 });
  expect(await read(owner.call(`${path}?search=%25`))).toMatchObject({ rows: [], total: 0 });
});

it("requires authentication and workspace access for lists, details, creation and edits", async () => {
  const owner = await account("interviewer-access@example.com");
  const outsider = await account("interviewer-access-outsider@example.com");
  const path = `interviewer-agents/${owner.workspaceId}`;
  const input = { name: "Interviewer", prompt: "Ask about experience.", version: 1 };
  const { id } = await read(owner.call(path, input));
  const anonymous = await app.request(`/api/${path}`, undefined, atsTest.env, atsTest.platform.ctx);
  expect(anonymous.status).toBe(401);
  expect(await outsider.call(path)).toMatchObject({ status: 404 });
  expect(await outsider.call(path, input)).toMatchObject({ status: 404 });
  expect(await outsider.call(`${path}/${id}`)).toMatchObject({ status: 404 });
  const put = (target: string) =>
    outsider.request(target, {
      body: JSON.stringify({ ...input, name: "Changed" }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  expect(await put(`${path}/${id}`)).toMatchObject({ status: 404 });
  const otherPath = `interviewer-agents/${outsider.workspaceId}/${id}`;
  const unavailable = { error: "INTERVIEWER_AGENT_UNAVAILABLE", version: 1 };
  const otherDetail = await outsider.call(otherPath);
  const otherEdit = await put(otherPath);
  expect([otherDetail.status, otherEdit.status]).toEqual([404, 404]);
  expect(await otherDetail.json()).toEqual(unavailable);
  expect(await otherEdit.json()).toEqual(unavailable);
  const missing = `${path}/${crypto.randomUUID()}`;
  expect(await owner.call(missing)).toMatchObject({ status: 404 });
  const missingEdit = await owner.request(missing, {
    body: JSON.stringify(input),
    headers: { "content-type": "application/json" },
    method: "PUT",
  });
  expect(missingEdit.status).toBe(404);
  expect(await missingEdit.json()).toEqual(unavailable);
  expect(await read(owner.call(`${path}/${id}`))).toMatchObject({ name: "Interviewer" });
});

it("validates request versions, editable fields and pagination at the HTTP boundary", async () => {
  const owner = await account("interviewer-input@example.com");
  const path = `interviewer-agents/${owner.workspaceId}`;
  const input = { name: "Interviewer", prompt: "Ask about experience.", version: 1 };
  const { id } = await read(owner.call(path, input));
  const invalidBodies = [
    { name: input.name, prompt: input.prompt },
    { ...input, version: null },
    { ...input, version: 2 },
    { ...input, name: "  " },
    { ...input, name: "n".repeat(201) },
    { ...input, prompt: "  " },
    { ...input, prompt: "p".repeat(30_001) },
    { ...input, description: "d".repeat(30_001) },
    { ...input, description: null },
    { ...input, createdBy: "forged-user" },
    { ...input, workspaceId: "another-workspace" },
  ];
  await Promise.all(
    invalidBodies.map(async (body) => {
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
      "page=0",
      "page=1.5",
      "page=1000001",
      "pageSize=0",
      "pageSize=101",
      `search=${"s".repeat(201)}`,
    ].map(async (query) => {
      expect(await owner.call(`${path}?${query}`)).toMatchObject({ status: 400 });
    }),
  );
  expect(await owner.call(`${path}/invalid-id`)).toMatchObject({ status: 400 });
  expect(await read(owner.call(path))).toMatchObject({ rows: [{ id }], total: 1 });
  expect(await read(owner.call(`${path}/${id}`))).toMatchObject(input);
});
