import type { CompilerOptions } from "@inlang/paraglide-js";

export const paraglideCompilerOptions = {
  emitTsDeclarations: true,
  isServer: "import.meta.env.SSR",
  outdir: "./src/paraglide",
  outputStructure: "message-modules",
  project: "./project.inlang",
  routeStrategies: [{ exclude: true, match: "/api/:path(.*)?" }],
  strategy: ["cookie", "baseLocale"],
} satisfies CompilerOptions;
