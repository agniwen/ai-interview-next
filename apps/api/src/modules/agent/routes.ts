import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import { z } from "zod";
import { agentCommand } from "@ai-interview/agent";
import type { ChatSummary } from "@ai-interview/agent";

export const agentRoutes = new Hono<AuthenticatedEnv>()
  .use("/:workspaceId/*", requireWorkspace)
  .onError((failure, c) => {
    console.error("Agent request failed", failure);
    return c.json({ error: "AGENT_REQUEST_FAILED" }, 409);
  })
  .get("/:workspaceId/sessions", async (c) => {
    const entries = await c.env.REDIS.getByName(c.get("scope")).hgetall("sessions");
    const sessions = Object.values(entries)
      .map((value) => JSON.parse(value) as ChatSummary)
      // 新数组可原地排序，兼容共享客户端的 ES2022 类型。Sort the new array in place for the shared ES2022 client types.
      // oxlint-disable-next-line unicorn/no-array-sort
      .sort((a, b) => b.lastSentAt - a.lastSentAt);
    return c.json({ sessions });
  })
  .post(
    "/:workspaceId/sessions",
    sValidator(
      "json",
      z.object({
        id: z.string().uuid(),
        messageId: z.string().uuid(),
        text: z.string().trim().min(1).max(32_000),
      }),
    ),
    async (c) => {
      if (!c.env.AGENT_CHAT_KEY) {
        return c.json({ error: "AGENT_NOT_CONFIGURED" }, 503);
      }
      const { id, messageId, text } = c.req.valid("json");
      const scope = c.get("scope");
      const session = c.env.AGENT_SESSIONS.getByName(JSON.stringify([scope, id]));
      await session.initialize(scope, id);
      const snapshot = await session.command({ id: messageId, text, type: "send" });
      return c.json(snapshot, 201);
    },
  )
  .use("/:workspaceId/sessions/:sessionId/*", async (c, next) => {
    const sessions = await c.env.REDIS.getByName(c.get("scope")).hgetall("sessions");
    if (!sessions[c.req.param("sessionId")]) {
      return c.json({ error: "CHAT_NOT_FOUND" }, 404);
    }
    return next();
  })
  .get("/:workspaceId/sessions/:sessionId/state", async (c) =>
    c.json(
      await c.env.AGENT_SESSIONS.getByName(
        JSON.stringify([c.get("scope"), c.req.param("sessionId")]),
      ).snapshot(),
    ),
  )
  .get("/:workspaceId/sessions/:sessionId/events", (c) =>
    c.env.AGENT_SESSIONS.getByName(
      JSON.stringify([c.get("scope"), c.req.param("sessionId")]),
    ).events(),
  )
  .post("/:workspaceId/sessions/:sessionId/commands", sValidator("json", agentCommand), async (c) =>
    c.json(
      await c.env.AGENT_SESSIONS.getByName(
        JSON.stringify([c.get("scope"), c.req.param("sessionId")]),
      ).command(c.req.valid("json")),
    ),
  )
  .delete("/:workspaceId/sessions/:sessionId/permanent", async (c) => {
    const scope = c.get("scope");
    const id = c.req.param("sessionId");
    const session = c.env.AGENT_SESSIONS.getByName(JSON.stringify([scope, id]));
    const snapshot = await session.snapshot();
    if (!snapshot.summary.trashed) {
      return c.json({ error: "CHAT_NOT_TRASHED" }, 409);
    }
    await session.destroy();
    await c.env.REDIS.getByName(scope).hdel("sessions", id);
    return c.json({ deleted: true });
  });
