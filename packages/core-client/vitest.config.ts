import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      include: ["src/**/*.ts"],
      provider: "v8",
      reporter: ["text", "html", "lcov"],
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    name: "@ai-interview/core-client",
  },
});
