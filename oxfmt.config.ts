import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: [
    "src/routeTree.gen.ts",
    "src/components/ui/**",
    "src/hooks/use-composer-editor.ts",
    "src/hooks/use-media-query.ts",
    "src/lib/composer-*.ts",
  ],
});
