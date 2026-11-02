import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeSignature } from "better-auth/crypto";
import { betterAuth } from "better-auth";
import { authOptions } from "@/lib/auth/options";

const origin = "https://sainoa.example";
const secret = randomBytes(32).toString("hex");
let database: DatabaseSync;
let auth: ReturnType<typeof createTestAuth>;

function createTestAuth(testDatabase: DatabaseSync) {
  return betterAuth({
    ...authOptions({
      baseURL: origin,
      googleClientId: "test.apps.googleusercontent.com",
      googleClientSecret: "test-google-secret",
      secret,
    }),
    // Better Auth disables origin checks in test mode; exercise production behavior.
    advanced: { disableCSRFCheck: false, disableOriginCheck: false },
    database: testDatabase,
  });
}

beforeEach(() => {
  database = new DatabaseSync(":memory:");
  database.exec(readFileSync(new URL("../migrations/0001_auth.sql", import.meta.url), "utf-8"));
  auth = createTestAuth(database);
});

afterEach(() => {
  database.close();
});

function signIn(callbackURL: string, requestOrigin = origin) {
  return auth.handler(
    new Request(`${origin}/api/auth/sign-in/social`, {
      body: JSON.stringify({
        callbackURL,
        errorCallbackURL: `${origin}/zh-CN/login`,
        provider: "google",
      }),
      headers: {
        "content-type": "application/json",
        cookie: "better-auth.session_token=existing-session",
        origin: requestOrigin,
        "sec-fetch-mode": "cors",
        "sec-fetch-site": requestOrigin === origin ? "same-origin" : "cross-site",
      },
      method: "POST",
    }),
  );
}

describe("Google authentication", () => {
  it("starts Google OAuth with a fixed API callback and localized return URL", async () => {
    const response = await signIn(`${origin}/zh-CN/login`);
    expect(response.status).toBe(200);
    const { url } = await response.json();
    const google = new URL(url);
    expect(google.hostname).toBe("accounts.google.com");
    expect(google.searchParams.get("client_id")).toBe("test.apps.googleusercontent.com");
    expect(google.searchParams.get("redirect_uri")).toBe(`${origin}/api/auth/callback/google`);
    expect(google.searchParams.get("state")).toBeTruthy();
    expect(google.searchParams.get("code_challenge")).toBeTruthy();
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects external callback URLs", async () => {
    const response = await signIn("https://untrusted.example/callback");
    expect(response.status).toBe(403);
  });

  it("rejects cookie-bearing requests from untrusted origins", async () => {
    const response = await signIn(`${origin}/login`, "https://untrusted.example");
    expect(response.status).toBe(403);
  });

  it("returns no session for an anonymous request", async () => {
    const response = await auth.handler(new Request(`${origin}/api/auth/get-session`));
    expect(response.status).toBe(200);
    expect(await response.json()).toBeNull();
  });

  it("reads a persisted session and invalidates it on sign-out", async () => {
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser(
      {
        email: "test@example.com",
        emailVerified: true,
        name: "Test User",
      },
      { method: "oauth" },
    );
    const session = await context.internalAdapter.createSession(user.id, false);
    const signedToken = `${session.token}.${await makeSignature(session.token, secret)}`;
    const cookie = `${context.authCookies.sessionToken.name}=${encodeURIComponent(signedToken)}`;
    const response = await auth.handler(
      new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.user.id).toBe(user.id);

    const logout = await auth.handler(
      new Request(`${origin}/api/auth/sign-out`, { headers: { cookie, origin }, method: "POST" }),
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
    const afterLogout = await auth.handler(
      new Request(`${origin}/api/auth/get-session`, { headers: { cookie } }),
    );
    expect(await afterLogout.json()).toBeNull();
  });

  it("does not create a session for a forged OAuth callback", async () => {
    const response = await auth.handler(
      new Request(`${origin}/api/auth/callback/google?code=invalid&state=forged`),
    );
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("error=");
    expect(database.prepare('select count(*) as count from "session"').get()).toMatchObject({
      count: 0,
    });
  });
});
