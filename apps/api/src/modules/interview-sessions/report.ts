import type { Database } from "@ai-interview/db";
import type {
  InterviewPlan,
  InterviewProgress,
  InterviewTurn,
} from "@ai-interview/db/interview-report";
import {
  application,
  interviewReport,
  interviewRound,
  interviewSession,
  interviewTranscript,
} from "@ai-interview/db/schema";
import { and, asc, eq, isNull, lt } from "drizzle-orm";

export function agentReportSession(db: Database, id: string, credential: string) {
  return db
    .select({ round: interviewRound, session: interviewSession })
    .from(interviewSession)
    .innerJoin(interviewRound, eq(interviewRound.id, interviewSession.interviewRoundId))
    .innerJoin(application, eq(application.id, interviewRound.applicationId))
    .where(
      and(
        eq(interviewSession.interviewRoundId, id),
        eq(interviewSession.contextToken, credential),
        isNull(application.deletedAt),
      ),
    )
    .get();
}

export function readInterviewLedger(db: Database, id: string) {
  return db.select().from(interviewReport).where(eq(interviewReport.interviewRoundId, id)).get();
}

export function readInterviewTurns(db: Database, id: string) {
  return db
    .select({
      at: interviewTranscript.at,
      id: interviewTranscript.id,
      interrupted: interviewTranscript.interrupted,
      role: interviewTranscript.role,
      speakerName: interviewTranscript.speakerName,
      text: interviewTranscript.text,
    })
    .from(interviewTranscript)
    .where(eq(interviewTranscript.interviewRoundId, id))
    .orderBy(asc(interviewTranscript.at), asc(interviewTranscript.id));
}

export async function prepareInterviewPlan(
  db: Database,
  id: string,
  credential: string,
  plan: InterviewPlan,
) {
  const entry = await agentReportSession(db, id, credential);
  if (!entry || entry.round.status !== "in_progress") {
    return { error: "INTERVIEW_CONTEXT_UNAVAILABLE" as const, status: 404 as const };
  }
  const questions = entry.session.content.questions.conversation;
  const ids = new Set(plan.questions.map((question) => question.id));
  const codes = new Set(plan.questions.map((question) => question.code));
  const points = plan.questions.flatMap((question) => question.points.map((point) => point.id));
  if (
    ids.size !== questions.length ||
    plan.questions.length !== questions.length ||
    codes.size !== questions.length ||
    questions.some((question) => !ids.has(question.id)) ||
    new Set(points).size !== points.length
  ) {
    return { error: "INVALID_INTERVIEW_PLAN" as const, status: 400 as const };
  }
  const source = new Map(questions.map((question) => [question.id, question.question.content]));
  const frozenPlan = {
    ...plan,
    questions: plan.questions.map((question) => ({
      ...question,
      content: source.get(question.id) as string,
    })),
  };
  await db
    .insert(interviewReport)
    .values({
      interviewRoundId: id,
      plan: frozenPlan,
      progress: {
        answers: [],
        asked: [],
        endReason: null,
        finalized: false,
        revision: 0,
        summary: "",
        usage: { cachedInputTokens: 0, inputTokens: 0, outputTokens: 0 },
        version: 1,
      },
      updatedAt: new Date(),
      workspaceId: entry.round.workspaceId,
    })
    .onConflictDoNothing();
  const [ledger] = await db
    .select()
    .from(interviewReport)
    .where(eq(interviewReport.interviewRoundId, id));
  return { ledger, version: 1 as const };
}

export async function saveInterviewTurns(
  db: Database,
  id: string,
  credential: string,
  turns: InterviewTurn[],
) {
  if (!(await agentReportSession(db, id, credential))) {
    return { error: "INTERVIEW_CONTEXT_UNAVAILABLE" as const, status: 404 as const };
  }
  // D1 每条语句最多绑定 100 个参数，每段转录占 8 个。
  // D1 allows 100 bound parameters per statement, with eight per transcript turn.
  await Promise.all(
    Array.from({ length: Math.ceil(turns.length / 12) }, (_, index) =>
      db
        .insert(interviewTranscript)
        .values(
          turns
            .slice(index * 12, (index + 1) * 12)
            .map((turn) => ({ ...turn, interviewRoundId: id })),
        )
        .onConflictDoNothing(),
    ),
  );
  return { version: 1 as const };
}

/** 引用必须来自本轮已保存的相应说话人原文；模型不能自报一个不存在的证据。
 * References must quote the correct speaker in this round's saved transcript; a model cannot invent evidence IDs. */
function validEvidence(progress: InterviewProgress, plan: InterviewPlan, turns: InterviewTurn[]) {
  const pointIds = new Set(
    plan.questions.flatMap((question) => question.points.map((point) => point.id)),
  );
  const questionIds = new Set(plan.questions.map((question) => question.id));
  const sources = new Map(turns.map((turn) => [turn.id, turn]));
  function matches(evidence: { turnId: string; quote: string }[], role: "user" | "assistant") {
    return evidence.every((item) => {
      const source = sources.get(item.turnId);
      return (
        source?.role === role &&
        source.text.includes(item.quote) &&
        (role === "user" || !source.interrupted)
      );
    });
  }
  return (
    new Set(progress.answers.map((answer) => answer.pointId)).size === progress.answers.length &&
    new Set(progress.asked.map((asked) => asked.questionId)).size === progress.asked.length &&
    progress.answers.every(
      (answer) => pointIds.has(answer.pointId) && matches(answer.evidence, "user"),
    ) &&
    progress.asked.every(
      (asked) => questionIds.has(asked.questionId) && matches(asked.evidence, "assistant"),
    )
  );
}

export async function saveInterviewProgress(
  db: Database,
  id: string,
  credential: string,
  progress: InterviewProgress,
) {
  if (!(await agentReportSession(db, id, credential))) {
    return { error: "INTERVIEW_CONTEXT_UNAVAILABLE" as const, status: 404 as const };
  }
  const ledger = await readInterviewLedger(db, id);
  if (!ledger) {
    return { error: "INTERVIEW_PLAN_REQUIRED" as const, status: 409 as const };
  }
  if (!validEvidence(progress, ledger.plan, await readInterviewTurns(db, id))) {
    return { error: "INVALID_INTERVIEW_EVIDENCE" as const, status: 400 as const };
  }
  // 修订号与快照一起比较，迟到的请求不能覆盖更新的采集结果。
  // Compare revision with the snapshot in one write so a delayed request cannot overwrite newer collection results.
  await db
    .update(interviewReport)
    .set({ progress, revision: progress.revision, updatedAt: new Date() })
    .where(
      and(
        eq(interviewReport.interviewRoundId, id),
        lt(interviewReport.revision, progress.revision),
      ),
    );
  return { version: 1 as const };
}
