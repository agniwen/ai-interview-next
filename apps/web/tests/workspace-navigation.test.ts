import { describe, expect, it } from "vitest";
import { loginSearch } from "@/lib/workspaces/client";

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
