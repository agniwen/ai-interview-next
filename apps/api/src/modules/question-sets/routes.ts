import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { questionSetInput, questionSetListQuery } from "./input";
import { createQuestionSet, getQuestionSet, listQuestionSets, updateQuestionSet } from "./service";

function validationResult(result: { success: boolean }, c: Context<AuthenticatedEnv>) {
  if (!result.success) {
    return c.json({ error: "INVALID_INPUT", version: 1 as const }, 400);
  }
}

const setParams = sValidator(
  "param",
  z.object({ id: z.uuid(), workspaceId: z.string() }),
  validationResult,
);
const setInput = sValidator("json", questionSetInput, validationResult);

/** 登录态由外层解析，工作区权限与题型对应的完整输入在此入口处理一次。
 * The parent resolves authentication; this boundary checks workspace access and validates the complete type-specific input once. */
export const questionSetRoutes = new Hono<AuthenticatedEnv>()
  .use("/:workspaceId/*", requireWorkspace)
  .get("/:workspaceId", sValidator("query", questionSetListQuery, validationResult), async (c) =>
    c.json(
      await listQuestionSets(c.get("database"), c.get("workspaceId"), c.req.valid("query")),
      200,
    ),
  )
  .post("/:workspaceId", setInput, async (c) =>
    c.json(
      await createQuestionSet(
        c.get("database"),
        c.get("workspaceId"),
        c.get("userId"),
        c.req.valid("json"),
      ),
      201,
    ),
  )
  .get("/:workspaceId/:id", setParams, async (c) => {
    const record = await getQuestionSet(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
    );
    if (!record) {
      return c.json({ error: "QUESTION_SET_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ ...record, version: 1 as const }, 200);
  })
  .put("/:workspaceId/:id", setParams, setInput, async (c) => {
    const record = await updateQuestionSet(
      c.get("database"),
      c.get("workspaceId"),
      c.req.valid("param").id,
      c.req.valid("json"),
    );
    if (!record) {
      return c.json({ error: "QUESTION_SET_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json({ id: record.id, version: 1 as const }, 200);
  });
