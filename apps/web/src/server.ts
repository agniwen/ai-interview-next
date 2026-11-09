import handler from "@tanstack/react-start/server-entry";
import { env } from "cloudflare:workers";

import { localizedAssetPath, publicPages } from "./lib/localized-pages";
import { cookieMaxAge, cookieName, isLocale } from "./paraglide/runtime";
import { paraglideMiddleware } from "./paraglide/server";

function renderPage(request: Request) {
  return paraglideMiddleware(request, ({ request: resolved }) => handler.fetch(resolved));
}

export default {
  fetch(request: Request) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/u, "") || "/";
    const [, prefix, ...segments] = path.split("/");
    if (prefix === ".well-known" && path.startsWith("/.well-known/oauth-")) {
      return env.API.fetch(request);
    }
    if (isLocale(prefix)) {
      url.pathname = `/${segments.join("/")}`;
      return new Response(null, {
        headers: {
          "Cache-Control": "private, no-store",
          Location: url.href,
          "Set-Cookie": `${cookieName}=${prefix}; Path=/; Max-Age=${cookieMaxAge}; SameSite=Lax`,
        },
        status: 302,
      });
    }

    if (prefix === "_localized") {
      const [locale] = segments;
      const page = publicPages.find((item) => localizedAssetPath(item, locale) === path);
      if (!page || request.headers.get("x-sainoa-prerender") !== "1") {
        return new Response(null, { status: 404 });
      }
      // 静态文件按语言分开存储，渲染时使用浏览器实际访问的路由。
      // Render each language asset at the public route the browser will hydrate.
      url.pathname = page;
      return renderPage(new Request(url, request));
    }

    const page = publicPages.find((item) => item === path);
    if (!import.meta.env.DEV && page && (request.method === "GET" || request.method === "HEAD")) {
      return paraglideMiddleware(request, async ({ locale }) => {
        const asset = new URL(localizedAssetPath(page, locale), url.origin);
        const result = await env.ASSETS.fetch(asset.href, { method: request.method });
        const response = new Response(result.body, result);
        response.headers.set("Cache-Control", "private, no-cache");
        return response;
      });
    }
    return renderPage(request);
  },
};
