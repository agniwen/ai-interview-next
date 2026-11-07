import {
  application,
  applicationResume,
  candidate,
  member,
  recruitmentProject,
  resume,
  resumeProcessingRun,
  resumeSubmission,
  resumeUploadBatch,
  resumeUploadItem,
} from "@ai-interview/db/schema";

import { expect, it } from "vitest";
import { account, atsTest, read } from "./ats-fixture";

it("retries one failed upload in its original batch while other files enter processing", async () => {
  const owner = await account("upload-retry@example.com");
  const outsider = await account("upload-retry-outsider@example.com");
  const bytes = new TextEncoder().encode("%PDF-1.7\n%%EOF");
  const batch = await read(
    owner.ats("uploads", {
      files: ["first.pdf", "second.pdf"].map((filename) => ({ filename, size: bytes.length })),
      version: 1,
    }),
  );
  const [first, second] = batch.uploads;
  const put = (url: string) =>
    owner.request(url, {
      body: bytes,
      headers: { "content-type": "application/pdf" },
      method: "PUT",
    });

  const uploaded = await put(first.url);
  expect(uploaded.status).toBe(204);
  const accepted = await owner.ats(`uploads/${first.id}/confirm`, {});
  expect(accepted.status).toBe(202);
  const failed = await owner.ats(`uploads/${second.id}/failed`, {});
  expect(failed.status).toBe(200);
  const blocked = await put(second.url);
  expect(blocked.status).toBe(404);
  const forbidden = await outsider.call(`ats/${owner.workspaceId}/uploads/${second.id}/retry`, {});
  expect(forbidden.status).toBe(404);
  expect(await read(owner.ats(`uploads/${first.id}/retry`, {}))).toEqual({
    contentType: "application/pdf",
    id: first.id,
    url: null,
    version: 1,
  });

  const retry = await read(owner.ats(`uploads/${second.id}/retry`, {}));
  expect(retry).toEqual({
    contentType: "application/pdf",
    id: second.id,
    url: second.url,
    version: 1,
  });
  const retried = await put(retry.url);
  expect(retried.status).toBe(204);
  const confirmed = await owner.ats(`uploads/${second.id}/confirm`, {});
  expect(confirmed.status).toBe(202);
  expect(await read(owner.ats("resumes"))).toMatchObject({
    batches: [{ failed: 0, id: batch.id, total: 2 }],
    rows: expect.arrayContaining([
      expect.objectContaining({
        id: first.id,
        runId: first.id,
        source: "manual_upload",
        status: "accepted",
      }),
      expect.objectContaining({
        id: second.id,
        runId: second.id,
        source: "manual_upload",
        status: "accepted",
      }),
    ]),
    total: 2,
  });
});

it("lists projects by page and filters recruitment records by the job's project", async () => {
  const owner = await account("project-owner@example.com");
  const other = await account("project-outsider@example.com");
  const { workspaceId } = owner;
  const empty = await owner.ats("projects");
  expect(await empty.json()).toMatchObject({ rows: [], total: 0 });
  const projectResponse = await owner.ats("projects", { title: " Graduate hiring ", version: 1 });
  expect(projectResponse.status).toBe(201);
  const { id: projectId } = await projectResponse.json();
  expect(await read(owner.ats("projects/options"))).toMatchObject({
    rows: [{ id: projectId, title: "Graduate hiring" }],
  });
  const outsideProjectList = await other.call(`ats/${workspaceId}/projects`);
  expect(outsideProjectList.status).toBe(404);
  expect(await read(other.ats("projects/options"))).toMatchObject({ rows: [] });

  const jobInput = { requirements: "Requirements", title: "Engineer", version: 1 };
  const outsideJob = await other.ats("jobs", { ...jobInput, projectId });
  expect(outsideJob.status).toBe(404);
  const linked = await owner.ats("jobs", { ...jobInput, projectId });
  const unlinked = await owner.ats("jobs", jobInput);
  expect([linked.status, unlinked.status]).toEqual([201, 201]);
  const { id: linkedJobId } = await linked.json();
  const { id: unlinkedJobId } = await unlinked.json();
  expect(await read(owner.ats("jobs"))).toMatchObject({
    rows: expect.arrayContaining([
      expect.objectContaining({ id: linkedJobId, projectTitle: "Graduate hiring" }),
      expect.objectContaining({ id: unlinkedJobId, projectTitle: null }),
    ]),
  });
  const candidateId = crypto.randomUUID();
  const applicationId = crypto.randomUUID();
  const createdAt = new Date(0);
  await atsTest.platform.database.batch([
    atsTest.platform.database.insert(candidate).values({
      createdAt,
      creationSource: "manual",
      email: "candidate@example.com",
      id: candidateId,
      name: "Candidate",
      workspaceId,
    }),
    atsTest.platform.database.insert(application).values([
      {
        candidateId,
        createdAt,
        id: applicationId,
        jobId: linkedJobId,
        stage: "screening",
        workspaceId,
      },
      {
        candidateId,
        closedAt: createdAt,
        createdAt,
        id: crypto.randomUUID(),
        jobId: unlinkedJobId,
        stage: "screening",
        workspaceId,
      },
    ]),
    atsTest.platform.database.insert(recruitmentProject).values(
      Array.from({ length: 20 }, (_, index) => ({
        createdAt,
        id: crypto.randomUUID(),
        title: `Project ${index}`,
        workspaceId,
      })),
    ),
  ]);
  expect(await read(owner.ats("applications"))).toMatchObject({ total: 2 });
  expect(await read(owner.ats(`applications?projectId=${projectId}`))).toMatchObject({
    rows: [{ id: applicationId }],
    total: 1,
  });
  const first = await read(owner.ats("projects?page=1"));
  const second = await read(owner.ats("projects?page=2"));
  expect(first).toMatchObject({ page: 1, pageSize: 20, total: 21 });
  expect(first.rows).toHaveLength(20);
  expect(first.rows[0]).toMatchObject({ id: projectId });
  expect(second).toMatchObject({ page: 2, total: 21 });
  expect(second.rows).toHaveLength(1);
  expect(first.rows).not.toEqual(expect.arrayContaining(second.rows));

  expect(
    await read(owner.ats(`jobs?search=engineer&pageSize=1&projectId=${projectId}`)),
  ).toMatchObject({ page: 1, pageSize: 1, rows: [{ id: linkedJobId }], total: 1 });
  expect(
    await read(
      owner.ats(`applications?search=engineer&status=open&pageSize=1&projectId=${projectId}`),
    ),
  ).toMatchObject({ rows: [{ id: applicationId }], total: 1 });
  expect(await read(owner.ats("applications?search=engineer&status=closed"))).toMatchObject({
    rows: [{ closedAt: createdAt.toISOString() }],
    total: 1,
  });
  expect(await read(owner.ats("candidates?search=example.com&pageSize=1"))).toMatchObject({
    rows: [{ id: candidateId }],
    total: 1,
  });
  expect(await read(owner.ats("projects?search=PROJECT&pageSize=1&page=21"))).toMatchObject({
    page: 21,
    pageSize: 1,
    rows: [],
    total: 20,
    version: 1,
  });
  const invalidPageSize = await owner.ats("projects?pageSize=101");
  expect(invalidPageSize.status).toBe(400);

  const profiles = [
    { name: "First attached resume", status: "available" },
    { name: "Latest available resume", status: "available" },
    { name: "Removed resume", status: "removed" },
    { name: "Unconfirmed resume", status: "pending_confirmation" },
  ] as const;
  await atsTest.platform.database.batch([
    atsTest.platform.database.insert(resume).values(
      profiles.map(({ name }, index) => ({
        avatarObjectKey: `avatars/${index}.png`,
        candidateId,
        createdAt: new Date(index),
        id: name,
        parsedProfile: { identity: { name }, version: 1 as const },
        pdfObjectKey: name,
        sha256: name,
        workspaceId,
      })),
    ),
    atsTest.platform.database.insert(applicationResume).values(
      profiles.map(({ name, status }, index) => ({
        applicationId,
        createdAt: new Date(index),
        id: name,
        resumeId: name,
        status,
        workspaceId,
      })),
    ),
  ]);
  expect(await read(owner.ats("applications?search=latest"))).toMatchObject({
    rows: [
      {
        candidateAvatarResumeId: "Latest available resume",
        candidateName: "Latest available resume",
        id: applicationId,
      },
    ],
    total: 1,
  });
  expect(await read(owner.ats("applications?search=candidate"))).toMatchObject({
    rows: [],
    total: 0,
  });
  const detailPath = `applications/${applicationId}`;
  const detail = await owner.ats(detailPath);
  expect(detail.status).toBe(200);
  expect(await detail.json()).toMatchObject({
    activity: [],
    application: {
      canDelete: false,
      candidateName: "Latest available resume",
      closedAt: null,
      creator: null,
      id: applicationId,
      jobId: linkedJobId,
      jobTitle: "Engineer",
      projectTitle: "Graduate hiring",
    },
    evaluations: [],
    resumeProfile: { identity: { name: "Latest available resume" }, version: 1 },
    version: 1,
  });
  const unavailable = await other.ats(detailPath);
  expect(unavailable.status).toBe(404);
  const deleteUnattributed = await owner.request(`ats/${workspaceId}/${detailPath}`, {
    method: "DELETE",
  });
  expect(deleteUnattributed.status).toBe(404);

  const closed = await owner.ats(`${detailPath}/close`, {});
  expect(closed.status).toBe(200);
  expect(await read(owner.ats(detailPath))).toMatchObject({
    activity: [{ actorId: owner.userId, result: { outcome: "closed" } }],
    application: { closedAt: expect.any(String) },
  });
});

it("records the signed-in creator, shows the associated resume, and only allows the creator to delete", async () => {
  const email = "application-creator@example.com";
  const { ats, request, userId, workspaceId } = await account(email);
  const admin = await account("application-admin@example.com");
  await atsTest.platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: workspaceId,
    role: "admin",
    userId: admin.userId,
  });
  const jobInput = { requirements: "Requirements", title: "Engineer", version: 1 };
  const { id: jobId } = await read(ats("jobs", jobInput));
  const { id: matchedJobId } = await read(ats("jobs", { ...jobInput, title: "Matched job" }));
  const candidateId = crypto.randomUUID();
  const resumeId = crypto.randomUUID();
  const createdAt = new Date(0);
  const filename = "candidate.pdf";
  await atsTest.platform.database.batch([
    atsTest.platform.database.insert(candidate).values({
      createdAt,
      creationSource: "manual",
      id: candidateId,
      name: "Candidate",
      workspaceId,
    }),
    atsTest.platform.database.insert(resume).values({
      candidateId,
      createdAt,
      id: resumeId,
      parseStatus: "succeeded",
      parsedProfile: { identity: { name: "Name on Resume" }, version: 1 },
      pdfObjectKey: resumeId,
      sha256: resumeId,
      workspaceId,
    }),
    atsTest.platform.database.insert(resumeProcessingRun).values({
      createdAt,
      executionId: resumeId,
      id: resumeId,
      kind: "parse",
      resumeId,
      stage: "structure",
      status: "succeeded",
      workspaceId,
    }),
    atsTest.platform.database.insert(resumeSubmission).values({
      createdAt,
      id: resumeId,
      identityStatus: "resolved",
      originalFilename: filename,
      resolvedCandidateId: candidateId,
      resumeId,
      workspaceId,
    }),
    atsTest.platform.database.insert(resumeUploadBatch).values({
      createdAt,
      createdBy: userId,
      id: resumeId,
      workspaceId,
    }),
    atsTest.platform.database.insert(resumeUploadItem).values({
      batchId: resumeId,
      filename,
      id: resumeId,
      objectKey: resumeId,
      size: 1,
      status: "accepted",
      submissionId: resumeId,
      workspaceId,
    }),
  ]);

  const applicationInput = { jobId, resumeId, version: 1 };
  expect(await read(ats(`candidates/${candidateId}/resumes`))).toMatchObject({
    rows: [{ canJoinRecruitment: true, id: resumeId, uploadId: resumeId }],
  });
  expect(await read(ats("applications/resume-options?search=name%20on%20resume"))).toMatchObject({
    rows: [{ candidateName: "Name on Resume", id: resumeId }],
  });
  const created = await ats("applications", applicationInput);
  expect(created.status).toBe(201);
  const { applicationId } = await created.json();
  expect(await read(ats("applications", applicationInput))).toMatchObject({
    applicationId,
    runId: null,
  });
  const detail = await read(ats(`applications/${applicationId}`));
  expect(detail).toMatchObject({
    activity: [{ action: "created", actorId: userId, actorName: email, actorType: "user" }],
    application: {
      canDelete: true,
      candidateName: "Name on Resume",
      creator: { actorId: userId, actorName: email, actorType: "user" },
    },
    resume: { filename, id: resumeId, uploadId: resumeId },
  });
  expect(detail.activity[0].occurredAt).toBe(detail.application.createdAt);

  const matched = await read(
    ats(`submissions/${resumeId}/match`, { jobId: matchedJobId, version: 1 }),
  );
  expect(await read(ats(`applications/${matched.applicationId}`))).toMatchObject({
    activity: [{ action: "created", actorId: userId, actorType: "user" }],
    application: { creator: { actorId: userId, actorType: "user" }, jobTitle: "Matched job" },
  });

  const deletePath = `ats/${workspaceId}/applications/${applicationId}`;
  expect(await read(admin.request(deletePath, { method: "GET" }))).toMatchObject({
    application: { canDelete: false },
  });
  const forbidden = await admin.request(deletePath, { method: "DELETE" });
  expect(forbidden.status).toBe(404);
  const intact = await ats(`applications/${applicationId}`);
  expect(intact.status).toBe(200);
  const deleted = await request(deletePath, { method: "DELETE" });
  expect(deleted.status).toBe(200);
  const unavailable = await ats(`applications/${applicationId}`);
  expect(unavailable.status).toBe(404);
  expect(await read(ats("applications"))).toMatchObject({
    rows: [{ id: matched.applicationId }],
    total: 1,
  });
  const recreated = await ats("applications", applicationInput);
  expect(recreated.status).toBe(201);
  const replacement = await read(recreated);
  expect(replacement.applicationId).not.toBe(applicationId);
});

it("edits projects and jobs within the workspace and can unlink a job", async () => {
  const owner = await account("ats-edit@example.com");
  const other = await account("ats-edit-other@example.com");
  const projectInput = {
    description: "## Goals\n\n- Hire engineers",
    title: "First project",
    version: 1,
  };
  const { id: projectId } = await read(owner.ats("projects", projectInput));
  const { id: otherProjectId } = await read(other.ats("projects", projectInput));
  const { id: departmentId } = await read(
    owner.ats("departments", { name: "Engineering", version: 1 }),
  );
  const jobInput = {
    departmentId,
    internalCriteria: "## Internal criteria\n\n- Product ownership",
    projectId,
    requirements: "Original JD",
    title: "Engineer",
    version: 1,
  };
  const { id: jobId } = await read(owner.ats("jobs", jobInput));
  const put = (path: string, body: object) =>
    owner.request(`ats/${owner.workspaceId}/${path}`, {
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
      method: "PUT",
    });

  const projectPath = `projects/${projectId}`;
  const jobPath = `jobs/${jobId}`;
  const newProject = { description: "**Updated** project", title: "Renamed project", version: 1 };
  const newJob = {
    departmentId: null,
    internalCriteria: "## Internal criteria\n\n- Leads a team",
    projectId: null,
    requirements: "## Responsibilities\n\n- Build features",
    title: "Senior engineer",
    version: 1,
  };
  const [outsideJob, outsideProjectLink, outsideProject] = await Promise.all([
    other.ats(jobPath),
    put(jobPath, { ...newJob, projectId: otherProjectId }),
    put(`projects/${otherProjectId}`, newProject),
  ]);
  expect([outsideJob.status, outsideProjectLink.status, outsideProject.status]).toEqual([
    404, 404, 404,
  ]);
  expect(await read(owner.ats(jobPath))).toEqual({
    createdBy: owner.userId,
    id: jobId,
    ...jobInput,
    department: "Engineering",
    projectTitle: projectInput.title,
  });

  expect(await read(owner.ats(projectPath))).toMatchObject({
    createdAt: expect.any(String),
    description: projectInput.description,
    id: projectId,
    jobCount: 1,
    title: projectInput.title,
    version: 1,
  });
  const outsidePreview = await other.ats(projectPath);
  const missingPreview = await owner.ats("projects/missing-project");
  expect(outsidePreview.status).toBe(404);
  expect(missingPreview.status).toBe(404);

  const updatedProject = await put(projectPath, newProject);
  expect(updatedProject.status).toBe(200);
  expect(await read(owner.ats("projects/options"))).toMatchObject({
    rows: [{ id: projectId, title: newProject.title }],
  });
  expect(await read(owner.ats("jobs"))).toMatchObject({
    rows: [{ id: jobId, projectTitle: newProject.title }],
  });
  expect(await read(owner.ats(jobPath))).toMatchObject({ projectTitle: newProject.title });
  expect(await read(owner.ats(projectPath))).toMatchObject({
    description: newProject.description,
    jobCount: 1,
    title: newProject.title,
  });

  await put(projectPath, { title: newProject.title, version: 1 });
  expect(await read(owner.ats(projectPath))).toMatchObject({ description: newProject.description });
  const tooLong = await put(projectPath, { ...newProject, description: "x".repeat(30_001) });
  expect(tooLong.status).toBe(400);
  await put(projectPath, { ...newProject, description: "" });
  expect(await read(owner.ats(projectPath))).toMatchObject({ description: "" });

  const updatedJob = await put(jobPath, newJob);
  expect(updatedJob.status).toBe(200);
  expect(await read(owner.ats(jobPath))).toEqual({
    createdBy: owner.userId,
    id: jobId,
    ...newJob,
    department: null,
    projectTitle: null,
  });
  const { internalCriteria: _criteria, ...withoutCriteria } = newJob;
  await put(jobPath, withoutCriteria);
  expect(await read(owner.ats(jobPath))).toMatchObject({
    internalCriteria: newJob.internalCriteria,
  });
  const tooLongCriteria = await put(jobPath, { ...newJob, internalCriteria: "x".repeat(30_001) });
  expect(tooLongCriteria.status).toBe(400);
  await put(jobPath, { ...newJob, internalCriteria: "" });
  expect(await read(owner.ats(jobPath))).toMatchObject({ internalCriteria: "" });
  expect(await read(owner.ats(projectPath))).toMatchObject({ jobCount: 0 });
  expect(await read(owner.ats(`jobs?projectId=${projectId}`))).toMatchObject({
    rows: [],
    total: 0,
  });
});

it("filters resume files before pagination and keeps full upload batch totals", async () => {
  const { ats, userId, workspaceId } = await account("resume-filter@example.com");
  const batchId = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const createdAt = new Date(0);
  const files = [
    { filename: "first.pdf", status: "upload_failed" },
    { filename: "second.pdf", runId, status: "accepted" },
    { filename: "third.pdf", status: "waiting" },
  ] as const;
  await atsTest.platform.database.batch([
    atsTest.platform.database
      .insert(resumeUploadBatch)
      .values({ createdAt, createdBy: userId, id: batchId, workspaceId }),
    atsTest.platform.database.insert(resumeUploadItem).values(
      files.map((file) => ({
        ...file,
        batchId,
        id: file.filename,
        objectKey: file.filename,
        size: 1,
        workspaceId,
      })),
    ),
    atsTest.platform.database.insert(resumeProcessingRun).values({
      createdAt,
      executionId: runId,
      id: runId,
      kind: "parse",
      stage: "extract_text",
      status: "failed",
      workspaceId,
    }),
  ]);
  const filter = "resumes?search=RESUME-FILTER&status=failed&pageSize=1";
  expect(await read(ats(filter))).toMatchObject({
    batches: [{ failed: 2, id: batchId, total: 3 }],
    page: 1,
    pageSize: 1,
    rows: [{ filename: "second.pdf", source: "manual_upload" }],
    total: 2,
  });
  expect(await read(ats(`${filter}&page=2`))).toMatchObject({
    page: 2,
    rows: [{ filename: "first.pdf" }],
    total: 2,
  });
});

it("shows and searches the extracted candidate name until identity is confirmed", async () => {
  const { ats, userId, workspaceId } = await account("resume-review@example.com");
  const batchId = crypto.randomUUID();
  const resumeId = crypto.randomUUID();
  const filename = "intake.pdf";
  const createdAt = new Date(0);
  await atsTest.platform.database.batch([
    atsTest.platform.database
      .insert(resumeUploadBatch)
      .values({ createdAt, createdBy: userId, id: batchId, workspaceId }),
    atsTest.platform.database.insert(resume).values({
      createdAt,
      id: resumeId,
      parseStatus: "succeeded",
      parsedProfile: { identity: { name: " Extracted Name " }, version: 1 },
      pdfObjectKey: resumeId,
      sha256: resumeId,
      workspaceId,
    }),
    atsTest.platform.database.insert(resumeSubmission).values({
      createdAt,
      id: resumeId,
      identityStatus: "pending_review",
      originalFilename: filename,
      resumeId,
      workspaceId,
    }),
    atsTest.platform.database.insert(resumeUploadItem).values({
      batchId,
      filename,
      id: resumeId,
      objectKey: resumeId,
      size: 1,
      status: "accepted",
      submissionId: resumeId,
      workspaceId,
    }),
  ]);
  expect(await read(ats("resumes?search=extracted"))).toMatchObject({
    rows: [
      {
        candidateAvatarResumeId: null,
        candidateName: "Extracted Name",
        identityStatus: "pending_review",
      },
    ],
    total: 1,
  });
  const confirmed = await ats(`submissions/${resumeId}/resolve`, {
    name: "Confirmed Name",
    version: 1,
  });
  expect(confirmed.status).toBe(200);
  expect(await read(ats("resumes?search=extracted"))).toMatchObject({
    rows: [{ candidateName: "Extracted Name", identityStatus: "resolved" }],
    total: 1,
  });
  expect(await read(ats("resumes?search=confirmed"))).toMatchObject({ rows: [], total: 0 });
});
