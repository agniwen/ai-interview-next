import { describe, expect, it } from "vitest";

import { home_hero_tagline } from "@/paraglide/messages";
import { deLocalizeUrl, getLocale, localizeUrl } from "@/paraglide/runtime";
import { paraglideMiddleware } from "@/paraglide/server";

const origin = "https://sainoa.example";

describe("global URL localization", () => {
  it.each([
    ["en", "/"],
    ["zh-CN", "/zh-CN"],
    ["ja", "/ja"],
    ["ko", "/ko"],
  ] as const)("uses the canonical homepage for %s", (locale, path) => {
    expect(localizeUrl(`${origin}/`, { locale }).pathname).toBe(path);
  });

  it("localizes nested pages and preserves query parameters and fragments", () => {
    const original = new URL("/interviews/123?view=report#answers", origin);
    const localized = localizeUrl(original, { locale: "ja" });
    expect(localized.href).toBe(`${origin}/ja/interviews/123?view=report#answers`);
    expect(deLocalizeUrl(localized).href).toBe(original.href);
    expect(localizeUrl(localized, { locale: "en" }).href).toBe(original.href);
  });

  it("uses English for unprefixed requests regardless of cookies or browser language", async () => {
    const request = new Request(`${origin}/`, {
      headers: { "Accept-Language": "ja", Cookie: "PARAGLIDE_LOCALE=ko; ARC_LOCALE=zh-CN" },
    });
    const response = await paraglideMiddleware(request, () =>
      Response.json({ locale: getLocale() }),
    );
    expect(await response.json()).toEqual({ locale: "en" });
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("isolates translations between concurrent server requests", async () => {
    const paths = ["/zh-CN", "/", "/ja", "/ko"];
    const responses = await Promise.all(
      paths.map((path) =>
        paraglideMiddleware(new Request(new URL(path, origin)), async () => {
          await Promise.resolve();
          return Response.json({ locale: getLocale(), title: home_hero_tagline() });
        }),
      ),
    );
    const values = await Promise.all(responses.map((response) => response.json()));
    expect(values.map((value) => value.locale)).toEqual(["zh-CN", "en", "ja", "ko"]);
    expect(values[0].title).toBe("你的新一代招聘智能体");
    expect(values[1].title).toBe("Your next recruiting agent");
    expect(new Set(values.map((value) => value.title)).size).toBe(4);
  });

  it("passes API requests through without locale redirects", async () => {
    const request = new Request(`${origin}/api/health`, {
      headers: { "Accept-Language": "ja", "Sec-Fetch-Dest": "document" },
    });
    const response = await paraglideMiddleware(request, ({ request: resolved }) =>
      Response.json({ url: resolved.url }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: `${origin}/api/health` });
  });
});
