import { Hono } from "hono";
import { sValidator } from "@hono/standard-validator";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { usageQuery } from "./input";
import { listMyUsage } from "./service";

export const usageRoutes = new Hono<AuthenticatedEnv>()
  .use("/:workspaceId/*", requireWorkspace)
  .get("/:workspaceId/me", sValidator("query", usageQuery), async (c) => {
    c.header("Cache-Control", "private, no-store");
    return c.json(
      await listMyUsage(
        c.get("database"),
        c.get("workspaceId"),
        c.get("userId"),
        c.req.valid("query"),
      ),
      200,
    );
  });
