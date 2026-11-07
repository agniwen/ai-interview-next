import { sValidator } from "@hono/standard-validator";
import { csrf } from "hono/csrf";
import { requireSession } from "./middleware/authenticated";
import type { AuthenticatedEnv } from "./middleware/authenticated";
import { Hono } from "hono";
import { z } from "zod";
import { atsRoutes } from "./modules/ats/routes";
import { agentRoutes } from "./modules/agent/routes";
import { authRoutes } from "./modules/auth/routes";
import { interviewerAgentRoutes } from "./modules/interviewer-agents/routes";
import { workspaceRoutes } from "./modules/workspaces/routes";
import type { ApiBindings } from "./env";

const protectedApi = new Hono<AuthenticatedEnv>()
  .use(csrf())
  .use(requireSession)
  .route("/agent", agentRoutes)
  .route("/ats", atsRoutes)
  .route("/interviewer-agents", interviewerAgentRoutes)
  .route("/workspaces", workspaceRoutes);

export const app = new Hono<{ Bindings: ApiBindings }>()
  .route("/api/auth", authRoutes)
  .route("/api", protectedApi)
  .get("/health", sValidator("query", z.strictObject({}).optional()), (c) =>
    c.json({ status: "ok" as const }, 200),
  );
