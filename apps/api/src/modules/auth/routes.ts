import { Hono } from "hono";
import { getAuth } from "./auth";
import type { ApiBindings } from "../../env";

export const authRoutes = new Hono<{ Bindings: ApiBindings }>().on(["GET", "POST"], "/*", (c) =>
  getAuth(c.env).handler(c.req.raw),
);
