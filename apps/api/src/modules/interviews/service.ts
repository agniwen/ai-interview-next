import type { Database } from "@ai-interview/db";
import {
  application,
  interviewerAgent,
  interviewRound,
  interviewAssignment,
  member,
  user,
  questionSet,
} from "@ai-interview/db/schema";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { CreateInterviewInput } from "./input";
import type { ListQuery } from "../ats/input";

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
  confirmationUserId: string,
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
    db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, workspaceId), eq(member.userId, confirmationUserId)))
      .get(),
    db
      .select({ content: questionSet.content, id: questionSet.id })
      .from(questionSet)
      .where(and(eq(questionSet.workspaceId, workspaceId), inArray(questionSet.id, ids))),
  ]);
  if (!agent) {
    return "INTERVIEWER_AGENT_UNAVAILABLE" as const;
  }
  if (!reviewer) {
    return "CONFIRMATION_USER_UNAVAILABLE" as const;
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
  userId: string,
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
  const confirmationUserId = input.confirmationUserId ?? userId;
  return selectionError(db, workspaceId, input, confirmationUserId);
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

function assignmentValues(
  workspaceId: string,
  id: string,
  input: CreateInterviewInput,
  userId: string,
) {
  const assignees =
    input.kind === "human" ? input.interviewerUserIds : [input.confirmationUserId ?? userId];
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

/** 只开放首轮创建；后续轮次须接入正式评价确认规则后开放。
 * Only first-round creation is available; later rounds require formal evaluation confirmation rules. */
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
  const previous = await db
    .select({ id: interviewRound.id })
    .from(interviewRound)
    .where(
      and(
        eq(interviewRound.workspaceId, workspaceId),
        eq(interviewRound.applicationId, applicationId),
      ),
    )
    .get();
  if (previous) {
    return { error: "INTERVIEW_ALREADY_EXISTS" as const, status: 409 as const };
  }
  const error = await interviewSelectionError(db, workspaceId, input, userId);
  if (error) {
    return { error, status: 400 as const };
  }
  const id: string = crypto.randomUUID();
  await db.batch([
    db.insert(interviewRound).values({
      ...roundSettings(input),
      applicationId,
      createdAt: new Date(),
      createdBy: userId,
      id,
      sequence: 1,
      status: "scheduled",
      workspaceId,
    }),
    db.insert(interviewAssignment).values(assignmentValues(workspaceId, id, input, userId)),
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
  const [rows, total, manager] = await Promise.all([
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
  ]);
  const assignments = await roundAssignments(
    db,
    workspaceId,
    rows.map(({ round }) => round.id),
  );
  return {
    page,
    pageSize,
    rows: rows.map(({ round, ...names }) => ({
      ...round,
      ...names,
      canDelete: round.status === "scheduled" && round.createdBy === userId,
      canEdit: round.status === "scheduled" && (round.createdBy === userId || manager),
      interviewers: (assignments.get(round.id) ?? []).filter(
        (person) => person.role === "interviewer",
      ),
    })),
    total,
    version: 1 as const,
  };
}

export async function getInterview(db: Database, workspaceId: string, id: string) {
  const result = await db
    .select({ round: interviewRound })
    .from(interviewRound)
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
  return { round: { ...result.round, assignments: assignments.get(id) ?? [] } };
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
  const error = await interviewSelectionError(db, workspaceId, input, userId);
  if (error) {
    return { error, status: 400 as const };
  }
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
    db.insert(interviewAssignment).values(assignmentValues(workspaceId, id, input, userId)),
  ]);
  return { id, version: 1 as const };
}
