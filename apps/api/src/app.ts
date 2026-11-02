import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";
import { authRoutes } from "./modules/auth/routes";
import type { ApiBindings } from "./env";

export const app = new Hono<{ Bindings: ApiBindings }>()
  .route("/api/auth", authRoutes)
  .get("/health", sValidator("query", z.strictObject({}).optional()), (c) =>
    c.json({ status: "ok" as const }, 200),
  );
