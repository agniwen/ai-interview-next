import { createDatabase } from "@ai-interview/db";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import type { ApiBindings } from "../../env";
import { enterCandidateInterview, saveCandidateForm } from "./service";
import { candidateInterviewParam, candidateFormInput } from "./input";

const validateToken = sValidator("param", candidateInterviewParam, (result, c) => {
  if (!result.success) {
    return c.json({ error: "INTERVIEW_UNAVAILABLE", version: 1 as const }, 404);
  }
});
const validateForm = sValidator("json", candidateFormInput, (result, c) => {
  if (!result.success) {
    return c.json({ error: "INTERVIEW_FORM_INVALID", version: 1 as const }, 400);
  }
});

export const candidateInterviewRoutes = new Hono<{ Bindings: ApiBindings }>()
  .use(csrf())
  .use((c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    return next();
  })
  .post("/:token/entry", validateToken, async (c) => {
    const result = await enterCandidateInterview(
      createDatabase(c.env.AUTH_DB),
      c.req.valid("param").token,
    );
    if (!result) {
      return c.json({ error: "INTERVIEW_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json(result, 200);
  })
  .put("/:token/form", validateToken, validateForm, async (c) => {
    const result = await saveCandidateForm(
      createDatabase(c.env.AUTH_DB),
      c.req.valid("param").token,
      c.req.valid("json"),
      false,
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    return c.json({ ...result, version: 1 as const }, 200);
  })
  .post("/:token/form/submit", validateToken, validateForm, async (c) => {
    const result = await saveCandidateForm(
      createDatabase(c.env.AUTH_DB),
      c.req.valid("param").token,
      c.req.valid("json"),
      true,
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    return c.json({ ...result, version: 1 as const }, 200);
  });
