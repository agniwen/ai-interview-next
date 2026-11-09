import type { Database } from "@ai-interview/db";
import {
  application,
  applicationEvaluation,
  interviewRound,
  interviewSession,
  interviewEvaluation,
  organization,
  resume,
  resumeUploadItem,
  user,
} from "@ai-interview/db/schema";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";
import { candidateInterview } from "../candidate-interviews/service";
import {
  captureSession,
  completeInterview,
  readInterviewMaterials,
} from "../interview-sessions/service";
import { getInterview } from "./service";
import { readInterviewTurns } from "../interview-sessions/report";
import { dispatchHumanTranscription } from "../interview-sessions/rooms";
import type { InterviewRoomConfiguration } from "../interview-sessions/rooms";

type StartTranscription = (session: typeof interviewSession.$inferSelect) => void;

export async function startHumanMeetingTranscription(
  db: Database,
  config: InterviewRoomConfiguration,
  session: typeof interviewSession.$inferSelect,
) {
  const now = Date.now();
  // 两端同时入会时只调度一个转录任务；任务调度失败后可在下次入会重试。
  // Concurrent arrivals dispatch one transcriber. A failed dispatch can retry on the next entry.
  const claimed = await db
    .update(interviewSession)
    .set({ transcriptionDispatchAt: now })
    .where(
      and(
        eq(interviewSession.interviewRoundId, session.interviewRoundId),
        or(
          isNull(interviewSession.transcriptionDispatchAt),
          lt(interviewSession.transcriptionDispatchAt, now - 30_000),
        ),
      ),
    )
    .returning({ id: interviewSession.interviewRoundId })
    .get();
  if (!claimed) {
    return;
  }
  try {
    await dispatchHumanTranscription(config, session);
  } catch (error) {
    console.warn(
      "Human transcription dispatch failed",
      error instanceof Error ? error.name : "unknown",
    );
  } finally {
    await db
      .update(interviewSession)
      .set({ transcriptionDispatchAt: null })
      .where(
        and(
          eq(interviewSession.interviewRoundId, session.interviewRoundId),
          eq(interviewSession.transcriptionDispatchAt, now),
        ),
      );
  }
}

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
  const [session, [workspace], history, resumeEvaluation] = await Promise.all([
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
    db
      .select({ createdAt: applicationEvaluation.createdAt, result: applicationEvaluation.result })
      .from(applicationEvaluation)
      .where(
        and(
          eq(applicationEvaluation.workspaceId, workspaceId),
          eq(applicationEvaluation.applicationId, round.applicationId),
        ),
      )
      .orderBy(desc(applicationEvaluation.createdAt), desc(applicationEvaluation.id))
      .get(),
  ]);
  const materials = session?.content ?? (await readInterviewMaterials(db, round));
  const [avatar, uploads] = await Promise.all([
    db
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
      .get(),
    db
      .select({ filename: resumeUploadItem.filename, objectKey: resumeUploadItem.objectKey })
      .from(resumeUploadItem)
      .where(
        and(
          eq(resumeUploadItem.workspaceId, workspaceId),
          inArray(
            resumeUploadItem.objectKey,
            materials.resumes.map((item) => item.pdfObjectKey),
          ),
        ),
      ),
  ]);
  const filenames = new Map(uploads.map(({ filename, objectKey }) => [objectKey, filename]));
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
      resumeEvaluation: resumeEvaluation ?? null,
      resumes: materials.resumes.map((item) => ({
        ...item,
        documentUrl: `/api/interviews/${workspaceId}/${id}/meeting/resumes/${item.id}`,
        filename: filenames.get(item.pdfObjectKey) ?? "resume.pdf",
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
  onEntered?: StartTranscription,
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
  if (!onEntered) {
    return { participant, session: { roomName, startedAt: round.startedAt } };
  }
  const result = existing
    ? { session: existing }
    : await captureSession(db, round, actor, roomName);
  if (result.error !== undefined) {
    return { error: result.error, status: result.status };
  }
  onEntered(result.session);
  return {
    participant,
    session: { roomName, startedAt: result.session.capturedAt },
    turns: await readInterviewTurns(db, round.id),
  };
}

export async function joinCandidateMeeting(
  db: Database,
  token: string,
  onEntered?: StartTranscription,
) {
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
    onEntered,
  );
}

export async function joinInterviewerMeeting(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
  onEntered?: StartTranscription,
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
    onEntered,
  );
}

export async function endHumanMeeting(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
  closeRoom: (roomName: string) => Promise<void>,
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
  try {
    await closeRoom(session.roomName);
  } catch {
    return { error: "INTERVIEW_CLOSE_FAILED" as const, status: 503 as const };
  }
  return completeInterview(db, entry.round, { actorId: userId, actorType: "user" }, "completed");
}
