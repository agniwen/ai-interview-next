import { joinCandidateMeeting, startHumanMeetingTranscription } from "../interviews/meeting";
import {
  candidateFeedbackInput,
  candidateInterviewParam,
  candidateFormInput,
  candidateStartInput,
} from "./input";
import { candidateEventsInput } from "../interview-sessions/input";
import { recordCandidateEvents } from "../interview-sessions/events";
import { createDatabase } from "@ai-interview/db";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import type { ApiBindings } from "../../env";
import { enterCandidateInterview, saveCandidateForm, saveCandidateFeedback } from "./service";

import {
  startCandidateInterview,
  candidateSession,
  endCandidateInterview,
} from "../interview-sessions/service";
import {
  closeInterviewRoom,
  connectHumanMeeting,
  meetingRoomConfiguration,
  connectInterviewRoom,
  interviewRoomConfiguration,
} from "../interview-sessions/rooms";

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

const validateStart = sValidator("json", candidateStartInput, (result, c) => {
  if (!result.success) {
    return c.json({ error: "INVALID_INPUT", version: 1 as const }, 400);
  }
});

export const candidateInterviewRoutes = new Hono<{ Bindings: ApiBindings }>()
  .use(csrf())
  .use((c, next) => {
    c.header("Cache-Control", "private, no-store");
    c.header("Referrer-Policy", "no-referrer");
    return next();
  })
  .post("/:token/events", validateToken, sValidator("json", candidateEventsInput), async (c) => {
    const result = await recordCandidateEvents(
      createDatabase(c.env.AUTH_DB),
      c.req.valid("param").token,
      c.req.valid("json").events,
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    return c.json(result, 200);
  })
  .post("/:token/meeting/entered", validateToken, validateStart, async (c) => {
    const db = createDatabase(c.env.AUTH_DB);
    const config = interviewRoomConfiguration.safeParse(c.env);
    const result = await joinCandidateMeeting(db, c.req.valid("param").token, (session) =>
      config.success
        ? c.executionCtx.waitUntil(startHumanMeetingTranscription(db, config.data, session))
        : undefined,
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    return c.json(
      { startedAt: result.session.startedAt, turns: result.turns ?? [], version: 1 as const },
      200,
    );
  })
  .post("/:token/meeting", validateToken, validateStart, async (c) => {
    const config = meetingRoomConfiguration.safeParse(c.env);
    if (!config.success) {
      return c.json({ error: "INTERVIEW_SERVICE_UNAVAILABLE", version: 1 as const }, 503);
    }
    const result = await joinCandidateMeeting(
      createDatabase(c.env.AUTH_DB),
      c.req.valid("param").token,
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    try {
      return c.json(
        await connectHumanMeeting(config.data, result.session, result.participant),
        200,
      );
    } catch {
      return c.json({ error: "INTERVIEW_CONNECTION_FAILED", version: 1 as const }, 503);
    }
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
  .post(
    "/:token/start",
    validateToken,
    sValidator("json", candidateStartInput, (result, c) => {
      if (!result.success) {
        return c.json({ error: "INVALID_INPUT", version: 1 as const }, 400);
      }
    }),
    async (c) => {
      if (!interviewRoomConfiguration.safeParse(c.env).success) {
        return c.json({ error: "INTERVIEW_SERVICE_UNAVAILABLE", version: 1 as const }, 503);
      }
      const result = await startCandidateInterview(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").token,
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  )
  .post("/:token/connection", validateToken, async (c) => {
    const result = await candidateSession(
      createDatabase(c.env.AUTH_DB),
      c.req.valid("param").token,
    );
    if ("error" in result) {
      return c.json({ error: result.error, version: 1 as const }, result.status);
    }
    const config = interviewRoomConfiguration.safeParse(c.env);
    if (!config.success) {
      return c.json({ error: "INTERVIEW_SERVICE_UNAVAILABLE", version: 1 as const }, 503);
    }
    try {
      return c.json(await connectInterviewRoom(config.data, result.session), 200);
    } catch {
      return c.json({ error: "INTERVIEW_CONNECTION_FAILED", version: 1 as const }, 503);
    }
  })
  .post(
    "/:token/end",
    validateToken,
    sValidator("json", candidateStartInput, (result, c) => {
      if (!result.success) {
        return c.json({ error: "INVALID_INPUT", version: 1 as const }, 400);
      }
    }),
    async (c) => {
      const config = meetingRoomConfiguration.safeParse(c.env);
      if (!config.success) {
        return c.json({ error: "INTERVIEW_SERVICE_UNAVAILABLE", version: 1 as const }, 503);
      }
      const result = await endCandidateInterview(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").token,
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      try {
        await closeInterviewRoom(config.data, result.roomName);
      } catch {
        return c.json({ error: "INTERVIEW_CLOSE_FAILED", version: 1 as const }, 503);
      }
      return c.json({ endedAt: result.endedAt, version: 1 as const }, 200);
    },
  )
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
  })
  .post(
    "/:token/feedback",
    validateToken,
    sValidator("json", candidateFeedbackInput),
    async (c) => {
      const result = await saveCandidateFeedback(
        createDatabase(c.env.AUTH_DB),
        c.req.valid("param").token,
        c.req.valid("json"),
      );
      if ("error" in result) {
        return c.json({ error: result.error, version: 1 as const }, result.status);
      }
      return c.json(result, 200);
    },
  );
