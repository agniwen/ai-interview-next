import { job, recruitmentProject, resume, resumeUploadItem as item } from "@ai-interview/db/schema";
import { sValidator } from "@hono/standard-validator";
import { and, asc, count, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { resumeFileExtension, resumeMediaType } from "../../lib/resume-file";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import {
  closeApplication,
  addApplicationFeedback,
  reevaluateApplication,
  createApplication,
  deleteApplication,
  matchSubmissionJob,
} from "./applications";
import {
  applicationListQuery,
  applicationFeedbackInput,
  departmentInput,
  jobInput,
  jobListQuery,
  listQuery,
  projectDetailsInput,
  resumeListQuery,
  resumeOptionsQuery,
  updateJobInput,
} from "./input";
import {
  applicationDetail,
  applicationOptions,
  applicationResumeOptions,
  getUploadResumeProfile,
  getUploadProcessing,
  listApplications,
  listCandidateResumes,
  listCandidates,
  listDepartments,
  listJobs,
  listRecruitmentProjects,
  listResumes,
} from "./queries";
import { getJob, saveDepartment, saveJob, saveProject } from "./service";
import { resolveSubmissionCandidate } from "./external-resumes";
import { flushResumeOutbox } from "./runtime";
import { resumeFiles, resumeObjectStore } from "./storage";
import {
  acceptUpload,
  createUploadBatch,
  findUploadItem,
  reparseResume,
  retryResumeRun,
  retryUpload,
} from "./uploads";

const paginatedList = sValidator("query", listQuery);
const applicationParams = sValidator(
  "param",
  z.object({ id: z.string().min(1), workspaceId: z.string() }),
);
const version = z.literal(1);
const files = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().trim().max(255).regex(resumeFileExtension),
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
  .get("/:workspaceId/resumes", sValidator("query", resumeListQuery), async (c) => {
    const query = c.req.valid("query");
    return c.json(
      await listResumes(
        c.get("database"),
        c.get("workspaceId"),
        query,
        query.owner === "me" ? c.get("userId") : undefined,
      ),
      200,
    );
  })
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
      const result = await createApplication(
        db,
        c.get("workspaceId"),
        c.req.valid("json"),
        c.get("userId"),
      );
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
  .get("/:workspaceId/applications/:id", applicationParams, async (c) => {
    const result = await applicationDetail(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.get("userId"),
    );
    if (!result) {
      return c.json({ error: "APPLICATION_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    return c.json(result, 200);
  })
  .post(
    "/:workspaceId/applications/:id/feedback",
    applicationParams,
    sValidator("json", applicationFeedbackInput),
    async (c) => {
      const result = await addApplicationFeedback(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json").body,
      );
      return result
        ? c.json(result, 201)
        : c.json({ error: "APPLICATION_NOT_AVAILABLE", version: 1 as const }, 404);
    },
  )
  .post("/:workspaceId/applications/:id/reevaluate", applicationParams, async (c) => {
    const db = c.get("database");
    const result = await reevaluateApplication(db, c.get("workspaceId"), c.req.valid("param").id);
    if (!result) {
      return c.json({ error: "APPLICATION_NOT_EVALUABLE", version: 1 as const }, 409);
    }
    c.executionCtx.waitUntil(flushResumeOutbox(c.env, db, result.runId));
    return c.json(result, 202);
  })
  .delete("/:workspaceId/applications/:id", applicationParams, async (c) => {
    const deleted = await deleteApplication(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.get("userId"),
    );
    if (!deleted) {
      return c.json({ error: "APPLICATION_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ version: 1 as const }, 200);
  })
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
  .get("/:workspaceId/departments", paginatedList, async (c) =>
    c.json(
      await listDepartments(c.get("database"), c.get("workspaceId"), c.req.valid("query")),
      200,
    ),
  )
  .post("/:workspaceId/departments", sValidator("json", departmentInput), async (c) => {
    const { version: _, ...values } = c.req.valid("json");
    const result = await saveDepartment(c.get("database"), c.get("workspaceId"), c.get("userId"), {
      values,
    });
    return "error" in result
      ? c.json({ error: result.error, version: 1 as const }, 404)
      : c.json(result, 201);
  })
  .put("/:workspaceId/departments/:id", sValidator("json", departmentInput), async (c) => {
    const { version: _, ...values } = c.req.valid("json");
    const result = await saveDepartment(c.get("database"), c.get("workspaceId"), c.get("userId"), {
      id: c.req.param("id"),
      values,
    });
    return "error" in result
      ? c.json({ error: result.error, version: 1 as const }, 404)
      : c.json(result, 200);
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
  .get("/:workspaceId/projects/:id", async (c) => {
    const workspaceId = c.get("workspaceId");
    const [project] = await c
      .get("database")
      .select({
        createdAt: recruitmentProject.createdAt,
        createdBy: recruitmentProject.createdBy,
        description: recruitmentProject.description,
        id: recruitmentProject.id,
        jobCount: count(job.id),
        title: recruitmentProject.title,
      })
      .from(recruitmentProject)
      .leftJoin(
        job,
        and(eq(job.projectId, recruitmentProject.id), eq(job.workspaceId, workspaceId)),
      )
      .where(
        and(
          eq(recruitmentProject.id, c.req.param("id")),
          eq(recruitmentProject.workspaceId, workspaceId),
        ),
      )
      .groupBy(recruitmentProject.id);
    if (!project) {
      return c.json({ error: "PROJECT_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ ...project, version: 1 as const }, 200);
  })
  .post("/:workspaceId/projects", sValidator("json", projectDetailsInput), async (c) => {
    const { version: _, ...values } = c.req.valid("json");
    const result = await saveProject(c.get("database"), c.get("workspaceId"), c.get("userId"), {
      values,
    });
    return "error" in result
      ? c.json({ error: result.error, version: 1 as const }, 404)
      : c.json(result, 201);
  })
  .put("/:workspaceId/projects/:id", sValidator("json", projectDetailsInput), async (c) => {
    const { version: _, ...values } = c.req.valid("json");
    const result = await saveProject(c.get("database"), c.get("workspaceId"), c.get("userId"), {
      id: c.req.param("id"),
      values,
    });
    return "error" in result
      ? c.json({ error: result.error, version: 1 as const }, 404)
      : c.json(result, 200);
  })
  .post("/:workspaceId/jobs", sValidator("json", jobInput), async (c) => {
    const { version: _, ...values } = c.req.valid("json");
    const result = await saveJob(c.get("database"), c.get("workspaceId"), c.get("userId"), {
      values,
    });
    return "error" in result
      ? c.json({ error: result.error, version: 1 as const }, 404)
      : c.json(result, 201);
  })
  .get("/:workspaceId/jobs/:id", async (c) => {
    const record = await getJob(c.get("database"), c.get("workspaceId"), c.req.param("id"));
    return record
      ? c.json({ ...record, version: 1 as const }, 200)
      : c.json({ error: "JOB_UNAVAILABLE", version: 1 as const }, 404);
  })
  .put("/:workspaceId/jobs/:id", sValidator("json", updateJobInput), async (c) => {
    const { version: _, ...values } = c.req.valid("json");
    const result = await saveJob(c.get("database"), c.get("workspaceId"), c.get("userId"), {
      id: c.req.param("id"),
      values,
    });
    return "error" in result
      ? c.json({ error: result.error, version: 1 as const }, 404)
      : c.json(result, 200);
  })
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
  .get("/:workspaceId/uploads/:id/processing", applicationParams, async (c) => {
    const { id } = c.req.valid("param");
    const result = await getUploadProcessing(c.get("database"), c.get("workspaceId"), id);
    return result ? c.json(result, 200) : c.json({ error: "NOT_FOUND", version: 1 as const }, 404);
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
    const { avatarObjectKey, ...profile } = result;
    return c.json({ ...profile, hasAvatar: avatarObjectKey !== null, version: 1 as const }, 200);
  })
  .get("/:workspaceId/resumes/:id/avatar", async (c) => {
    const record = await c
      .get("database")
      .select({ key: resume.avatarObjectKey })
      .from(resume)
      .where(and(eq(resume.workspaceId, c.get("workspaceId")), eq(resume.id, c.req.param("id"))))
      .get();
    if (!record?.key) {
      return c.json({ error: "AVATAR_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    const avatar = await resumeFiles(c.env).download(record.key, { as: "stream" });
    return c.body(avatar.stream(), 200, {
      "Cache-Control": "private, max-age=300",
      "Content-Type": "image/png",
    });
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
      "Content-Type": resumeMediaType(file.filename),
    });
  })
  .put("/:workspaceId/upload-files/:id", async (c) => {
    const file = await findUploadItem(c.get("database"), c.get("workspaceId"), c.req.param("id"));
    if (!file || file.status !== "waiting") {
      return c.json({ error: "UPLOAD_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    const bytes = await c.req.arrayBuffer();
    const contentType = resumeMediaType(file.filename);
    if (bytes.byteLength !== file.size || c.req.header("Content-Type") !== contentType) {
      return c.json({ error: "INVALID_UPLOAD", version: 1 as const }, 400);
    }
    await resumeObjectStore(c.env).write(file.objectKey, bytes, contentType);
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
  .post("/:workspaceId/uploads/:id/retry", async (c) => {
    const workspaceId = c.get("workspaceId");
    const storage = resumeObjectStore(c.env, `/api/ats/${workspaceId}/upload-files`);
    const upload = await retryUpload(c.get("database"), storage, workspaceId, c.req.param("id"));
    if (!upload) {
      return c.json({ error: "UPLOAD_NOT_AVAILABLE", version: 1 as const }, 404);
    }
    return c.json(upload, 200);
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
  .post("/:workspaceId/uploads/:id/reparse", async (c) => {
    const db = c.get("database");
    const result = await reparseResume(db, c.get("workspaceId"), c.req.param("id"));
    if (!result) {
      return c.json({ error: "RESUME_NOT_REPARSABLE", version: 1 as const }, 409);
    }
    c.executionCtx.waitUntil(flushResumeOutbox(c.env, db, result.runId));
    return c.json(result, 202);
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
      const id = c.req.param("id");
      const resolved = await resolveSubmissionCandidate(db, workspaceId, id, c.req.valid("json"));
      if ("error" in resolved) {
        return c.json({ error: resolved.error, version: 1 as const }, 404);
      }
      if (resolved.jobId) {
        const result = await matchSubmissionJob(db, workspaceId, id, resolved.jobId, {
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
