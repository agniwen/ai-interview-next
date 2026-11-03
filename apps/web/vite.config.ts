import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

import { paraglideCompilerOptions } from "./paraglide.config.ts";

const config = defineConfig({
  plugins: [
    devtools(),
    paraglideVitePlugin(paraglideCompilerOptions),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      pages: paraglideCompilerOptions.urlPatterns[0].localized.flatMap(([, path]) => [
        { path },
        { path: path === "/" ? "/sign-in" : `${path}/sign-in` },
      ]),
      prerender: {
        autoStaticPathsDiscovery: false,
        // 输出 .html，使 Cloudflare 保持现有的不带尾斜杠的语言路由。
        // Emit .html files so Cloudflare preserves the existing slashless locale URLs.
        autoSubfolderIndex: false,
        crawlLinks: false,
        enabled: true,
        failOnError: true,
      },
    }),
    viteReact(),
  ],
  resolve: { dedupe: ["react", "react-dom"], tsconfigPaths: true },
});

export default config;
