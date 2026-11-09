import {
  application,
  interviewRound,
  interviewAssignment,
  member,
  questionSet,
  questionSetJob,
  interviewerAgent,
  user,
} from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { hc } from "hono/client";
import { expect, expectTypeOf, it } from "vitest";
import { app } from "../src/app";
import type { AppType } from "../src/types";
import { account, atsTest, read } from "./ats-fixture";
import { fixture, addInterviewMember, editRound } from "./interview-fixture";

it("creates the first AI round through the typed API, preserving selection order without copying content", async () => {
  const f = await fixture("interview-create@example.com");
  const client = hc<AppType>("https://sainoa.example", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      f.owner.request(input.toString(), init ?? {}),
  });
  const response = await client.api.interviews[":workspaceId"].applications[":applicationId"].$post(
    { json: f.input, param: { applicationId: f.applicationId, workspaceId: f.owner.workspaceId } },
  );
  expect(response.status).toBe(201);
  if (response.status !== 201) {
    throw new Error("Expected created round");
  }
  const created = await response.json();
  expectTypeOf(created.version).toEqualTypeOf<1>();
  const detailPath = `interviews/${f.owner.workspaceId}/${created.id}`;
  const detail = await read(f.owner.call(detailPath));
  expect(detail).toMatchObject({
    admissionDeadline: null,
    assignments: [],
    createdBy: f.owner.userId,
    interviewerAgentId: f.agent.id,
    kind: "ai",
    label: "技术沟通",
    questionSelection: {
      conversationQuestionSetIds: f.input.conversationQuestionSetIds,
      formQuestionSetIds: f.input.formQuestionSetIds,
      version: 1,
    },
    resumeId: null,
    scheduledAt: null,
    sequence: 1,
    status: "scheduled",
    version: 1,
  });
  expect(await read(f.owner.call(`${f.path}?pageSize=1`))).toMatchObject({
    page: 1,
    pageSize: 1,
    rows: [{ id: created.id }],
    total: 1,
    version: 1,
  });
  expect(await read(f.owner.ats("applications"))).toMatchObject({
    rows: [{ id: f.applicationId, latestInterview: { kind: "ai", sequence: 1 } }],
  });
  expect(await read(f.owner.call(`${f.path}?pageSize=1&page=2`))).toMatchObject({
    rows: [],
    total: 1,
  });
  await atsTest.platform.database
    .update(questionSet)
    .set({
      content: { kind: "conversation", questions: [], version: 1 },
      name: "Edited after creation",
    })
    .where(eq(questionSet.id, f.conversation.id));
  await atsTest.platform.database
    .update(interviewerAgent)
    .set({ prompt: "Changed prompt" })
    .where(eq(interviewerAgent.id, f.agent.id));
  expect(await read(f.owner.call(detailPath))).toEqual(detail);
  expect(JSON.stringify(detail.questionSelection)).not.toContain("Tell me about");
  expect(await f.owner.call(f.path, f.input)).toMatchObject({ status: 409 });
});

it("allows no form sets and an explicit workspace confirmation member", async () => {
  const f = await fixture("interview-reviewer@example.com");
  const reviewer = await account("interview-reviewer-member@example.com");
  await atsTest.platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: f.owner.workspaceId,
    role: "member",
    userId: reviewer.userId,
  });
  const created = await read(
    f.owner.call(f.path, {
      ...f.input,
      confirmationUserId: reviewer.userId,
      formQuestionSetIds: [],
    }),
  );
  expect(
    await read(reviewer.call(`interviews/${f.owner.workspaceId}/${created.id}`)),
  ).toMatchObject({
    assignments: [{ id: reviewer.userId, role: "reviewer" }],
    questionSelection: { formQuestionSetIds: [], version: 1 },
  });
});

it("rejects invalid time, versions, duplicate selections and unavailable resources without saving a round", async () => {
  const f = await fixture("interview-invalid@example.com");
  const foreign = await fixture("interview-foreign@example.com");
  const cases = [
    { ...f.input, version: 2 },
    { ...f.input, version: null },
    { ...f.input, kind: "human" },
    { ...f.input, scheduledAt: "2027-01-05T10:00:00" },
    { ...f.input, admissionDeadline: "2027-01-05T10:00:00+08:00" },
    { ...f.input, admissionDeadline: "2027-01-05T01:00:00Z" },
    { ...f.input, conversationQuestionSetIds: [] },
    { ...f.input, conversationQuestionSetIds: [f.conversation.id, f.conversation.id] },
    { ...f.input, conversationQuestionSetIds: [f.empty.id] },
    { ...f.input, conversationQuestionSetIds: [f.form.id] },
    { ...f.input, formQuestionSetIds: [f.conversation.id] },
    { ...f.input, conversationQuestionSetIds: [foreign.conversation.id] },
    { ...f.input, conversationQuestionSetIds: [crypto.randomUUID()] },
    { ...f.input, interviewerAgentId: foreign.agent.id },
    { ...f.input, interviewerAgentId: crypto.randomUUID() },
    { ...f.input, confirmationUserId: foreign.owner.userId },
    { ...f.input, confirmationUserId: "missing-user" },
  ];
  await Promise.all(
    cases.map(async (input) =>
      expect(await f.owner.call(f.path, input)).toMatchObject({ status: 400 }),
    ),
  );
  expect(await read(f.owner.call(f.path))).toMatchObject({ rows: [], total: 0 });
});

it("isolates interviews and rejects closed or deleted applications", async () => {
  const f = await fixture("interview-access@example.com");
  const outsider = await account("interview-outsider@example.com");
  const anonymous = await app.request(
    `/api/${f.path}`,
    undefined,
    atsTest.env,
    atsTest.platform.ctx,
  );
  expect(anonymous.status).toBe(401);
  expect(await outsider.call(f.path, f.input)).toMatchObject({ status: 404 });
  expect(await outsider.call(f.path)).toMatchObject({ status: 404 });
  const otherPath = `interviews/${outsider.workspaceId}/applications/${f.applicationId}`;
  expect(await outsider.call(otherPath)).toMatchObject({ status: 404 });
  expect(await outsider.call(otherPath, f.input)).toMatchObject({ status: 404 });
  await atsTest.platform.database
    .update(application)
    .set({ closedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await f.owner.call(f.path, f.input)).toMatchObject({ status: 409 });
  await atsTest.platform.database
    .update(application)
    .set({ closedAt: null })
    .where(eq(application.id, f.applicationId));
  const { id } = await read(f.owner.call(f.path, f.input));
  expect(await outsider.call(`interviews/${outsider.workspaceId}/${id}`)).toMatchObject({
    status: 404,
  });
  await atsTest.platform.database
    .update(application)
    .set({ deletedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await f.owner.call(f.path)).toMatchObject({ status: 404 });
  expect(await f.owner.call(f.path, f.input)).toMatchObject({ status: 404 });
  expect(await f.owner.call(`interviews/${f.owner.workspaceId}/${id}`)).toMatchObject({
    status: 404,
  });
  expect(await atsTest.platform.database.$count(interviewRound, eq(interviewRound.id, id))).toBe(1);
});

it("initializes job defaults and paginates searchable confirmation members within the workspace", async () => {
  const f = await fixture("interview-setup@example.com");
  const outsider = await account("interview-setup-outsider@example.com");
  const image = "https://example.com/avatar.png";
  await atsTest.platform.database.update(user).set({ image }).where(eq(user.id, f.owner.userId));
  await atsTest.platform.database.insert(questionSetJob).values([
    { jobId: f.jobId, questionSetId: f.form.id },
    { jobId: f.jobId, questionSetId: f.conversation.id },
  ]);
  const setup = await read(f.owner.call(`${f.path}/setup`));
  expect(setup).toMatchObject({
    reviewer: { email: "interview-setup@example.com", id: f.owner.userId, image },
    version: 1,
  });
  expect(setup.sets).toHaveLength(2);
  expect(setup.sets).toEqual(
    expect.arrayContaining([
      { id: f.form.id, kind: "form", name: "form", questionCount: 1 },
      { id: f.conversation.id, kind: "conversation", name: "conversation", questionCount: 1 },
    ]),
  );
  expect(await outsider.call(`${f.path}/setup`)).toMatchObject({ status: 404 });
  expect(
    await outsider.call(`interviews/${outsider.workspaceId}/applications/${f.applicationId}/setup`),
  ).toMatchObject({ status: 404 });
  const path = `interviews/${f.owner.workspaceId}/members`;
  const members = await read(f.owner.call(`${path}?pageSize=1`));
  expect(members).toMatchObject({
    page: 1,
    pageSize: 1,
    rows: [{ email: "interview-setup@example.com", id: f.owner.userId, image }],
    total: 1,
    version: 1,
  });
  expect(await read(f.owner.call(`${path}?pageSize=1&page=2`))).toMatchObject({
    rows: [],
    total: 1,
  });
  expect(
    await read(f.owner.call(`${path}?search=${encodeURIComponent(members.rows[0].name)}`)),
  ).toMatchObject({ total: 1 });
  expect(await read(f.owner.call(`${path}?search=not-a-member`))).toMatchObject({
    rows: [],
    total: 0,
  });
  expect(await read(f.owner.call(`${path}?search=INTERVIEW-SETUP%40`))).toMatchObject({
    rows: [{ id: f.owner.userId, image }],
    total: 1,
  });
  expect(await outsider.call(path)).toMatchObject({ status: 404 });
});

it("allows only the creator to delete a scheduled round and create a replacement", async () => {
  const f = await fixture("interview-delete@example.com");
  const peer = await account("interview-delete-admin@example.com");
  await atsTest.platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: f.owner.workspaceId,
    role: "admin",
    userId: peer.userId,
  });
  const { id } = await read(
    f.owner.call(f.path, {
      ...f.input,
    }),
  );
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  expect(await read(f.owner.call(f.path))).toMatchObject({ rows: [{ canDelete: true, id }] });
  expect(await read(peer.call(f.path))).toMatchObject({ rows: [{ canDelete: false, id }] });
  const forbidden = await peer.request(path, { method: "DELETE" });
  expect(forbidden.status).toBe(403);
  expect(await forbidden.json()).toEqual({ error: "INTERVIEW_DELETE_FORBIDDEN", version: 1 });
  expect(await atsTest.platform.database.$count(interviewRound, eq(interviewRound.id, id))).toBe(1);

  const client = hc<AppType>("https://sainoa.example", {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      f.owner.request(input.toString(), init ?? {}),
  });
  const deleted = await client.api.interviews[":workspaceId"][":id"].$delete({
    param: { id, workspaceId: f.owner.workspaceId },
  });
  expect(deleted.status).toBe(200);
  if (deleted.status !== 200) {
    throw new Error("Expected deleted round");
  }
  const deletedBody = await deleted.json();
  expectTypeOf(deletedBody.version).toEqualTypeOf<1>();
  expect(deletedBody).toEqual({ id, version: 1 });
  expect(await read(f.owner.call(f.path))).toMatchObject({ rows: [], total: 0 });
  expect(await f.owner.call(path)).toMatchObject({ status: 404 });
  expect(
    await atsTest.platform.database.$count(interviewerAgent, eq(interviewerAgent.id, f.agent.id)),
  ).toBe(1);
  expect(
    await atsTest.platform.database.$count(questionSet, eq(questionSet.id, f.conversation.id)),
  ).toBe(1);
  expect(await f.owner.call(f.path, f.input)).toMatchObject({ status: 201 });
});

it.each(["in_progress", "completed", "cancelled"])("does not delete %s rounds", async (status) => {
  const f = await fixture(`interview-delete-${status}@example.com`);
  const { id } = await read(f.owner.call(f.path, f.input));
  await atsTest.platform.database
    .update(interviewRound)
    .set({ status })
    .where(eq(interviewRound.id, id));
  expect(await read(f.owner.call(f.path))).toMatchObject({ rows: [{ canDelete: false, id }] });
  const response = await f.owner.request(`interviews/${f.owner.workspaceId}/${id}`, {
    method: "DELETE",
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toEqual({ error: "INTERVIEW_NOT_DELETABLE", version: 1 });
  expect(await atsTest.platform.database.$count(interviewRound, eq(interviewRound.id, id))).toBe(1);
});

it("requires authentication and workspace access to delete an accessible interview", async () => {
  const f = await fixture("interview-delete-isolation@example.com");
  const outsider = await account("interview-delete-outsider@example.com");
  const { id } = await read(f.owner.call(f.path, f.input));
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  expect(
    await app.request(
      `https://sainoa.example/api/${path}`,
      { headers: { origin: "https://sainoa.example" }, method: "DELETE" },
      atsTest.env,
      atsTest.platform.ctx,
    ),
  ).toMatchObject({ status: 401 });
  expect(await outsider.request(path, { method: "DELETE" })).toMatchObject({ status: 404 });
  expect(
    await outsider.request(`interviews/${outsider.workspaceId}/${id}`, { method: "DELETE" }),
  ).toMatchObject({ status: 404 });
  expect(
    await f.owner.request(`interviews/${f.owner.workspaceId}/invalid`, { method: "DELETE" }),
  ).toMatchObject({ status: 400 });
  expect(
    await f.owner.request(`interviews/${f.owner.workspaceId}/${crypto.randomUUID()}`, {
      method: "DELETE",
    }),
  ).toMatchObject({ status: 404 });
  await atsTest.platform.database
    .update(application)
    .set({ deletedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await f.owner.request(path, { method: "DELETE" })).toMatchObject({ status: 404 });
  expect(await atsTest.platform.database.$count(interviewRound, eq(interviewRound.id, id))).toBe(1);
});

it.each([1, 2])(
  "creates a human round with %i workspace interviewers and no AI fields",
  async (count) => {
    const f = await fixture(`human-${count}@example.com`);
    const colleague = await account(`human-colleague-${count}@example.com`);
    await atsTest.platform.database.insert(member).values({
      createdAt: new Date(),
      id: crypto.randomUUID(),
      organizationId: f.owner.workspaceId,
      role: "member",
      userId: colleague.userId,
    });
    const interviewerUserIds = [f.owner.userId, colleague.userId].slice(0, count);
    const input = {
      admissionDeadline: "2027-01-05T10:30:00+08:00",
      interviewerUserIds,
      kind: "human" as const,
      label: "  技术复面  ",
      scheduledAt: "2027-01-05T10:00:00+08:00",
      version: 1 as const,
    };
    const client = hc<AppType>("https://sainoa.example", {
      fetch: (request: RequestInfo | URL, init?: RequestInit) =>
        f.owner.request(request.toString(), init ?? {}),
    });
    const response = await client.api.interviews[":workspaceId"].applications[
      ":applicationId"
    ].$post({
      json: input,
      param: { applicationId: f.applicationId, workspaceId: f.owner.workspaceId },
    });
    expect(response.status).toBe(201);
    if (response.status !== 201) {
      throw new Error("Expected created human interview");
    }
    const { id } = await response.json();
    const applicationDetail = await read(f.owner.ats(`applications/${f.applicationId}`));
    expect(applicationDetail.activity).toEqual([
      expect.objectContaining({
        action: "interview_created",
        actorId: f.owner.userId,
        actorType: "user",
        result: expect.objectContaining({
          interview: { id, kind: "human", label: "技术复面", sequence: 1 },
        }),
      }),
    ]);
    const detail = await read(f.owner.call(`interviews/${f.owner.workspaceId}/${id}`));
    expect(detail).toMatchObject({
      interviewerAgentId: null,
      kind: "human",
      label: "技术复面",
      questionSelection: { conversationQuestionSetIds: [], formQuestionSetIds: [], version: 1 },
    });
    expect(detail.assignments.map((person: { id: string }) => person.id)).toEqual(
      interviewerUserIds,
    );
    expect(
      detail.assignments.every((person: { role: string }) => person.role === "interviewer"),
    ).toBe(true);
    const list = await read(f.owner.call(f.path));
    expect(list.rows[0]).toMatchObject({
      canDelete: true,
      confirmationName: null,
      id,
      interviewerName: null,
    });
    expect(list.rows[0].interviewers.map((person: { id: string }) => person.id)).toEqual(
      interviewerUserIds,
    );
    expect(await f.owner.call(f.path, input)).toMatchObject({ status: 409 });
    expect(
      await f.owner.request(`interviews/${f.owner.workspaceId}/${id}`, { method: "DELETE" }),
    ).toMatchObject({ status: 200 });
    expect(
      await atsTest.platform.database.$count(
        interviewAssignment,
        eq(interviewAssignment.interviewRoundId, id),
      ),
    ).toBe(0);
  },
);

it("rejects missing, duplicate, foreign and mixed interviewers at creation", async () => {
  const f = await fixture("human-invalid@example.com");
  const outsider = await account("human-outsider@example.com");
  const input = {
    admissionDeadline: "2027-01-05T10:30:00+08:00",
    interviewerUserIds: [f.owner.userId],
    kind: "human",
    scheduledAt: "2027-01-05T10:00:00+08:00",
    version: 1,
  };
  const invalidInputs = [
    { ...input, interviewerUserIds: [] },
    { ...input, interviewerUserIds: [f.owner.userId, f.owner.userId] },
    { ...input, interviewerUserIds: [""] },
    { ...input, interviewerAgentId: f.agent.id },
    { ...input, confirmationUserId: f.owner.userId },
    { ...input, conversationQuestionSetIds: [] },
    { ...input, admissionDeadline: input.scheduledAt },
    { ...input, admissionDeadline: "2027-01-05T01:00:00Z" },
    { ...input, scheduledAt: "2027-01-05T10:00:00" },
    { ...input, scheduledAt: undefined },
    { ...input, admissionDeadline: undefined },
    { ...input, version: 2 },
    { ...f.input, interviewerUserIds: [f.owner.userId] },
  ];
  await Promise.all(
    invalidInputs.map(async (invalid) => {
      expect(await f.owner.call(f.path, invalid)).toMatchObject({ status: 400 });
    }),
  );
  const foreignSelections = [
    [outsider.userId],
    [f.owner.userId, outsider.userId],
    [crypto.randomUUID()],
  ];
  await Promise.all(
    foreignSelections.map(async (ids) => {
      const response = await f.owner.call(f.path, { ...input, interviewerUserIds: ids });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "INTERVIEWER_USER_UNAVAILABLE", version: 1 });
    }),
  );
  expect(await read(f.owner.call(f.path))).toMatchObject({ rows: [], total: 0 });
});

it("requires round question selections without duplicating assignment data", async () => {
  const f = await fixture("interview-required-config@example.com");
  const { id } = await read(f.owner.call(f.path, f.input));
  await expect(
    atsTest.env.AUTH_DB.prepare("UPDATE interview_round SET questionSelection = NULL WHERE id = ?")
      .bind(id)
      .run(),
  ).rejects.toThrow(/NOT NULL/u);
  expect(await read(f.owner.call(`interviews/${f.owner.workspaceId}/${id}`))).toMatchObject({
    interviewerAgentId: f.agent.id,
    kind: "ai",
    questionSelection: { version: 1 },
  });
});

it("finds assigned rounds by workspace and user using the assignment index", async () => {
  const f = await fixture("assigned-round@example.com");
  const other = await fixture("assigned-other@example.com");
  const reviewer = await account("assigned-reviewer@example.com");
  await atsTest.platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: f.owner.workspaceId,
    role: "member",
    userId: reviewer.userId,
  });
  const { id } = await read(
    f.owner.call(f.path, { ...f.input, confirmationUserId: reviewer.userId }),
  );
  await read(other.owner.call(other.path, other.input));
  const query = `SELECT r.id, a.role FROM interview_assignment a
    JOIN interview_round r ON r.workspaceId = a.workspaceId AND r.id = a.interviewRoundId
    JOIN application p ON p.id = r.applicationId AND p.workspaceId = r.workspaceId
    WHERE a.workspaceId = ? AND a.userId = ? AND r.status = 'scheduled' AND p.deletedAt IS NULL
    ORDER BY r.createdAt DESC, r.id DESC LIMIT 20`;
  const db = atsTest.env.AUTH_DB;
  const assigned = await db.prepare(query).bind(f.owner.workspaceId, reviewer.userId).all();
  const createdOnly = await db.prepare(query).bind(f.owner.workspaceId, f.owner.userId).all();
  const foreignWorkspace = await db
    .prepare(query)
    .bind(other.owner.workspaceId, reviewer.userId)
    .all();
  expect(assigned.results).toEqual([{ id, role: "reviewer" }]);
  expect(createdOnly.results).toEqual([]);
  expect(foreignWorkspace.results).toEqual([]);
  const plan = await db
    .prepare(`EXPLAIN QUERY PLAN ${query}`)
    .bind(f.owner.workspaceId, reviewer.userId)
    .all();
  expect(plan.results).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        detail: expect.stringContaining("interview_assignment_user_round_idx"),
      }),
    ]),
  );
  await expect(
    atsTest.platform.database.insert(interviewAssignment).values({
      interviewRoundId: id,
      position: 0,
      role: "reviewer",
      userId: reviewer.userId,
      workspaceId: other.owner.workspaceId,
    }),
  ).rejects.toThrow();
});

it("edits human times and replaces assigned interviewers while retaining round identity", async () => {
  const f = await fixture("edit-human@example.com");
  const first = await addInterviewMember(f.owner.workspaceId, "edit-first@example.com");
  const second = await addInterviewMember(f.owner.workspaceId, "edit-second@example.com");
  const input = {
    admissionDeadline: "2027-01-05T11:00:00+08:00",
    interviewerUserIds: [f.owner.userId, first.userId],
    kind: "human",
    label: "First",
    scheduledAt: "2027-01-05T10:00:00+08:00",
    version: 1,
  };
  const { id } = await read(f.owner.call(f.path, input));
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  const before = await read(f.owner.call(path));
  const setup = await read(f.owner.call(`${path}/edit`));
  expect(setup.round.assignments.map((person: { id: string }) => person.id)).toEqual(
    input.interviewerUserIds,
  );
  expect(setup.agent).toBeNull();
  expect(setup.sets).toEqual([]);
  const changed = {
    ...input,
    admissionDeadline: "2027-02-06T15:30:00+08:00",
    interviewerUserIds: [second.userId, f.owner.userId],
    label: " Updated ",
    scheduledAt: "2027-02-06T14:00:00+08:00",
  };
  expect(await editRound(f.owner, path, changed)).toMatchObject({ status: 200 });
  const after = await read(f.owner.call(path));
  expect(after).toMatchObject({
    admissionDeadline: "2027-02-06T07:30:00.000Z",
    createdAt: before.createdAt,
    createdBy: before.createdBy,
    id,
    label: "Updated",
    scheduledAt: "2027-02-06T06:00:00.000Z",
    sequence: before.sequence,
    status: "scheduled",
  });
  expect(after.assignments.map((person: { id: string }) => person.id)).toEqual(
    changed.interviewerUserIds,
  );
  const assigned = await atsTest.env.AUTH_DB.prepare(
    "SELECT interviewRoundId FROM interview_assignment WHERE workspaceId = ? AND userId = ?",
  )
    .bind(f.owner.workspaceId, first.userId)
    .all();
  expect(assigned.results).toEqual([]);
  const list = await read(f.owner.call(f.path));
  expect(list.rows[0].interviewers.map((person: { id: string }) => person.id)).toEqual(
    changed.interviewerUserIds,
  );
});

it("loads saved AI selections and updates its agent, reviewer and ordered sets", async () => {
  const f = await fixture("edit-ai@example.com");
  const reviewer = await addInterviewMember(f.owner.workspaceId, "edit-reviewer@example.com");
  const agent = await read(
    f.owner.call(`interviewer-agents/${f.owner.workspaceId}`, {
      name: "New interviewer",
      prompt: "Follow up",
      version: 1,
    }),
  );
  const { id } = await read(f.owner.call(f.path, f.input));
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  const setup = await read(f.owner.call(`${path}/edit`));
  expect(setup.agent).toMatchObject({ id: f.agent.id, name: "Interviewer" });
  expect(setup.round.questionSelection.conversationQuestionSetIds).toEqual(
    f.input.conversationQuestionSetIds,
  );
  expect(setup.sets).toHaveLength(3);
  expect(setup.sets.every((set: { questionCount: number }) => set.questionCount === 1)).toBe(true);
  const changed = {
    ...f.input,
    confirmationUserId: reviewer.userId,
    conversationQuestionSetIds: f.input.conversationQuestionSetIds.toReversed(),
    formQuestionSetIds: [],
    interviewerAgentId: agent.id,
  };
  expect(await editRound(f.owner, path, changed)).toMatchObject({ status: 200 });
  const after = await read(f.owner.call(`${path}/edit`));
  expect(after.round).toMatchObject({
    admissionDeadline: null,
    assignments: [{ id: reviewer.userId, role: "reviewer" }],
    interviewerAgentId: agent.id,
    questionSelection: {
      conversationQuestionSetIds: changed.conversationQuestionSetIds,
      formQuestionSetIds: [],
      version: 1,
    },
    scheduledAt: null,
  });
  expect(after.round.assignments).toHaveLength(1);
  expect(after.agent.name).toBe("New interviewer");
  expect(await read(f.owner.call(f.path))).toMatchObject({
    rows: [{ confirmationName: "edit-reviewer@example.com", interviewerName: "New interviewer" }],
  });
});

it("allows the creator and workspace managers to edit, rejects ordinary members and locks started rounds", async () => {
  const f = await fixture("edit-permissions@example.com");
  const creator = await addInterviewMember(f.owner.workspaceId, "edit-creator@example.com");
  const admin = await addInterviewMember(f.owner.workspaceId, "edit-admin@example.com", "admin");
  const ordinary = await addInterviewMember(f.owner.workspaceId, "edit-ordinary@example.com");
  const foreign = await account("edit-foreign@example.com");
  const { id } = await read(creator.call(f.path, f.input));
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  const changed = { ...f.input, confirmationUserId: creator.userId };
  await Promise.all(
    [creator, admin, f.owner].map(async (person) => {
      expect(await read(person.call(f.path))).toMatchObject({ rows: [{ canEdit: true }] });
      expect(await person.call(`${path}/edit`)).toMatchObject({ status: 200 });
      expect(await editRound(person, path, changed)).toMatchObject({ status: 200 });
    }),
  );
  expect(await read(admin.call(f.path))).toMatchObject({ rows: [{ canDelete: false }] });
  expect(await read(ordinary.call(f.path))).toMatchObject({ rows: [{ canEdit: false }] });
  expect(await ordinary.call(`${path}/edit`)).toMatchObject({ status: 403 });
  expect(await editRound(ordinary, path, changed)).toMatchObject({ status: 403 });
  expect(await editRound(foreign, path, changed)).toMatchObject({ status: 404 });
  expect(
    await editRound(f.owner, `interviews/${f.owner.workspaceId}/${crypto.randomUUID()}`, changed),
  ).toMatchObject({ status: 404 });
  /* eslint-disable no-await-in-loop -- 同一轮次按顺序切换状态并验证；verify each status sequentially on the same round. */
  for (const status of ["in_progress", "completed"]) {
    await atsTest.platform.database
      .update(interviewRound)
      .set({ status })
      .where(eq(interviewRound.id, id));
    expect(await read(creator.call(f.path))).toMatchObject({ rows: [{ canEdit: false }] });
    expect(await admin.call(`${path}/edit`)).toMatchObject({ status: 409 });
    expect(await editRound(creator, path, changed)).toMatchObject({ status: 409 });
    expect(await editRound(admin, path, changed)).toMatchObject({ status: 409 });
  }
  /* eslint-enable no-await-in-loop */
});

it("rejects invalid edits without changing the round or its assignments", async () => {
  const f = await fixture("edit-invalid@example.com");
  const other = await fixture("edit-invalid-other@example.com");
  const { id } = await read(f.owner.call(f.path, f.input));
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  const before = await read(f.owner.call(path));
  const input = { ...f.input, confirmationUserId: f.owner.userId };
  const invalid = [
    { ...input, confirmationUserId: other.owner.userId },
    { ...input, interviewerAgentId: other.agent.id },
    { ...input, conversationQuestionSetIds: [other.conversation.id] },
    { ...input, conversationQuestionSetIds: [f.empty.id] },
    { ...input, interviewerUserIds: [f.owner.userId] },
    { ...input, version: 2 },
    {
      admissionDeadline: "2027-01-01T02:00:00Z",
      interviewerUserIds: [other.owner.userId],
      kind: "human",
      scheduledAt: "2027-01-01T01:00:00Z",
      version: 1,
    },
  ];
  await Promise.all(
    invalid.map(async (value) => {
      expect(await editRound(f.owner, path, value)).toMatchObject({ status: 400 });
      expect(await read(f.owner.call(path))).toEqual(before);
    }),
  );
});

it.each(["human", "ai"] as const)(
  "rejects changing a saved %s round to the other type",
  async (kind) => {
    const f = await fixture(`edit-kind-${kind}@example.com`);
    const human = {
      admissionDeadline: "2027-01-05T11:00:00+08:00",
      interviewerUserIds: [f.owner.userId],
      kind: "human",
      scheduledAt: "2027-01-05T10:00:00+08:00",
      version: 1,
    };
    const ai = { ...f.input, confirmationUserId: f.owner.userId };
    const { id } = await read(f.owner.call(f.path, kind === "human" ? human : ai));
    const path = `interviews/${f.owner.workspaceId}/${id}`;
    const before = await read(f.owner.call(path));
    const response = await editRound(f.owner, path, kind === "human" ? ai : human);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "INTERVIEW_KIND_IMMUTABLE", version: 1 });
    expect(await read(f.owner.call(path))).toEqual(before);
  },
);

it("clears an AI confirmation assignee when editing without a reviewer", async () => {
  const f = await fixture("clear-reviewer@example.com");
  const { id } = await read(
    f.owner.call(f.path, { ...f.input, confirmationUserId: f.owner.userId }),
  );
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  expect(await editRound(f.owner, path, f.input)).toMatchObject({ status: 200 });
  expect(await read(f.owner.call(path))).toMatchObject({ assignments: [] });
});

it("includes workspace-wide form and conversation defaults in new interview setup", async () => {
  const f = await fixture("interview-all-job-defaults@example.com");
  const other = await fixture("interview-all-job-defaults-other@example.com");
  await Promise.all(
    [f, other].flatMap((current) =>
      [current.form.id, current.conversation.id].map(async (id) => {
        const path = `question-sets/${current.owner.workspaceId}/${id}`;
        const record = await read(current.owner.call(path));
        const response = await current.owner.request(path, {
          body: JSON.stringify({
            content: record.content,
            defaultAllJobs: true,
            name: record.name,
            version: 1,
          }),
          headers: { "content-type": "application/json" },
          method: "PUT",
        });
        expect(response.status).toBe(200);
      }),
    ),
  );
  const setup = await read(f.owner.call(`${f.path}/setup`));
  expect(setup.sets.map((set: { id: string }) => set.id).toSorted()).toEqual(
    [f.form.id, f.conversation.id].toSorted(),
  );
});
