import { createDatabase } from "@ai-interview/db";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { z } from "zod";
import { getAuth } from "../auth/auth";
import { activateWorkspace, listWorkspaces } from "./service";
import type { Database } from "@ai-interview/db";
import type { ApiBindings } from "../../env";

export const workspaceRoutes = new Hono<{
  Bindings: ApiBindings;
  Variables: { database: Database; userId: string };
}>()
  .use(csrf())
  .use(async (c, next) => {
    c.header("Cache-Control", "private, no-store");
    const database = createDatabase(c.env.AUTH_DB);
    const session = await getAuth(c.env, database).api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return c.json({ error: "UNAUTHORIZED" }, 401);
    }
    c.set("database", database);
    c.set("userId", session.user.id);
    return next();
  })
  .get("/", async (c) => c.json(await listWorkspaces(c.get("database"), c.get("userId")), 200))
  .post(
    "/:workspaceId/activate",
    sValidator("param", z.object({ workspaceId: z.string().min(1).toLowerCase() })),
    async (c) => {
      const { workspaceId } = c.req.valid("param");
      const activated = await activateWorkspace(c.get("database"), c.get("userId"), workspaceId);
      if (!activated) {
        return c.json({ error: "WORKSPACE_NOT_ACCESSIBLE" }, 404);
      }
      return c.json({ workspaceId }, 200);
    },
  );
