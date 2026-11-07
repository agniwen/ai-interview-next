import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { interviewSetup, interviewMembers, interviewEditSetup } from "./options";
import { listQuery, paginationQuery } from "../ats/input";
import { createInterviewInput, updateInterviewInput } from "./input";
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
