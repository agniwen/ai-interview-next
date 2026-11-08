import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  candidate,
  interviewFeedback,
  user,
} from "@ai-interview/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { getInterview } from "./service";
import { readInterviewLedger, readInterviewTurns } from "../interview-sessions/report";
import { readInterviewEvents } from "../interview-sessions/events";
import { readEvaluation } from "./evaluation";

/** AI 采集记录和真人反馈共用结果入口，缺失材料明确返回空值。
 * AI collection records and human feedback share a results endpoint; unavailable material remains explicitly absent. */
export async function readInterviewResult(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const entry = await getInterview(db, workspaceId, id);
  if (!entry) {
    return null;
  }
  const [ledger, turns, feedback, people, completion, events, evaluation] = await Promise.all([
    readInterviewLedger(db, id),
    readInterviewTurns(db, id),
    db
      .select({
        author: { id: user.id, image: user.image, name: user.name },
        body: interviewFeedback.body,
        createdAt: interviewFeedback.createdAt,
        id: interviewFeedback.id,
      })
      .from(interviewFeedback)
      .innerJoin(user, eq(user.id, interviewFeedback.authorUserId))
      .where(
        and(
          eq(interviewFeedback.workspaceId, workspaceId),
          eq(interviewFeedback.interviewRoundId, id),
        ),
      )
      .orderBy(asc(interviewFeedback.createdAt), asc(interviewFeedback.id)),
    db
      .select({ id: candidate.id, name: candidate.name })
      .from(application)
      .innerJoin(candidate, eq(candidate.id, application.candidateId))
      .where(eq(application.id, entry.round.applicationId)),
    db
      .select({ actorType: applicationActivity.actorType })
      .from(applicationActivity)
      .where(eq(applicationActivity.id, `interview_ended-${id}`))
      .get(),
    readInterviewEvents(db, id),
    readEvaluation(db, entry.round, userId),
  ]);
  const [person] = people;
  // 共享客户端类型检查使用 ES2022，反转副本以定位最新报告事件。
  // Shared client type checks target ES2022; reverse a copy to locate the latest report event.
  // oxlint-disable-next-line unicorn/no-array-reverse
  const newestEvents = [...events].reverse();
  const reportEvent = newestEvents.find(
    (event) => event.content.kind === "report_ready" || event.content.kind === "report_failed",
  );
  let reportStatus: "failed" | "ready" | "processing" | "unavailable" = "unavailable";
  if (ledger) {
    reportStatus = "processing";
  }
  if (ledger?.progress.finalized) {
    reportStatus = "ready";
  }
  if (reportEvent?.content.kind === "report_failed") {
    reportStatus = "failed";
  }
  return {
    candidate: person,
    evaluation,
    events,
    feedback,
    plan: ledger?.plan ?? null,
    progress: ledger
      ? {
          ...ledger.progress,
          // 按钮结束以业务记录为准，不把 Agent 的房间关闭误报为中断。
          // Button completion follows the business event, not the Agent's room-disconnect reason.
          endReason:
            completion?.actorType === "candidate"
              ? ("candidate_requested" as const)
              : ledger.progress.endReason,
          summary:
            ledger.progress.summary ||
            ledger.progress.answers.map((answer) => answer.summary).join("\n"),
        }
      : null,
    reportStatus,
    round: entry.round,
    turns,
    version: 1 as const,
  };
}
