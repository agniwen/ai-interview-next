import type { RecruitingCard } from "@ai-interview/agent";
import type { ToolContext } from "../mcp/tools";
import { getJob } from "../ats/service";
import { getUploadResumeProfile } from "../ats/queries";
import {
  application,
  candidate,
  interviewRound,
  job,
  recruitmentProject,
} from "@ai-interview/db/schema";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";

const row = z.object({
  candidateName: z.string().nullish(),
  department: z.string().nullish(),
  email: z.string().nullish(),
  filename: z.string().nullish(),
  id: z.string().optional(),
  internalCriteria: z.string().nullish(),
  jobTitle: z.string().nullish(),
  latestEmployer: z.string().nullish(),
  name: z.string().nullish(),
  phoneNormalized: z.string().nullish(),
  projectTitle: z.string().nullish(),
  requirements: z.string().nullish(),
  stage: z.string().nullish(),
  status: z.string().nullish(),
  title: z.string().nullish(),
  uploadId: z.string().nullish(),
});
const resultShape = row.extend({
  application: row.optional(),
  rows: z.array(row).optional(),
});

const kinds = new Map<string, RecruitingCard["kind"]>([
  ["search_jobs", "job"],
  ["get_job", "job"],
  ["search_candidates", "candidate"],
  ["get_candidate", "candidate"],
  ["list_applications", "application"],
  ["get_application", "application"],
  ["list_resumes", "resume"],
  ["get_resume", "resume"],
  ["list_candidate_resumes", "resume"],
]);

async function resumeCard(
  db: ToolContext["db"],
  workspaceId: string,
  id: string,
  record: z.infer<typeof row>,
): Promise<RecruitingCard> {
  const resume = await getUploadResumeProfile(db, workspaceId, id);
  const profile = resume?.profile;
  const experience = profile?.employment
    ?.map(({ employer, title }) => [employer, title].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join("\n");
  const education = profile?.education
    ?.map(({ institution, degree }) => [institution, degree].filter(Boolean).join(" · "))
    .filter(Boolean)
    .join("\n");
  return {
    fields: {
      education,
      experience,
      filename: record.filename,
      status: resume?.parseStatus ?? record.status,
    },
    id,
    kind: "resume",
    subtitle: record.filename ?? null,
    title: profile?.identity?.name ?? record.candidateName ?? record.filename ?? null,
    version: 1,
  };
}

export async function captureRecruitingCards(
  { actor, db }: ToolContext,
  name: string,
  args: unknown,
  result: unknown,
): Promise<RecruitingCard[]> {
  const kind = kinds.get(name);
  if (!kind) {
    return [];
  }
  const parsed = resultShape.parse(result);
  const input = row.parse(args);
  const rows = parsed.rows ?? [parsed.application ?? parsed];
  const { workspaceId } = actor;
  if (kind === "application") {
    const ids = rows.flatMap(({ id }) => (id ? [id] : []));
    if (!ids.length) {
      return [];
    }
    const selectedIds = sql`(select value from json_each(${JSON.stringify(ids)}))`;
    const [details, interviews] = await Promise.all([
      db
        .select({
          candidateName: candidate.name,
          closedAt: application.closedAt,
          id: application.id,
          project: recruitmentProject.title,
          stage: application.stage,
        })
        .from(application)
        .innerJoin(
          candidate,
          and(eq(candidate.id, application.candidateId), eq(candidate.workspaceId, workspaceId)),
        )
        .innerJoin(job, and(eq(job.id, application.jobId), eq(job.workspaceId, workspaceId)))
        .leftJoin(
          recruitmentProject,
          and(
            eq(recruitmentProject.id, job.projectId),
            eq(recruitmentProject.workspaceId, workspaceId),
          ),
        )
        .where(
          and(eq(application.workspaceId, workspaceId), sql`${application.id} in ${selectedIds}`),
        ),
      db
        .select({
          applicationId: interviewRound.applicationId,
          label: interviewRound.label,
          scheduledAt: interviewRound.scheduledAt,
          sequence: interviewRound.sequence,
          status: interviewRound.status,
        })
        .from(interviewRound)
        .where(
          and(
            eq(interviewRound.workspaceId, workspaceId),
            sql`${interviewRound.applicationId} in ${selectedIds}`,
          ),
        )
        .orderBy(asc(interviewRound.sequence), asc(interviewRound.id)),
    ]);
    return rows.flatMap((record) => {
      if (!record.id) {
        return [];
      }
      const detail = details.find(({ id }) => id === record.id);
      return [
        {
          fields: {
            project: detail?.project,
            stage: record.stage ?? detail?.stage,
            status: detail?.closedAt ? "closed" : "open",
          },
          id: record.id,
          interviews: interviews
            .filter(({ applicationId }) => applicationId === record.id)
            .map(({ sequence, label, status, scheduledAt }) => ({
              label,
              scheduledAt: scheduledAt?.toISOString() ?? null,
              sequence,
              status,
            })),
          kind,
          subtitle: record.jobTitle ?? null,
          title: record.candidateName ?? detail?.candidateName ?? null,
          version: 1,
        },
      ];
    });
  }
  return Promise.all(
    rows.map(async (record) => {
      const id = record.uploadId ?? record.id ?? input.id ?? "";
      const base = { id, kind, version: 1 as const };
      switch (kind) {
        case "job": {
          const jobDetail = name === "get_job" ? record : await getJob(db, workspaceId, id);
          return {
            ...base,
            fields: {
              department: jobDetail?.department,
              internalCriteria: jobDetail?.internalCriteria,
              project: record.projectTitle,
              requirements: jobDetail?.requirements,
            },
            subtitle: record.projectTitle ?? null,
            title: record.title ?? null,
          };
        }
        case "candidate": {
          return {
            ...base,
            fields: {
              email: record.email,
              employer: record.latestEmployer,
              phone: record.phoneNormalized,
            },
            subtitle: record.latestEmployer ?? null,
            title: record.name ?? null,
          };
        }
        default: {
          return resumeCard(db, workspaceId, id, record);
        }
      }
    }),
  );
}
