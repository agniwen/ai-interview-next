import type { Database } from "@ai-interview/db";
import {
  application,
  interviewInvitation,
  interviewQuestionSnapshot,
  interviewRound,
  job,
  organization,
  questionSet,
} from "@ai-interview/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";

function candidateInterview(db: Database, token: string) {
  return db
    .select({
      jobTitle: job.title,
      round: interviewRound,
      workspaceName: organization.name,
    })
    .from(interviewInvitation)
    .innerJoin(interviewRound, eq(interviewRound.id, interviewInvitation.interviewRoundId))
    .innerJoin(application, eq(application.id, interviewRound.applicationId))
    .innerJoin(job, eq(job.id, application.jobId))
    .innerJoin(organization, eq(organization.id, interviewRound.workspaceId))
    .where(and(eq(interviewInvitation.token, token), isNull(application.deletedAt)))
    .get();
}

async function bindQuestions(db: Database, round: typeof interviewRound.$inferSelect) {
  const saved = await db
    .select()
    .from(interviewQuestionSnapshot)
    .where(eq(interviewQuestionSnapshot.interviewRoundId, round.id))
    .get();
  if (saved) {
    return saved;
  }
  const ids = [
    ...round.questionSelection.formQuestionSetIds,
    ...round.questionSelection.conversationQuestionSetIds,
  ];
  const sets = await db
    .select({ content: questionSet.content, id: questionSet.id })
    .from(questionSet)
    .where(and(eq(questionSet.workspaceId, round.workspaceId), inArray(questionSet.id, ids)));
  const byId = Object.fromEntries(sets.map((set) => [set.id, set.content] as const));
  const content: typeof interviewQuestionSnapshot.$inferInsert.content = {
    conversation: [],
    form: [],
    version: 1,
  };
  for (const questionSetId of ids) {
    const set = byId[questionSetId];
    if (set.kind === "form") {
      content.form.push(
        ...set.questions.map((question, questionIndex) => ({
          id: crypto.randomUUID(),
          question,
          questionIndex,
          questionSetId,
        })),
      );
    } else {
      content.conversation.push(
        ...set.questions.map((question, questionIndex) => ({
          id: crypto.randomUUID(),
          question,
          questionIndex,
          questionSetId,
        })),
      );
    }
  }
  // 只插入一次，重复进入始终读取已经绑定的题目和 ID。
  // Insert once; repeated entries always read the bound questions and IDs.
  await db
    .insert(interviewQuestionSnapshot)
    .values({
      capturedAt: new Date(),
      content,
      interviewRoundId: round.id,
      workspaceId: round.workspaceId,
    })
    .onConflictDoNothing({ target: interviewQuestionSnapshot.interviewRoundId });
  const [snapshot] = await db
    .select()
    .from(interviewQuestionSnapshot)
    .where(eq(interviewQuestionSnapshot.interviewRoundId, round.id));
  return snapshot;
}

export async function enterCandidateInterview(db: Database, token: string) {
  const result = await candidateInterview(db, token);
  if (!result) {
    return;
  }
  const { round, jobTitle, workspaceName } = result;
  const snapshot = round.kind === "ai" ? await bindQuestions(db, round) : null;
  return {
    admissionDeadline: round.admissionDeadline,
    jobTitle,
    kind: round.kind,
    label: round.label,
    // 候选人只接收表单题；沟通题及内部评价指引不发送到浏览器。
    // Candidates receive form questions only; conversation questions and internal evaluation guidance stay on the server.
    questions: snapshot
      ? {
          capturedAt: snapshot.capturedAt,
          conversationCount: snapshot.content.conversation.length,
          form: snapshot.content.form.map(({ id, question }) => ({ id, ...question })),
          version: snapshot.content.version,
        }
      : null,
    scheduledAt: round.scheduledAt,
    sequence: round.sequence,
    status: round.status,
    version: 1 as const,
    workspaceName,
  };
}
