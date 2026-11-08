import {
  application,
  interviewInvitation,
  interviewQuestionSnapshot,
  questionSet,
} from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { assert, expect, it } from "vitest";
import { app } from "../src/app";
import { account, atsTest, read } from "./ats-fixture";
import { fixture, addInterviewMember, editRound } from "./interview-fixture";

function issueInvitation(owner: Awaited<ReturnType<typeof account>>, id: string) {
  return owner.request(`interviews/${owner.workspaceId}/${id}/invitation`, { method: "POST" });
}

function candidateEntry(token: string) {
  return app.request(
    `https://sainoa.example/api/candidate-interviews/${token}/entry`,
    { headers: { origin: "https://sainoa.example" }, method: "POST" },
    atsTest.env,
    atsTest.platform.ctx,
  );
}

function roundSnapshot(id: string) {
  return atsTest.platform.database
    .select()
    .from(interviewQuestionSnapshot)
    .where(eq(interviewQuestionSnapshot.interviewRoundId, id))
    .get();
}

it("issues a stable private invitation only to workspace members without binding questions", async () => {
  const f = await fixture("invitation-owner@example.com");
  const foreign = await account("invitation-foreign@example.com");
  const { id } = await read(f.owner.call(f.path, f.input));
  const response = await issueInvitation(f.owner, id);
  expect(response.status).toBe(200);
  const invite = await response.json();
  expect(invite).toEqual({ token: expect.stringMatching(/^[a-f0-9]{64}$/u), version: 1 });
  expect(invite.token).not.toBe(id);
  expect(await read(issueInvitation(f.owner, id))).toEqual(invite);
  expect(await roundSnapshot(id)).toBeUndefined();
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  expect(await read(f.owner.call(path))).not.toHaveProperty("token");
  expect(JSON.stringify(await read(f.owner.call(f.path)))).not.toContain(invite.token);
  expect(await foreign.request(`${path}/invitation`, { method: "POST" })).toMatchObject({
    status: 404,
  });
  expect(
    await app.request(
      `https://sainoa.example/api/${path}/invitation`,
      { headers: { origin: "https://sainoa.example" }, method: "POST" },
      atsTest.env,
      atsTest.platform.ctx,
    ),
  ).toMatchObject({ status: 401 });
  const colleague = await addInterviewMember(f.owner.workspaceId, "invitation-member@example.com");
  expect(await read(colleague.request(`${path}/invitation`, { method: "POST" }))).toEqual(invite);
});

it("binds latest questions once in selected order, preserving duplicates and keeping internal guidance private", async () => {
  const f = await fixture("snapshot-order@example.com");
  const db = atsTest.platform.database;
  const { id } = await read(f.owner.call(f.path, f.input));
  const { token } = await read(issueInvitation(f.owner, id));
  await db
    .update(questionSet)
    .set({
      content: {
        kind: "form",
        questions: [
          {
            content: "Choose",
            description: "Pick one",
            options: ["B", "A"],
            type: "single_choice",
          },
          {
            content: "Choose several",
            description: "",
            options: ["C", "A", "B"],
            type: "multiple_choice",
          },
          { content: "Latest background?", description: "Details", type: "text" },
        ],
        version: 1,
      },
    })
    .where(eq(questionSet.id, f.form.id));
  const conversationIds = f.input.conversationQuestionSetIds;
  await db
    .update(questionSet)
    .set({
      content: {
        kind: "conversation",
        questions: [
          {
            content: "First",
            difficulty: "hard",
            evaluationCriteria: "Private criteria",
            evaluationFocus: "Private focus",
            followUpDirections: "Private follow-up",
          },
          {
            content: "Duplicate",
            difficulty: "easy",
            evaluationCriteria: "",
            evaluationFocus: "",
            followUpDirections: "",
          },
        ],
        version: 1,
      },
    })
    .where(eq(questionSet.id, conversationIds[0]));
  await db
    .update(questionSet)
    .set({
      content: {
        kind: "conversation",
        questions: [
          {
            content: "Duplicate",
            difficulty: "medium",
            evaluationCriteria: "",
            evaluationFocus: "",
            followUpDirections: "",
          },
        ],
        version: 1,
      },
    })
    .where(eq(questionSet.id, conversationIds[1]));
  const response = await candidateEntry(token);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const entry = await response.json();
  expect(entry).toMatchObject({
    candidateName: "Candidate",
    jobDescription: "Skills",
    jobTitle: "Engineer",
    kind: "ai",
    questions: {
      conversationCount: 3,
      form: [
        { content: "Choose", options: ["B", "A"], type: "single_choice" },
        { options: ["C", "A", "B"], type: "multiple_choice" },
        { content: "Latest background?", type: "text" },
      ],
      version: 1,
    },
    scheduledAt: null,
    status: "scheduled",
    version: 1,
  });
  expect(entry).not.toHaveProperty("internalCriteria");
  expect(entry).not.toHaveProperty("assignments");
  expect(entry).not.toHaveProperty("interviewerAgentId");
  const serialized = JSON.stringify(entry);
  expect(serialized).not.toContain("Private");
  expect(serialized).not.toContain("Ask one question at a time");
  expect(serialized).not.toContain("Duplicate");
  const snapshot = await roundSnapshot(id);
  assert(snapshot);
  expect(snapshot.content.version).toBe(1);
  expect(
    snapshot.content.conversation.map((q) => [
      q.questionSetId,
      q.questionIndex,
      q.question.content,
    ]),
  ).toEqual([
    [conversationIds[0], 0, "First"],
    [conversationIds[0], 1, "Duplicate"],
    [conversationIds[1], 0, "Duplicate"],
  ]);
  expect(snapshot.content.conversation[0].question.evaluationCriteria).toBe("Private criteria");
  expect(
    new Set([...snapshot.content.form, ...snapshot.content.conversation].map((q) => q.id)).size,
  ).toBe(6);
  await db
    .update(questionSet)
    .set({ content: { kind: "form", questions: [], version: 1 } })
    .where(eq(questionSet.id, f.form.id));
  await db
    .update(questionSet)
    .set({ content: { kind: "conversation", questions: [], version: 1 } })
    .where(eq(questionSet.id, conversationIds[0]));
  expect(await read(candidateEntry(token))).toEqual(entry);
  expect(await roundSnapshot(id)).toEqual(snapshot);
  expect(await read(f.owner.call(`interviews/${f.owner.workspaceId}/${id}`))).toMatchObject({
    resumeId: null,
    status: "scheduled",
  });
});

it("locks selected sets after candidate entry but still lets recruiters edit the agent and reviewer", async () => {
  const f = await fixture("snapshot-lock@example.com");
  const { id } = await read(f.owner.call(f.path, f.input));
  const { token } = await read(issueInvitation(f.owner, id));
  await candidateEntry(token);
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  const before = await read(f.owner.call(path));
  expect(before.questionsBoundAt).toEqual(expect.any(String));
  const input = { ...f.input, confirmationUserId: f.owner.userId };
  await Promise.all(
    [
      { ...input, formQuestionSetIds: [] },
      { ...input, conversationQuestionSetIds: input.conversationQuestionSetIds.toReversed() },
    ].map(async (value) => {
      const response = await editRound(f.owner, path, value);
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "INTERVIEW_QUESTIONS_LOCKED", version: 1 });
    }),
  );
  expect(await read(f.owner.call(path))).toEqual(before);
  const reviewer = await addInterviewMember(
    f.owner.workspaceId,
    "snapshot-new-reviewer@example.com",
  );
  const agent = await read(
    f.owner.call(`interviewer-agents/${f.owner.workspaceId}`, {
      name: "Updated agent",
      prompt: "Updated prompt",
      version: 1,
    }),
  );
  await atsTest.platform.database
    .update(questionSet)
    .set({ content: { kind: "conversation", questions: [], version: 1 } })
    .where(eq(questionSet.workspaceId, f.owner.workspaceId));
  expect(
    await editRound(f.owner, path, {
      ...input,
      confirmationUserId: reviewer.userId,
      interviewerAgentId: agent.id,
      label: "Updated",
    }),
  ).toMatchObject({ status: 200 });
  const setup = await read(f.owner.call(`${path}/edit`));
  expect(setup.round).toMatchObject({
    assignments: [{ id: reviewer.userId }],
    interviewerAgentId: agent.id,
    label: "Updated",
    questionsBoundAt: before.questionsBoundAt,
  });
  expect(setup.sets.map((set: { questionCount: number }) => set.questionCount)).toEqual([1, 1, 1]);
  const entered = await read(candidateEntry(token));
  expect(entered.questions.conversationCount).toBe(2);
});

it("keeps human preparation accessible before its scheduled time and never freezes questions", async () => {
  const f = await fixture("human-invitation@example.com");
  const input = {
    admissionDeadline: "2099-01-01T01:00:00Z",
    interviewerUserIds: [f.owner.userId],
    kind: "human",
    scheduledAt: "2099-01-01T00:00:00Z",
    version: 1,
  };
  const { id } = await read(f.owner.call(f.path, input));
  const { token } = await read(issueInvitation(f.owner, id));
  expect(await read(candidateEntry(token))).toMatchObject({
    kind: "human",
    questions: null,
    scheduledAt: "2099-01-01T00:00:00.000Z",
    status: "scheduled",
  });
  expect(await roundSnapshot(id)).toBeUndefined();
  const path = `interviews/${f.owner.workspaceId}/${id}`;
  expect(
    await editRound(f.owner, path, {
      ...input,
      admissionDeadline: "2020-01-01T01:00:00Z",
      scheduledAt: "2020-01-01T00:00:00Z",
    }),
  ).toMatchObject({ status: 200 });
  expect(await read(candidateEntry(token))).toMatchObject({
    questions: null,
    scheduledAt: "2020-01-01T00:00:00.000Z",
    status: "scheduled",
  });
});

it("binds AI rounds without form questions and keeps their entry independent of time windows", async () => {
  const f = await fixture("snapshot-no-form@example.com");
  const { id } = await read(f.owner.call(f.path, { ...f.input, formQuestionSetIds: [] }));
  const { token } = await read(issueInvitation(f.owner, id));
  expect(await read(candidateEntry(token))).toMatchObject({
    kind: "ai",
    questions: { conversationCount: 2, form: [], version: 1 },
  });
  const snapshot = await roundSnapshot(id);
  expect(snapshot?.content.form).toEqual([]);
});

it("rejects invalid invitations and removes access and snapshots when a round is deleted", async () => {
  const f = await fixture("invitation-removal@example.com");
  const { id } = await read(f.owner.call(f.path, f.input));
  const { token } = await read(issueInvitation(f.owner, id));
  await candidateEntry(token);
  await Promise.all(
    ["invalid", id, "a".repeat(64)].map(async (value) => {
      const response = await candidateEntry(value);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "INTERVIEW_UNAVAILABLE", version: 1 });
    }),
  );
  await atsTest.platform.database
    .update(application)
    .set({ deletedAt: new Date() })
    .where(eq(application.id, f.applicationId));
  expect(await candidateEntry(token)).toMatchObject({ status: 404 });
  await atsTest.platform.database
    .update(application)
    .set({ deletedAt: null })
    .where(eq(application.id, f.applicationId));
  expect(
    await f.owner.request(`interviews/${f.owner.workspaceId}/${id}`, { method: "DELETE" }),
  ).toMatchObject({ status: 200 });
  expect(await candidateEntry(token)).toMatchObject({ status: 404 });
  expect(await roundSnapshot(id)).toBeUndefined();
  expect(
    await atsTest.platform.database
      .select()
      .from(interviewInvitation)
      .where(eq(interviewInvitation.interviewRoundId, id)),
  ).toEqual([]);
});
