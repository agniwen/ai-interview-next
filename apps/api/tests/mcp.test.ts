import { once } from "node:events";
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import {
  agentOperation,
  job,
  member,
  resumeProcessingAttempt,
  resumeProcessingRun,
} from "@ai-interview/db/schema";
import {
  CLIENT_CAPABILITIES_META_KEY,
  CLIENT_INFO_META_KEY,
  PROTOCOL_VERSION_META_KEY,
} from "@modelcontextprotocol/server";
import { makeSignature } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { app } from "../src/app";
import type { ApiBindings } from "../src/env";
import { getAuth } from "../src/modules/auth/auth";
import { createTestDatabase } from "./database";

const secret = randomBytes(32).toString("hex");
const protocol = "2026-07-28";
let platform: Awaited<ReturnType<typeof createTestDatabase>>;
let env: ApiBindings;
let origin: string;
const server = createServer(async (incoming, outgoing) => {
  const chunks = [];
  for await (const chunk of incoming) {
    chunks.push(chunk);
  }
  const body = chunks.length ? new Uint8Array(Buffer.concat(chunks)) : undefined;
  const request = new Request(new URL(incoming.url ?? "/", origin), {
    body,
    headers: new Headers(
      incoming.headersDistinct
        ? Object.entries(incoming.headersDistinct).flatMap(([name, values]) =>
            (values ?? []).map((value): [string, string] => [name, value]),
          )
        : undefined,
    ),
    method: incoming.method,
  });
  const response = await app.fetch(request, env, platform.ctx);
  outgoing.writeHead(response.status, Object.fromEntries(response.headers));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});

beforeAll(async () => {
  platform = await createTestDatabase();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Local MCP test server could not start");
  }
  origin = `http://127.0.0.1:${address.port}`;
  env = {
    ...platform.env,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: origin,
    GOOGLE_CLIENT_ID: "mcp-e2e.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "mcp-e2e-google-unused",
    RESUME_S3_ACCESS_KEY_ID: undefined,
    RESUME_S3_ENDPOINT: undefined,
    RESUME_S3_SECRET_ACCESS_KEY: undefined,
  };
});

afterAll(async () => {
  server.closeAllConnections();
  server.close();
  await platform.dispose();
});

async function account() {
  const auth = await getAuth(env).$context;
  const user = await auth.internalAdapter.createUser(
    { email: `${crypto.randomUUID()}@example.test`, emailVerified: true, name: "MCP test user" },
    { method: "oauth" },
  );
  const session = await auth.internalAdapter.createSession(user.id, false);
  const cookie = `${auth.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${await makeSignature(session.token, secret)}`)}`;
  const membership = await platform.database
    .select()
    .from(member)
    .where(eq(member.userId, user.id))
    .get();
  if (!membership) {
    throw new Error("Test account has no workspace");
  }
  return { cookie, userId: user.id, workspaceId: membership.organizationId };
}

function jsonRequest(
  path: string,
  body: unknown,
  cookie?: string,
  method: "POST" | "PUT" = "POST",
) {
  const url = new URL(path, origin);
  const init = {
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin,
      ...(cookie ? { cookie } : {}),
    },
  };
  return method === "PUT"
    ? fetch(url, { ...init, method: "PUT" })
    : fetch(url, { ...init, method: "POST" });
}

async function connect(actor: Awaited<ReturnType<typeof account>>, scopes: string[]) {
  const redirectUri = `${origin}/callback`;
  const resource = `${origin}/api/mcp`;
  const scope = [...scopes, "offline_access"].join(" ");
  const registration = await jsonRequest("/api/auth/oauth2/register", {
    application_type: "native",
    client_name: "Local MCP integration test",
    grant_types: ["authorization_code", "refresh_token"],
    redirect_uris: [redirectUri],
    response_types: ["code"],
    scope,
    token_endpoint_auth_method: "none",
  });
  expect(registration.status, await registration.clone().text()).toBe(201);
  const { client_id: clientId } = await registration.json();
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    client_id: clientId,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
    redirect_uri: redirectUri,
    resource,
    response_type: "code",
    scope,
    state: crypto.randomUUID(),
  });
  const authorize = await fetch(`${origin}/api/auth/oauth2/authorize?${query}`, {
    headers: { accept: "application/json", cookie: actor.cookie },
    redirect: "manual",
  });
  expect(authorize.status).toBe(200);
  const authorized = await authorize.json();
  const location = new URL(authorized.url, origin);
  expect(location.pathname).toBe("/mcp/authorize");
  const consent = await jsonRequest(
    "/api/mcp-management/consent",
    {
      accept: true,
      oauthQuery: location.search.slice(1),
      scopes,
      version: 1,
      workspaceId: actor.workspaceId,
    },
    actor.cookie,
  );
  expect(consent.status, await consent.clone().text()).toBe(200);
  const approved = await consent.json();
  const code = new URL(approved.url).searchParams.get("code");
  expect(code).toBeTruthy();
  const exchange = await fetch(`${origin}/api/auth/oauth2/token`, {
    body: new URLSearchParams({
      client_id: clientId,
      code: code ?? "",
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      resource,
    }),
    method: "POST",
  });
  expect(exchange.status, await exchange.clone().text()).toBe(200);
  const tokens = (await exchange.json()) as { access_token: string; refresh_token: string };
  return { ...tokens, clientId };
}

function callMcp(token: string, method: string, params: Record<string, unknown> = {}) {
  return fetch(`${origin}/api/mcp`, {
    body: JSON.stringify({
      id: crypto.randomUUID(),
      jsonrpc: "2.0",
      method,
      params: {
        ...params,
        _meta: {
          [CLIENT_CAPABILITIES_META_KEY]: {},
          [CLIENT_INFO_META_KEY]: { name: "mcp-e2e", version: "1" },
          [PROTOCOL_VERSION_META_KEY]: protocol,
        },
      },
    }),
    headers: {
      accept: "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "content-type": "application/json",
      "mcp-method": method,
      "mcp-protocol-version": protocol,
      ...(typeof params.name === "string" ? { "mcp-name": params.name } : {}),
    },
    method: "POST",
  });
}

async function tool(token: string, name: string, input = {}) {
  const response = await callMcp(token, "tools/call", {
    arguments: { ...input, version: 1 },
    name,
  });
  expect(response.status, await response.clone().text()).toBe(200);
  const { result } = await response.json();
  return result.structuredContent;
}

it("authorizes one workspace, enforces scopes, audits the actual changes, and revokes old tokens", async () => {
  const actor = await account();
  const external = await account();
  await platform.database.insert(member).values({
    createdAt: new Date(),
    id: crypto.randomUUID(),
    organizationId: external.workspaceId,
    role: "member",
    userId: actor.userId,
  });
  const foreignId = crypto.randomUUID();
  await platform.database.insert(job).values({
    createdAt: new Date(),
    id: foreignId,
    requirements: "Foreign",
    title: "Foreign job",
    workspaceId: external.workspaceId,
  });
  const anonymous = await callMcp("", "tools/list");
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("www-authenticate")).toContain(
    "/.well-known/oauth-protected-resource/api/mcp",
  );
  const readOnly = await connect(actor, ["jobs:read"]);
  const contextResponse = await fetch(
    `${origin}/api/mcp-management/context?${new URLSearchParams({ clientId: readOnly.clientId })}`,
    { headers: { cookie: actor.cookie } },
  );
  expect(contextResponse.status).toBe(200);
  const context = (await contextResponse.json()) as {
    tools: { name: string; scopes: string[] }[];
    version: number;
  };
  expect(context.version).toBe(1);
  expect(context.tools).toContainEqual({
    name: "list_candidate_resumes",
    scopes: ["candidates:read", "resumes:read"],
  });
  const catalogResponse = await callMcp(readOnly.access_token, "tools/list");
  const catalog = await catalogResponse.json();
  const jobTools = context.tools
    .filter(({ scopes }) => scopes.every((scope) => scope === "jobs:read"))
    .map(({ name }) => name);
  expect(jobTools).toEqual(["search_jobs", "get_job"]);
  expect(catalog.result.tools.map(({ name }: { name: string }) => name)).toEqual(jobTools);
  expect(
    await tool(readOnly.access_token, "create_job", { requirements: "Denied", title: "Denied" }),
  ).toMatchObject({ error: "FORBIDDEN" });
  expect(await tool(readOnly.access_token, "get_job", { id: foreignId })).toMatchObject({
    error: "RECORD_UNAVAILABLE",
  });

  const settingsDenied = await jsonRequest(
    `/api/mcp-management/workspaces/${external.workspaceId}`,
    { enabled: false, version: 1 },
    actor.cookie,
    "PUT",
  );
  expect(settingsDenied.status).toBe(403);

  const writable = await connect(actor, ["jobs:read", "jobs:write"]);
  const { id } = await tool(writable.access_token, "create_job", {
    requirements: "TypeScript",
    title: "Before",
  });
  await tool(writable.access_token, "update_job", { changes: { title: "After" }, id });
  await tool(writable.access_token, "update_job", { changes: { title: "After" }, id });
  expect(await tool(writable.access_token, "get_job", { id })).toMatchObject({
    requirements: "TypeScript",
    title: "After",
  });
  const audits = await platform.database
    .select()
    .from(agentOperation)
    .where(eq(agentOperation.workspaceId, actor.workspaceId));
  expect(audits).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "write", outcome: "denied", tool: "create_job" }),
      expect.objectContaining({
        changedAt: expect.any(Date),
        detail: { changes: { title: { after: "After", before: "Before" } }, id, version: 1 },
        source: "remote_mcp",
        tool: "update_job",
        userId: actor.userId,
      }),
      expect.objectContaining({
        changedAt: null,
        detail: { changes: {}, id, version: 1 },
        tool: "update_job",
      }),
      expect.objectContaining({ kind: "read", outcome: "succeeded", tool: "get_job" }),
    ]),
  );

  const path = `/api/mcp-management/workspaces/${actor.workspaceId}`;
  const disabled = await jsonRequest(path, { enabled: false, version: 1 }, actor.cookie, "PUT");
  expect(disabled.status).toBe(200);
  const enabled = await jsonRequest(path, { enabled: true, version: 1 }, actor.cookie, "PUT");
  expect(enabled.status).toBe(200);
  const revoked = await callMcp(writable.access_token, "tools/list");
  expect(revoked.status).toBe(401);
  const refresh = await fetch(`${origin}/api/auth/oauth2/token`, {
    body: new URLSearchParams({
      client_id: writable.clientId,
      grant_type: "refresh_token",
      refresh_token: writable.refresh_token,
      resource: `${origin}/api/mcp`,
    }),
    method: "POST",
  });
  expect(refresh.ok).toBe(false);

  expect(
    await platform.database
      .select()
      .from(agentOperation)
      .where(eq(agentOperation.workspaceId, actor.workspaceId)),
  ).toHaveLength(audits.length);
});

it("imports an externally parsed PDF through local storage without model stages", async () => {
  const actor = await account();
  const { access_token: token } = await connect(actor, [
    "candidates:read",
    "candidates:write",
    "resumes:read",
    "resumes:write",
  ]);
  const profile = { identity: { name: "PDF candidate" }, version: 1 };
  const pdf = new TextEncoder().encode("%PDF-1.4\n%%EOF\n");
  const prepared = await tool(token, "prepare_resume_upload", {
    filename: "resume.pdf",
    size: pdf.length,
  });
  const [upload] = prepared.uploads;
  const uploaded = await fetch(upload.url, {
    body: pdf,
    headers: { "content-type": "application/pdf" },
    method: "PUT",
  });
  expect(uploaded.status).toBe(204);
  const imported = await tool(token, "import_resume", { profile, uploadId: upload.id });
  expect(imported).toMatchObject({
    candidateId: expect.any(String),
    identityStatus: "resolved",
    resumeId: expect.any(String),
  });
  expect(await tool(token, "get_resume", { id: upload.id })).toMatchObject({
    profile,
    resumeId: imported.resumeId,
  });
  expect(await tool(token, "list_candidate_resumes", { id: imported.candidateId })).toMatchObject({
    rows: [{ id: imported.resumeId }],
  });
  expect(
    await platform.database
      .select()
      .from(resumeProcessingAttempt)
      .innerJoin(resumeProcessingRun, eq(resumeProcessingAttempt.runId, resumeProcessingRun.id))
      .where(eq(resumeProcessingRun.workspaceId, actor.workspaceId)),
  ).toHaveLength(0);
  const original = await fetch(`${origin}/api/ats/${actor.workspaceId}/upload-files/${upload.id}`, {
    headers: { cookie: actor.cookie },
  });
  expect(new Uint8Array(await original.arrayBuffer())).toEqual(pdf);
});

it("keeps data and audit atomic when the audit write fails", async () => {
  const actor = await account();
  const { access_token: token } = await connect(actor, ["jobs:read", "jobs:write"]);
  const { id } = await tool(token, "create_job", { requirements: "TypeScript", title: "Original" });
  await platform.env.AUTH_DB.prepare(
    `CREATE TRIGGER reject_mcp_audit BEFORE INSERT ON agent_operation WHEN NEW.workspaceId = '${actor.workspaceId}' BEGIN SELECT RAISE(ABORT, 'audit test failure'); END`,
  ).run();
  try {
    const edit = await callMcp(token, "tools/call", {
      arguments: { changes: { title: "Failed" }, id, version: 1 },
      name: "update_job",
    });
    const lookup = await callMcp(token, "tools/call", {
      arguments: { id, version: 1 },
      name: "get_job",
    });
    const outcomes = await Promise.all([edit.json(), lookup.json()]);
    for (const outcome of outcomes) {
      expect(outcome.error || outcome.result?.isError).toBeTruthy();
    }
    expect(await platform.database.select().from(job).where(eq(job.id, id)).get()).toMatchObject({
      title: "Original",
    });
  } finally {
    await platform.env.AUTH_DB.prepare("DROP TRIGGER reject_mcp_audit").run();
  }
});
