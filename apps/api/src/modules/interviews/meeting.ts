import type { Database } from "@ai-interview/db";
import {
  application,
  interviewRound,
  interviewSession,
  interviewEvaluation,
  organization,
  resume,
  user,
} from "@ai-interview/db/schema";
import { and, asc, eq, inArray, isNotNull, lt } from "drizzle-orm";
import { candidateInterview } from "../candidate-interviews/service";
import {
  captureSession,
  completeInterview,
  readInterviewMaterials,
} from "../interview-sessions/service";
import { getInterview } from "./service";

function admissionError(round: typeof interviewRound.$inferSelect, closedAt: Date | null) {
  if (closedAt || round.status === "completed") {
    return "INTERVIEW_CONNECTION_UNAVAILABLE" as const;
  }
  const now = Date.now();
  if (now < Number(round.scheduledAt) - 10 * 60_000) {
    return "INTERVIEW_TOO_EARLY" as const;
  }
  if (now > Number(round.admissionDeadline)) {
    return "INTERVIEW_ADMISSION_CLOSED" as const;
  }
}

async function assignedMeeting(db: Database, workspaceId: string, id: string, userId: string) {
  const entry = await getInterview(db, workspaceId, id);
  if (!entry || entry.round.kind !== "human") {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  const person = entry.round.assignments.find(
    (item) => item.id === userId && item.role === "interviewer",
  );
  if (!person) {
    return { error: "INTERVIEW_MEETING_FORBIDDEN" as const, status: 403 as const };
  }
  const [record] = await db
    .select({ closedAt: application.closedAt })
    .from(application)
    .where(eq(application.id, entry.round.applicationId));
  return { closedAt: record.closedAt, person, round: entry.round };
}

export async function readHumanMeeting(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const entry = await assignedMeeting(db, workspaceId, id, userId);
  if (entry.error !== undefined) {
    return { error: entry.error, status: entry.status };
  }
  const { round } = entry;
  const [session, [workspace], history] = await Promise.all([
    db.select().from(interviewSession).where(eq(interviewSession.interviewRoundId, id)).get(),
    db
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, workspaceId)),
    db
      .select({
        author: { id: user.id, image: user.image, name: user.name },
        content: interviewEvaluation.content,
        kind: interviewRound.kind,
        label: interviewRound.label,
        roundId: interviewRound.id,
        sequence: interviewRound.sequence,
        submittedAt: interviewEvaluation.submittedAt,
      })
      .from(interviewEvaluation)
      .innerJoin(interviewRound, eq(interviewRound.id, interviewEvaluation.interviewRoundId))
      .innerJoin(user, eq(user.id, interviewEvaluation.authorUserId))
      .where(
        and(
          eq(interviewRound.workspaceId, workspaceId),
          eq(interviewRound.applicationId, round.applicationId),
          lt(interviewRound.sequence, round.sequence),
          isNotNull(interviewEvaluation.submittedAt),
        ),
      )
      .orderBy(
        asc(interviewRound.sequence),
        asc(interviewRound.id),
        asc(interviewEvaluation.submittedAt),
        asc(user.id),
      ),
  ]);
  const materials = session?.content ?? (await readInterviewMaterials(db, round));
  const avatar = await db
    .select({ id: resume.id })
    .from(resume)
    .where(
      and(
        eq(resume.workspaceId, workspaceId),
        inArray(
          resume.id,
          materials.resumes.map((item) => item.id),
        ),
        isNotNull(resume.avatarObjectKey),
      ),
    )
    .orderBy(asc(resume.id))
    .get();
  return {
    admissionError: admissionError(round, entry.closedAt) ?? null,
    candidateName: materials.candidate.name,
    jobDescription: materials.job.requirements,
    jobTitle: materials.job.title,
    materials: {
      history,
      job: materials.job,
      people: [
        {
          identity: `candidate-${round.id}`,
          image: avatar ? `/api/ats/${workspaceId}/resumes/${avatar.id}/avatar` : null,
        },
        ...round.assignments.map((person) => ({
          identity: `interviewer-${person.id}`,
          image: person.image,
        })),
      ],
      resumes: materials.resumes.map((item) => ({
        ...item,
        documentUrl: `/api/interviews/${workspaceId}/${id}/meeting/resumes/${item.id}`,
      })),
      version: 1 as const,
    },
    round,
    version: 1 as const,
    workspaceName: workspace.name,
  };
}

async function joinMeeting(
  db: Database,
  round: typeof interviewRound.$inferSelect,
  closedAt: Date | null,
  actor: { actorId: string; actorType: "candidate" | "user" },
  participant: { identity: string; name: string; role: "candidate" | "interviewer" },
  entered: boolean,
) {
  const error = admissionError(round, closedAt);
  if (error) {
    return { error, status: 409 as const };
  }
  const existing = await db
    .select()
    .from(interviewSession)
    .where(eq(interviewSession.interviewRoundId, round.id))
    .get();
  const roomName = existing?.roomName ?? `meeting-${round.id}`;
  if (!entered) {
    return { participant, session: { roomName, startedAt: round.startedAt } };
  }
  const result = existing
    ? { session: existing }
    : await captureSession(db, round, actor, roomName);
  if (result.error !== undefined) {
    return { error: result.error, status: result.status };
  }
  return { participant, session: { roomName, startedAt: result.session.capturedAt } };
}

export async function joinCandidateMeeting(db: Database, token: string, entered = false) {
  const entry = await candidateInterview(db, token);
  if (!entry || entry.round.kind !== "human") {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  return joinMeeting(
    db,
    entry.round,
    entry.applicationClosedAt,
    { actorId: entry.candidateId, actorType: "candidate" },
    { identity: `candidate-${entry.round.id}`, name: entry.candidateName, role: "candidate" },
    entered,
  );
}

export async function joinInterviewerMeeting(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
  entered = false,
) {
  const entry = await assignedMeeting(db, workspaceId, id, userId);
  if (entry.error !== undefined) {
    return { error: entry.error, status: entry.status };
  }
  return joinMeeting(
    db,
    entry.round,
    entry.closedAt,
    { actorId: userId, actorType: "user" },
    { identity: `interviewer-${userId}`, name: entry.person.name, role: "interviewer" },
    entered,
  );
}

export async function endHumanMeeting(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const entry = await assignedMeeting(db, workspaceId, id, userId);
  if (entry.error !== undefined) {
    return { error: entry.error, status: entry.status };
  }
  if (entry.round.status === "scheduled") {
    return { error: "INTERVIEW_END_UNAVAILABLE" as const, status: 409 as const };
  }
  const [session] = await db
    .select()
    .from(interviewSession)
    .where(eq(interviewSession.interviewRoundId, id));
  const result = await completeInterview(
    db,
    entry.round,
    { actorId: userId, actorType: "user" },
    "completed",
  );
  return { ...result, roomName: session.roomName };
}
