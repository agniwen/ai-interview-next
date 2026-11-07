import { createDatabase } from "@ai-interview/db";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { z } from "zod";
import type { ApiBindings } from "../../env";
import { enterCandidateInterview } from "./service";

export const candidateInterviewRoutes = new Hono<{ Bindings: ApiBindings }>()
  .use(csrf())
  .use((c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    return next();
  })
  .post(
    "/:token/entry",
    sValidator("param", z.object({ token: z.string().regex(/^[a-f0-9]{64}$/u) }), (result, c) => {
      if (!result.success) {
        return c.json({ error: "INTERVIEW_UNAVAILABLE", version: 1 as const }, 404);
      }
    }),
    async (c) => {
      const result = await enterCandidateInterview(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").token,
      );
      if (!result) {
        return c.json({ error: "INTERVIEW_UNAVAILABLE", version: 1 as const }, 404);
      }
      return c.json(result, 200);
    },
  );
