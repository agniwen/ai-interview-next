import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { listQuery } from "../ats/input";
import { interviewerAgentInput } from "./input";
import {
  createInterviewerAgent,
  getInterviewerAgent,
  listInterviewerAgents,
  updateInterviewerAgent,
} from "./service";

function validationResult(result: { success: boolean }, c: Context<AuthenticatedEnv>) {
  if (!result.success) {
    return c.json({ error: "INVALID_INPUT", version: 1 as const }, 400);
  }
}

// 保留完整路径参数，供类型化客户端构建工作区内的详情和编辑地址。
// Preserve all path parameters so the typed client can build workspace-scoped detail and edit URLs.
const agentParams = sValidator(
  "param",
  z.object({ id: z.uuid(), workspaceId: z.string() }),
  validationResult,
);
const agentInput = sValidator("json", interviewerAgentInput, validationResult);

/** 外层 app 解析登录态；此处校验工作区成员关系，并在 HTTP 入口校验操作输入。
 * The parent app resolves the session; this module checks workspace membership and validates operation inputs at the HTTP boundary. */
export const interviewerAgentRoutes = new Hono<AuthenticatedEnv>()
  .use("/:workspaceId/*", requireWorkspace)
  .get("/:workspaceId", sValidator("query", listQuery, validationResult), async (c) =>
    c.json(
      await listInterviewerAgents(c.get("database"), c.get("workspaceId"), c.req.valid("query")),
      200,
    ),
  )
  .post("/:workspaceId", agentInput, async (c) =>
    c.json(
      await createInterviewerAgent(
        c.get("database"),
        c.get("workspaceId"),
        c.get("userId"),
        c.req.valid("json"),
      ),
      201,
    ),
  )
  .get("/:workspaceId/:id", agentParams, async (c) => {
    const record = await getInterviewerAgent(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
    );
    if (!record) {
      return c.json({ error: "INTERVIEWER_AGENT_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ ...record, version: 1 as const }, 200);
  })
  .put("/:workspaceId/:id", agentParams, agentInput, async (c) => {
    const record = await updateInterviewerAgent(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    if (!record) {
      return c.json({ error: "INTERVIEWER_AGENT_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ id: record.id, version: 1 as const }, 200);
  });
