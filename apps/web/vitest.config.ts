import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    coverage: {
      exclude: ["src/routeTree.gen.ts", "src/paraglide/**", "src/**/*.{test,spec}.{ts,tsx}"],
      include: ["src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "html", "lcov"],
    },
    environment: "node",
    include: ["{src,tests}/**/*.{test,spec}.{ts,tsx}"],
    name: "@ai-interview/web",
  },
});
