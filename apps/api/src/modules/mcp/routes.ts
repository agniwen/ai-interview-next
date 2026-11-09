import { createDatabase } from "@ai-interview/db";
import { requireMcpAuth } from "@better-auth/mcp";
import { createResourceServerChallenge } from "@better-auth/oauth-provider";
import type { Tool } from "@modelcontextprotocol/server";
import { createMcpHandler, Server } from "@modelcontextprotocol/server";
import { APIError } from "better-auth/api";
import { Hono } from "hono";
import { z } from "zod";
import type { ApiBindings } from "../../env";
import { getAuth } from "../auth/auth";
import { activeGrant, mcpResource, mcpScopes } from "./access";
import { businessTools, recruitingInstructions, toolContent } from "./tools";
import type { ToolContext } from "./tools";

const claims = z.object({
  azp: z.string(),
  mcp_grant_id: z.string(),
  scope: z.string(),
  sub: z.string(),
});

function createBusinessServer(context: ToolContext) {
  const server = new Server(
    { name: "sainoa", version: "1.0.0" },
    { capabilities: { tools: {} }, instructions: recruitingInstructions },
  );
  server.setRequestHandler("tools/list", () => ({
    tools: businessTools
      .filter((tool) => tool.available(context))
      .map(({ description, inputSchema, kind, name }) => ({
        annotations: { destructiveHint: false, readOnlyHint: kind === "read" },
        description,
        inputSchema: inputSchema as Tool["inputSchema"],
        name,
      })),
  }));
  server.setRequestHandler("tools/call", async ({ params }) => {
    const tool = businessTools.find(({ name }) => name === params.name);
    if (!tool) {
      return { content: toolContent({ error: "TOOL_UNAVAILABLE", version: 1 }), isError: true };
    }
    const result = await tool.call(context, params.arguments ?? {});
    return server.projectCallToolResult(
      { content: toolContent(result), isError: "error" in result, structuredContent: result },
      undefined,
    );
  });
  return server;
}

export const remoteMcpRoutes = new Hono<{ Bindings: ApiBindings }>().all("/", async (c) => {
  const resource = mcpResource(c.env.BETTER_AUTH_URL);
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(resource).origin) {
    return c.json({ error: "INVALID_ORIGIN", version: 1 as const }, 403);
  }
  const db = createDatabase(c.env.AUTH_DB);
  const response = await requireMcpAuth(
    getAuth(c.env, db),
    async (request, payload) => {
      const verified = claims.safeParse(payload);
      const grant =
        verified.success && (await activeGrant(db, verified.data.mcp_grant_id, verified.data.sub));
      if (!verified.success || !grant || grant.clientId !== verified.data.azp) {
        const challenge = createResourceServerChallenge(new APIError("UNAUTHORIZED"), resource, {
          challengeScopes: [...mcpScopes],
        });
        return Response.json(
          { error: "AUTHORIZATION_REVOKED", version: 1 },
          { headers: challenge?.headers, status: 401 },
        );
      }
      const tokenScopes = new Set(verified.data.scope.split(" "));
      const context: ToolContext = {
        actor: {
          clientId: grant.clientId,
          grantId: verified.data.mcp_grant_id,
          source: "remote_mcp",
          userId: verified.data.sub,
          workspaceId: grant.workspaceId,
        },
        db,
        env: c.env,
        scopes: new Set(grant.scopes.values.filter((scope) => tokenScopes.has(scope))),
      };
      return createMcpHandler(() => createBusinessServer(context), { legacy: "reject" }).fetch(
        request,
      );
    },
    { challengeScopes: [...mcpScopes], resource },
  )(c.req.raw);
  const result = new Response(response.body, response);
  result.headers.set("Cache-Control", "private, no-store");
  return result;
});
