import { createDatabase } from "@ai-interview/db";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { ApiBindings } from "../../env";
import {
  interviewEndInput,
  interviewPlanInput,
  interviewProgressInput,
  interviewTurnsInput,
  agentEventsInput,
} from "./input";
import { recordAgentEvents } from "./events";
import { prepareInterviewPlan, saveInterviewProgress, saveInterviewTurns } from "./report";
import { endAgentInterview, readInterviewContext } from "./service";
import {
  createInterviewEvaluator,
  generateInterviewEvaluation,
} from "../interviews/evaluation-generation";

const contextInput = z.object({ id: z.uuid() });
const credentialInput = z.object({
  authorization: z
    .string()
    .regex(/^Bearer [a-f0-9]{64}$/u)
    .transform((value) => value.slice(7)),
});

const validateContextId = sValidator("param", contextInput, (result, c) => {
  if (!result.success) {
    return c.json({ error: "INTERVIEW_CONTEXT_UNAVAILABLE", version: 1 as const }, 404);
  }
});
const validateCredential = sValidator("header", credentialInput, (result, c) => {
  if (!result.success) {
    return c.json({ error: "INTERVIEW_CONTEXT_UNAVAILABLE", version: 1 as const }, 404);
  }
});

export const interviewSessionRoutes = new Hono<{ Bindings: ApiBindings }>()
  .use((c, next) => {
    c.header("Cache-Control", "private, no-store");
    return next();
  })
  .post(
    "/:id/events",
    validateContextId,
    validateCredential,
    sValidator("json", agentEventsInput),
    async (c) => {
      const result = await recordAgentEvents(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").id,
        c.req.valid("header").authorization,
        c.req.valid("json").events,
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .get("/:id/context", validateContextId, validateCredential, async (c) => {
    const result = await readInterviewContext(
      createDatabase(c.env.AUTH_DB),
      c.req.valid("param").id,
      c.req.valid("header").authorization,
    );
    if (!result) {
      return c.json({ error: "INTERVIEW_CONTEXT_UNAVAILABLE", version: 1 as const }, 404);
    }
    return c.json(result, 200);
  })
  .post(
    "/:id/end",
    validateContextId,
    validateCredential,
    sValidator("json", interviewEndInput, (result, c) => {
      if (!result.success) {
        return c.json({ error: "INVALID_INPUT", version: 1 as const }, 400);
      }
    }),
    async (c) => {
      const result = await endAgentInterview(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").id,
        c.req.valid("header").authorization,
        c.req.valid("json").reason,
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .post(
    "/:id/plan",
    validateContextId,
    validateCredential,
    sValidator("json", interviewPlanInput),
    async (c) => {
      const result = await prepareInterviewPlan(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").id,
        c.req.valid("header").authorization,
        c.req.valid("json"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .post(
    "/:id/turns",
    validateContextId,
    validateCredential,
    sValidator("json", interviewTurnsInput),
    async (c) => {
      const result = await saveInterviewTurns(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").id,
        c.req.valid("header").authorization,
        c.req.valid("json").turns,
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .post(
    "/:id/progress",
    validateContextId,
    validateCredential,
    sValidator("json", interviewProgressInput),
    async (c) => {
      const result = await saveInterviewProgress(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").id,
        c.req.valid("header").authorization,
        c.req.valid("json"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      if (c.req.valid("json").finalized) {
        c.executionCtx.waitUntil(
          generateInterviewEvaluation(
            createDatabase(c.env.AUTH_DB),
            c.req.valid("param").id,
            createInterviewEvaluator(c.env),
          ),
        );
      }
      return c.json(result, 200);
    },
  );
