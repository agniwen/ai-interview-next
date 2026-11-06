import { createRequestHandler } from "@tanstack/react-router/ssr/server";
import { describe, expect, it, vi } from "vitest";
import { loginSearch } from "@/lib/workspaces/client";
import type { getWorkspaceSession } from "@/lib/workspaces/session.functions";
import { workspaceSessionQueryOptions } from "@/lib/workspaces/session-query";
import { getRouter } from "@/router";

vi.mock("cloudflare:workers", () => ({ env: {} }));

function requestWithSession(
  path: string,
  session: Awaited<ReturnType<typeof getWorkspaceSession>>,
) {
  const router = getRouter();
  router.options.context.queryClient.setQueryData(
    workspaceSessionQueryOptions.queryKey,
    () => session,
  );
  return createRequestHandler({
    createRouter: () => router,
    request: new Request(new URL(path, "http://localhost")),
  })(() => new Response());
}

describe("workspace login destinations", () => {
  it.each([
    "/account",
    "/w/example/agent",
    "/w/example/settings",
    "/invite/example",
    "/workspaces?choose=true",
  ])("preserves the explicit destination %s", (next) => {
    expect(loginSearch.parse({ next }).next).toBe(next);
  });

  it.each(["https://untrusted.example", "//untrusted.example", "/sign-in"])(
    "does not accept %s as a login destination",
    (next) => {
      expect(loginSearch.parse({ next }).next).toBeUndefined();
    },
  );

  it("allows a normal login without an explicit workspace", () => {
    expect(loginSearch.parse({}).next).toBeUndefined();
  });
});

describe("homepage workspace destinations", () => {
  const workspaces = [
    { id: "first", name: "First workspace", role: "owner" },
    { id: "recent", name: "Recent workspace", role: "member" },
  ];

  it.each([
    ["agent", "recent", "/w/recent/agent"],
    ["hub", "recent", "/w/recent/hub/dashboard"],
    ["hub", null, "/w/first/hub/dashboard"],
  ])("opens %s directly for a signed-in user", async (destination, lastWorkspaceId, expected) => {
    const response = await requestWithSession(`/workspaces?destination=${destination}`, {
      lastWorkspaceId,
      workspaces,
    });
    expect(response.headers.get("Location")).toBe(expected);
  });

  it("preserves the homepage destination when sign-in is required", async () => {
    const next = "/workspaces?destination=hub";
    const response = await requestWithSession(next, null);
    const signIn = new URL(response.headers.get("Location") ?? "", "http://localhost");
    expect(signIn.pathname).toBe("/sign-in");
    expect(loginSearch.parse({ next: signIn.searchParams.get("next") }).next).toBe(next);
  });
});
