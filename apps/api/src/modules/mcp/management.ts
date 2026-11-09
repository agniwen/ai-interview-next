import {
  mcpGrant,
  member,
  oauthClient,
  oauthRefreshToken,
  organization,
} from "@ai-interview/db/schema";
import { sValidator } from "@hono/standard-validator";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthenticatedEnv } from "../../middleware/authenticated";
import { requireWorkspace } from "../../middleware/workspace";
import { getAuth } from "../auth/auth";
import { authorization, mcpScopes, workspaceMembership } from "./access";

const scope = z.enum(mcpScopes);
const consentInput = z.strictObject({
  accept: z.boolean(),
  oauthQuery: z.string().min(1).max(16_000),
  scopes: z.array(scope).max(mcpScopes.length).optional(),
  version: z.literal(1),
  workspaceId: z.string().min(1).optional(),
});
const consentResponse = z.object({ url: z.url() });

export const mcpManagement = new Hono<AuthenticatedEnv>()
  .get(
    "/context",
    sValidator("query", z.object({ clientId: z.string().min(1).max(2048) })),
    async (c) => {
      const db = c.get("database");
      const client = await db
        .select({ name: oauthClient.name })
        .from(oauthClient)
        .where(
          and(
            eq(oauthClient.clientId, c.req.valid("query").clientId),
            eq(oauthClient.disabled, false),
          ),
        )
        .get();
      if (!client) {
        return c.json({ error: "CLIENT_UNAVAILABLE", version: 1 as const }, 404);
      }
      const workspaces = await db
        .select({ id: organization.id, name: organization.name })
        .from(member)
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(and(eq(member.userId, c.get("userId")), eq(organization.mcpEnabled, true)))
        .orderBy(asc(organization.name), asc(organization.id));
      return c.json({ client, scopes: mcpScopes, version: 1 as const, workspaces }, 200);
    },
  )
  .post("/consent", sValidator("json", consentInput), async (c) => {
    const input = c.req.valid("json");
    const db = c.get("database");
    const userId = c.get("userId");
    const auth = getAuth(c.env, db);
    const headers = new Headers(c.req.raw.headers);
    headers.set("accept", "application/json");
    headers.delete("content-length");
    const submit = (selected?: string) =>
      auth.handler(
        new Request(new URL("/api/auth/oauth2/consent", c.env.BETTER_AUTH_URL), {
          body: JSON.stringify({
            accept: input.accept,
            oauth_query: input.oauthQuery,
            scope: selected,
          }),
          headers,
          method: "POST",
        }),
      );
    if (!input.accept) {
      const response = await submit();
      if (!response.ok) {
        return c.json({ error: "INVALID_AUTHORIZATION", version: 1 as const }, 400);
      }
      return c.json({ ...consentResponse.parse(await response.json()), version: 1 as const }, 200);
    }

    const query = new URLSearchParams(input.oauthQuery);
    const clientId = query.get("client_id");
    const requested = new Set(query.get("scope")?.split(" "));
    const scopes = [...new Set(input.scopes)];
    if (
      !clientId ||
      !input.workspaceId ||
      !scopes.length ||
      !scopes.every((item) => requested.has(item))
    ) {
      return c.json({ error: "INVALID_AUTHORIZATION", version: 1 as const }, 400);
    }
    const { workspaceId } = input;
    const [membership, client] = await Promise.all([
      workspaceMembership(db, userId, workspaceId),
      db
        .select({ id: oauthClient.id })
        .from(oauthClient)
        .where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.disabled, false)))
        .get(),
    ]);
    if (!membership?.mcpEnabled || !client) {
      return c.json({ error: "WORKSPACE_NOT_ACCESSIBLE", version: 1 as const }, 403);
    }

    const grantId = crypto.randomUUID();
    await db.insert(mcpGrant).values({
      clientId,
      createdAt: new Date(),
      id: grantId,
      scopes: { values: scopes, version: 1 },
      userId,
      workspaceId,
    });
    const authorizedScopes = requested.has("offline_access")
      ? [...scopes, "offline_access"]
      : scopes;
    let redirect: string | undefined;
    try {
      const response = await authorization.run({ grantId, userId }, () =>
        submit(authorizedScopes.join(" ")),
      );
      if (response.ok) {
        const result = consentResponse.safeParse(await response.json());
        if (result.success && new URL(result.data.url).searchParams.has("code")) {
          redirect = result.data.url;
        }
      }
    } finally {
      if (!redirect) {
        await db.update(mcpGrant).set({ revokedAt: new Date() }).where(eq(mcpGrant.id, grantId));
      }
    }
    return redirect
      ? c.json({ url: redirect, version: 1 as const }, 200)
      : c.json({ error: "INVALID_AUTHORIZATION", version: 1 as const }, 400);
  })
  .use("/workspaces/:workspaceId", requireWorkspace)
  .use("/workspaces/:workspaceId/*", requireWorkspace)
  .get("/workspaces/:workspaceId/grants", async (c) => {
    const grants = await c
      .get("database")
      .select({
        clientName: oauthClient.name,
        createdAt: mcpGrant.createdAt,
        id: mcpGrant.id,
        scopes: mcpGrant.scopes,
      })
      .from(mcpGrant)
      .innerJoin(oauthClient, eq(oauthClient.clientId, mcpGrant.clientId))
      .where(
        and(
          eq(mcpGrant.workspaceId, c.get("workspaceId")),
          eq(mcpGrant.userId, c.get("userId")),
          isNull(mcpGrant.revokedAt),
        ),
      );
    return c.json({ grants, version: 1 as const }, 200);
  })
  .delete("/workspaces/:workspaceId/grants/:id", async (c) => {
    const db = c.get("database");
    const id = c.req.param("id");
    const userId = c.get("userId");
    const revoked = new Date();
    const owned = and(
      eq(mcpGrant.id, id),
      eq(mcpGrant.userId, userId),
      eq(mcpGrant.workspaceId, c.get("workspaceId")),
    );
    const [, [grant]] = await db.batch([
      db
        .update(oauthRefreshToken)
        .set({ revoked, rotationReplayExpiresAt: null, rotationReplayResponse: null })
        .where(
          inArray(
            oauthRefreshToken.referenceId,
            db.select({ id: mcpGrant.id }).from(mcpGrant).where(owned),
          ),
        ),
      db
        .update(mcpGrant)
        .set({ revokedAt: revoked })
        .where(and(owned, isNull(mcpGrant.revokedAt)))
        .returning({ id: mcpGrant.id }),
    ]);
    return grant
      ? c.json({ version: 1 as const }, 200)
      : c.json({ error: "GRANT_UNAVAILABLE", version: 1 as const }, 404);
  })
  .get("/workspaces/:workspaceId", async (c) => {
    const membership = await workspaceMembership(
      c.get("database"),
      c.get("userId"),
      c.get("workspaceId"),
    );
    return c.json({ enabled: membership?.mcpEnabled ?? false, version: 1 as const }, 200);
  })
  .put(
    "/workspaces/:workspaceId",
    sValidator("json", z.strictObject({ enabled: z.boolean(), version: z.literal(1) })),
    async (c) => {
      const db = c.get("database");
      const workspaceId = c.get("workspaceId");
      const membership = await workspaceMembership(db, c.get("userId"), workspaceId);
      if (membership?.role !== "owner" && membership?.role !== "admin") {
        return c.json({ error: "FORBIDDEN", version: 1 as const }, 403);
      }
      const { enabled } = c.req.valid("json");
      const change = db
        .update(organization)
        .set({ mcpEnabled: enabled })
        .where(eq(organization.id, workspaceId));
      if (enabled) {
        await change;
      } else {
        const revoked = new Date();
        const active = and(eq(mcpGrant.workspaceId, workspaceId), isNull(mcpGrant.revokedAt));
        await db.batch([
          change,
          db
            .update(oauthRefreshToken)
            .set({ revoked, rotationReplayExpiresAt: null, rotationReplayResponse: null })
            .where(
              inArray(
                oauthRefreshToken.referenceId,
                db.select({ id: mcpGrant.id }).from(mcpGrant).where(active),
              ),
            ),
          db.update(mcpGrant).set({ revokedAt: revoked }).where(active),
        ]);
      }
      return c.json({ enabled, version: 1 as const }, 200);
    },
  );
