import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  migrations: { prefix: "timestamp" },
  out: "./migrations",
  schema: "./src/schema/index.ts",
});
