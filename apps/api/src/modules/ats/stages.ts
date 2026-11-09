/* oxlint-disable typescript/no-non-null-assertion -- 阶段消息在运行和尝试持久化后才派发，各阶段读取上一步已提交的输入。 / Stage messages are sent after the run and attempt are stored, and each stage reads committed inputs. */
import type { Database } from "@ai-interview/db";
import {
  application,
  applicationActivity,
  applicationEvaluation,
  resume,
  resumeProcessingAttempt as attempt,
  resumeProcessingOutbox as outbox,
  resumeProcessingRun as run,
  resumeSubmission as submission,
  resumeUploadItem as item,
} from "@ai-interview/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { ResumeObjectStore, StageMessage } from "./contracts";
import type { PdfTextExtractor } from "../../lib/pdf-text";
import { matchesResumeMediaType, resumeFileDigest, resumeMediaType } from "../../lib/resume-file";
import type { ResumeMediaType } from "../../lib/resume-file";
import type { ResumeStructurer } from "../../lib/resume-structuring";
import { normalizedPhone, resolveParsedResume } from "./identity";
import { outboxEntry } from "./outbox";

type Parameters = NonNullable<typeof attempt.$inferSelect.parameters>;
type Evaluation = typeof applicationEvaluation.$inferInsert.result;
type ModelParameters = Omit<Parameters, "avatar" | "input" | "version">;

export interface ResumeStageDependencies {
  storage: ResumeObjectStore;
  extractAvatar: (bytes: Uint8Array, mediaType: ResumeMediaType) => Promise<ArrayBuffer | null>;
  avatarParameters: NonNullable<Parameters["avatar"]>;
  extract: (transport: typeof fetch) => PdfTextExtractor;
  structure: (transport: typeof fetch) => ResumeStructurer;
  evaluate: (
    input: { requirements: string; internalCriteria: string; profile: unknown },
    transport: typeof fetch,
  ) => Promise<Evaluation>;
  extractParameters: ModelParameters;
  structureParameters: ModelParameters;
  evaluateParameters: ModelParameters;
}

class InvalidResumeError extends Error {
  override name = "InvalidResumeError";
  readonly reason: "INVALID_PDF" | "INVALID_RESUME_IMAGE";

  constructor(reason: "INVALID_PDF" | "INVALID_RESUME_IMAGE") {
    super(reason);
    this.reason = reason;
  }
}

function stageFailure(error: unknown, status: number | undefined) {
  if (error instanceof InvalidResumeError) {
    return { reason: error.reason, retryable: false };
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return { reason: "INVALID_MODEL_OUTPUT", retryable: true };
  }
  if (status && status >= 400) {
    return { reason: `UPSTREAM_HTTP_${status}`, retryable: status === 429 || status >= 500 };
  }
  const retryable =
    error instanceof TypeError ||
    (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"));
  return {
    reason: error instanceof Error ? `STAGE_${error.name}` : "STAGE_FAILED",
    retryable,
  };
}

async function registerResume(
  db: Database,
  entry: typeof run.$inferSelect,
  file: typeof item.$inferSelect,
  bytes: Uint8Array,
) {
  const sha256 = await resumeFileDigest(bytes);
  await db
    .insert(resume)
    .values({
      createdAt: new Date(),
      id: entry.id,
      pdfObjectKey: file.objectKey,
      sha256,
      workspaceId: entry.workspaceId,
    })
    .onConflictDoNothing();
  const [pdf] = await db
    .select()
    .from(resume)
    .where(and(eq(resume.workspaceId, entry.workspaceId), eq(resume.sha256, sha256)));
  const resumeId = pdf!.id;
  await db
    .update(run)
    .set({ resumeId })
    .where(
      and(
        eq(run.id, entry.id),
        sql`not exists (select 1 from ${run} where "kind" = 'parse' and "resumeId" = ${resumeId} and "id" <> ${entry.id})`,
      ),
    );
  const [canonical] = await db
    .select({ id: run.id })
    .from(run)
    .where(and(eq(run.resumeId, resumeId), eq(run.kind, "parse")));
  const runId = canonical!.id;
  await db.batch([
    db
      .insert(submission)
      .values({
        createdAt: new Date(),
        id: file.id,
        originalFilename: file.filename,
        resumeId,
        workspaceId: entry.workspaceId,
      })
      .onConflictDoNothing(),
    db.update(item).set({ runId, submissionId: file.id }).where(eq(item.id, file.id)),
  ]);
  return {
    pdf: pdf!,
    reused: runId !== entry.id || pdf!.parseStatus === "succeeded",
    submissionId: file.id,
  };
}

async function saveResumeAvatar(
  deps: ResumeStageDependencies,
  record: typeof resume.$inferSelect,
  attemptId: string,
  bytes: Uint8Array,
  mediaType: ResumeMediaType,
) {
  if (record.avatarObjectKey) {
    return;
  }
  try {
    const avatar = await deps.extractAvatar(bytes, mediaType);
    if (avatar) {
      const key = `${record.workspaceId}/avatars/${record.id}/${attemptId}.png`;
      await deps.storage.write(key, avatar, "image/png");
      return key;
    }
  } catch (error) {
    console.warn("Resume avatar extraction failed", {
      error: error instanceof Error ? error.name : "UnknownError",
      resumeId: record.id,
    });
  }
}

export async function consumeResumeStage(
  db: Database,
  deps: ResumeStageDependencies,
  message: StageMessage,
) {
  const [[entry], [task]] = await Promise.all([
    db.select().from(run).where(eq(run.id, message.runId)),
    db.select().from(attempt).where(eq(attempt.id, message.attemptId)),
  ]);
  if (entry!.executionId !== task!.executionId || task!.status !== "queued") {
    return;
  }
  const { stage } = task!;
  const avatar = stage === "extract_text" ? deps.avatarParameters : undefined;
  const parameters = {
    evaluate: deps.evaluateParameters,
    extract_text: deps.extractParameters,
    structure: deps.structureParameters,
  }[stage];
  const startedAt = new Date();
  const active = and(eq(attempt.id, message.attemptId), eq(attempt.status, "running"));
  const activeExists = sql`exists (select 1 from ${attempt} where ${active})`;
  const [claimed] = await db
    .update(attempt)
    .set({
      deadlineAt: new Date(
        startedAt.getTime() + parameters.timeoutMs + (avatar?.timeoutMs ?? 0) + 15_000,
      ),
      parameters: {
        ...parameters,
        avatar,
        input:
          stage === "extract_text" ? `upload:${entry!.uploadItemId}` : `resume:${entry!.resumeId}`,
        version: 1,
      },
      startedAt,
      status: "running",
    })
    .where(and(eq(attempt.id, message.attemptId), eq(attempt.status, "queued")))
    .returning({ id: attempt.id });
  if (!claimed) {
    return;
  }

  let requestId: string | null = null;
  let status: number | undefined;
  let retryAfterAt: Date | null = null;
  const transport: typeof fetch = async (input, init) => {
    const response = await fetch(input, init);
    ({ status } = response);
    requestId = response.headers.get("x-request-id") ?? response.headers.get("request-id");
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter) {
      const seconds = Number(retryAfter);
      const at = Number.isFinite(seconds) ? Date.now() + seconds * 1000 : Date.parse(retryAfter);
      retryAfterAt = Number.isFinite(at) ? new Date(at) : null;
    }
    return response;
  };
  const finished = (state: "succeeded" | "failed" | "skipped", error?: string, retryable = false) =>
    db
      .update(attempt)
      .set({
        error,
        finishedAt: new Date(),
        providerRequestId: requestId,
        retryAfterAt,
        retryable,
        status: state,
      })
      .where(active);
  const wake = () => {
    const event = outboxEntry("finished", entry!.id, entry!.executionId, message.attemptId);
    return db
      .insert(outbox)
      .select(
        db
          .select({
            attemptId: attempt.id,
            availableAt: sql<Date>`${event.availableAt.getTime()}`.as("availableAt"),
            executionId: attempt.executionId,
            id: sql<string>`${event.id}`.as("id"),
            runId: attempt.runId,
            sentAt: sql<null>`null`.as("sentAt"),
            topic: sql<"finished">`'finished'`.as("topic"),
          })
          .from(attempt)
          .where(active),
      )
      .onConflictDoNothing();
  };

  try {
    if (stage === "extract_text") {
      const [file] = await db.select().from(item).where(eq(item.id, entry!.uploadItemId!));
      const bytes = await deps.storage.read(file!.objectKey);
      const mediaType = resumeMediaType(file!.filename);
      if (!matchesResumeMediaType(bytes, mediaType)) {
        throw new InvalidResumeError(
          mediaType === "application/pdf" ? "INVALID_PDF" : "INVALID_RESUME_IMAGE",
        );
      }
      const { pdf, reused, submissionId } = await registerResume(db, entry!, file!, bytes);
      const linkAvatar = (key: string) =>
        db
          .update(resume)
          .set({ avatarObjectKey: key })
          .where(and(eq(resume.id, pdf.id), isNull(resume.avatarObjectKey), activeExists));
      if (reused) {
        let avatarKey: string | undefined;
        if (pdf.parseStatus === "succeeded") {
          await resolveParsedResume(db, pdf.id, submissionId);
          avatarKey = await saveResumeAvatar(deps, pdf, message.attemptId, bytes, mediaType);
        }
        await db.batch([
          db
            .update(run)
            .set({ status: "succeeded" })
            .where(and(eq(run.id, entry!.id), activeExists)),
          ...(avatarKey ? [linkAvatar(avatarKey)] : []),
          wake(),
          finished("succeeded"),
        ]);
        return;
      }
      await db.update(resume).set({ parseStatus: "processing" }).where(eq(resume.id, pdf.id));
      const { text } = await deps.extract(transport)(bytes, mediaType);
      const avatarKey = await saveResumeAvatar(deps, pdf, message.attemptId, bytes, mediaType);
      await db.batch([
        db
          .update(resume)
          .set({ markdown: text })
          .where(and(eq(resume.id, pdf.id), activeExists)),
        ...(avatarKey ? [linkAvatar(avatarKey)] : []),
        wake(),
        finished("succeeded"),
      ]);
      return;
    }

    const [pdf] = await db.select().from(resume).where(eq(resume.id, entry!.resumeId!));
    if (stage === "structure") {
      const profile = await deps.structure(transport)(pdf!.markdown!);
      await db.batch([
        db
          .update(resume)
          .set({
            extractedPhoneNormalized: normalizedPhone(profile),
            parseStatus: "succeeded",
            parsedProfile: profile,
          })
          .where(and(eq(resume.id, pdf!.id), activeExists)),
        wake(),
        finished("succeeded"),
      ]);
      return;
    }

    const [applicationRow] = await db
      .select({ closedAt: application.closedAt, deletedAt: application.deletedAt })
      .from(application)
      .where(eq(application.id, entry!.applicationId!));
    if (applicationRow!.closedAt || applicationRow!.deletedAt) {
      await db.batch([
        db
          .update(run)
          .set({ status: "skipped" })
          .where(and(eq(run.id, entry!.id), activeExists)),
        wake(),
        finished("skipped"),
      ]);
      return;
    }
    const result = await deps.evaluate(
      {
        internalCriteria: entry!.internalCriteriaSnapshot,
        profile: pdf!.parsedProfile,
        requirements: entry!.jobRequirementsSnapshot!,
      },
      transport,
    );
    const evaluatedAt = Date.now();
    await db.batch([
      db.insert(applicationEvaluation).select(
        db
          .select({
            applicationId: sql<string>`${entry!.applicationId!}`.as("applicationId"),
            createdAt: sql<Date>`${evaluatedAt}`.as("createdAt"),
            id: attempt.id,
            internalCriteriaSnapshot: sql<string>`${entry!.internalCriteriaSnapshot}`.as(
              "internalCriteriaSnapshot",
            ),
            jobRequirementsSnapshot: sql<string>`${entry!.jobRequirementsSnapshot!}`.as(
              "jobRequirementsSnapshot",
            ),
            result: sql<Evaluation>`${JSON.stringify(result)}`.as("result"),
            resumeId: sql<string>`${pdf!.id}`.as("resumeId"),
            workspaceId: sql<string>`${entry!.workspaceId}`.as("workspaceId"),
          })
          .from(attempt)
          .where(active),
      ),
      db.insert(applicationActivity).select(
        db
          .select({
            action: sql<"evaluation_completed">`'evaluation_completed'`.as("action"),
            actorId: sql<string>`'sainoa-agent'`.as("actorId"),
            actorType: sql<"system">`'system'`.as("actorType"),
            applicationId: sql<string>`${entry!.applicationId!}`.as("applicationId"),
            id: sql<string>`${`evaluated-${message.attemptId}`}`.as("id"),
            occurredAt: sql<Date>`${evaluatedAt}`.as("occurredAt"),
            result: sql<typeof applicationActivity.$inferInsert.result>`${JSON.stringify({
              evaluationId: message.attemptId,
              outcome: "evaluation_completed",
              reason: "ai",
              version: 1,
            })}`.as("result"),
            source: sql<null>`null`.as("source"),
            workspaceId: sql<string>`${entry!.workspaceId}`.as("workspaceId"),
          })
          .from(attempt)
          .where(active),
      ),
      db
        .update(run)
        .set({ evaluationId: message.attemptId })
        .where(and(eq(run.id, entry!.id), activeExists)),
      wake(),
      finished("succeeded"),
    ]);
  } catch (error) {
    const { reason, retryable } = stageFailure(error, status);
    await db.batch([wake(), finished("failed", reason, retryable)]);
  }
}
