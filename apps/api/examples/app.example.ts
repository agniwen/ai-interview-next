import { Hono } from "hono";
import { requestId } from "hono/request-id";
import { statisticsRoutes } from "./modules/statistics/routes.example";
import type { ExampleEnvironment } from "./context.example";

export const exampleApp = new Hono<ExampleEnvironment>()
  .use("*", requestId())
  .route("/statistics", statisticsRoutes)
  .get("/health", (c) => c.json({ status: "ok" as const }, 200));
