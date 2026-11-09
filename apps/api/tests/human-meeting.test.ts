import {
  applicationActivity,
  applicationEvaluation,
  applicationResume,
  interviewRound,
  interviewEvaluation,
  interviewSession,
  job,
  resume,
  resumeUploadBatch,
  resumeUploadItem,
} from "@ai-interview/db/schema";
import { and, eq } from "drizzle-orm";
import {
  AgentDispatch,
  AgentDispatchClient,
  Room,
  RoomServiceClient,
  TokenVerifier,
} from "livekit-server-sdk";
import { afterEach, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { resumeFiles } from "../src/modules/ats/storage";
import { atsTest, read } from "./ats-fixture";
import { fixture, addInterviewMember } from "./interview-fixture";

const config = {
  LIVEKIT_API_KEY: "meeting-test-key",
  LIVEKIT_API_SECRET: "meeting-test-secret-at-least-32-characters",
  LIVEKIT_URL: "wss://meeting.example",
};

afterEach(() => vi.restoreAllMocks());

async function setup(name: string) {
  const f = await fixture(`meeting-${name}@example.com`);
  Object.assign(atsTest.env, config);
  const createRoom = vi
    .spyOn(RoomServiceClient.prototype, "createRoom")
    .mockResolvedValue(new Room());
  const deleteRoom = vi.spyOn(RoomServiceClient.prototype, "deleteRoom").mockResolvedValue();
  const dispatch = vi.spyOn(AgentDispatchClient.prototype, "createDispatch");
  const created = await read(
    f.owner.call(f.path, {
      admissionDeadline: new Date(Date.now() + 60 * 60_000).toISOString(),
      interviewerUserIds: [f.owner.userId],
      kind: "human",
      label: "技术面试",
      scheduledAt: new Date(Date.now() - 60_000).toISOString(),
      version: 1,
    }),
  );
  expect(created.id).toBeTypeOf("string");
  const roundId = String(created.id);
  const { token } = await read(
    f.owner.request(`interviews/${f.owner.workspaceId}/${roundId}/invitation`, { method: "POST" }),
  );
  const path = `interviews/${f.owner.workspaceId}/${roundId}/meeting`;
  const candidate = (action: string) =>
    app.request(
      `https://sainoa.example/api/candidate-interviews/${token}/${action}`,
      {
        body: JSON.stringify({ version: 1 }),
        headers: { "content-type": "application/json", origin: "https://sainoa.example" },
        method: "POST",
      },
      atsTest.env,
      atsTest.platform.ctx,
    );
  const round = () =>
    atsTest.platform.database
      .select()
      .from(interviewRound)
      .where(eq(interviewRound.id, roundId))
      .get();
  const session = () =>
    atsTest.platform.database
      .select()
      .from(interviewSession)
      .where(eq(interviewSession.interviewRoundId, roundId))
      .get();
  return { ...f, candidate, createRoom, deleteRoom, dispatch, path, round, roundId, session };
}

it("restricts interviewer materials and room admission to authenticated assigned members", async () => {
  const f = await setup("access");
  const other = await addInterviewMember(f.owner.workspaceId, "meeting-other@example.com");
  expect(
    await app.request(
      `https://sainoa.example/api/${f.path}`,
      {},
      atsTest.env,
      atsTest.platform.ctx,
    ),
  ).toMatchObject({ status: 401 });
  expect(await other.call(f.path)).toMatchObject({ status: 403 });
  expect(await other.call(f.path, { version: 1 })).toMatchObject({ status: 403 });
  expect(await other.call(`${f.path}/entered`, { version: 1 })).toMatchObject({ status: 403 });
  expect(await other.call(`${f.path}/end`, { version: 1 })).toMatchObject({ status: 403 });
  const preview = await read(f.owner.call(f.path));
  expect(preview).toMatchObject({
    admissionError: null,
    candidateName: "Candidate",
    jobTitle: "Engineer",
    materials: { version: 1 },
    version: 1,
  });
  expect(await f.session()).toBeUndefined();
  const candidate = await read(f.candidate("entry"));
  expect(candidate).not.toHaveProperty("materials");
  expect(candidate).not.toHaveProperty("internalCriteria");
});

it("serves the original image resume and the latest resume evaluation before entry", async () => {
  const f = await setup("original-resume");
  const { userId, workspaceId } = f.owner;
  const id = crypto.randomUUID();
  const filename = "Original resume.png";
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWioAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  const createdAt = new Date();
  const db = atsTest.platform.database;
  await db.batch([
    db.insert(resume).values({ createdAt, id, pdfObjectKey: id, sha256: id, workspaceId }),
    db.insert(applicationResume).values({
      applicationId: f.applicationId,
      createdAt,
      id,
      resumeId: id,
      status: "available",
      workspaceId,
    }),
    db.insert(resumeUploadBatch).values({ createdAt, createdBy: userId, id, workspaceId }),
    db.insert(resumeUploadItem).values({
      batchId: id,
      filename,
      id,
      objectKey: id,
      size: png.byteLength,
      status: "accepted",
      workspaceId,
    }),
  ]);
  await resumeFiles(atsTest.env).upload(id, png, { contentType: "image/png" });
  await db.insert(applicationEvaluation).values(
    ["Earlier assessment", "Latest assessment"].map((assessment, index) => ({
      applicationId: f.applicationId,
      createdAt: new Date(createdAt.getTime() + index),
      id: crypto.randomUUID(),
      jobRequirementsSnapshot: "Requirements",
      result: {
        conciseOverall: assessment,
        detailedOverall: { judgment: assessment, matchingEvidence: [], risks: [] },
        recommendationLevel: "recommended" as const,
        version: 3 as const,
      },
      resumeId: id,
      workspaceId,
    })),
  );
  const documentUrl = `/api/${f.path}/resumes/${id}`;
  expect(await read(f.owner.call(f.path))).toMatchObject({
    materials: {
      resumeEvaluation: { result: { conciseOverall: "Latest assessment", version: 3 } },
      resumes: [{ documentUrl, filename }],
    },
  });
  const original = await f.owner.call(`${f.path}/resumes/${id}`);
  expect(original.status).toBe(200);
  expect(original.headers.get("content-type")).toBe("image/png");
  expect(new Uint8Array(await original.arrayBuffer())).toEqual(png);
});

it("issues media-only tokens without starting, then snapshots the first successful entry and preserves it on reconnect", async () => {
  const f = await setup("lifecycle");
  const connection = await read(f.owner.call(f.path, { version: 1 }));
  const candidateConnection = await read(f.candidate("meeting"));
  expect(connection).toMatchObject({ startedAt: null, version: 1 });
  expect(await f.session()).toBeUndefined();
  expect(await f.round()).toMatchObject({ startedAt: null, status: "scheduled" });
  const verifier = new TokenVerifier(config.LIVEKIT_API_KEY, config.LIVEKIT_API_SECRET);
  const ownerToken = await verifier.verify(connection.participantToken);
  const candidateToken = await verifier.verify(candidateConnection.participantToken);
  expect(ownerToken.attributes).toMatchObject({ role: "interviewer" });
  expect(candidateToken.attributes).toMatchObject({ role: "candidate" });
  expect(ownerToken.video?.room).toBe(candidateToken.video?.room);
  expect(ownerToken.video).toMatchObject({
    canPublish: true,
    canPublishSources: ["microphone", "camera", "screen_share", "screen_share_audio"],
    canSubscribe: true,
    roomJoin: true,
  });
  expect(ownerToken.video).not.toHaveProperty("roomAdmin");
  expect(f.dispatch).not.toHaveBeenCalled();
  await atsTest.platform.database
    .update(job)
    .set({ internalCriteria: "Private criteria", requirements: "Current requirements" })
    .where(eq(job.id, f.jobId));
  const started = await read(f.owner.call(`${f.path}/entered`, { version: 1 }));
  expect(started.startedAt).toEqual(expect.any(String));
  expect(await f.round()).toMatchObject({ status: "in_progress" });
  expect(await f.session()).toMatchObject({
    content: { interviewer: null, job: { requirements: "Current requirements" } },
    roomName: ownerToken.video?.room,
  });
  await atsTest.platform.database
    .update(job)
    .set({ requirements: "Changed afterwards" })
    .where(eq(job.id, f.jobId));
  expect(await read(f.candidate("meeting/entered"))).toEqual(started);
  expect(await read(f.owner.call(f.path))).toMatchObject({
    materials: { job: { requirements: "Current requirements" } },
  });
  const events = await atsTest.platform.database
    .select()
    .from(applicationActivity)
    .where(
      and(
        eq(applicationActivity.applicationId, f.applicationId),
        eq(applicationActivity.action, "interview_started"),
      ),
    );
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ actorId: f.owner.userId, actorType: "user" });
  expect(await read(f.candidate("meeting"))).toMatchObject({ startedAt: started.startedAt });
});

it("lets candidates enter and leave without ending, and closes the room only for an assigned interviewer", async () => {
  const f = await setup("end");
  await f.candidate("meeting");
  await f.candidate("meeting/entered");
  const original = await f.session();
  expect(await f.candidate("end")).toMatchObject({ status: 409 });
  expect(await f.round()).toMatchObject({ status: "in_progress" });
  const started = await atsTest.platform.database
    .select()
    .from(applicationActivity)
    .where(eq(applicationActivity.id, `interview_started-${f.roundId}`))
    .get();
  expect(started).toMatchObject({ actorType: "candidate" });
  const ended = await read(f.owner.call(`${f.path}/end`, { version: 1 }));
  expect(ended).toMatchObject({ endedAt: expect.any(String), version: 1 });
  expect(f.deleteRoom).toHaveBeenCalledWith(original?.roomName);
  expect(await f.round()).toMatchObject({ status: "completed" });
  expect(await f.candidate("meeting")).toMatchObject({ status: 409 });
  expect(await f.candidate("meeting/entered")).toMatchObject({ status: 409 });
  expect(await f.owner.call(f.path, { version: 1 })).toMatchObject({ status: 409 });
  expect(await read(f.owner.call(`${f.path}/end`, { version: 1 }))).toEqual(ended);
  const events = await atsTest.platform.database
    .select()
    .from(applicationActivity)
    .where(eq(applicationActivity.id, `interview_ended-${f.roundId}`));
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ actorId: f.owner.userId, actorType: "user" });
});

it("enforces the ten-minute admission window without automatically ending an active interview at the deadline", async () => {
  const f = await setup("window");
  const db = atsTest.platform.database;
  await db
    .update(interviewRound)
    .set({ scheduledAt: new Date(Date.now() + 11 * 60_000) })
    .where(eq(interviewRound.id, f.roundId));
  expect(await read(f.candidate("meeting"))).toMatchObject({ error: "INTERVIEW_TOO_EARLY" });
  expect(await read(f.owner.call(f.path, { version: 1 }))).toMatchObject({
    error: "INTERVIEW_TOO_EARLY",
  });
  expect(await f.session()).toBeUndefined();
  await db
    .update(interviewRound)
    .set({ scheduledAt: new Date(Date.now() + 9 * 60_000) })
    .where(eq(interviewRound.id, f.roundId));
  expect(await f.candidate("meeting")).toMatchObject({ status: 200 });
  await f.candidate("meeting/entered");
  await db
    .update(interviewRound)
    .set({ admissionDeadline: new Date(Date.now() - 1000) })
    .where(eq(interviewRound.id, f.roundId));
  expect(await read(f.candidate("meeting"))).toMatchObject({ error: "INTERVIEW_ADMISSION_CLOSED" });
  expect(await f.owner.call(f.path, { version: 1 })).toMatchObject({ status: 409 });
  expect(await f.round()).toMatchObject({ endedAt: null, status: "in_progress" });
  expect(f.deleteRoom).not.toHaveBeenCalled();
  expect(await f.owner.call(`${f.path}/end`, { version: 1 })).toMatchObject({ status: 200 });
});

it("keeps the round active until the room closes and lets an interviewer retry a timeout", async () => {
  const f = await setup("end-retry");
  await f.candidate("meeting/entered");
  f.deleteRoom.mockRejectedValueOnce(new DOMException("Room close timed out", "TimeoutError"));

  const end = () => f.owner.call(`${f.path}/end`, { version: 1 });
  expect(await end()).toMatchObject({ status: 503 });
  expect(await f.round()).toMatchObject({ endedAt: null, status: "in_progress" });
  expect(await f.candidate("meeting")).toMatchObject({ status: 200 });

  expect(await end()).toMatchObject({ status: 200 });
  expect(await f.round()).toMatchObject({ status: "completed" });
  expect(await f.candidate("meeting")).toMatchObject({ status: 409 });
});

it("issues both human meeting tokens when explicit room creation would time out", async () => {
  const f = await setup("unavailable");
  f.createRoom.mockRejectedValue(new DOMException("Room creation timed out", "TimeoutError"));
  expect(await f.candidate("meeting")).toMatchObject({ status: 200 });
  expect(await f.owner.call(f.path, { version: 1 })).toMatchObject({ status: 200 });
  expect(f.createRoom).not.toHaveBeenCalled();
  expect(await f.round()).toMatchObject({ startedAt: null, status: "scheduled" });
  expect(await f.session()).toBeUndefined();
});

it("dispatches one transcription worker after entry and restores speaker-attributed turns", async () => {
  const f = await setup("transcription");
  const listDispatch = vi
    .spyOn(AgentDispatchClient.prototype, "listDispatch")
    .mockResolvedValue([]);
  const agent = new AgentDispatch({ agentName: "human-test-agent" });
  f.dispatch.mockImplementation(() => {
    listDispatch.mockResolvedValue([agent]);
    return Promise.resolve(agent);
  });
  const { env } = atsTest;
  const previous = { agent: env.LIVEKIT_AGENT_NAME, url: env.INTERVIEW_AGENT_API_URL };
  env.LIVEKIT_AGENT_NAME = agent.agentName;
  env.INTERVIEW_AGENT_API_URL = "https://sainoa.example";
  try {
    await f.candidate("meeting");
    expect(f.dispatch).not.toHaveBeenCalled();
    await Promise.all([
      f.candidate("meeting/entered"),
      f.owner.call(`${f.path}/entered`, { version: 1 }),
    ]);
    await vi.waitFor(() => expect(f.dispatch).toHaveBeenCalledTimes(1));
    const session = await f.session();
    const [[room, name, options]] = f.dispatch.mock.calls;
    expect(room).toBe(session?.roomName);
    expect(name).toBe(agent.agentName);
    const metadata = JSON.parse(options?.metadata ?? "{}");
    expect(metadata).toMatchObject({
      contextToken: session?.contextToken,
      mode: "human_transcription",
      version: 1,
    });
    const headers = {
      authorization: `Bearer ${session?.contextToken}`,
      "content-type": "application/json",
    };
    expect(await app.request(metadata.contextUrl, {}, env, atsTest.platform.ctx)).toMatchObject({
      status: 404,
    });
    expect(
      await app.request(metadata.contextUrl, { headers }, env, atsTest.platform.ctx),
    ).toMatchObject({ status: 200 });
    const turns = [
      {
        at: Date.now(),
        id: "first",
        interrupted: false,
        role: "user",
        speakerName: "Candidate",
        text: "Candidate spoke",
      },
      {
        at: Date.now() + 1,
        id: "second",
        interrupted: false,
        role: "assistant",
        speakerName: "Interviewer",
        text: "Interviewer spoke",
      },
    ];
    const write = () =>
      app.request(
        metadata.contextUrl.replace(/\/transcription$/u, "/turns"),
        {
          body: JSON.stringify({ turns, version: 1 }),
          headers,
          method: "POST",
        },
        env,
        atsTest.platform.ctx,
      );
    expect(await write()).toMatchObject({ status: 200 });
    expect(await write()).toMatchObject({ status: 200 });
    expect(await read(f.candidate("meeting/entered"))).toMatchObject({ turns });
    expect(await read(f.owner.call(`${f.path}/entered`, { version: 1 }))).toMatchObject({ turns });
    await f.owner.call(`${f.path}/end`, { version: 1 });
    expect(await read(f.owner.call(f.path.replace(/\/meeting$/u, "/result")))).toMatchObject({
      turns,
    });
    expect(f.dispatch).toHaveBeenCalledTimes(1);
  } finally {
    env.LIVEKIT_AGENT_NAME = previous.agent;
    env.INTERVIEW_AGENT_API_URL = previous.url;
  }
});

it("saves an interviewer's live draft but requires completion before formal submission", async () => {
  const f = await setup("draft");
  const path = `interviews/${f.owner.workspaceId}/${f.roundId}`;
  const content = {
    conclusion: "pass",
    overall: "Clear explanation of project decisions.",
    version: 1,
  };
  const save = () =>
    f.owner.request(`${path}/evaluation`, {
      body: JSON.stringify(content),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });
  expect(await save()).toMatchObject({ status: 409 });
  await f.owner.call(`${f.path}/entered`, { version: 1 });
  expect(await save()).toMatchObject({ status: 200 });
  expect(await read(f.owner.call(`${path}/result`))).toMatchObject({
    evaluation: { canEdit: true, own: { content, submittedAt: null } },
  });
  expect(await f.owner.call(`${path}/evaluation/submit`, content)).toMatchObject({ status: 409 });
  await f.owner.call(`${f.path}/end`, { version: 1 });
  expect(await f.owner.call(`${path}/evaluation/submit`, content)).toMatchObject({ status: 200 });
});

it("shows submitted earlier evaluations and excludes drafts and later rounds", async () => {
  const f = await setup("history");
  const db = atsTest.platform.database;
  const current = await f.round();
  expect(current).toBeDefined();
  if (!current) {
    throw new Error("Missing fixture round");
  }
  await db.update(interviewRound).set({ sequence: 3 }).where(eq(interviewRound.id, current.id));
  const previousId = crypto.randomUUID();
  const draftId = crypto.randomUUID();
  const laterId = crypto.randomUUID();
  await Promise.all(
    (
      [
        [previousId, 1],
        [draftId, 2],
        [laterId, 4],
      ] as const
    ).map(async ([id, sequence]) => {
      await db.insert(interviewRound).values({ ...current, id, sequence, status: "completed" });
      await db.insert(interviewEvaluation).values({
        authorUserId: f.owner.userId,
        content: {
          conclusion: "pass",
          overall: id === previousId ? "**Strong evidence**" : "Not visible",
          version: 1,
        },
        interviewRoundId: id,
        submittedAt: id === draftId ? null : new Date(),
        updatedAt: new Date(),
        workspaceId: f.owner.workspaceId,
      });
    }),
  );
  const meeting = await read(f.owner.call(f.path));
  expect(meeting.materials.history).toHaveLength(1);
  expect(meeting.materials.history[0]).toMatchObject({
    author: { id: f.owner.userId },
    content: { overall: "**Strong evidence**", version: 1 },
    roundId: previousId,
    sequence: 1,
  });
});
