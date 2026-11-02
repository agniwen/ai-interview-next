import { describe, expect, it } from "vitest";

import { getComposerQuery } from "@/lib/composer-query";

describe("getComposerQuery", () => {
  it("completes the mention at the caret without consuming following prose", () => {
    expect(getComposerQuery("Hello @alice how are you", 9, ["@"])).toEqual({
      character: "@",
      end: 12,
      start: 6,
      text: "alice",
    });
  });

  it("does not treat an email address as a mention", () => {
    expect(getComposerQuery("alice@example.com", 17, ["@"])).toBeNull();
  });

  it("uses the most recent trigger", () => {
    expect(getComposerQuery("@alice /search", 14, ["@", "/"])).toEqual({
      character: "/",
      end: 14,
      start: 7,
      text: "search",
    });
  });
});
