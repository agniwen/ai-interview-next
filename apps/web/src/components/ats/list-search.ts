import { z } from "zod";

export const resumeStatuses = [
  "waiting",
  "queued",
  "running",
  "succeeded",
  "failed",
  "skipped",
] as const;
export const applicationStatuses = ["open", "closed"] as const;

export const listSearch = z.object({
  page: z.number().int().min(1).max(1_000_000).catch(1).default(1),
  pageSize: z.number().int().min(1).max(100).catch(20).default(20),
  search: z
    .union([z.string(), z.number()])
    .transform(String)
    .pipe(z.string().trim().max(200))
    .catch("")
    .default(""),
});

export const jobListSearch = listSearch.extend({
  projectId: z.uuid().optional().catch(undefined),
});

export const applicationListSearch = jobListSearch.extend({
  status: z.enum(applicationStatuses).optional().catch(undefined),
});

export const resumeListSearch = listSearch.extend({
  status: z.enum(resumeStatuses).optional().catch(undefined),
});

export type ListSearch = z.output<typeof listSearch>;
export type JobListSearch = z.output<typeof jobListSearch>;
export type ApplicationListSearch = z.output<typeof applicationListSearch>;
export type ResumeListSearch = z.output<typeof resumeListSearch>;

export function listParams<T extends ListSearch>({ page, pageSize, search, ...filters }: T) {
  return {
    ...filters,
    page: String(page),
    pageSize: String(pageSize),
    search: search || undefined,
  };
}
