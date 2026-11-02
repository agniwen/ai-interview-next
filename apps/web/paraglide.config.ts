import type { CompilerOptions } from "@inlang/paraglide-js";

export const paraglideCompilerOptions = {
  emitTsDeclarations: true,
  isServer: "import.meta.env.SSR",
  outdir: "./src/paraglide",
  outputStructure: "message-modules",
  project: "./project.inlang",
  routeStrategies: [{ exclude: true, match: "/api/:path(.*)?" }],
  strategy: ["url", "baseLocale"],
  urlPatterns: [
    {
      localized: [
        ["zh-CN", "/zh-CN"],
        ["ja", "/ja"],
        ["ko", "/ko"],
        ["en", "/"],
      ],
      pattern: "/",
    },
    {
      localized: [
        ["zh-CN", "/zh-CN/:path(.*)?"],
        ["ja", "/ja/:path(.*)?"],
        ["ko", "/ko/:path(.*)?"],
        ["en", "/:path(.*)?"],
      ],
      pattern: "/:path(.*)?",
    },
  ],
} satisfies CompilerOptions;
