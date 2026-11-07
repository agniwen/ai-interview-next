import {
  resume,
  resumeProcessingAttempt,
  resumeProcessingRun,
  resumeUploadItem,
} from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { cropResumePortrait } from "../src/lib/resume-avatar";
import { consumeResumeStage } from "../src/modules/ats/stages";
import type { ResumeStageDependencies } from "../src/modules/ats/stages";
import { runResumeWorkflow } from "../src/modules/ats/workflow";
import { resumeObjectStore } from "../src/modules/ats/storage";
import { account, atsTest, read } from "./ats-fixture";

it.each([{ missingAvatar: true }, { missingAvatar: false }])(
  "reparses from OCR and fills a missing avatar or keeps an existing one (missing: $missingAvatar)",
  async ({ missingAvatar }) => {
    const owner = await account(`resume-avatar-${missingAvatar}@example.com`);
    const outsider = await account(`resume-avatar-outsider-${missingAvatar}@example.com`);
    const image = new PNG({ height: 8, width: 8 });
    image.data.fill(255);
    const bytes = PNG.sync.write(image);
    const created = await read(
      owner.ats("uploads", {
        files: [{ filename: "resume.png", size: bytes.byteLength }],
        version: 1,
      }),
    );
    const [upload] = created.uploads;
    expect(upload.contentType).toBe("image/png");
    expect(await read(owner.ats(`uploads/${upload.id}/processing`))).toMatchObject({
      attempts: [],
      resume: null,
      run: null,
      upload: { filename: "resume.png", id: upload.id, status: "waiting" },
      version: 1,
    });
    const forbidden = await outsider.call(
      `ats/${owner.workspaceId}/uploads/${upload.id}/processing`,
    );
    expect(forbidden.status).toBe(404);
    const crossWorkspace = await outsider.ats(`uploads/${upload.id}/processing`);
    expect(crossWorkspace.status).toBe(404);
    const missing = await owner.ats(`uploads/${crypto.randomUUID()}/processing`);
    expect(missing.status).toBe(404);

    const uploaded = await owner.request(upload.url, {
      body: new Uint8Array(bytes),
      headers: { "content-type": upload.contentType },
      method: "PUT",
    });
    expect(uploaded.status).toBe(204);
    const accepted = await owner.ats(`uploads/${upload.id}/confirm`, {});
    expect(accepted.status).toBe(202);
    const { runId } = await accepted.json();
    const item = await atsTest.platform.database
      .select()
      .from(resumeUploadItem)
      .where(eq(resumeUploadItem.id, upload.id))
      .get();
    const storage = resumeObjectStore(atsTest.env);
    expect(await storage.read(item?.objectKey ?? "")).toEqual(new Uint8Array(bytes));
    const attemptId = `avatar-test-${runId}`;
    await atsTest.platform.database.insert(resumeProcessingAttempt).values({
      createdAt: new Date(),
      executionId: runId,
      id: attemptId,
      ordinal: 1,
      runId,
      stage: "extract_text",
      status: "queued",
    });
    const parameters = { model: "test", promptVersion: 1, timeoutMs: 1000 };
    let extractions = 0;
    let avatarExtractions = 0;
    const dependencies: ResumeStageDependencies = {
      avatarParameters: { ...parameters, version: 1 },
      evaluate: () => Promise.reject(new Error("Unexpected evaluation")),
      evaluateParameters: parameters,
      extract: () => (file, mediaType) => {
        expect(file).toEqual(new Uint8Array(bytes));
        expect(mediaType).toBe("image/png");
        extractions += 1;
        return Promise.resolve({ text: `# Resume ${extractions}` });
      },
      extractAvatar: (file, mediaType) => {
        avatarExtractions += 1;
        expect(mediaType).toBe("image/png");
        return Promise.resolve(
          cropResumePortrait(file, "image/png", {
            bottom: 0.75,
            left: 0.5,
            right: 1,
            top: 0.25,
          }),
        );
      },
      extractParameters: parameters,
      storage,
      structure: () => (text) => {
        expect(text).toBe("# Resume 2");
        return Promise.resolve({ identity: { name: "Reparsed name" }, version: 1 });
      },
      structureParameters: parameters,
    };
    await consumeResumeStage(atsTest.platform.database, dependencies, {
      attemptId,
      runId,
      version: 1,
    });
    const record = await atsTest.platform.database
      .select()
      .from(resume)
      .where(eq(resume.id, runId))
      .get();
    expect(record).toMatchObject({ avatarObjectKey: expect.any(String), markdown: "# Resume 1" });
    expect(await read(owner.ats("resumes"))).toMatchObject({
      rows: [{ candidateAvatarResumeId: runId, id: upload.id }],
    });
    expect(await read(owner.ats(`uploads/${upload.id}/profile`))).toMatchObject({
      hasAvatar: true,
      resumeId: runId,
    });
    const avatar = await owner.ats(`resumes/${runId}/avatar`);
    expect(avatar.status).toBe(200);
    expect(avatar.headers.get("content-type")).toBe("image/png");
    const crop = PNG.sync.read(Buffer.from(await avatar.arrayBuffer()));
    expect(crop).toMatchObject({ height: 4, width: 4 });
    const privateAvatar = await outsider.call(`ats/${owner.workspaceId}/resumes/${runId}/avatar`);
    expect(privateAvatar.status).toBe(404);

    await atsTest.platform.database
      .update(resume)
      .set({
        avatarObjectKey: missingAvatar ? null : record?.avatarObjectKey,
        parseStatus: "succeeded",
        parsedProfile: { identity: { name: "Old name" }, version: 1 },
      })
      .where(eq(resume.id, runId));
    await atsTest.platform.database
      .update(resumeProcessingRun)
      .set({
        stage: "structure",
        status: "succeeded",
      })
      .where(eq(resumeProcessingRun.id, runId));
    const forbiddenReparse = await outsider.call(
      `ats/${owner.workspaceId}/uploads/${upload.id}/reparse`,
      {},
    );
    expect(forbiddenReparse.status).toBe(404);
    const restarted = await owner.ats(`uploads/${upload.id}/reparse`, {});
    expect(restarted.status).toBe(202);
    expect(await restarted.json()).toEqual({ runId, version: 1 });
    const restartedRun = await atsTest.platform.database
      .select()
      .from(resumeProcessingRun)
      .where(eq(resumeProcessingRun.id, runId))
      .get();
    expect(restartedRun).toMatchObject({
      resumeId: runId,
      stage: "extract_text",
      status: "queued",
    });
    expect(restartedRun?.executionId).not.toBe(runId);
    const duplicateReparse = await owner.ats(`uploads/${upload.id}/reparse`, {});
    expect(duplicateReparse.status).toBe(409);
    expect(await read(owner.ats(`uploads/${upload.id}/profile`))).toMatchObject({
      hasAvatar: !missingAvatar,
      parseStatus: "queued",
      profile: { identity: { name: "Old name" } },
    });

    expect(await read(owner.ats(`uploads/${upload.id}/processing`))).toMatchObject({
      attempts: [],
      resume: { markdown: "# Resume 1", profile: { identity: { name: "Old name" } } },
      run: { executionId: restartedRun?.executionId, status: "queued" },
    });
    await runResumeWorkflow(
      atsTest.platform.database,
      {
        checkpoint: (_name, operation) => operation(),
        sleep: () => Promise.reject(new Error("Unexpected retry")),
        waitForAttempt: async (_name, queuedAttemptId) => {
          await consumeResumeStage(atsTest.platform.database, dependencies, {
            attemptId: queuedAttemptId,
            runId,
            version: 1,
          });
        },
      },
      { runId, version: 1 },
      restartedRun?.executionId ?? "",
      () => Promise.resolve(),
    );
    expect(extractions).toBe(2);
    expect(avatarExtractions).toBe(missingAvatar ? 2 : 1);
    expect(await read(owner.ats(`uploads/${upload.id}/profile`))).toMatchObject({
      hasAvatar: true,
      parseStatus: "succeeded",
      profile: { identity: { name: "Reparsed name" }, version: 1 },
      resumeId: runId,
    });
    const attempts = await atsTest.platform.database
      .select()
      .from(resumeProcessingAttempt)
      .where(eq(resumeProcessingAttempt.runId, runId));
    expect(attempts).toHaveLength(3);
    const processing = await read(owner.ats(`uploads/${upload.id}/processing`));
    expect(processing).toMatchObject({
      attempts: [
        {
          finishedAt: expect.any(String),
          ordinal: 1,
          parameters: { model: "test", version: 1 },
          stage: "extract_text",
          startedAt: expect.any(String),
          status: "succeeded",
        },
        { ordinal: 1, stage: "structure", status: "succeeded" },
      ],
      resume: {
        hasAvatar: true,
        id: runId,
        markdown: "# Resume 2",
        profile: { identity: { name: "Reparsed name" }, version: 1 },
      },
      run: { executionId: restartedRun?.executionId, stage: "structure", status: "succeeded" },
      upload: { id: upload.id, status: "accepted" },
      version: 1,
    });
    expect(processing.attempts).toHaveLength(2);
    expect(processing.resume).not.toHaveProperty("avatarObjectKey");

    expect(attempts.every((entry) => entry.status === "succeeded")).toBe(true);
  },
);
