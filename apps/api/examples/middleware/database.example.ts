import { createDatabase } from "@ai-interview/db";
import { createMiddleware } from "hono/factory";
import type { ExampleEnvironment } from "../context.example";

export const databaseMiddleware = createMiddleware<ExampleEnvironment>((c, next) => {
  c.set("database", createDatabase(c.env.AUTH_DB));
  return next();
});
