import { readFileSync } from "node:fs";
import { department, job, member, recruitmentProject } from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import { account, atsTest, read } from "./ats-fixture";

it("stores department Markdown, preserves omitted descriptions and allows clearing", async () => {
  const owner = await account("department-description@example.com");
  const description = "## Responsibilities\n\n- Build **products**\n- Support teams";
  const { id } = await read(
    owner.ats("departments", {
      description: `  ${description}  `,
      name: "Engineering",
      version: 1,
    }),
  );
  const list = () => read(owner.ats("departments"));
  expect(await list()).toMatchObject({ rows: [{ description, id, name: "Engineering" }] });
  const put = (body: object) =>
    owner.request(`ats/${owner.workspaceId}/departments/${id}`, {
      body: JSON.stringify({ name: "Platform", version: 1, ...body }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  expect(await put({})).toMatchObject({ status: 200 });
  expect(await list()).toMatchObject({ rows: [{ description, name: "Platform" }] });
  const updated = "# Platform\n\nShared infrastructure";
  expect(await put({ description: updated })).toMatchObject({ status: 200 });
  expect(await list()).toMatchObject({ rows: [{ description: updated }] });
  expect(await put({ description: "x".repeat(30_001) })).toMatchObject({ status: 400 });
  expect(await list()).toMatchObject({ rows: [{ description: updated }] });
  expect(await put({ description: "" })).toMatchObject({ status: 200 });
  expect(await list()).toMatchObject({ rows: [{ description: "" }] });
  const { id: emptyId } = await read(owner.ats("departments", { name: "Empty", version: 1 }));
  expect(await list()).toMatchObject({
    rows: expect.arrayContaining([expect.objectContaining({ description: "", id: emptyId })]),
  });
});

it("links jobs to workspace departments and reflects renames, reassignment and clearing", async () => {
  const owner = await account("job-department@example.com");
  const outsider = await account("job-department-outsider@example.com");
  const { id: departmentId } = await read(
    owner.ats("departments", { name: "Engineering", version: 1 }),
  );
  const { id: secondId } = await read(owner.ats("departments", { name: "Product", version: 1 }));
  const { id: outsideId } = await read(
    outsider.ats("departments", { name: "Outside", version: 1 }),
  );
  const input = { departmentId, requirements: "Build products", title: "Engineer", version: 1 };
  const created = await owner.ats("jobs", input);
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(await read(owner.ats(`jobs/${id}`))).toMatchObject({
    department: "Engineering",
    departmentId,
  });
  const put = (path: string, body: object) =>
    owner.request(`ats/${owner.workspaceId}/${path}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  const rename = await put(`departments/${departmentId}`, { name: "Platform", version: 1 });
  expect(rename.status).toBe(200);
  expect(await read(owner.ats(`jobs/${id}`))).toMatchObject({
    department: "Platform",
    departmentId,
  });
  const invalidCreate = await owner.ats("jobs", { ...input, departmentId: outsideId });
  const invalidUpdate = await put(`jobs/${id}`, {
    ...input,
    departmentId: outsideId,
    projectId: null,
  });
  const missing = await owner.ats("jobs", { ...input, departmentId: crypto.randomUUID() });
  const invalidId = await owner.ats("jobs", { ...input, departmentId: "Engineering" });
  expect([invalidCreate.status, invalidUpdate.status, missing.status, invalidId.status]).toEqual([
    404, 404, 404, 400,
  ]);
  expect(await read(owner.ats(`jobs/${id}`))).toMatchObject({ departmentId });
  const reassigned = await put(`jobs/${id}`, { ...input, departmentId: secondId, projectId: null });
  expect(reassigned.status).toBe(200);
  expect(await read(owner.ats(`jobs/${id}`))).toMatchObject({
    department: "Product",
    departmentId: secondId,
  });
  const cleared = await put(`jobs/${id}`, { ...input, departmentId: null, projectId: null });
  expect(cleared.status).toBe(200);
  expect(await read(owner.ats(`jobs/${id}`))).toMatchObject({
    department: null,
    departmentId: null,
  });
});

it("migrates legacy job department names without merging workspaces or replacing existing departments", async () => {
  const owner = await account("legacy-department@example.com");
  const outsider = await account("legacy-department-outsider@example.com");
  const { id: existingId } = await read(
    owner.ats("departments", { name: "Engineering", version: 1 }),
  );
  const rows = [
    { department: " Engineering ", workspaceId: owner.workspaceId },
    { department: "Product", workspaceId: owner.workspaceId },
    { department: "Product", workspaceId: owner.workspaceId },
    { department: "Engineering", workspaceId: outsider.workspaceId },
  ].map((row) => ({
    ...row,
    createdAt: new Date(0),
    id: crypto.randomUUID(),
    requirements: "Legacy",
    title: "Legacy",
  }));
  await atsTest.platform.database.insert(job).values(rows);
  const sql = readFileSync(
    new URL(
      "../../../packages/db/migrations/20261107032535_link_legacy_departments.sql",
      import.meta.url,
    ),
    "utf-8",
  );
  await atsTest.env.AUTH_DB.batch(
    sql
      .split(";")
      .map((statement) => statement.trim())
      .filter(Boolean)
      .map((statement) => atsTest.env.AUTH_DB.prepare(statement)),
  );
  const [first, second, third, outside] = await Promise.all(
    rows.map((row) => atsTest.platform.database.select().from(job).where(eq(job.id, row.id)).get()),
  );
  expect(first?.departmentId).toBe(existingId);
  expect(second?.departmentId).toEqual(expect.any(String));
  expect(second?.departmentId).toBe(third?.departmentId);
  expect(outside?.departmentId).toEqual(expect.any(String));
  expect(outside?.departmentId).not.toBe(existingId);
  const departments = await read(owner.ats("departments"));
  expect(departments.total).toBe(2);
  expect(departments.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ createdBy: owner.userId, id: existingId, name: "Engineering" }),
      expect.objectContaining({ createdBy: null, name: "Product" }),
    ]),
  );
});

it("creates, searches, pages and edits departments only within the workspace", async () => {
  const owner = await account("departments-owner@example.com");
  const outsider = await account("departments-outsider@example.com");
  expect(await read(owner.ats("departments"))).toEqual({
    page: 1,
    pageSize: 20,
    rows: [],
    total: 0,
    version: 1,
  });
  const created = await owner.ats("departments", { name: "  Engineering  ", version: 1 });
  expect(created.status).toBe(201);
  const { id } = await created.json();
  expect(await read(owner.ats("departments?search=%20ENGINEERING%20"))).toMatchObject({
    rows: [{ createdBy: owner.userId, id, name: "Engineering" }],
    total: 1,
    version: 1,
  });
  const departments = Array.from({ length: 21 }, (_, index) => ({
    createdAt: new Date(0),
    createdBy: owner.userId,
    id: `department-${String(index).padStart(2, "0")}`,
    name: `Operations ${index}`,
    workspaceId: owner.workspaceId,
  }));
  await atsTest.platform.database.batch([
    atsTest.platform.database.insert(department).values(departments.slice(0, 15)),
    atsTest.platform.database.insert(department).values(departments.slice(15)),
  ]);
  await outsider.ats("departments", { name: "Operations outside", version: 1 });
  const first = await read(owner.ats("departments?search=operations&pageSize=20"));
  const second = await read(owner.ats("departments?search=operations&page=2&pageSize=20"));
  expect(first).toMatchObject({ page: 1, pageSize: 20, total: 21, version: 1 });
  expect(first.rows).toHaveLength(20);
  expect(first.rows[0].id).toBe("department-20");
  expect(first.rows[19].id).toBe("department-01");
  expect(second).toMatchObject({ page: 2, rows: [{ id: "department-00" }], total: 21 });
  expect(await read(owner.ats("departments?search=operations&page=3"))).toMatchObject({
    rows: [],
    total: 21,
  });
  const put = (actor: typeof owner, workspaceId: string, recordId: string, name: string) =>
    actor.request(`ats/${workspaceId}/departments/${recordId}`, {
      body: JSON.stringify({ name, version: 1 }),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  const forbidden = await outsider.call(`ats/${owner.workspaceId}/departments`);
  const forbiddenCreate = await outsider.call(`ats/${owner.workspaceId}/departments`, {
    name: "Forbidden",
    version: 1,
  });
  const forbiddenUpdate = await put(outsider, owner.workspaceId, id, "Forbidden");
  const crossWorkspace = await put(outsider, outsider.workspaceId, id, "Forbidden");
  expect([
    forbidden.status,
    forbiddenCreate.status,
    forbiddenUpdate.status,
    crossWorkspace.status,
  ]).toEqual([404, 404, 404, 404]);
  const edited = await put(owner, owner.workspaceId, id, "  Platform  ");
  expect(edited.status).toBe(200);
  expect(await read(owner.ats("departments?search=platform"))).toMatchObject({
    rows: [{ id, name: "Platform" }],
    total: 1,
  });
  const missing = await put(owner, owner.workspaceId, crypto.randomUUID(), "Missing");
  expect(missing.status).toBe(404);
  await Promise.all(
    ["page=0", "page=1.5", "page=1000001", "pageSize=101", `search=${"x".repeat(201)}`].map(
      async (query) => {
        const response = await owner.ats(`departments?${query}`);
        expect(response.status).toBe(400);
      },
    ),
  );
  await Promise.all(
    ["  ", "x".repeat(201)].map(async (name) => {
      const invalid = await owner.ats("departments", { name, version: 1 });
      expect(invalid.status).toBe(400);
    }),
  );
});

it("attributes all three resources to the session user and preserves creators after another member edits", async () => {
  const owner = await account("resource-creator@example.com");
  const editor = await account("resource-editor@example.com");
  const db = atsTest.platform.database;
  await db.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: owner.workspaceId,
    role: "member",
    userId: editor.userId,
  });
  const resources = [
    { body: { name: "Engineering", version: 1 }, path: "departments" },
    { body: { title: "Hiring", version: 1 }, path: "projects" },
    { body: { requirements: "Build products", title: "Engineer", version: 1 }, path: "jobs" },
  ] as const;
  await Promise.all(
    resources.map(async ({ path, body }) => {
      const forged = await owner.ats(path, { ...body, createdBy: editor.userId });
      expect(forged.status).toBe(400);
      const { id } = await read(owner.ats(path, body));
      const changed = await editor.request(`ats/${owner.workspaceId}/${path}/${id}`, {
        body: JSON.stringify(path === "jobs" ? { ...body, projectId: null } : body),
        headers: { "content-type": "application/json" },
        method: "PUT",
      });
      expect(changed.status).toBe(200);
      const result = await read(owner.ats(path));
      expect(result.rows).toEqual([expect.objectContaining({ createdBy: owner.userId, id })]);
    }),
  );
  const legacyProjectId = crypto.randomUUID();
  const legacyJobId = crypto.randomUUID();
  await db.batch([
    db.insert(recruitmentProject).values({
      createdAt: new Date(0),
      id: legacyProjectId,
      title: "Legacy",
      workspaceId: owner.workspaceId,
    }),
    db.insert(job).values({
      createdAt: new Date(0),
      id: legacyJobId,
      requirements: "Original",
      title: "Legacy",
      workspaceId: owner.workspaceId,
    }),
  ]);
  expect(
    await db
      .select({ createdBy: recruitmentProject.createdBy })
      .from(recruitmentProject)
      .where(eq(recruitmentProject.id, legacyProjectId))
      .get(),
  ).toEqual({ createdBy: null });
  expect(
    await db.select({ createdBy: job.createdBy }).from(job).where(eq(job.id, legacyJobId)).get(),
  ).toEqual({ createdBy: null });
});
