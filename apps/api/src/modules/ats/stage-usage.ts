import type { Database } from "@ai-interview/db";
import type { resumeProcessingRun } from "@ai-interview/db/schema";
import { applicationResume, resumeUploadItem } from "@ai-interview/db/schema";
import { and, eq } from "drizzle-orm";
import { captureUsage } from "../usage/capture";
import { insertUsage, usageOwner } from "../usage/service";

type Run = typeof resumeProcessingRun.$inferSelect;

export function resumeStageUsage(
  db: Database,
  run: Run,
  attemptId: string,
  stage: Run["stage"],
  model: string,
  avatarModel: string | undefined,
) {
  const usageStage = {
    evaluate: "application_evaluation",
    extract_text: "resume_ocr",
    structure: "resume_structure",
  } as const;
  const main = captureUsage(usageStage[stage], "deepseek", model);
  const avatar = captureUsage("resume_avatar", "deepseek", avatarModel ?? model);
  let avatarFailed = false;

  return {
    avatarFailed() {
      avatarFailed = true;
    },
    async avatarTransport(input: RequestInfo | URL, init?: RequestInit) {
      const response = await fetch(input, init);
      await avatar.observe(response);
      return response;
    },
    observe: main.observe,
    async writes(failed: boolean) {
      const calls = [...main.rows(failed), ...avatar.rows(avatarFailed)];
      if (!calls.length) {
        return [];
      }
      const selected =
        run.kind === "parse"
          ? await db
              .select({ submissionId: resumeUploadItem.submissionId })
              .from(resumeUploadItem)
              .where(eq(resumeUploadItem.id, run.uploadItemId ?? ""))
              .get()
          : await db
              .select({ submissionId: applicationResume.submissionId })
              .from(applicationResume)
              .where(
                and(
                  eq(applicationResume.workspaceId, run.workspaceId),
                  eq(applicationResume.applicationId, run.applicationId ?? ""),
                  eq(applicationResume.resumeId, run.resumeId ?? ""),
                ),
              )
              .get();
      const owner =
        selected?.submissionId && (await usageOwner(db, run.workspaceId, selected.submissionId));
      return owner
        ? [
            insertUsage(
              db,
              owner,
              calls.map((call, index) => ({
                ...call,
                id: `resume:${attemptId}:${index}`,
              })),
            ),
          ]
        : [];
    },
  };
}
