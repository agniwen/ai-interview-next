import type { Database } from "@ai-interview/db";
import { department, job, recruitmentProject } from "@ai-interview/db/schema";
import { and, eq, getTableColumns } from "drizzle-orm";
import type { z } from "zod";
import type { OperationAudit } from "../mcp/audit";
import { changedFields } from "../mcp/audit";
import type { departmentInput, jobInput, projectDetailsInput } from "./input";

type Department = Omit<z.infer<typeof departmentInput>, "version">;
type Project = Omit<z.infer<typeof projectDetailsInput>, "version">;
type Save<T> = { id?: undefined; values: T } | { id: string; values: Partial<T> };
type Job = Omit<z.infer<typeof jobInput>, "version" | "projectId"> & { projectId?: string | null };

export function getDepartment(db: Database, workspaceId: string, id: string) {
  return db
    .select()
    .from(department)
    .where(and(eq(department.workspaceId, workspaceId), eq(department.id, id)))
    .get();
}

export function getProject(db: Database, workspaceId: string, id: string) {
  return db
    .select()
    .from(recruitmentProject)
    .where(and(eq(recruitmentProject.workspaceId, workspaceId), eq(recruitmentProject.id, id)))
    .get();
}

export async function saveDepartment(
  db: Database,
  workspaceId: string,
  userId: string,
  input: Save<Department>,
  audit?: OperationAudit,
) {
  const { id, values } = input;
  if (id !== undefined) {
    const before = await getDepartment(db, workspaceId, id);
    if (!before) {
      return { error: "DEPARTMENT_UNAVAILABLE" } as const;
    }
    const filter = and(eq(department.workspaceId, workspaceId), eq(department.id, id));
    const change = db.update(department).set(values).where(filter);
    await (audit
      ? db.batch([audit.edit(id, department, getTableColumns(department), values, filter), change])
      : change);
    return { id, version: 1 } as const;
  }
  const createdAt = new Date();
  const newId = crypto.randomUUID();
  const change = db.insert(department).values({
    ...values,
    createdAt,
    createdBy: userId,
    id: newId,
    name: values.name,
    workspaceId,
  });
  await (audit
    ? db.batch([
        change,
        audit.success({ changes: changedFields({}, values), id: newId }, createdAt),
      ])
    : change);
  return { id: newId, version: 1 } as const;
}

export async function saveProject(
  db: Database,
  workspaceId: string,
  userId: string,
  input: Save<Project>,
  audit?: OperationAudit,
) {
  const { id, values } = input;
  if (id !== undefined) {
    const before = await getProject(db, workspaceId, id);
    if (!before) {
      return { error: "PROJECT_UNAVAILABLE" } as const;
    }
    const filter = and(
      eq(recruitmentProject.workspaceId, workspaceId),
      eq(recruitmentProject.id, id),
    );
    const change = db.update(recruitmentProject).set(values).where(filter);
    await (audit
      ? db.batch([
          audit.edit(id, recruitmentProject, getTableColumns(recruitmentProject), values, filter),
          change,
        ])
      : change);
    return { id, version: 1 } as const;
  }
  const createdAt = new Date();
  const newId = crypto.randomUUID();
  const change = db.insert(recruitmentProject).values({
    ...values,
    createdAt,
    createdBy: userId,
    id: newId,
    title: values.title,
    workspaceId,
  });
  await (audit
    ? db.batch([
        change,
        audit.success({ changes: changedFields({}, values), id: newId }, createdAt),
      ])
    : change);
  return { id: newId, version: 1 } as const;
}

export async function saveJob(
  db: Database,
  workspaceId: string,
  userId: string,
  input: Save<Job>,
  audit?: OperationAudit,
) {
  const { id, values } = input;
  if (values.departmentId && !(await getDepartment(db, workspaceId, values.departmentId))) {
    return { error: "DEPARTMENT_UNAVAILABLE" } as const;
  }
  if (values.projectId && !(await getProject(db, workspaceId, values.projectId))) {
    return { error: "PROJECT_UNAVAILABLE" } as const;
  }
  if (id !== undefined) {
    const filter = and(eq(job.id, id), eq(job.workspaceId, workspaceId));
    const before = await db.select().from(job).where(filter).get();
    if (!before) {
      return { error: "JOB_UNAVAILABLE" } as const;
    }
    const change = db.update(job).set(values).where(filter);
    await (audit
      ? db.batch([audit.edit(id, job, getTableColumns(job), values, filter), change])
      : change);
    return { id, version: 1 } as const;
  }
  const createdAt = new Date();
  const newId = crypto.randomUUID();
  const change = db.insert(job).values({
    ...values,
    createdAt,
    createdBy: userId,
    id: newId,
    requirements: values.requirements,
    title: values.title,
    workspaceId,
  });
  await (audit
    ? db.batch([
        change,
        audit.success({ changes: changedFields({}, values), id: newId }, createdAt),
      ])
    : change);
  return { id: newId, version: 1 } as const;
}

export function getJob(db: Database, workspaceId: string, id: string) {
  return db
    .select({
      createdBy: job.createdBy,
      department: department.name,
      departmentId: job.departmentId,
      id: job.id,
      internalCriteria: job.internalCriteria,
      projectId: job.projectId,
      projectTitle: recruitmentProject.title,
      requirements: job.requirements,
      title: job.title,
    })
    .from(job)
    .leftJoin(
      recruitmentProject,
      and(
        eq(recruitmentProject.id, job.projectId),
        eq(recruitmentProject.workspaceId, job.workspaceId),
      ),
    )
    .leftJoin(
      department,
      and(eq(department.id, job.departmentId), eq(department.workspaceId, job.workspaceId)),
    )
    .where(and(eq(job.id, id), eq(job.workspaceId, workspaceId)))
    .get();
}
