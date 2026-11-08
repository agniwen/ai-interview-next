import type { applicationActivity, interviewRound } from "@ai-interview/db/schema";

type Round = Pick<
  typeof interviewRound.$inferSelect,
  "id" | "applicationId" | "workspaceId" | "kind" | "sequence" | "label"
>;
type Actor = Pick<typeof applicationActivity.$inferInsert, "actorId" | "actorType">;

export function interviewActivityValues(
  round: Round,
  action: "interview_created" | "interview_started" | "interview_ended",
  actor: Actor,
  occurredAt: Date,
) {
  return {
    ...actor,
    action,
    applicationId: round.applicationId,
    id: `${action}-${round.id}`,
    occurredAt,
    result: {
      interview: { id: round.id, kind: round.kind, label: round.label, sequence: round.sequence },
      outcome: action,
      reason: round.kind,
      version: 1 as const,
    },
    workspaceId: round.workspaceId,
  };
}
