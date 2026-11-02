import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  extends: [ultracite],
  ignorePatterns: [
    "apps/web/worker-configuration.d.ts",
    "apps/api/worker-configuration.d.ts",
    "packages/db/migrations/**",
    "apps/web/src/paraglide/**",
    "apps/web/src/routeTree.gen.ts",
    "apps/web/src/components/ui/**",
    "apps/web/src/hooks/use-composer-editor.ts",
    "apps/web/src/hooks/use-media-query.ts",
    "apps/web/src/lib/composer-*.ts",
  ],
});
