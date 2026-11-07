import type { Database } from "@ai-interview/db";
import {
  application,
  interviewInvitation,
  interviewFormResponse,
  interviewQuestionSnapshot,
  interviewRound,
  job,
  organization,
  questionSet,
} from "@ai-interview/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { CandidateFormInput } from "./input";

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

async function readFormResponse(db: Database, roundId: string) {
  const form = await db
    .select({
      content: interviewFormResponse.content,
      submittedAt: interviewFormResponse.submittedAt,
      updatedAt: interviewFormResponse.updatedAt,
    })
    .from(interviewFormResponse)
    .where(eq(interviewFormResponse.interviewRoundId, roundId))
    .get();
  return form ? { ...form, version: 1 as const } : null;
}

export async function enterCandidateInterview(db: Database, token: string) {
  const result = await candidateInterview(db, token);
  if (!result) {
    return;
  }
  const { round, jobTitle, workspaceName } = result;
  const snapshot = round.kind === "ai" ? await bindQuestions(db, round) : null;
  const form = snapshot ? await readFormResponse(db, round.id) : null;
  return {
    admissionDeadline: round.admissionDeadline,
    form: form ?? null,
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

function formAnswerError(
  questions: typeof interviewQuestionSnapshot.$inferSelect.content.form,
  input: CandidateFormInput,
  submit: boolean,
) {
  const byId = new Map(questions.map(({ id, question }) => [id, question]));
  for (const [id, value] of Object.entries(input.answers)) {
    const question = byId.get(id);
    if (!question) {
      return "INTERVIEW_FORM_INVALID" as const;
    }
    if (value === null) {
      continue;
    }
    let valid: boolean;
    if (question.type === "text") {
      valid = typeof value === "string";
    } else if (question.type === "single_choice") {
      valid = typeof value === "number" && value < question.options.length;
    } else {
      valid = Array.isArray(value) && value.every((index) => index < question.options.length);
    }
    if (!valid) {
      return "INTERVIEW_FORM_INVALID" as const;
    }
  }
  if (
    submit &&
    questions.some(({ id }) => {
      const value = input.answers[id];
      return (
        value === null ||
        value === undefined ||
        (typeof value === "string" && value.trim().length === 0) ||
        (Array.isArray(value) && value.length === 0)
      );
    })
  ) {
    return "INTERVIEW_FORM_INCOMPLETE" as const;
  }
}

export async function saveCandidateForm(
  db: Database,
  token: string,
  input: CandidateFormInput,
  submit: boolean,
) {
  const entry = await candidateInterview(db, token);
  if (!entry) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  if (entry.round.status !== "scheduled") {
    return { error: "INTERVIEW_FORM_LOCKED" as const, status: 409 as const };
  }
  const snapshot = await db
    .select()
    .from(interviewQuestionSnapshot)
    .where(eq(interviewQuestionSnapshot.interviewRoundId, entry.round.id))
    .get();
  if (entry.round.kind !== "ai" || !snapshot?.content.form.length) {
    return { error: "INTERVIEW_FORM_UNAVAILABLE" as const, status: 409 as const };
  }
  const error = formAnswerError(snapshot.content.form, input, submit);
  if (error) {
    return { error, status: 400 as const };
  }
  const now = new Date();
  const form = { content: input, submittedAt: submit ? now : null, updatedAt: now };
  await db
    .insert(interviewFormResponse)
    .values({
      ...form,
      interviewRoundId: entry.round.id,
      workspaceId: entry.round.workspaceId,
    })
    .onConflictDoUpdate({ set: form, target: interviewFormResponse.interviewRoundId });
  return { form: { ...form, version: 1 as const } };
}
