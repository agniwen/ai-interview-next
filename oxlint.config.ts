import { defineConfig } from "oxlint";

import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";

export default defineConfig({
  extends: [core, react],
  // `routeTree.gen.ts` does not match Ultracite's `**/*.gen.*` ignore.
  ignorePatterns: [
    "src/routeTree.gen.ts",
    // Upstream coss ui source. Keep it aligned with the registry instead of local lint rewrites.
    "src/components/ui/**",
    "src/hooks/use-composer-editor.ts",
    "src/hooks/use-media-query.ts",
    "src/lib/composer-*.ts",
  ],
  overrides: [
    {
      files: ["src/routes/**/*.{ts,tsx}"],
      rules: {
        // TanStack Router's option order is part of its type-inference chain.
        // Route objects must not be alphabetized by Ultracite's sort-keys rule.
        "sort-keys": "off",
      },
    },
  ],
  rules: {
    "func-style": "off",
    "max-lines": [
      "error",
      {
        max: 800,
        skipBlankLines: false,
        skipComments: false,
      },
    ],
    "react/function-component-definition": [
      "error",
      {
        namedComponents: "function-declaration",
      },
    ],
  },
});
