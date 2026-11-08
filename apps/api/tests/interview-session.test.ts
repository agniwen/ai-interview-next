import {
  application,
  applicationResume,
  interviewerAgent,
  interviewRound,
  interviewSession,
  job,
  questionSet,
  resume,
} from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import {
  AgentDispatch,
  AgentDispatchClient,
  Room,
  RoomServiceClient,
  TokenVerifier,
} from "livekit-server-sdk";
import { afterEach, assert, expect, it, vi } from "vitest";
import { app } from "../src/app";
import type { ApiBindings } from "../src/env";
import { atsTest, read } from "./ats-fixture";
import { editRound, fixture } from "./interview-fixture";

const roomConfig = {
  INTERVIEW_AGENT_API_URL: "https://agent-api.example",
  LIVEKIT_AGENT_NAME: "interview-test-agent",
  LIVEKIT_API_KEY: "test-room-key",
  LIVEKIT_API_SECRET: "test-room-secret-at-least-32-characters",
  LIVEKIT_URL: "wss://rooms.example",
};

afterEach(() => vi.restoreAllMocks());

function request(token: string, action: string, body?: object, overrides?: Partial<ApiBindings>) {
  return app.request(
    `https://sainoa.example/api/candidate-interviews/${token}/${action}`,
    {
      body: body ? JSON.stringify(body) : undefined,
      headers: { "content-type": "application/json", origin: "https://sainoa.example" },
      method: "POST",
    },
    { ...atsTest.env, ...roomConfig, ...overrides },
    atsTest.platform.ctx,
  );
}

function context(id: string, credential?: string) {
  return app.request(
    `https://sainoa.example/api/interview-sessions/${id}/context`,
    {
      headers: credential ? { authorization: `Bearer ${credential}` } : {},
    },
    atsTest.env,
    atsTest.platform.ctx,
  );
}

function snapshot(id: string) {
  return atsTest.platform.database
    .select()
    .from(interviewSession)
    .where(eq(interviewSession.interviewRoundId, id))
    .get();
}

async function setup(name: string, withForms = true) {
  const f = await fixture(`session-${name}@example.com`);
  const { id } = await read(
    f.owner.call(f.path, {
      ...f.input,
      formQuestionSetIds: withForms ? f.input.formQuestionSetIds : [],
    }),
  );
  const { token } = await read(
    f.owner.request(`interviews/${f.owner.workspaceId}/${id}/invitation`, { method: "POST" }),
  );
  return { ...f, id: id as string, token: token as string };
}

function mockRooms() {
  const createRoom = vi
    .spyOn(RoomServiceClient.prototype, "createRoom")
    .mockResolvedValue(new Room());
  const listDispatch = vi
    .spyOn(AgentDispatchClient.prototype, "listDispatch")
    .mockResolvedValue([]);
  const createDispatch = vi
    .spyOn(AgentDispatchClient.prototype, "createDispatch")
    .mockResolvedValue(new AgentDispatch());
  return { createDispatch, createRoom, listDispatch };
}

it("requires explicit start and submitted answers without starting from entry or token prefetch", async () => {
  const f = await setup("preparation");
  const rooms = mockRooms();
  expect(await request(f.token, "start", { version: 1 })).toMatchObject({ status: 409 });
  const entry = await read(request(f.token, "entry"));
  expect(await snapshot(f.id)).toBeUndefined();
  expect(await request(f.token, "connection")).toMatchObject({ status: 409 });
  expect(await request(f.token, "start", { version: 1 })).toMatchObject({ status: 409 });
  expect(rooms.createRoom).not.toHaveBeenCalled();
  expect(rooms.createDispatch).not.toHaveBeenCalled();
  const answers = { [entry.questions.form[0].id]: "My background" };
  expect(await request(f.token, "form/submit", { answers, version: 1 })).toMatchObject({
    status: 200,
  });
  const start = await request(f.token, "start", { version: 1 });
  expect(start.status).toBe(200);
  expect(start.headers.get("cache-control")).toBe("private, no-store");
  const result = await start.json();
  expect(result).toEqual({ startedAt: expect.any(String), version: 1 });
  const saved = await snapshot(f.id);
  expect(saved?.content.form).toEqual({ answers, version: 1 });
  expect(saved?.capturedAt.toISOString()).toBe(result.startedAt);
  expect(await read(request(f.token, "entry"))).toMatchObject({
    startedAt: result.startedAt,
    status: "in_progress",
  });
  expect(await request(f.token, "form/submit", { answers, version: 1 })).toMatchObject({
    status: 409,
  });
  expect(
    await editRound(f.owner, `interviews/${f.owner.workspaceId}/${f.id}`, {
      ...f.input,
      confirmationUserId: f.owner.userId,
    }),
  ).toMatchObject({ status: 409 });
  expect(rooms.createDispatch).not.toHaveBeenCalled();
});

it("captures latest available materials and agent configuration exactly once", async () => {
  const f = await setup("snapshot", false);
  const db = atsTest.platform.database;
  await request(f.token, "entry");
  const availableId = crypto.randomUUID();
  const pendingId = crypto.randomUUID();
  const removedId = crypto.randomUUID();
  const materials = [
    { id: availableId, status: "available" },
    { id: pendingId, status: "pending_confirmation" },
    { id: removedId, status: "removed" },
  ] as const;
  await db.insert(resume).values(
    materials.map(({ id, status }) => ({
      createdAt: new Date(),
      id,
      markdown: `Resume ${status}`,
      pdfObjectKey: `${id}.pdf`,
      sha256: id,
      workspaceId: f.owner.workspaceId,
    })),
  );
  await db.insert(applicationResume).values(
    materials.map(({ id, status }) => ({
      applicationId: f.applicationId,
      createdAt: new Date(),
      id: crypto.randomUUID(),
      resumeId: id,
      status,
      workspaceId: f.owner.workspaceId,
    })),
  );
  await db
    .update(job)
    .set({ internalCriteria: "Private hiring criteria", requirements: "Latest requirements" })
    .where(eq(job.id, f.jobId));
  await db
    .update(interviewerAgent)
    .set({ prompt: "Latest hosting prompt" })
    .where(eq(interviewerAgent.id, f.agent.id));
  const start = await read(request(f.token, "start", { version: 1 }));
  const original = await snapshot(f.id);
  expect(original?.content).toMatchObject({
    form: { answers: {}, version: 1 },
    interviewer: { prompt: "Latest hosting prompt" },
    job: { internalCriteria: "Private hiring criteria", requirements: "Latest requirements" },
    resumes: [
      { id: availableId, markdown: "Resume available", pdfObjectKey: `${availableId}.pdf` },
    ],
    version: 1,
  });
  await db.update(job).set({ requirements: "Changed after start" }).where(eq(job.id, f.jobId));
  await db
    .update(interviewerAgent)
    .set({ prompt: "Changed after start" })
    .where(eq(interviewerAgent.id, f.agent.id));
  await db
    .update(resume)
    .set({ markdown: "Changed after start" })
    .where(eq(resume.id, availableId));
  await db
    .update(applicationResume)
    .set({ status: "removed" })
    .where(eq(applicationResume.resumeId, availableId));
  await db
    .update(questionSet)
    .set({ content: { kind: "conversation", questions: [], version: 1 } })
    .where(eq(questionSet.id, f.conversation.id));
  expect(await read(request(f.token, "start", { version: 1 }))).toEqual(start);
  expect(await snapshot(f.id)).toEqual(original);
  const publicEntry = JSON.stringify(await read(request(f.token, "entry")));
  expect(publicEntry).not.toContain("hosting prompt");
  expect(publicEntry).not.toContain("hiring criteria");
  expect(publicEntry).not.toContain(original?.contextToken);
});

it("issues a scoped SDK token and dispatches only the server-selected agent with private context", async () => {
  const f = await setup("connection", false);
  await request(f.token, "entry");
  await request(f.token, "start", { version: 1 });
  const saved = await snapshot(f.id);
  assert(saved);
  const rooms = mockRooms();
  const response = await request(f.token, "connection", {
    participant_identity: "someone-else",
    room_config: { agents: [{ agent_name: "other-agent" }] },
    room_name: "foreign-room",
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const connection = await response.json();
  expect(connection).toEqual({
    participantToken: expect.any(String),
    serverUrl: roomConfig.LIVEKIT_URL,
    version: 1,
  });
  const claims = await new TokenVerifier(
    roomConfig.LIVEKIT_API_KEY,
    roomConfig.LIVEKIT_API_SECRET,
  ).verify(connection.participantToken);
  expect(claims).toMatchObject({
    sub: `candidate-${f.id}`,
    video: {
      canPublish: true,
      canPublishData: true,
      canPublishSources: ["microphone", "camera"],
      canSubscribe: true,
      canUpdateOwnMetadata: false,
      room: saved.roomName,
      roomJoin: true,
    },
  });
  expect(claims.video).not.toHaveProperty("roomAdmin");
  expect(claims.video).not.toHaveProperty("roomCreate");
  expect(claims.exp).toBe(Number(claims.nbf) + 900);
  expect(claims).not.toHaveProperty("roomConfig");
  expect(JSON.stringify(claims)).not.toContain(saved.contextToken);
  expect(rooms.createRoom).toHaveBeenCalledWith({ name: saved.roomName });
  expect(rooms.createDispatch).toHaveBeenCalledWith(saved.roomName, roomConfig.LIVEKIT_AGENT_NAME, {
    metadata: JSON.stringify({
      contextToken: saved.contextToken,
      contextUrl: `https://agent-api.example/api/interview-sessions/${f.id}/context`,
      version: 1,
    }),
  });
  rooms.listDispatch.mockResolvedValue([
    new AgentDispatch({ agentName: roomConfig.LIVEKIT_AGENT_NAME }),
  ]);
  expect(await request(f.token, "connection")).toMatchObject({ status: 200 });
  expect(rooms.createDispatch).toHaveBeenCalledTimes(1);
  expect(await snapshot(f.id)).toEqual(saved);
});

it("keeps context private to the running round and blocks ended, closed and deleted sessions", async () => {
  const f = await setup("context", false);
  const other = await setup("context-other", false);
  await request(f.token, "entry");
  await request(f.token, "start", { version: 1 });
  const saved = await snapshot(f.id);
  assert(saved);
  expect(await context(f.id)).toMatchObject({ status: 404 });
  expect(await context(f.id, f.token)).toMatchObject({ status: 404 });
  expect(await context(other.id, saved.contextToken)).toMatchObject({ status: 404 });
  const allowed = await context(f.id, saved.contextToken);
  expect(allowed.status).toBe(200);
  expect(allowed.headers.get("cache-control")).toBe("private, no-store");
  expect(await allowed.json()).toMatchObject({
    content: saved.content,
    interviewId: f.id,
    participantIdentity: `candidate-${f.id}`,
    roomName: saved.roomName,
    version: 1,
  });
  const db = atsTest.platform.database;
  await db.update(interviewRound).set({ status: "completed" }).where(eq(interviewRound.id, f.id));
  expect(await request(f.token, "start", { version: 1 })).toMatchObject({ status: 409 });
  expect(await request(f.token, "connection")).toMatchObject({ status: 409 });
  expect(await context(f.id, saved.contextToken)).toMatchObject({ status: 404 });
  await db.update(interviewRound).set({ status: "in_progress" }).where(eq(interviewRound.id, f.id));
  await db
    .update(application)
    .set({ closedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await request(f.token, "connection")).toMatchObject({ status: 409 });
  expect(await context(f.id, saved.contextToken)).toMatchObject({ status: 404 });
  await db
    .update(application)
    .set({ closedAt: null, deletedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await request(f.token, "start", { version: 1 })).toMatchObject({ status: 404 });
  expect(await request(f.token, "connection")).toMatchObject({ status: 404 });
  expect(await context(f.id, saved.contextToken)).toMatchObject({ status: 404 });
});

it("rejects invalid input, unknown invitations and human interview starts", async () => {
  const f = await setup("invalid", false);
  expect(await request("invalid", "start", { version: 1 })).toMatchObject({ status: 404 });
  expect(await request("a".repeat(64), "start", { version: 1 })).toMatchObject({ status: 404 });
  expect(await request(f.token, "start", { version: 2 })).toMatchObject({ status: 400 });
  const human = await fixture("session-human@example.com");
  const { id } = await read(
    human.owner.call(human.path, {
      admissionDeadline: "2099-01-01T01:00:00Z",
      interviewerUserIds: [human.owner.userId],
      kind: "human",
      scheduledAt: "2099-01-01T00:00:00Z",
      version: 1,
    }),
  );
  const { token } = await read(
    human.owner.request(`interviews/${human.owner.workspaceId}/${id}/invitation`, {
      method: "POST",
    }),
  );
  expect(await request(token, "start", { version: 1 })).toMatchObject({ status: 409 });
  expect(await request(token, "connection")).toMatchObject({ status: 409 });
  expect(await snapshot(id)).toBeUndefined();
});

it("leaves preparation editable without configuration and allows connection retry after service failure", async () => {
  const f = await setup("failure", false);
  await request(f.token, "entry");
  expect(
    await request(f.token, "start", { version: 1 }, { LIVEKIT_API_KEY: undefined }),
  ).toMatchObject({ status: 503 });
  expect(await snapshot(f.id)).toBeUndefined();
  expect(await read(request(f.token, "entry"))).toMatchObject({ status: "scheduled" });
  const start = await read(request(f.token, "start", { version: 1 }));
  const rooms = mockRooms();
  rooms.createDispatch.mockRejectedValueOnce(new Error("vendor secret details"));
  const failed = await request(f.token, "connection");
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({ error: "INTERVIEW_CONNECTION_FAILED", version: 1 });
  expect(await request(f.token, "connection")).toMatchObject({ status: 200 });
  expect(await read(request(f.token, "start", { version: 1 }))).toEqual(start);
});

function finishAgent(id: string, credential: string, reason = "candidate_requested") {
  return app.request(
    `https://sainoa.example/api/interview-sessions/${id}/end`,
    {
      body: JSON.stringify({ reason, version: 1 }),
      headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
      method: "POST",
    },
    atsTest.env,
    atsTest.platform.ctx,
  );
}

it("records creation, start and candidate completion once while refreshes reuse the round", async () => {
  const f = await setup("lifecycle", false);
  const rooms = mockRooms();
  const close = vi.spyOn(RoomServiceClient.prototype, "deleteRoom").mockResolvedValue(undefined);
  await request(f.token, "entry");
  const start = await read(request(f.token, "start", { version: 1 }));
  expect(await read(request(f.token, "start", { version: 1 }))).toEqual(start);
  await request(f.token, "connection");
  rooms.listDispatch.mockResolvedValue([
    new AgentDispatch({ agentName: roomConfig.LIVEKIT_AGENT_NAME }),
  ]);
  await request(f.token, "connection");
  expect(rooms.createDispatch).toHaveBeenCalledTimes(1);
  const ended = await read(request(f.token, "end", { version: 1 }));
  expect(ended).toEqual({ endedAt: expect.any(String), version: 1 });
  expect(await read(request(f.token, "end", { version: 1 }))).toEqual(ended);
  const saved = await snapshot(f.id);
  assert(saved);
  expect(await read(finishAgent(f.id, saved.contextToken))).toEqual(ended);
  expect(close).toHaveBeenCalledWith(saved.roomName);
  expect(await request(f.token, "connection")).toMatchObject({ status: 409 });
  expect(await request(f.token, "start", { version: 1 })).toMatchObject({ status: 409 });
  expect(await context(f.id, saved.contextToken)).toMatchObject({ status: 404 });
  expect(await read(request(f.token, "entry"))).toMatchObject({ ...ended, status: "completed" });
  const detail = await read(f.owner.ats(`applications/${f.applicationId}`));
  expect(detail.activity).toHaveLength(3);
  expect(detail.activity).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        action: "interview_created",
        actorId: f.owner.userId,
        actorType: "user",
      }),
      expect.objectContaining({
        action: "interview_started",
        actorName: "Candidate",
        actorType: "candidate",
        occurredAt: start.startedAt,
      }),
      expect.objectContaining({
        action: "interview_ended",
        actorName: "Candidate",
        actorType: "candidate",
        occurredAt: ended.endedAt,
      }),
    ]),
  );
  expect(
    detail.activity.every((event: { result: unknown }) =>
      JSON.stringify(event.result).includes(f.id),
    ),
  ).toBe(true);
});

it("authenticates Agent completion and keeps its actor when a candidate retries", async () => {
  const f = await setup("agent-end", false);
  await request(f.token, "entry");
  await request(f.token, "start", { version: 1 });
  const saved = await snapshot(f.id);
  assert(saved);
  expect(await finishAgent(f.id, "b".repeat(64))).toMatchObject({ status: 404 });
  const ended = await read(finishAgent(f.id, saved.contextToken));
  expect(await read(finishAgent(f.id, saved.contextToken))).toEqual(ended);
  vi.spyOn(RoomServiceClient.prototype, "deleteRoom").mockResolvedValue(undefined);
  expect(await read(request(f.token, "end", { version: 1 }))).toEqual(ended);
  const detail = await read(f.owner.ats(`applications/${f.applicationId}`));
  expect(
    detail.activity.filter((event: { action: string }) => event.action === "interview_ended"),
  ).toEqual([
    expect.objectContaining({
      actorId: f.agent.id,
      actorName: "Interviewer",
      actorType: "system",
      occurredAt: ended.endedAt,
    }),
  ]);
});

it("retries room cleanup without replacing the committed completion event", async () => {
  const f = await setup("end-cleanup", false);
  await request(f.token, "entry");
  await request(f.token, "start", { version: 1 });
  vi.spyOn(RoomServiceClient.prototype, "deleteRoom")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue(undefined);
  expect(await request(f.token, "end", { version: 1 })).toMatchObject({ status: 503 });
  const entry = await read(request(f.token, "entry"));
  expect(entry.status).toBe("completed");
  expect(await read(request(f.token, "end", { version: 1 }))).toEqual({
    endedAt: entry.endedAt,
    version: 1,
  });
  const detail = await read(f.owner.ats(`applications/${f.applicationId}`));
  expect(
    detail.activity.filter((event: { action: string }) => event.action === "interview_ended"),
  ).toHaveLength(1);
});

it("does not let candidates complete human interviews", async () => {
  const f = await fixture("human-candidate-end@example.com");
  const { id } = await read(
    f.owner.call(f.path, {
      admissionDeadline: "2027-01-05T10:30:00Z",
      interviewerUserIds: [f.owner.userId],
      kind: "human",
      scheduledAt: "2027-01-05T10:00:00Z",
      version: 1,
    }),
  );
  const { token } = await read(
    f.owner.request(`interviews/${f.owner.workspaceId}/${id}/invitation`, { method: "POST" }),
  );
  expect(await request(token, "end", { version: 1 })).toMatchObject({ status: 409 });
  const detail = await read(f.owner.ats(`applications/${f.applicationId}`));
  expect(detail.activity.map((event: { action: string }) => event.action)).toEqual([
    "interview_created",
  ]);
});

function reportRequest(id: string, credential: string, action: string, content: object) {
  return app.request(
    `https://sainoa.example/api/interview-sessions/${id}/${action}`,
    {
      body: JSON.stringify(content),
      headers: { authorization: `Bearer ${credential}`, "content-type": "application/json" },
      method: "POST",
    },
    atsTest.env,
    atsTest.platform.ctx,
  );
}

it("persists evidence-backed results, rejects invented quotes and separates refusal from collected information", async () => {
  const f = await setup("collection", false);
  await request(f.token, "entry");
  await request(f.token, "start", { version: 1 });
  const session = await snapshot(f.id);
  assert(session);
  const questions = session.content.questions.conversation;
  const plan = {
    questions: questions.map((q, i) => ({
      code: `q${i + 1}`,
      content: q.question.content,
      id: q.id,
      points: [{ id: `q${i + 1}.p1`, label: "具体经历" }],
    })),
    version: 1,
  };
  expect(await reportRequest(f.id, "b".repeat(64), "plan", plan)).toMatchObject({ status: 404 });
  expect(await reportRequest(f.id, session.contextToken, "plan", plan)).toMatchObject({
    status: 200,
  });
  expect(await finishAgent(f.id, session.contextToken, "completed")).toMatchObject({ status: 409 });
  const turns = {
    turns: [
      {
        at: Date.now(),
        id: `u-${f.id}`,
        interrupted: false,
        role: "user",
        text: "这部分经历我不方便透露。",
      },
    ],
    version: 1,
  };
  expect(await reportRequest(f.id, session.contextToken, "turns", turns)).toMatchObject({
    status: 200,
  });
  const progress = {
    answers: plan.questions.map((q) => ({
      evidence: [{ quote: "我不方便透露", turnId: `u-${f.id}` }],
      pointId: `${q.code}.p1`,
      status: "declined",
      summary: "不便透露",
    })),
    asked: [],
    endReason: "completed",
    finalized: true,
    revision: 1,
    summary: "候选人未透露相关经历。",
    usage: { cachedInputTokens: 10, inputTokens: 50, outputTokens: 20 },
    version: 1,
  };
  expect(
    await reportRequest(f.id, session.contextToken, "progress", {
      ...progress,
      answers: [
        { ...progress.answers[0], evidence: [{ quote: "我设计了订单系统", turnId: `u-${f.id}` }] },
      ],
    }),
  ).toMatchObject({ status: 400 });
  expect(await reportRequest(f.id, session.contextToken, "progress", progress)).toMatchObject({
    status: 200,
  });
  expect(await finishAgent(f.id, session.contextToken, "completed")).toMatchObject({ status: 200 });
  const result = await read(f.owner.call(`interviews/${f.owner.workspaceId}/${f.id}/result`));
  expect(result).toMatchObject({
    feedback: [],
    plan,
    progress,
    round: { status: "completed" },
    turns: turns.turns,
    version: 1,
  });
  expect(
    await reportRequest(f.id, session.contextToken, "progress", { ...progress, revision: 0 }),
  ).toMatchObject({ status: 400 });
  const candidate = await read(request(f.token, "entry"));
  expect(candidate).not.toHaveProperty("progress");
  expect(
    await request(f.token, "feedback", { comment: "交流自然", rating: 5, version: 1 }),
  ).toMatchObject({ status: 200 });
  expect(await read(request(f.token, "entry"))).toMatchObject({
    feedback: { comment: "交流自然", rating: 5, version: 1 },
  });
});

it("records recovery separately from completion and prevents clients forging system events", async () => {
  const f = await setup("runtime-events", false);
  mockRooms();
  vi.spyOn(RoomServiceClient.prototype, "deleteRoom").mockResolvedValue(undefined);
  await request(f.token, "entry");
  await request(f.token, "start", { version: 1 });
  const session = await snapshot(f.id);
  assert(session);
  const event = {
    at: Date.now(),
    content: {
      attempt: null,
      kind: "room_reconnecting",
      reason: "network",
      recoverable: true,
      version: 1,
    },
    id: crypto.randomUUID(),
    runId: "test-browser",
  };
  expect(await request(f.token, "events", { events: [event], version: 1 })).toMatchObject({
    status: 200,
  });
  expect(await request(f.token, "events", { events: [event], version: 1 })).toMatchObject({
    status: 200,
  });
  expect(
    await request(f.token, "events", {
      events: [{ ...event, content: { ...event.content, kind: "interview_ended" } }],
      version: 1,
    }),
  ).toMatchObject({ status: 400 });
  expect(
    await request(f.token, "events", {
      events: [{ ...event, content: { ...event.content, kind: "realtime_failed" } }],
      version: 1,
    }),
  ).toMatchObject({ status: 400 });
  const failure = {
    ...event,
    content: {
      ...event.content,
      attempt: 3,
      kind: "realtime_failed",
      reason: "APIConnectionError",
      recoverable: false,
    },
    id: crypto.randomUUID(),
    runId: "test-agent",
  };
  expect(
    await reportRequest(f.id, "b".repeat(64), "events", { events: [failure], version: 1 }),
  ).toMatchObject({ status: 404 });
  expect(
    await reportRequest(f.id, session.contextToken, "events", { events: [failure], version: 1 }),
  ).toMatchObject({ status: 200 });
  let result = await read(f.owner.call(`interviews/${f.owner.workspaceId}/${f.id}/result`));
  expect(result.round.status).toBe("in_progress");
  expect(result.round.endedAt).toBeNull();
  expect(result.events).toHaveLength(2);
  expect(result.events).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: event.id, source: "candidate" }),
      expect.objectContaining({
        content: expect.objectContaining({ attempt: 3, recoverable: false }),
        id: failure.id,
        source: "agent",
      }),
    ]),
  );
  const recovery = {
    ...failure,
    content: { ...failure.content, kind: "realtime_reconnected", reason: null, recoverable: true },
    id: crypto.randomUUID(),
  };
  expect(
    await reportRequest(f.id, session.contextToken, "events", { events: [recovery], version: 1 }),
  ).toMatchObject({ status: 200 });
  await request(f.token, "end", { version: 1 });
  await request(f.token, "end", { version: 1 });
  result = await read(f.owner.call(`interviews/${f.owner.workspaceId}/${f.id}/result`));
  expect(result.round.status).toBe("completed");
  expect(
    result.events.filter(
      (item: { content: { kind: string } }) => item.content.kind === "interview_ended",
    ),
  ).toEqual([
    expect.objectContaining({
      content: expect.objectContaining({ reason: "candidate_requested" }),
      source: "system",
    }),
  ]);
});
