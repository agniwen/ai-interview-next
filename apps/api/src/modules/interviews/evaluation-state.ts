import type { Database } from "@ai-interview/db";
import { interviewAssignment, interviewEvaluation } from "@ai-interview/db/schema";
import { and, asc, eq } from "drizzle-orm";

type Evaluation = Pick<
  typeof interviewEvaluation.$inferSelect,
  "authorUserId" | "content" | "submittedAt"
>;

export function canConfirmEvaluation(
  kind: "ai" | "human",
  requiredUserIds: string[],
  userId: string,
) {
  return (kind === "ai" && requiredUserIds.length === 0) || requiredUserIds.includes(userId);
}

export function evaluationSummary(
  kind: "ai" | "human",
  requiredUserIds: string[],
  evaluations: Evaluation[],
) {
  const confirmed = evaluations.filter(
    (item) => item.submittedAt && canConfirmEvaluation(kind, requiredUserIds, item.authorUserId),
  );
  const submitted = kind === "ai" ? confirmed.slice(0, 1) : confirmed;
  const requiredCount = kind === "ai" ? 1 : requiredUserIds.length;
  const complete = requiredCount > 0 && submitted.length === requiredCount;
  const conclusion =
    submitted.find((item) => item.content.conclusion !== "pending")?.content.conclusion ??
    (complete ? "pending" : null);
  return {
    complete,
    conclusion,
    requiredCount,
    submittedCount: submitted.length,
    version: 1 as const,
  };
}

export async function readEvaluationSummary(
  db: Database,
  workspaceId: string,
  id: string,
  kind: "ai" | "human",
) {
  const [assignments, evaluations] = await Promise.all([
    db
      .select({ userId: interviewAssignment.userId })
      .from(interviewAssignment)
      .where(
        and(
          eq(interviewAssignment.workspaceId, workspaceId),
          eq(interviewAssignment.interviewRoundId, id),
        ),
      ),
    db
      .select()
      .from(interviewEvaluation)
      .where(
        and(
          eq(interviewEvaluation.workspaceId, workspaceId),
          eq(interviewEvaluation.interviewRoundId, id),
        ),
      )
      .orderBy(asc(interviewEvaluation.submittedAt), asc(interviewEvaluation.authorUserId)),
  ]);
  return evaluationSummary(
    kind,
    assignments.map((item) => item.userId),
    evaluations,
  );
}
