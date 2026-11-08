import type { Database } from "@ai-interview/db";
import type { InterviewEventInput } from "@ai-interview/db/interview-report";
import { interviewEvent } from "@ai-interview/db/schema";
import { asc, eq } from "drizzle-orm";
import { candidateInterview } from "../candidate-interviews/service";
import { agentReportSession } from "./report";

export function readInterviewEvents(db: Database, id: string) {
  return db
    .select()
    .from(interviewEvent)
    .where(eq(interviewEvent.interviewRoundId, id))
    .orderBy(asc(interviewEvent.at), asc(interviewEvent.id));
}

async function appendEvents(
  db: Database,
  id: string,
  source: "candidate" | "agent",
  events: InterviewEventInput[],
) {
  await db
    .insert(interviewEvent)
    .values(
      events.map((event) => ({
        ...event,
        interviewRoundId: id,
        receivedAt: new Date(),
        source,
      })),
    )
    .onConflictDoNothing();
  return { version: 1 as const };
}

export async function recordAgentEvents(
  db: Database,
  id: string,
  credential: string,
  events: InterviewEventInput[],
) {
  if (!(await agentReportSession(db, id, credential))) {
    return { error: "INTERVIEW_CONTEXT_UNAVAILABLE" as const, status: 404 as const };
  }
  return appendEvents(db, id, "agent", events);
}

export async function recordCandidateEvents(
  db: Database,
  token: string,
  events: InterviewEventInput[],
) {
  const entry = await candidateInterview(db, token);
  if (!entry || entry.round.kind !== "ai" || !entry.round.startedAt) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  return appendEvents(db, entry.round.id, "candidate", events);
}
