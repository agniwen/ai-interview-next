import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listQuery = paginationQuery.extend({
  search: z.string().trim().max(200).default(""),
});

export const jobListQuery = listQuery.extend({ projectId: z.uuid().optional() });

export const projectInput = z.strictObject({
  title: z.string().trim().min(1).max(200),
  version: z.literal(1),
});

export const jobInput = projectInput.extend({
  projectId: z.uuid().optional(),
  requirements: z.string().trim().min(1).max(30_000),
});

export const updateJobInput = jobInput.extend({ projectId: z.uuid().nullable() });

export const applicationListQuery = jobListQuery.extend({
  status: z.enum(["open", "closed"]).optional(),
});

export const resumeListQuery = listQuery.extend({
  status: z.enum(["waiting", "queued", "running", "succeeded", "failed", "skipped"]).optional(),
});

export const resumeOptionsQuery = listQuery.extend({
  offsetMinutes: z.coerce.number().int().min(-840).max(840).default(0),
});

export type ListQuery = z.output<typeof listQuery>;
export type JobListQuery = z.output<typeof jobListQuery>;
export type ApplicationListQuery = z.output<typeof applicationListQuery>;
export type ResumeListQuery = z.output<typeof resumeListQuery>;
export type ResumeOptionsQuery = z.output<typeof resumeOptionsQuery>;
