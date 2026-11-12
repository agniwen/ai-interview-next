import {
  applicationResume,
  interviewAssignment,
  interviewRound,
  resume,
  resumeSubmission,
  resumeUploadBatch,
  resumeUploadItem,
} from "@ai-interview/db/schema";
import { expect, it } from "vitest";
import { atsTest, read } from "./ats-fixture";
import { addInterviewMember, fixture } from "./interview-fixture";

it("filters the overview to the current user's uploads and interview roles before pagination", async () => {
  const f = await fixture("overview-owner@example.com");
  const { workspaceId, userId } = f.owner;
  const colleague = await addInterviewMember(workspaceId, "overview-colleague@example.com");
  const db = atsTest.platform.database;
  const createdAt = new Date();
  const versionA = crypto.randomUUID();
  const versionB = crypto.randomUUID();
  const failedId = crypto.randomUUID();
  const olderId = crypto.randomUUID();
  const newerId = crypto.randomUUID();
  const otherId = crypto.randomUUID();

  await db.batch([
    db.insert(resume).values(
      [versionA, versionB].map((id) => ({
        createdAt,
        id,
        pdfObjectKey: id,
        sha256: id,
        workspaceId,
      })),
    ),
    db.insert(resumeSubmission).values(
      [versionA, versionB].map((id) => ({
        createdAt,
        id,
        identityStatus: "resolved" as const,
        originalFilename: id,
        resumeId: id,
        workspaceId,
      })),
    ),
    db.insert(resumeUploadBatch).values([
      { createdAt, createdBy: userId, id: olderId, workspaceId },
      {
        createdAt: new Date(createdAt.getTime() + 1000),
        createdBy: userId,
        id: newerId,
        workspaceId,
      },
      { createdAt, createdBy: colleague.userId, id: otherId, workspaceId },
    ]),
    db.insert(resumeUploadItem).values([
      {
        batchId: olderId,
        filename: "A.pdf",
        id: olderId,
        objectKey: olderId,
        size: 1,
        status: "accepted",
        submissionId: versionA,
        workspaceId,
      },
      {
        batchId: newerId,
        filename: "A copy.pdf",
        id: newerId,
        objectKey: newerId,
        size: 1,
        status: "accepted",
        submissionId: versionA,
        workspaceId,
      },
      {
        batchId: olderId,
        filename: "Failed.pdf",
        id: failedId,
        objectKey: failedId,
        size: 1,
        status: "upload_failed",
        workspaceId,
      },
      {
        batchId: otherId,
        filename: "B.pdf",
        id: otherId,
        objectKey: otherId,
        size: 1,
        status: "accepted",
        submissionId: versionB,
        workspaceId,
      },
    ]),
    db.insert(applicationResume).values({
      applicationId: f.applicationId,
      createdAt,
      id: crypto.randomUUID(),
      resumeId: versionA,
      status: "available",
      workspaceId,
    }),
  ]);

  const rounds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
  await db.batch([
    db.insert(interviewRound).values(
      rounds.map((id, index) => ({
        applicationId: f.applicationId,
        createdAt,
        id,
        kind: "human" as const,
        questionSelection: {
          conversationQuestionSetIds: [],
          formQuestionSetIds: [],
          version: 1 as const,
        },
        resumeId: [versionB, versionA, null][index],
        sequence: index + 1,
        status: index === 0 ? "in_progress" : "scheduled",
        workspaceId,
      })),
    ),
    db.insert(interviewAssignment).values(
      rounds.slice(0, 2).map((id) => ({
        interviewRoundId: id,
        position: 0,
        role: "interviewer" as const,
        userId,
        workspaceId,
      })),
    ),
  ]);

  const path = `interviews/${workspaceId}/personal`;
  const workspacePath = `interviews/${workspaceId}/rounds`;
  expect(
    await read(colleague.call(`${workspacePath}?kind=human&status=in_progress&search=Engineer`)),
  ).toMatchObject({
    rows: [
      {
        candidateName: "Candidate",
        id: rounds[0],
        interviewers: [{ id: userId }],
        jobTitle: "Engineer",
      },
    ],
    total: 1,
  });
  expect(await read(colleague.call(`${workspacePath}?page=4&pageSize=1`))).toMatchObject({
    rows: [],
    total: 3,
  });
  const outsider = await fixture("overview-outsider@example.com");
  const denied = await outsider.owner.call(workspacePath);
  expect(denied.status).toBe(404);
  expect(await read(f.owner.call(`${path}?pageSize=1`))).toMatchObject({
    rows: [{ canJoin: true, id: rounds[0], interviewer: true, uploader: false }],
    total: 3,
  });
  const uploaded = await read(f.owner.call(`${path}?role=uploader`));
  expect(uploaded.total).toBe(2);
  expect(uploaded.rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: rounds[1], interviewer: true, uploader: true }),
      expect.objectContaining({ id: rounds[2], interviewer: false, uploader: true }),
    ]),
  );
  expect(await read(f.owner.call(`${path}?role=interviewer&page=3&pageSize=1`))).toMatchObject({
    rows: [],
    total: 2,
  });
  expect(await read(f.owner.ats("resumes?owner=me&pageSize=1"))).toMatchObject({
    rows: [{ id: failedId, needsAttention: true }],
    total: 2,
  });
  expect(await read(f.owner.ats("resumes?owner=me&page=2&pageSize=1"))).toMatchObject({
    rows: [{ id: newerId, needsAttention: false, resumeId: versionA }],
    total: 2,
  });
  expect(await read(f.owner.ats("resumes"))).toMatchObject({ total: 4 });
});
