import { AsyncLocalStorage } from "node:async_hooks";
import type { Database } from "@ai-interview/db";
import { mcpGrant, member, organization, oauthClient } from "@ai-interview/db/schema";
import { and, eq, isNull } from "drizzle-orm";

export const mcpScopes = [
  "jobs:read",
  "jobs:write",
  "organization:read",
  "organization:write",
  "applications:read",
  "applications:write",
  "resumes:read",
  "resumes:write",
  "candidates:read",
  "candidates:write",
] as const;
export type McpScope = (typeof mcpScopes)[number];

export const authorization = new AsyncLocalStorage<{ grantId: string; userId: string }>();

export function mcpResource(baseURL: string) {
  return new URL("/api/mcp", baseURL).href;
}

export function workspaceMembership(db: Database, userId: string, workspaceId: string) {
  return db
    .select({ mcpEnabled: organization.mcpEnabled, role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(and(eq(member.userId, userId), eq(member.organizationId, workspaceId)))
    .get();
}

export function activeGrant(db: Database, id: string, userId: string) {
  return db
    .select({
      clientId: mcpGrant.clientId,
      scopes: mcpGrant.scopes,
      workspaceId: mcpGrant.workspaceId,
    })
    .from(mcpGrant)
    .innerJoin(organization, eq(organization.id, mcpGrant.workspaceId))
    .innerJoin(
      member,
      and(eq(member.organizationId, mcpGrant.workspaceId), eq(member.userId, userId)),
    )
    .innerJoin(oauthClient, eq(oauthClient.clientId, mcpGrant.clientId))
    .where(
      and(
        eq(mcpGrant.id, id),
        eq(mcpGrant.userId, userId),
        isNull(mcpGrant.revokedAt),
        eq(organization.mcpEnabled, true),
        eq(oauthClient.disabled, false),
      ),
    )
    .get();
}
