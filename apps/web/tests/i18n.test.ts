import { describe, expect, it } from "vitest";

import { home_hero_tagline } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import { paraglideMiddleware } from "@/paraglide/server";

const origin = "https://sainoa.example";

describe("cookie localization", () => {
  it.each(["/", "/sign-in", "/w/demo/hub/dashboard", "/w/demo/agent/chat"])(
    "uses the language cookie without changing %s",
    async (path) => {
      const request = new Request(new URL(path, origin), {
        headers: { "Sec-Fetch-Dest": "document", cookie: "PARAGLIDE_LOCALE=ko" },
      });
      const response = await paraglideMiddleware(request, ({ request: resolved }) =>
        Response.json({ locale: getLocale(), url: resolved.url }),
      );
      expect(await response.json()).toEqual({ locale: "ko", url: request.url });
      expect(response.headers.get("vary")).toContain("Cookie");
    },
  );

  it.each(["", "PARAGLIDE_LOCALE=unknown"])("defaults to English for cookie %j", async (cookie) => {
    const request = new Request(origin, { headers: { "Accept-Language": "ja", cookie } });
    const response = await paraglideMiddleware(request, () => Response.json(getLocale()));
    expect(await response.json()).toBe("en");
  });

  it("isolates concurrent requests to the same URL", async () => {
    const locales = ["zh-CN", "en", "ja", "ko"];
    const responses = await Promise.all(
      locales.map((locale) =>
        paraglideMiddleware(
          new Request(origin, { headers: { cookie: `PARAGLIDE_LOCALE=${locale}` } }),
          () => Response.json({ locale: getLocale(), title: home_hero_tagline() }),
        ),
      ),
    );
    const values = await Promise.all(responses.map((response) => response.json()));
    expect(values.map((value) => value.locale)).toEqual(locales);
    expect(new Set(values.map((value) => value.title)).size).toBe(4);
  });

  it("passes API requests through", async () => {
    const request = new Request(`${origin}/api/health`, {
      headers: { "Sec-Fetch-Dest": "document", cookie: "PARAGLIDE_LOCALE=ja" },
    });
    const response = await paraglideMiddleware(request, ({ request: resolved }) =>
      Response.json({ url: resolved.url }),
    );
    expect(await response.json()).toEqual({ url: request.url });
  });
});
