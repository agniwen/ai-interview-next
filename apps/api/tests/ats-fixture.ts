import { randomBytes } from "node:crypto";
import { makeSignature } from "better-auth/crypto";
import { afterAll, beforeAll } from "vitest";
import { app } from "../src/app";
import type { ApiBindings } from "../src/env";
import { getAuth } from "../src/modules/auth/auth";
import { createTestDatabase } from "./database";

const origin = "https://sainoa.example";
const secret = randomBytes(32).toString("hex");
let platform: Awaited<ReturnType<typeof createTestDatabase>>;
let env: ApiBindings;

beforeAll(async () => {
  platform = await createTestDatabase();
  env = {
    ...platform.env,
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: origin,
    GOOGLE_CLIENT_ID: "test.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "test-secret",
  };
});

afterAll(() => platform.dispose());

export async function read(request: Promise<Response> | Response) {
  const response = await request;
  return response.json();
}

export async function account(email: string) {
  const context = await getAuth(env).$context;
  const user = await context.internalAdapter.createUser(
    { email, emailVerified: true, name: email },
    { method: "oauth" },
  );
  const session = await context.internalAdapter.createSession(user.id, false);
  const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(`${session.token}.${await makeSignature(session.token, secret)}`)}`;
  const request = (path: string, init: RequestInit) => {
    const headers = new Headers(init.headers);
    headers.set("cookie", cookie);
    headers.set("origin", origin);
    return app.request(new URL(path, `${origin}/api/`), { ...init, headers }, env, platform.ctx);
  };
  const call = (path: string, body?: object) =>
    request(path, {
      body: body ? JSON.stringify(body) : undefined,
      headers: { "content-type": "application/json" },
      method: body ? "POST" : "GET",
    });
  const { lastWorkspaceId: workspaceId } = await read(call("workspaces"));
  const ats = (path: string, body?: object) => call(`ats/${workspaceId}/${path}`, body);
  return { ats, call, request, userId: user.id, workspaceId };
}

export const atsTest = {
  get env() {
    return env;
  },
  get platform() {
    return platform;
  },
};
