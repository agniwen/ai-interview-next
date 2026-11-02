import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";

export const app = new Hono().get(
  "/health",
  sValidator("query", z.strictObject({}).optional()),
  (c) => c.json({ status: "ok" as const }, 200),
);
