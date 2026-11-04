import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";
import { activateWorkspace, listWorkspaces } from "./service";

export const workspaceRoutes = new Hono<AuthenticatedEnv>()
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
