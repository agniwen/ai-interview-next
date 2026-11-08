import type { Database } from "@ai-interview/db";
import type {
  InterviewEvaluationContent,
  InterviewEvaluationDraft,
} from "@ai-interview/db/interview-evaluation";
import {
  application,
  applicationActivity,
  interviewEvaluation,
  interviewEvaluationReport,
  user,
} from "@ai-interview/db/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { getInterview } from "./service";
import { canConfirmEvaluation, evaluationSummary, readEvaluationSummary } from "./evaluation-state";

type Round = NonNullable<Awaited<ReturnType<typeof getInterview>>>["round"];

export async function readEvaluation(db: Database, round: Round, userId: string) {
  const [original, evaluations] = await Promise.all([
    db
      .select()
      .from(interviewEvaluationReport)
      .where(eq(interviewEvaluationReport.interviewRoundId, round.id))
      .get(),
    db
      .select({
        author: { id: user.id, image: user.image, name: user.name },
        authorUserId: interviewEvaluation.authorUserId,
        content: interviewEvaluation.content,
        submittedAt: interviewEvaluation.submittedAt,
        updatedAt: interviewEvaluation.updatedAt,
      })
      .from(interviewEvaluation)
      .innerJoin(user, eq(user.id, interviewEvaluation.authorUserId))
      .where(eq(interviewEvaluation.interviewRoundId, round.id))
      .orderBy(asc(interviewEvaluation.submittedAt), asc(interviewEvaluation.authorUserId)),
  ]);
  const own = evaluations.find((item) => item.authorUserId === userId) ?? null;
  const requiredUserIds = round.assignments.map((item) => item.id);
  const assigned = canConfirmEvaluation(round.kind, requiredUserIds, userId);
  const summary = evaluationSummary(round.kind, requiredUserIds, evaluations);
  const completed = round.status === "completed";
  return {
    canEdit:
      (completed || (round.kind === "human" && round.status === "in_progress")) &&
      assigned &&
      !own?.submittedAt &&
      !summary.complete,
    canGenerate:
      completed &&
      assigned &&
      !own?.submittedAt &&
      !summary.complete &&
      round.kind === "ai" &&
      original?.status !== "ready" &&
      original?.status !== "generating",
    evaluations: evaluations.filter((item) => item.submittedAt || item.authorUserId === userId),
    original: original ?? null,
    own,
    summary,
    version: 1 as const,
  };
}

async function editableEvaluation(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
  submit: boolean,
) {
  const entry = await getInterview(db, workspaceId, id);
  if (!entry) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  if (
    !canConfirmEvaluation(
      entry.round.kind,
      entry.round.assignments.map((item) => item.id),
      userId,
    )
  ) {
    return { error: "INTERVIEW_EVALUATION_FORBIDDEN" as const, status: 403 as const };
  }
  if (
    entry.round.status !== "completed" &&
    (submit || entry.round.kind !== "human" || entry.round.status !== "in_progress")
  ) {
    return { error: "INTERVIEW_NOT_COMPLETED" as const, status: 409 as const };
  }
  const state = await readEvaluation(db, entry.round, userId);
  if (state.own?.submittedAt || state.summary.complete) {
    return { error: "INTERVIEW_EVALUATION_LOCKED" as const, status: 409 as const };
  }
  return entry;
}

export async function saveEvaluation(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
  input:
    | { submit: false; content: InterviewEvaluationDraft }
    | { submit: true; content: InterviewEvaluationContent },
) {
  const { content, submit } = input;
  const entry = await editableEvaluation(db, workspaceId, id, userId, submit);
  if ("error" in entry) {
    return entry;
  }
  if (entry.round.kind === "ai" && content.conclusion === "pending") {
    return { error: "INVALID_INPUT" as const, status: 400 as const };
  }
  const now = new Date();
  const values = {
    authorUserId: userId,
    content,
    interviewRoundId: id,
    submittedAt: submit ? now : null,
    updatedAt: now,
    workspaceId,
  };
  await db
    .insert(interviewEvaluation)
    .values(values)
    .onConflictDoUpdate({
      set: { content, submittedAt: values.submittedAt, updatedAt: now },
      setWhere: isNull(interviewEvaluation.submittedAt),
      target: [interviewEvaluation.interviewRoundId, interviewEvaluation.authorUserId],
    });
  if (submit) {
    const summary = await readEvaluationSummary(db, workspaceId, id, entry.round.kind);
    const { round } = entry;
    await db
      .insert(applicationActivity)
      .values({
        action: "interview_evaluation_submitted",
        actorId: userId,
        actorType: "user",
        applicationId: round.applicationId,
        id: `interview-evaluation-${id}-${userId}`,
        occurredAt: now,
        result: {
          interview: { id, kind: round.kind, label: round.label, sequence: round.sequence },
          outcome: "interview_evaluation_submitted",
          reason: content.conclusion,
          version: 1,
        },
        workspaceId,
      })
      .onConflictDoNothing();
    if (summary.conclusion === "fail") {
      await db.batch([
        db
          .update(application)
          .set({ closedAt: now, outcome: "rejected" })
          .where(and(eq(application.id, round.applicationId), isNull(application.closedAt))),
        db
          .insert(applicationActivity)
          .values({
            action: "closed",
            actorId: userId,
            actorType: "user",
            applicationId: round.applicationId,
            id: `interview-rejected-${id}`,
            occurredAt: now,
            result: { outcome: "rejected", reason: "interview_failed", version: 1 },
            workspaceId,
          })
          .onConflictDoNothing(),
      ]);
    }
  }
  return { version: 1 as const };
}
