import { readInterviewLedger, readInterviewTurns } from "./report";
import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  applicationResume,
  candidate,
  interviewerAgent,
  interviewFormResponse,
  interviewQuestionSnapshot,
  interviewRound,
  interviewSession,
  interviewEvent,
  job,
  resume,
} from "@ai-interview/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { candidateInterview } from "../candidate-interviews/service";
import { interviewActivityValues } from "../interviews/activity";

function readSession(db: Database, roundId: string) {
  return db
    .select()
    .from(interviewSession)
    .where(eq(interviewSession.interviewRoundId, roundId))
    .get();
}

export async function readInterviewMaterials(
  db: Database,
  round: typeof interviewRound.$inferSelect,
) {
  const [[materials], resumes] = await Promise.all([
    db
      .select({
        candidate: { id: candidate.id, name: candidate.name },
        interviewer: {
          description: interviewerAgent.description,
          id: interviewerAgent.id,
          name: interviewerAgent.name,
          prompt: interviewerAgent.prompt,
        },
        job: {
          id: job.id,
          internalCriteria: job.internalCriteria,
          requirements: job.requirements,
          title: job.title,
        },
      })
      .from(interviewRound)
      .innerJoin(application, eq(application.id, interviewRound.applicationId))
      .innerJoin(candidate, eq(candidate.id, application.candidateId))
      .innerJoin(job, eq(job.id, application.jobId))
      .leftJoin(interviewerAgent, eq(interviewerAgent.id, interviewRound.interviewerAgentId))
      .where(eq(interviewRound.id, round.id)),
    db
      .select({
        id: resume.id,
        markdown: resume.markdown,
        parsedProfile: resume.parsedProfile,
        pdfObjectKey: resume.pdfObjectKey,
      })
      .from(applicationResume)
      .innerJoin(resume, eq(resume.id, applicationResume.resumeId))
      .where(
        and(
          eq(applicationResume.applicationId, round.applicationId),
          eq(applicationResume.status, "available"),
        ),
      )
      .orderBy(asc(applicationResume.createdAt), asc(applicationResume.id)),
  ]);
  return { ...materials, resumes };
}

export async function captureSession(
  db: Database,
  round: typeof interviewRound.$inferSelect,
  actor?: { actorId: string; actorType: "candidate" | "user" },
  roomName = `interview-${crypto.randomUUID()}`,
) {
  const questions = await db
    .select()
    .from(interviewQuestionSnapshot)
    .where(eq(interviewQuestionSnapshot.interviewRoundId, round.id))
    .get();
  if (round.kind === "ai" && !questions) {
    return { error: "INTERVIEW_PREPARATION_REQUIRED" as const, status: 409 as const };
  }
  const form = await db
    .select()
    .from(interviewFormResponse)
    .where(eq(interviewFormResponse.interviewRoundId, round.id))
    .get();
  if (questions && questions.content.form.length > 0 && !form?.submittedAt) {
    return { error: "INTERVIEW_FORM_INCOMPLETE" as const, status: 409 as const };
  }
  const materials = await readInterviewMaterials(db, round);
  const contextToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  const capturedAt = new Date();
  // 快照和状态在同一批事务中保存；重试保留第一次实际开始的材料、房间和时间。
  // Persist snapshot and status in one transaction; retries preserve the first start's materials, room and timestamp.
  await db.batch([
    db
      .insert(interviewSession)
      .values({
        capturedAt,
        content: {
          ...materials,
          form: form?.content ?? { answers: {}, version: 1 },
          questions: questions?.content ?? { conversation: [], form: [], version: 1 },
          version: 1,
        },
        contextToken,
        interviewRoundId: round.id,
        roomName,
        workspaceId: round.workspaceId,
      })
      .onConflictDoNothing({ target: interviewSession.interviewRoundId }),
    db
      .update(interviewRound)
      .set({ startedAt: capturedAt, status: "in_progress" })
      .where(and(eq(interviewRound.id, round.id), eq(interviewRound.status, "scheduled"))),
    db
      .insert(applicationActivity)
      .values(
        interviewActivityValues(
          round,
          "interview_started",
          actor ?? { actorId: materials.candidate.id, actorType: "candidate" },
          capturedAt,
        ),
      )
      .onConflictDoNothing({ target: applicationActivity.id }),
  ]);
  const [session] = await db
    .select()
    .from(interviewSession)
    .where(eq(interviewSession.interviewRoundId, round.id));
  return { session };
}

/** 只有候选人明确开始才固定材料和锁定答案；获取连接信息不调用此操作。
 * Only an explicit candidate start freezes materials and locks answers; connection requests never call this operation. */
export async function startCandidateInterview(db: Database, token: string) {
  const entry = await candidateInterview(db, token);
  if (!entry) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  if (entry.applicationClosedAt || entry.round.kind !== "ai") {
    return { error: "INTERVIEW_START_UNAVAILABLE" as const, status: 409 as const };
  }
  if (entry.round.status === "in_progress") {
    return { startedAt: entry.round.startedAt, version: 1 as const };
  }
  if (entry.round.status !== "scheduled") {
    return { error: "INTERVIEW_START_UNAVAILABLE" as const, status: 409 as const };
  }
  const result = await captureSession(db, entry.round);
  if (result.error !== undefined) {
    return { error: result.error, status: result.status };
  }
  return { startedAt: result.session.capturedAt, version: 1 as const };
}

export async function candidateSession(db: Database, token: string) {
  const entry = await candidateInterview(db, token);
  if (!entry) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  if (
    entry.applicationClosedAt ||
    entry.round.kind !== "ai" ||
    entry.round.status !== "in_progress"
  ) {
    return { error: "INTERVIEW_CONNECTION_UNAVAILABLE" as const, status: 409 as const };
  }
  const session = await readSession(db, entry.round.id);
  if (!session) {
    return { error: "INTERVIEW_CONNECTION_UNAVAILABLE" as const, status: 409 as const };
  }
  return { session };
}

/** 按本轮专属凭证提供 Agent 上下文，不接受候选人邀请凭证或普通工作区登录替代。
 * Serve agent context using its round-specific credential, never a candidate invitation or workspace login. */
export async function readInterviewContext(db: Database, id: string, contextToken: string) {
  const result = await db
    .select({
      content: interviewSession.content,
      interviewId: interviewSession.interviewRoundId,
      roomName: interviewSession.roomName,
      startedAt: interviewSession.capturedAt,
    })
    .from(interviewSession)
    .innerJoin(interviewRound, eq(interviewRound.id, interviewSession.interviewRoundId))
    .innerJoin(application, eq(application.id, interviewRound.applicationId))
    .where(
      and(
        eq(interviewSession.interviewRoundId, id),
        eq(interviewSession.contextToken, contextToken),
        eq(interviewRound.status, "in_progress"),
        isNull(application.deletedAt),
        isNull(application.closedAt),
      ),
    )
    .get();
  return result
    ? {
        ...result,
        ledger: (await readInterviewLedger(db, id)) ?? null,
        participantIdentity: `candidate-${id}`,
        turns: await readInterviewTurns(db, id),
        version: 1 as const,
      }
    : undefined;
}

/** 正式结束与操作记录一起提交，重试保留首次结束时间及执行者。
 * Commit completion and activity together; retries retain the first end time and actor. */
export async function completeInterview(
  db: Database,
  round: typeof interviewRound.$inferSelect,
  actor: { actorId: string; actorType: "candidate" | "system" | "user" },
  reason: "completed" | "candidate_requested",
) {
  const endedAt = new Date();
  await db.batch([
    db
      .update(interviewRound)
      .set({ endedAt, status: "completed" })
      .where(and(eq(interviewRound.id, round.id), eq(interviewRound.status, "in_progress"))),
    db
      .insert(applicationActivity)
      .values(interviewActivityValues(round, "interview_ended", actor, endedAt))
      .onConflictDoNothing({ target: applicationActivity.id }),
    db
      .insert(interviewEvent)
      .values({
        at: endedAt.getTime(),
        content: { attempt: null, kind: "interview_ended", reason, recoverable: false, version: 1 },
        id: `interview_ended-${round.id}`,
        interviewRoundId: round.id,
        receivedAt: endedAt,
        runId: round.id,
        source: "system",
      })
      .onConflictDoNothing(),
  ]);
  const [ended] = await db
    .select({ endedAt: interviewRound.endedAt })
    .from(interviewRound)
    .where(eq(interviewRound.id, round.id));
  return { ...ended, version: 1 as const };
}

export async function endAgentInterview(
  db: Database,
  id: string,
  contextToken: string,
  reason: "completed" | "candidate_requested",
) {
  const entry = await db
    .select({
      interviewerId: interviewerAgent.id,
      round: interviewRound,
      session: interviewSession,
    })
    .from(interviewSession)
    .innerJoin(interviewRound, eq(interviewRound.id, interviewSession.interviewRoundId))
    .innerJoin(interviewerAgent, eq(interviewerAgent.id, interviewRound.interviewerAgentId))
    .where(
      and(
        eq(interviewSession.interviewRoundId, id),
        eq(interviewSession.contextToken, contextToken),
      ),
    )
    .get();
  if (!entry || entry.round.kind !== "ai") {
    return { error: "INTERVIEW_CONTEXT_UNAVAILABLE" as const, status: 404 as const };
  }
  if (entry.round.status !== "in_progress" && entry.round.status !== "completed") {
    return { error: "INTERVIEW_END_UNAVAILABLE" as const, status: 409 as const };
  }
  if (reason === "completed" && entry.round.status !== "completed") {
    const ledger = await readInterviewLedger(db, id);
    const recorded = new Set(ledger?.progress.answers.map((answer) => answer.pointId));
    if (
      !ledger ||
      ledger.plan.questions.some((question) =>
        question.points.some((point) => !recorded.has(point.id)),
      )
    ) {
      return { error: "INTERVIEW_COLLECTION_INCOMPLETE" as const, status: 409 as const };
    }
  }
  return completeInterview(
    db,
    entry.round,
    {
      actorId: entry.interviewerId,
      actorType: "system",
    },
    reason,
  );
}

export async function endCandidateInterview(db: Database, token: string) {
  const entry = await candidateInterview(db, token);
  if (!entry) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  if (
    entry.round.kind !== "ai" ||
    (entry.round.status !== "in_progress" && entry.round.status !== "completed")
  ) {
    return { error: "INTERVIEW_END_UNAVAILABLE" as const, status: 409 as const };
  }
  const session = await readSession(db, entry.round.id);
  if (!session) {
    return { error: "INTERVIEW_END_UNAVAILABLE" as const, status: 409 as const };
  }
  const ended = await completeInterview(
    db,
    entry.round,
    {
      actorId: entry.candidateId,
      actorType: "candidate",
    },
    "candidate_requested",
  );
  return { ...ended, roomName: session.roomName };
}
