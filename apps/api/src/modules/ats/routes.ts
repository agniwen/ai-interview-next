import {
  candidate,
  job,
  recruitmentProject,
  resume,
  resumeSubmission as submission,
  resumeUploadItem as item,
} from "@ai-interview/db/schema";
import { sValidator } from "@hono/standard-validator";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { closeApplication, createApplication, matchSubmissionJob } from "./applications";
import {
  applicationListQuery,
  jobListQuery,
  listQuery,
  resumeListQuery,
  resumeOptionsQuery,
} from "./input";
import {
  applicationHistory,
  applicationOptions,
  applicationResumeOptions,
  getUploadResumeProfile,
  listApplications,
  listCandidateResumes,
  listCandidates,
  listJobs,
  listRecruitmentProjects,
  listResumes,
} from "./queries";
import { flushResumeOutbox } from "./runtime";
import { resumeFiles, resumeObjectStore } from "./storage";
import { acceptUpload, createUploadBatch, findUploadItem, retryResumeRun } from "./uploads";

const paginatedList = sValidator("query", listQuery);
const version = z.literal(1);
const files = z.object({
  files: z
    .array(
      z.object({
        filename: z
          .string()
          .trim()
          .max(255)
          .regex(/\.pdf$/iu),
        size: z
          .number()
          .int()
          .positive()
          .max(20 * 1024 * 1024),
      }),
    )
    .min(1)
    .max(20),
  version,
});

export const atsRoutes = new Hono<AuthenticatedEnv>()
  .use("/:workspaceId/*", requireWorkspace)
  .get("/:workspaceId/candidates", paginatedList, async (c) =>
    c.json(
      await listCandidates(c.get("database"), c.get("workspaceId"), c.req.valid("query")),
      200,
    ),
  )
  .get(
    "/:workspaceId/candidates/:id/resumes",
    sValidator("param", z.object({ id: z.string().min(1), workspaceId: z.string() })),
    async (c) => {
      const result = await listCandidateResumes(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
      );
      if (!result) {
        return c.json({ error: "CANDIDATE_NOT_AVAILABLE", version: 1 as const }, 404);
      }
      return c.json(result, 200);
    },
  )
  .get("/:workspaceId/resumes", sValidator("query", resumeListQuery), async (c) =>
    c.json(await listResumes(c.get("database"), c.get("workspaceId"), c.req.valid("query")), 200),
  )
  .get("/:workspaceId/applications", sValidator("query", applicationListQuery), async (c) =>
    c.json(
      await listApplications(c.get("database"), c.get("workspaceId"), c.req.valid("query")),
      200,
    ),
  )
  .get("/:workspaceId/applications/options", async (c) =>
    c.json(await applicationOptions(c.get("database"), c.get("workspaceId")), 200),
  )
  .get(
    "/:workspaceId/applications/resume-options",
    sValidator("query", resumeOptionsQuery),
    async (c) =>
      c.json(
        await applicationResumeOptions(
          c.get("database"),
          c.get("workspaceId"),
          c.req.valid("query"),
        ),
        200,
      ),
  )
  .post(
    "/:workspaceId/applications",
    sValidator("json", z.strictObject({ jobId: z.uuid(), resumeId: z.uuid(), version })),
    async (c) => {
      const db = c.get("database");
      const result = await createApplication(db, c.get("workspaceId"), c.req.valid("json"));
      if ("error" in result) {
        return c.json(result, 409);
      }
      if (result.runId) {
        c.executionCtx.waitUntil(flushResumeOutbox(c.env, db, result.runId));
        return c.json(result, 201);
      }
      return c.json(result, 200);
    },
  )
  .get("/:workspaceId/applications/:id", async (c) =>
    c.json(await applicationHistory(c.get("database"), c.get("workspaceId"), c.req.param("id"))),
  )
  .post("/:workspaceId/applications/:id/close", async (c) => {
    const closed = await closeApplication(
      c.get("database"),
      c.get("workspaceId"),
      c.req.param("id"),
      c.get("userId"),
    );
    if (!closed) {
      return c.json({ error: "APPLICATION_NOT_OPEN", version: 1 as const }, 409);
    }
    return c.json({ version: 1 as const }, 200);
  })
  .get("/:workspaceId/jobs", sValidator("query", jobListQuery), async (c) =>
    c.json(await listJobs(c.get("database"), c.get("workspaceId"), c.req.valid("query")), 200),
  )
  .get("/:workspaceId/projects", paginatedList, async (c) =>
    c.json(
      await listRecruitmentProjects(c.get("database"), c.get("workspaceId"), c.req.valid("query")),
      200,
    ),
  )
  .get("/:workspaceId/projects/options", async (c) => {
    const rows = await c
      .get("database")
      .select({ id: recruitmentProject.id, title: recruitmentProject.title })
      .from(recruitmentProject)
      .where(eq(recruitmentProject.workspaceId, c.get("workspaceId")))
      .orderBy(asc(recruitmentProject.title), asc(recruitmentProject.id));
    return c.json({ rows, version: 1 as const }, 200);
  })
  .post(
    "/:workspaceId/projects",
    sValidator("json", z.strictObject({ title: z.string().trim().min(1).max(200), version })),
    async (c) => {
      const { title } = c.req.valid("json");
      const id = crypto.randomUUID();
      await c
        .get("database")
        .insert(recruitmentProject)
        .values({
          createdAt: new Date(),
          id,
          title,
          workspaceId: c.get("workspaceId"),
        });
      return c.json({ id, version: 1 as const }, 201);
    },
  )
  .post(
    "/:workspaceId/jobs",
    sValidator(
      "json",
      z.strictObject({
        projectId: z.uuid().optional(),
        requirements: z.string().trim().min(1).max(30_000),
        title: z.string().trim().min(1).max(200),
        version,
      }),
    ),
    async (c) => {
      const { projectId, requirements, title } = c.req.valid("json");
      const db = c.get("database");
      const workspaceId = c.get("workspaceId");
      if (projectId) {
        const project = await db
          .select({ id: recruitmentProject.id })
          .from(recruitmentProject)
          .where(
            and(
              eq(recruitmentProject.id, projectId),
              eq(recruitmentProject.workspaceId, workspaceId),
            ),
          )
          .get();
        if (!project) {
          return c.json({ error: "PROJECT_UNAVAILABLE", version: 1 as const }, 404);
        }
      }
      const id = crypto.randomUUID();
      await db.insert(job).values({
        createdAt: new Date(),
        id,
        projectId,
        requirements,
        title,
        workspaceId,
      });
      return c.json({ id, version: 1 as const }, 201);
    },
  )
  .post("/:workspaceId/uploads", sValidator("json", files), async (c) => {
    const workspaceId = c.get("workspaceId");
    const storage = resumeObjectStore(c.env, `/api/ats/${workspaceId}/upload-files`);
    return c.json(
      await createUploadBatch(
        c.get("database"),
        storage,
        workspaceId,
        c.get("userId"),
        c.req.valid("json").files,
      ),
      201,
    );
  })
  .get("/:workspaceId/uploads/:id/profile", async (c) => {
    const result = await getUploadResumeProfile(
      c.get("database"),
      c.get("workspaceId"),
      c.req.param("id"),
    );
    if (!result) {
      return c.json({ error: "UPLOAD_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ ...result, version: 1 as const }, 200);
  })
  .get("/:workspaceId/upload-files/:id", async (c) => {
    const file = await findUploadItem(c.get("database"), c.get("workspaceId"), c.req.param("id"));
    if (!file || file.status !== "accepted") {
      return c.json({ error: "UPLOAD_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    const original = await resumeFiles(c.env).download(file.objectKey, { as: "stream" });
    const filename = encodeURIComponent(file.filename)
      .replaceAll("'", "%27")
      .replaceAll("(", "%28")
      .replaceAll(")", "%29")
      .replaceAll("*", "%2A");
    return c.body(original.stream(), 200, {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      "Content-Length": String(original.size),
      "Content-Type": "application/pdf",
    });
  })
  .put("/:workspaceId/upload-files/:id", async (c) => {
    const file = await findUploadItem(c.get("database"), c.get("workspaceId"), c.req.param("id"));
    if (!file || file.status !== "waiting") {
      return c.json({ error: "UPLOAD_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    const bytes = await c.req.arrayBuffer();
    if (bytes.byteLength !== file.size || c.req.header("Content-Type") !== "application/pdf") {
      return c.json({ error: "INVALID_UPLOAD", version: 1 as const }, 400);
    }
    await resumeObjectStore(c.env).write(file.objectKey, bytes);
    return c.body(null, 204);
  })
  .post("/:workspaceId/uploads/:id/confirm", async (c) => {
    const db = c.get("database");
    const accepted = await acceptUpload(
      db,
      resumeObjectStore(c.env),
      c.get("workspaceId"),
      c.req.param("id"),
    );
    if (!accepted) {
      return c.json(
        { error: "UPLOAD_NOT_CONFIRMED", version: 1 as const },
        accepted === null ? 409 : 404,
      );
    }
    c.executionCtx.waitUntil(flushResumeOutbox(c.env, db, accepted.runId));
    return c.json(accepted, 202);
  })
  .post("/:workspaceId/uploads/:id/failed", async (c) => {
    await c
      .get("database")
      .update(item)
      .set({ status: "upload_failed" })
      .where(
        and(
          eq(item.id, c.req.param("id")),
          eq(item.workspaceId, c.get("workspaceId")),
          eq(item.status, "waiting"),
        ),
      );
    return c.json({ version: 1 as const }, 200);
  })
  .post("/:workspaceId/runs/:id/retry", async (c) => {
    const db = c.get("database");
    const id = c.req.param("id");
    if (!(await retryResumeRun(db, c.get("workspaceId"), id))) {
      return c.json({ error: "RUN_NOT_RETRYABLE", version: 1 as const }, 409);
    }
    c.executionCtx.waitUntil(flushResumeOutbox(c.env, db, id));
    return c.json({ version: 1 as const }, 202);
  })
  .post(
    "/:workspaceId/submissions/:id/match",
    sValidator("json", z.strictObject({ jobId: z.string().uuid(), version })),
    async (c) => {
      const db = c.get("database");
      const result = await matchSubmissionJob(
        db,
        c.get("workspaceId"),
        c.req.param("id"),
        c.req.valid("json").jobId,
        { id: c.get("userId"), type: "user" },
      );
      if (!result) {
        return c.json({ error: "MATCH_NOT_FOUND", version: 1 as const }, 404);
      }
      if (result.runId) {
        c.executionCtx.waitUntil(flushResumeOutbox(c.env, db, result.runId));
      }
      return c.json(result, 200);
    },
  )
  .post(
    "/:workspaceId/submissions/:id/resolve",
    sValidator(
      "json",
      z.union([
        z.strictObject({ candidateId: z.string().min(1), version }),
        z.strictObject({ name: z.string().trim().min(1).max(255), version }),
      ]),
    ),
    async (c) => {
      const db = c.get("database");
      const workspaceId = c.get("workspaceId");
      const [record] = await db
        .select()
        .from(submission)
        .where(
          and(
            eq(submission.id, c.req.param("id")),
            eq(submission.workspaceId, workspaceId),
            eq(submission.identityStatus, "pending_review"),
          ),
        );
      if (!record) {
        return c.json({ error: "SUBMISSION_NOT_FOUND", version: 1 as const }, 404);
      }
      const input = c.req.valid("json");
      const candidateId = "candidateId" in input ? input.candidateId : crypto.randomUUID();
      if ("candidateId" in input) {
        const [existing] = await db
          .select()
          .from(candidate)
          .where(and(eq(candidate.id, candidateId), eq(candidate.workspaceId, workspaceId)));
        if (!existing) {
          return c.json({ error: "CANDIDATE_NOT_FOUND", version: 1 as const }, 404);
        }
      } else {
        await db.insert(candidate).values({
          createdAt: new Date(),
          creationSource: "manual",
          id: candidateId,
          name: input.name,
          workspaceId,
        });
      }
      await db.batch([
        db
          .update(resume)
          .set({ candidateId })
          .where(and(eq(resume.id, record.resumeId), isNull(resume.candidateId))),
        db
          .update(submission)
          .set({ identityStatus: "resolved", resolvedCandidateId: candidateId })
          .where(eq(submission.id, record.id)),
      ]);
      if (record.jobId) {
        const result = await matchSubmissionJob(db, workspaceId, record.id, record.jobId, {
          id: c.get("userId"),
          type: "user",
        });
        if (result?.runId) {
          c.executionCtx.waitUntil(flushResumeOutbox(c.env, db, result.runId));
        }
      }
      return c.json({ version: 1 as const }, 200);
    },
  );
