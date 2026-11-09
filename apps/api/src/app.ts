import { sValidator } from "@hono/standard-validator";
import { csrf } from "hono/csrf";
import { requireSession } from "./middleware/authenticated";
import type { AuthenticatedEnv } from "./middleware/authenticated";
import { Hono } from "hono";
import { z } from "zod";
import { atsRoutes } from "./modules/ats/routes";
import { agentRoutes } from "./modules/agent/routes";
import { authRoutes } from "./modules/auth/routes";
import { getAuth } from "./modules/auth/auth";
import { mcpManagement } from "./modules/mcp/management";
import { mcpFileRoutes } from "./modules/mcp/upload";
import { remoteMcpRoutes } from "./modules/mcp/routes";
import { interviewerAgentRoutes } from "./modules/interviewer-agents/routes";
import { interviewRoutes } from "./modules/interviews/routes";
import { interviewSessionRoutes } from "./modules/interview-sessions/routes";
import { candidateInterviewRoutes } from "./modules/candidate-interviews/routes";
import { questionSetRoutes } from "./modules/question-sets/routes";
import { workspaceRoutes } from "./modules/workspaces/routes";
import type { ApiBindings } from "./env";

const protectedApi = new Hono<AuthenticatedEnv>()
  .use(csrf())
  .use(requireSession)
  .route("/agent", agentRoutes)
  .route("/ats", atsRoutes)
  .route("/interviewer-agents", interviewerAgentRoutes)
  .route("/question-sets", questionSetRoutes)
  .route("/interviews", interviewRoutes)
  .route("/workspaces", workspaceRoutes)
  .route("/mcp-management", mcpManagement);

export const app = new Hono<{ Bindings: ApiBindings }>()
  .on(["GET", "HEAD"], "/.well-known/*", (c) => getAuth(c.env).handler(c.req.raw))
  .route("/api/auth", authRoutes)
  .route("/api/mcp", remoteMcpRoutes)
  .route("/api/mcp-files", mcpFileRoutes)
  .route("/api/candidate-interviews", candidateInterviewRoutes)
  .route("/api/interview-sessions", interviewSessionRoutes)
  .route("/api", protectedApi)
  .get("/health", sValidator("query", z.strictObject({}).optional()), (c) =>
    c.json({ status: "ok" as const }, 200),
  );
