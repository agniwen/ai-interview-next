import { resumeFiles } from "../ats/storage";
import { readHumanMeeting, joinInterviewerMeeting, endHumanMeeting } from "./meeting";
import {
  meetingRoomConfiguration,
  connectHumanMeeting,
  closeInterviewRoom,
} from "../interview-sessions/rooms";
import { readInterviewResult } from "./result";
import {
  interviewEvaluationDraftSchema,
  interviewEvaluationSchema,
} from "@ai-interview/db/interview-evaluation";
import { saveEvaluation } from "./evaluation";
import { canConfirmEvaluation } from "./evaluation-state";
import { createInterviewEvaluator, generateInterviewEvaluation } from "./evaluation-generation";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { interviewSetup, interviewMembers, interviewEditSetup } from "./options";
import { listQuery, paginationQuery } from "../ats/input";
import { createInterviewInput, updateInterviewInput } from "./input";
import { createInterviewInvitation } from "./invitation";
import {
  updateInterview,
  deleteInterview,
  createInterview,
  getInterview,
  interviewApplication,
  listInterviews,
} from "./service";

function validationResult(result: { success: boolean }, c: Context<AuthenticatedEnv>) {
  if (!result.success) {
    return c.json({ error: "INVALID_INPUT", version: 1 as const }, 400);
  }
}
const applicationParams = sValidator(
  "param",
  z.object({ applicationId: z.uuid(), workspaceId: z.string() }),
  validationResult,
);

const interviewParams = sValidator(
  "param",
  z.object({ id: z.uuid(), workspaceId: z.string() }),
  validationResult,
);

/** 公共接口只使用面试业务名称；身份、工作区与外部格式在入口建立。
 * Public endpoints use interview domain names; establish identity, workspace access and external formats at the boundary. */
export const interviewRoutes = new Hono<AuthenticatedEnv>()
  .use("/:workspaceId/*", requireWorkspace)
  .get(
    "/:workspaceId/:id/meeting/resumes/:resumeId",
    sValidator(
      "param",
      z.object({ id: z.uuid(), resumeId: z.uuid(), workspaceId: z.string() }),
      validationResult,
    ),
    async (c) => {
      const { id, resumeId } = c.req.valid("param");
      const result = await readHumanMeeting(
        c.get("database"),
        c.get("workspaceId"),
        id,
        c.get("userId"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      const resume = result.materials.resumes.find((item) => item.id === resumeId);
      if (!resume) {
        return c.json({ error: "RESUME_UNAVAILABLE", version: 1 as const }, 404);
      }
      const file = await resumeFiles(c.env).download(resume.pdfObjectKey, { as: "stream" });
      return c.body(file.stream(), 200, {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="resume.pdf"',
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      });
    },
  )
  .get("/:workspaceId/:id/meeting", interviewParams, async (c) => {
    const result = await readHumanMeeting(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.get("userId"),
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    c.header("Cache-Control", "private, no-store");
    return c.json(result, 200);
  })
  .post(
    "/:workspaceId/:id/meeting/entered",
    interviewParams,
    sValidator("json", z.object({ version: z.literal(1) }), validationResult),
    async (c) => {
      const result = await joinInterviewerMeeting(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.get("userId"),
        true,
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json({ startedAt: result.session.startedAt, version: 1 as const }, 200);
    },
  )
  .post(
    "/:workspaceId/:id/meeting",
    interviewParams,
    sValidator("json", z.object({ version: z.literal(1) }), validationResult),
    async (c) => {
      const config = meetingRoomConfiguration.safeParse(c.env);
      if (!config.success) {
        return c.json({ error: "INTERVIEW_SERVICE_UNAVAILABLE", version: 1 as const }, 503);
      }
      const result = await joinInterviewerMeeting(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.get("userId"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      try {
        c.header("Cache-Control", "private, no-store");
        return c.json(
          await connectHumanMeeting(config.data, result.session, result.participant),
          200,
        );
      } catch {
        return c.json({ error: "INTERVIEW_CONNECTION_FAILED", version: 1 as const }, 503);
      }
    },
  )
  .post(
    "/:workspaceId/:id/meeting/end",
    interviewParams,
    sValidator("json", z.object({ version: z.literal(1) }), validationResult),
    async (c) => {
      const config = meetingRoomConfiguration.safeParse(c.env);
      if (!config.success) {
        return c.json({ error: "INTERVIEW_SERVICE_UNAVAILABLE", version: 1 as const }, 503);
      }
      const result = await endHumanMeeting(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.get("userId"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      try {
        await closeInterviewRoom(config.data, result.roomName);
      } catch {
        return c.json({ error: "INTERVIEW_CLOSE_FAILED", version: 1 as const }, 503);
      }
      return c.json({ endedAt: result.endedAt, version: 1 as const }, 200);
    },
  )
  .get("/:workspaceId/members", sValidator("query", listQuery, validationResult), async (c) =>
    c.json(
      await interviewMembers(c.get("database"), c.get("workspaceId"), c.req.valid("query")),
      200,
    ),
  )
  .get("/:workspaceId/applications/:applicationId/setup", applicationParams, async (c) => {
    const result = await interviewSetup(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").applicationId,
      c.get("userId"),
    );
    if (!result) {
      return c.json({ error: "APPLICATION_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json(result, 200);
  })
  .post(
    "/:workspaceId/applications/:applicationId",
    applicationParams,
    sValidator("json", createInterviewInput, validationResult),
    async (c) => {
      const result = await createInterview(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").applicationId,
        c.get("userId"),
        c.req.valid("json"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 201);
    },
  )
  .get(
    "/:workspaceId/applications/:applicationId",
    applicationParams,
    sValidator("query", paginationQuery, validationResult),
    async (c) => {
      const db = c.get("database");
      const workspaceId = c.get("workspaceId");
      const { applicationId } = c.req.valid("param");
      if (!(await interviewApplication(db, workspaceId, applicationId))) {
        return c.json({ error: "APPLICATION_UNAVAILABLE", version: 1 as const }, 404);
      }
      return c.json(
        await listInterviews(db, workspaceId, applicationId, c.req.valid("query"), c.get("userId")),
        200,
      );
    },
  )
  .post("/:workspaceId/:id/invitation", interviewParams, async (c) => {
    const result = await createInterviewInvitation(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    return c.json(result, 200);
  })
  .get("/:workspaceId/:id/edit", interviewParams, async (c) => {
    const result = await interviewEditSetup(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.get("userId"),
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    return c.json(result, 200);
  })
  .put(
    "/:workspaceId/:id",
    interviewParams,
    sValidator("json", updateInterviewInput, validationResult),
    async (c) => {
      const result = await updateInterview(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.get("userId"),
        c.req.valid("json"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .get("/:workspaceId/:id/result", interviewParams, async (c) => {
    const result = await readInterviewResult(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.get("userId"),
    );
    if (!result) {
      return c.json({ error: "INTERVIEW_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json(result, 200);
  })
  .put(
    "/:workspaceId/:id/evaluation",
    interviewParams,
    sValidator("json", interviewEvaluationDraftSchema, validationResult),
    async (c) => {
      const result = await saveEvaluation(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.get("userId"),
        { content: c.req.valid("json"), submit: false },
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .post(
    "/:workspaceId/:id/evaluation/submit",
    interviewParams,
    sValidator("json", interviewEvaluationSchema, validationResult),
    async (c) => {
      const result = await saveEvaluation(
        c.get("database"),
        c.get("workspaceId"),
        c.req.valid("param").id,
        c.get("userId"),
        { content: c.req.valid("json"), submit: true },
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .post(
    "/:workspaceId/:id/evaluation/generate",
    interviewParams,
    sValidator("json", z.strictObject({ version: z.literal(1) }), validationResult),
    async (c) => {
      const db = c.get("database");
      const { id } = c.req.valid("param");
      const entry = await getInterview(db, c.get("workspaceId"), id);
      if (!entry) {
        return c.json({ error: "INTERVIEW_UNAVAILABLE", version: 1 as const }, 404);
      }
      if (
        !canConfirmEvaluation(
          entry.round.kind,
          entry.round.assignments.map((item) => item.id),
          c.get("userId"),
        )
      ) {
        return c.json({ error: "INTERVIEW_EVALUATION_FORBIDDEN", version: 1 as const }, 403);
      }
      const result = await generateInterviewEvaluation(db, id, createInterviewEvaluator(c.env));
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .get("/:workspaceId/:id", interviewParams, async (c) => {
    const result = await getInterview(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
    );
    if (!result) {
      return c.json({ error: "INTERVIEW_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ ...result.round, version: 1 as const }, 200);
  })
  .delete("/:workspaceId/:id", interviewParams, async (c) => {
    const result = await deleteInterview(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.get("userId"),
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    return c.json(result, 200);
  });
