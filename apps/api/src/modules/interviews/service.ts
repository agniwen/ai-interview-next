import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  candidate,
  interviewerAgent,
  interviewRound,
  interviewAssignment,
  interviewQuestionSnapshot,
  interviewEvaluation,
  job,
  member,
  user,
  questionSet,
} from "@ai-interview/db/schema";
import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { z } from "zod";
import type { CreateInterviewInput, workspaceInterviewQuery } from "./input";
import { interviewActivityValues } from "./activity";
import type { ListQuery } from "../ats/input";
import { canConfirmEvaluation, evaluationSummary, readEvaluationSummary } from "./evaluation-state";

/** 已删除及其他工作区的招聘记录不作为面试入口。
 * Deleted applications and applications in other workspaces are unavailable as interview entry points. */
export function interviewApplication(db: Database, workspaceId: string, id: string) {
  return db
    .select()
    .from(application)
    .where(
      and(
        eq(application.id, id),
        eq(application.workspaceId, workspaceId),
        isNull(application.deletedAt),
      ),
    )
    .get();
}

async function selectionError(
  db: Database,
  workspaceId: string,
  input: Extract<CreateInterviewInput, { kind: "ai" }>,
  questionsBound: boolean,
) {
  const ids = [...input.formQuestionSetIds, ...input.conversationQuestionSetIds];
  const [agent, reviewer, sets] = await Promise.all([
    db
      .select({ id: interviewerAgent.id })
      .from(interviewerAgent)
      .where(
        and(
          eq(interviewerAgent.workspaceId, workspaceId),
          eq(interviewerAgent.id, input.interviewerAgentId),
        ),
      )
      .get(),
    input.confirmationUserId
      ? db
          .select({ id: member.id })
          .from(member)
          .where(
            and(
              eq(member.organizationId, workspaceId),
              eq(member.userId, input.confirmationUserId),
            ),
          )
          .get()
      : undefined,
    db
      .select({ content: questionSet.content, id: questionSet.id })
      .from(questionSet)
      .where(and(eq(questionSet.workspaceId, workspaceId), inArray(questionSet.id, ids))),
  ]);
  if (!agent) {
    return "INTERVIEWER_AGENT_UNAVAILABLE" as const;
  }
  if (input.confirmationUserId && !reviewer) {
    return "CONFIRMATION_USER_UNAVAILABLE" as const;
  }
  if (questionsBound) {
    return;
  }
  const byId = new Map(sets.map((set) => [set.id, set.content]));
  if (
    input.formQuestionSetIds.some((id) => byId.get(id)?.kind !== "form") ||
    input.conversationQuestionSetIds.some((id) => byId.get(id)?.kind !== "conversation")
  ) {
    return "QUESTION_SET_UNAVAILABLE" as const;
  }
  if (!input.conversationQuestionSetIds.some((id) => byId.get(id)?.questions.length)) {
    return "CONVERSATION_QUESTIONS_REQUIRED" as const;
  }
}

async function interviewSelectionError(
  db: Database,
  workspaceId: string,
  input: CreateInterviewInput,
  questionsBound = false,
) {
  if (input.kind === "human") {
    const members = await db
      .select({ id: member.userId })
      .from(member)
      .where(
        and(
          eq(member.organizationId, workspaceId),
          inArray(member.userId, input.interviewerUserIds),
        ),
      );
    if (members.length !== input.interviewerUserIds.length) {
      return "INTERVIEWER_USER_UNAVAILABLE" as const;
    }
    return;
  }
  return selectionError(db, workspaceId, input, questionsBound);
}

function roundSettings(input: CreateInterviewInput) {
  return {
    admissionDeadline: input.kind === "human" ? new Date(input.admissionDeadline) : null,
    interviewerAgentId: input.kind === "ai" ? input.interviewerAgentId : null,
    kind: input.kind,
    label: input.label,
    questionSelection: {
      conversationQuestionSetIds: input.kind === "ai" ? input.conversationQuestionSetIds : [],
      formQuestionSetIds: input.kind === "ai" ? input.formQuestionSetIds : [],
      version: 1 as const,
    },
    scheduledAt: input.kind === "human" ? new Date(input.scheduledAt) : null,
  };
}

function assignmentValues(workspaceId: string, id: string, input: CreateInterviewInput) {
  const assignees = input.kind === "human" ? input.interviewerUserIds : [];
  if (input.kind === "ai" && input.confirmationUserId) {
    assignees.push(input.confirmationUserId);
  }
  return assignees.map((assigneeId, position) => ({
    interviewRoundId: id,
    position,
    role: input.kind === "human" ? ("interviewer" as const) : ("reviewer" as const),
    userId: assigneeId,
    workspaceId,
  }));
}

async function isWorkspaceManager(db: Database, workspaceId: string, userId: string) {
  const membership = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, workspaceId), eq(member.userId, userId)))
    .get();
  return membership?.role === "admin" || membership?.role === "owner";
}

export async function interviewCreationState(
  db: Database,
  workspaceId: string,
  applicationId: string,
) {
  const previous = await db
    .select()
    .from(interviewRound)
    .where(
      and(
        eq(interviewRound.workspaceId, workspaceId),
        eq(interviewRound.applicationId, applicationId),
      ),
    )
    .orderBy(desc(interviewRound.sequence), desc(interviewRound.id))
    .get();
  if (!previous) {
    return { allowed: true, sequence: 1 };
  }
  const evaluation = await readEvaluationSummary(db, workspaceId, previous.id, previous.kind);
  return {
    allowed:
      previous.status === "completed" && evaluation.complete && evaluation.conclusion !== "fail",
    sequence: previous.sequence + 1,
  };
}

/** 后续轮次需要上一轮的正式评价全部确认，并采用人工确认后的结论。
 * Later rounds require all formal evaluations of the previous round and follow the human-confirmed verdict. */
export async function createInterview(
  db: Database,
  workspaceId: string,
  applicationId: string,
  userId: string,
  input: CreateInterviewInput,
) {
  const record = await interviewApplication(db, workspaceId, applicationId);
  if (!record) {
    return { error: "APPLICATION_UNAVAILABLE" as const, status: 404 as const };
  }
  if (record.closedAt) {
    return { error: "APPLICATION_CLOSED" as const, status: 409 as const };
  }
  const creation = await interviewCreationState(db, workspaceId, applicationId);
  if (!creation.allowed) {
    return { error: "INTERVIEW_EVALUATION_REQUIRED" as const, status: 409 as const };
  }
  const error = await interviewSelectionError(db, workspaceId, input);
  if (error) {
    return { error, status: 400 as const };
  }
  const id: string = crypto.randomUUID();
  const createdAt = new Date();
  const assignments = assignmentValues(workspaceId, id, input);
  await db.batch([
    db.insert(interviewRound).values({
      ...roundSettings(input),
      applicationId,
      createdAt,
      createdBy: userId,
      id,
      sequence: creation.sequence,
      status: "scheduled",
      workspaceId,
    }),
    ...(assignments.length ? [db.insert(interviewAssignment).values(assignments)] : []),
    db.insert(applicationActivity).values(
      interviewActivityValues(
        {
          applicationId,
          id,
          kind: input.kind,
          label: input.label,
          sequence: creation.sequence,
          workspaceId,
        },
        "interview_created",
        { actorId: userId, actorType: "user" },
        createdAt,
      ),
    ),
  ]);
  return { id, version: 1 as const };
}

async function roundAssignments(db: Database, workspaceId: string, ids: string[]) {
  const rows = await db
    .select({
      email: user.email,
      id: user.id,
      image: user.image,
      name: user.name,
      role: interviewAssignment.role,
      roundId: interviewAssignment.interviewRoundId,
    })
    .from(interviewAssignment)
    .innerJoin(user, eq(user.id, interviewAssignment.userId))
    .where(
      and(
        eq(interviewAssignment.workspaceId, workspaceId),
        inArray(interviewAssignment.interviewRoundId, ids),
      ),
    )
    .orderBy(asc(interviewAssignment.position), asc(interviewAssignment.userId));
  const grouped = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = grouped.get(row.roundId) ?? [];
    list.push(row);
    grouped.set(row.roundId, list);
  }
  return grouped;
}

export async function listWorkspaceInterviews(
  db: Database,
  workspaceId: string,
  { kind, page, pageSize, search, status }: z.output<typeof workspaceInterviewQuery>,
) {
  const where = and(
    eq(interviewRound.workspaceId, workspaceId),
    isNull(application.deletedAt),
    kind ? eq(interviewRound.kind, kind) : undefined,
    status ? eq(interviewRound.status, status) : undefined,
    search
      ? or(
          sql`instr(lower(${candidate.name}), lower(${search})) > 0`,
          sql`instr(lower(${job.title}), lower(${search})) > 0`,
          sql`instr(lower(${interviewRound.label}), lower(${search})) > 0`,
        )
      : undefined,
  );
  const fromRounds = db
    .select({
      agentName: sql<string | null>`${interviewerAgent.name}`.as("agent_name"),
      applicationId: interviewRound.applicationId,
      candidateName: candidate.name,
      createdAt: interviewRound.createdAt,
      id: interviewRound.id,
      jobTitle: job.title,
      kind: interviewRound.kind,
      label: interviewRound.label,
      scheduledAt: interviewRound.scheduledAt,
      sequence: interviewRound.sequence,
      status: interviewRound.status,
    })
    .from(interviewRound)
    .innerJoin(
      application,
      and(
        eq(application.id, interviewRound.applicationId),
        eq(application.workspaceId, interviewRound.workspaceId),
      ),
    )
    .innerJoin(candidate, eq(candidate.id, application.candidateId))
    .innerJoin(job, eq(job.id, application.jobId))
    .leftJoin(interviewerAgent, eq(interviewerAgent.id, interviewRound.interviewerAgentId))
    .where(where)
    .as("workspace_interviews");
  const [rows, total] = await Promise.all([
    db
      .select()
      .from(fromRounds)
      .orderBy(desc(fromRounds.createdAt), desc(fromRounds.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.$count(fromRounds),
  ]);
  const assignments = await roundAssignments(
    db,
    workspaceId,
    rows.map(({ id }) => id),
  );
  return {
    page,
    pageSize,
    rows: rows.map((row) => ({
      ...row,
      interviewers: (assignments.get(row.id) ?? [])
        .filter(({ role }) => role === "interviewer")
        .map(({ id, name }) => ({ id, name })),
    })),
    total,
    version: 1 as const,
  };
}

export async function listInterviews(
  db: Database,
  workspaceId: string,
  applicationId: string,
  { page, pageSize }: Pick<ListQuery, "page" | "pageSize">,
  userId: string,
) {
  const where = and(
    eq(interviewRound.workspaceId, workspaceId),
    eq(interviewRound.applicationId, applicationId),
  );
  const [rows, total, manager, creation, record] = await Promise.all([
    db
      .select({
        confirmationImage: user.image,
        confirmationName: user.name,
        interviewerName: interviewerAgent.name,
        round: interviewRound,
      })
      .from(interviewRound)
      .leftJoin(interviewerAgent, eq(interviewRound.interviewerAgentId, interviewerAgent.id))
      .leftJoin(
        interviewAssignment,
        and(
          eq(interviewAssignment.workspaceId, interviewRound.workspaceId),
          eq(interviewAssignment.interviewRoundId, interviewRound.id),
          eq(interviewAssignment.role, "reviewer"),
        ),
      )
      .leftJoin(user, eq(interviewAssignment.userId, user.id))
      .where(where)
      .orderBy(asc(interviewRound.sequence), asc(interviewRound.id))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.$count(interviewRound, where),
    isWorkspaceManager(db, workspaceId, userId),
    interviewCreationState(db, workspaceId, applicationId),
    interviewApplication(db, workspaceId, applicationId),
  ]);
  const assignments = await roundAssignments(
    db,
    workspaceId,
    rows.map(({ round }) => round.id),
  );
  const evaluations = await db
    .select()
    .from(interviewEvaluation)
    .where(
      and(
        eq(interviewEvaluation.workspaceId, workspaceId),
        inArray(
          interviewEvaluation.interviewRoundId,
          rows.map(({ round }) => round.id),
        ),
      ),
    )
    .orderBy(asc(interviewEvaluation.submittedAt), asc(interviewEvaluation.authorUserId));
  return {
    canCreateRound: creation.allowed && !record?.closedAt,
    page,
    pageSize,
    rows: rows.map(({ round, ...names }) => {
      const people = assignments.get(round.id) ?? [];
      const roundEvaluations = evaluations.filter((item) => item.interviewRoundId === round.id);
      const requiredUserIds = people.map((person) => person.id);
      const evaluation = evaluationSummary(round.kind, requiredUserIds, roundEvaluations);
      return {
        ...round,
        ...names,
        canDelete: round.status === "scheduled" && round.createdBy === userId,
        canEdit: round.status === "scheduled" && (round.createdBy === userId || manager),
        canEvaluate:
          round.status === "completed" &&
          !evaluation.complete &&
          canConfirmEvaluation(round.kind, requiredUserIds, userId) &&
          !roundEvaluations.some((item) => item.authorUserId === userId && item.submittedAt),
        canJoin:
          round.kind === "human" &&
          round.status !== "completed" &&
          !record?.closedAt &&
          people.some((person) => person.role === "interviewer" && person.id === userId),
        evaluation,
        interviewers: people.filter((person) => person.role === "interviewer"),
      };
    }),
    total,
    version: 1 as const,
  };
}

export async function getInterview(db: Database, workspaceId: string, id: string) {
  const result = await db
    .select({ questionsBoundAt: interviewQuestionSnapshot.capturedAt, round: interviewRound })
    .from(interviewRound)
    .leftJoin(
      interviewQuestionSnapshot,
      eq(interviewQuestionSnapshot.interviewRoundId, interviewRound.id),
    )
    .innerJoin(application, eq(application.id, interviewRound.applicationId))
    .where(
      and(
        eq(interviewRound.workspaceId, workspaceId),
        eq(interviewRound.id, id),
        isNull(application.deletedAt),
      ),
    )
    .get();
  if (!result) {
    return;
  }
  const assignments = await roundAssignments(db, workspaceId, [id]);
  return {
    round: {
      ...result.round,
      assignments: assignments.get(id) ?? [],
      questionsBoundAt: result.questionsBoundAt,
    },
  };
}

export async function deleteInterview(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const result = await getInterview(db, workspaceId, id);
  if (!result) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  if (result.round.createdBy !== userId) {
    return { error: "INTERVIEW_DELETE_FORBIDDEN" as const, status: 403 as const };
  }
  if (result.round.status !== "scheduled") {
    return { error: "INTERVIEW_NOT_DELETABLE" as const, status: 409 as const };
  }
  await db
    .delete(interviewRound)
    .where(and(eq(interviewRound.workspaceId, workspaceId), eq(interviewRound.id, id)));
  return { id, version: 1 as const };
}

export async function editableInterview(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
) {
  const result = await getInterview(db, workspaceId, id);
  if (!result) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  if (result.round.createdBy !== userId && !(await isWorkspaceManager(db, workspaceId, userId))) {
    return { error: "INTERVIEW_EDIT_FORBIDDEN" as const, status: 403 as const };
  }
  if (result.round.status !== "scheduled") {
    return { error: "INTERVIEW_NOT_EDITABLE" as const, status: 409 as const };
  }
  return result;
}

export async function updateInterview(
  db: Database,
  workspaceId: string,
  id: string,
  userId: string,
  input: CreateInterviewInput,
) {
  const result = await editableInterview(db, workspaceId, id, userId);
  if ("error" in result) {
    return result;
  }
  if (input.kind !== result.round.kind) {
    return { error: "INTERVIEW_KIND_IMMUTABLE" as const, status: 400 as const };
  }
  const questionsBound = result.round.questionsBoundAt !== null;
  if (
    questionsBound &&
    input.kind === "ai" &&
    (JSON.stringify(input.formQuestionSetIds) !==
      JSON.stringify(result.round.questionSelection.formQuestionSetIds) ||
      JSON.stringify(input.conversationQuestionSetIds) !==
        JSON.stringify(result.round.questionSelection.conversationQuestionSetIds))
  ) {
    return { error: "INTERVIEW_QUESTIONS_LOCKED" as const, status: 409 as const };
  }
  const error = await interviewSelectionError(db, workspaceId, input, questionsBound);
  if (error) {
    return { error, status: 400 as const };
  }
  const assignments = assignmentValues(workspaceId, id, input);
  await db.batch([
    db
      .update(interviewRound)
      .set(roundSettings(input))
      .where(and(eq(interviewRound.workspaceId, workspaceId), eq(interviewRound.id, id))),
    db
      .delete(interviewAssignment)
      .where(
        and(
          eq(interviewAssignment.workspaceId, workspaceId),
          eq(interviewAssignment.interviewRoundId, id),
        ),
      ),
    ...(assignments.length ? [db.insert(interviewAssignment).values(assignments)] : []),
  ]);
  return { id, version: 1 as const };
}
