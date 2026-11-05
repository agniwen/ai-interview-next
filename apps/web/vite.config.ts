import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";

import { tanstackStart } from "@tanstack/react-start/plugin/vite";

import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

import languageSettings from "./project.inlang/settings.json";
import { localizedAssetPath, publicPages } from "./src/lib/localized-pages";
import { paraglideCompilerOptions } from "./paraglide.config.ts";

const config = defineConfig({
  plugins: [
    devtools(),
    paraglideVitePlugin(paraglideCompilerOptions),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    tanstackStart({
      pages: languageSettings.locales.flatMap((locale) =>
        publicPages.map((path) => ({
          path: localizedAssetPath(path, locale),
          prerender: {
            headers: { cookie: `PARAGLIDE_LOCALE=${locale}`, "x-sainoa-prerender": "1" },
          },
        })),
      ),
      prerender: {
        autoStaticPathsDiscovery: false,
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
