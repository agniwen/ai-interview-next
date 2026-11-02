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
    tanstackStart(),
    viteReact(),
  ],
  resolve: { dedupe: ["react", "react-dom"], tsconfigPaths: true },
});

export default config;
