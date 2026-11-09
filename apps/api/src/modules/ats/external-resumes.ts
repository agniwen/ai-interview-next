import type { Database } from "@ai-interview/db";
import type { ResumeParsedProfile } from "@ai-interview/db/resume-profile";
import {
  candidate,
  resume,
  resumeProcessingRun as run,
  resumeSubmission as submission,
  resumeUploadBatch as batch,
  resumeUploadItem as item,
} from "@ai-interview/db/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { matchesResumeMediaType, resumeFileDigest } from "../../lib/resume-file";
import type { OperationAudit } from "../mcp/audit";
import type { ResumeObjectStore } from "./contracts";
import {
  candidatesByEmail,
  findCandidateByPhone,
  latestEmployer,
  normalizedPhone,
  preferredEmail,
} from "./identity";

export function findExternalUpload(db: Database, id: string) {
  return db
    .select({ file: item, uploaderId: batch.createdBy })
    .from(item)
    .innerJoin(batch, eq(batch.id, item.batchId))
    .where(and(eq(item.id, id), eq(batch.source, "external_import")))
    .get();
}

async function matchExternalProfile(
  db: Database,
  workspaceId: string,
  profile: ResumeParsedProfile,
  pdfCandidateId: string | null,
) {
  const phone = normalizedPhone(profile);
  const email = preferredEmail(profile);
  const [phoneMatch, pdfMatch, emailMatches] = await Promise.all([
    phone ? findCandidateByPhone(db, workspaceId, phone) : undefined,
    pdfCandidateId
      ? db
          .select({ id: candidate.id, name: candidate.name })
          .from(candidate)
          .where(
            and(
              eq(candidate.workspaceId, workspaceId),
              eq(candidate.id, pdfCandidateId),
              isNull(candidate.archivedAt),
            ),
          )
          .get()
      : undefined,
    email ? candidatesByEmail(db, workspaceId, email).limit(20) : [],
  ]);
  const conflict = Boolean(pdfMatch && phoneMatch && pdfMatch.id !== phoneMatch.id);
  const matched = conflict ? undefined : (phoneMatch ?? pdfMatch);
  const name = profile.identity?.name?.trim();
  const newCandidateName = !conflict && !matched && !emailMatches.length ? name : undefined;
  const matches = [
    ...(pdfMatch ? [{ ...pdfMatch, reason: "pdf" as const }] : []),
    ...(phoneMatch ? [{ ...phoneMatch, reason: "phone" as const }] : []),
    ...emailMatches.map((match) => ({ ...match, reason: "email" as const })),
  ];
  return {
    email,
    matched,
    matches,
    newCandidateName,
    pdfMatchId: pdfMatch?.id ?? null,
    phone,
    phoneMatchId: phoneMatch?.id ?? null,
  };
}

export async function getImportedResume(db: Database, workspaceId: string, uploadId: string) {
  const record = await db
    .select({
      candidateId: submission.resolvedCandidateId,
      identityStatus: submission.identityStatus,
      parseStatus: run.status,
      pdfMatchId: submission.pdfMatchedCandidateId,
      phoneMatchId: submission.phoneMatchedCandidateId,
      profile: resume.parsedProfile,
      resumeId: submission.resumeId,
      submissionId: submission.id,
      uploadId: item.id,
    })
    .from(item)
    .innerJoin(batch, eq(batch.id, item.batchId))
    .leftJoin(submission, eq(submission.id, item.submissionId))
    .leftJoin(run, eq(run.id, item.runId))
    .leftJoin(resume, eq(resume.id, submission.resumeId))
    .where(
      and(
        eq(item.workspaceId, workspaceId),
        eq(item.id, uploadId),
        eq(batch.source, "external_import"),
      ),
    )
    .get();
  if (!record) {
    return;
  }
  const { profile, ...receipt } = record;
  if (record.identityStatus !== "pending_review") {
    return { ...receipt, matches: [], version: 1 as const };
  }
  const strongIds = [record.pdfMatchId, record.phoneMatchId].filter(
    (id): id is string => id !== null,
  );
  const strong = strongIds.length
    ? await db
        .select({ id: candidate.id, name: candidate.name })
        .from(candidate)
        .where(and(eq(candidate.workspaceId, workspaceId), inArray(candidate.id, strongIds)))
    : [];
  const email = profile && preferredEmail(profile);
  const weak =
    !strong.length && email ? await candidatesByEmail(db, workspaceId, email).limit(20) : [];
  return {
    ...receipt,
    matches: [
      ...strong.flatMap((row) => [
        ...(row.id === record.pdfMatchId ? [{ ...row, reason: "pdf" as const }] : []),
        ...(row.id === record.phoneMatchId ? [{ ...row, reason: "phone" as const }] : []),
      ]),
      ...weak.map((row) => ({ ...row, reason: "email" as const })),
    ],
    version: 1 as const,
  };
}

async function readExternalOriginal(
  db: Database,
  storage: ResumeObjectStore,
  file: typeof item.$inferSelect,
) {
  const metadata = await storage.head(file.objectKey);
  if (metadata?.size !== file.size) {
    return { error: "UPLOAD_INCOMPLETE" } as const;
  }
  const bytes = await storage.read(file.objectKey);
  if (!matchesResumeMediaType(bytes, "application/pdf")) {
    return { error: "INVALID_PDF" } as const;
  }
  const sha256 = await resumeFileDigest(bytes);
  const { workspaceId } = file;
  const existing = await db
    .select()
    .from(resume)
    .where(and(eq(resume.workspaceId, workspaceId), eq(resume.sha256, sha256)))
    .get();
  const canonical = existing
    ? await db
        .select()
        .from(run)
        .where(and(eq(run.resumeId, existing.id), eq(run.kind, "parse")))
        .get()
    : undefined;
  if (canonical?.status === "queued" || canonical?.status === "running") {
    return { error: "RESUME_ALREADY_PROCESSING" } as const;
  }

  return { bytes, canonical, existing, sha256 };
}

type ExternalOriginal = Exclude<
  Awaited<ReturnType<typeof readExternalOriginal>>,
  { error: string }
>;

function externalParseWrites(
  db: Database,
  original: ExternalOriginal,
  parse: {
    candidateId: string | null;
    createdAt: Date;
    file: typeof item.$inferSelect;
    markdown: string | null;
    phone: string | null;
    profile: ResumeParsedProfile;
    pdfObjectKey: string;
    resumeId: string;
    runId: string;
  },
) {
  const { canonical, existing, sha256 } = original;
  const { candidateId, createdAt, file, markdown, phone, profile, pdfObjectKey, resumeId, runId } =
    parse;
  const { workspaceId } = file;
  const parsed = {
    extractedPhoneNormalized: phone,
    markdown,
    parseStatus: "succeeded" as const,
    parsedProfile: profile,
  };
  const ownership = candidateId && !existing?.candidateId ? { candidateId } : {};
  const writes: BatchItem<"sqlite">[] = [];
  if (existing) {
    const updated = { ...(canonical?.status === "succeeded" ? {} : parsed), ...ownership };
    if (Object.keys(updated).length) {
      writes.push(db.update(resume).set(updated).where(eq(resume.id, resumeId)));
    }
  } else {
    writes.push(
      db.insert(resume).values({
        ...parsed,
        ...ownership,
        createdAt,
        id: resumeId,
        pdfObjectKey,
        sha256,
        workspaceId,
      }),
    );
  }
  if (canonical) {
    if (canonical.status !== "succeeded") {
      writes.push(
        db
          .update(run)
          .set({ executionId: file.id, stage: "structure", status: "succeeded" })
          .where(eq(run.id, runId)),
      );
    }
  } else {
    writes.push(
      db.insert(run).values({
        createdAt,
        executionId: file.id,
        id: runId,
        kind: "parse",
        resumeId,
        stage: "structure",
        status: "succeeded",
        uploadItemId: file.id,
        workspaceId,
      }),
    );
  }
  return writes;
}

async function recordExternalImport(
  db: Database,
  storage: ResumeObjectStore,
  original: ExternalOriginal,
  file: typeof item.$inferSelect,
  input: { profile: ResumeParsedProfile; markdown?: string },
  audit: OperationAudit,
) {
  const { workspaceId } = file;
  const { bytes, canonical, existing } = original;
  const identity = await matchExternalProfile(
    db,
    workspaceId,
    input.profile,
    existing?.candidateId ?? null,
  );
  const createdAt = new Date();
  const resumeId = existing?.id ?? file.id;
  const runId = canonical?.id ?? file.id;
  const createCandidate = identity.newCandidateName
    ? {
        createdAt,
        creationSource: "resume_import" as const,
        email: identity.email,
        id: crypto.randomUUID(),
        latestEmployer: latestEmployer(input.profile),
        name: identity.newCandidateName,
        phoneNormalized: identity.phone,
        workspaceId,
      }
    : null;
  const candidateId = identity.matched?.id ?? createCandidate?.id ?? null;
  const identityStatus = candidateId ? "resolved" : "pending_review";
  const pdfObjectKey = existing?.pdfObjectKey ?? `${workspaceId}/originals/${resumeId}.pdf`;
  if (!existing) {
    await storage.write(pdfObjectKey, new Uint8Array(bytes).buffer, "application/pdf");
  }
  await db.batch([
    audit.success(
      {
        candidateId,
        createdCandidateId: createCandidate?.id,
        resumeId,
        runId,
        submissionId: file.id,
        uploadId: file.id,
      },
      createdAt,
    ),
    ...(createCandidate ? [db.insert(candidate).values(createCandidate)] : []),
    ...externalParseWrites(db, original, {
      candidateId,
      createdAt,
      file,
      markdown: input.markdown ?? null,
      pdfObjectKey,
      phone: identity.phone,
      profile: input.profile,
      resumeId,
      runId,
    }),
    db.insert(submission).values({
      createdAt,
      id: file.id,
      identityStatus,
      originalFilename: file.filename,
      pdfMatchedCandidateId: identity.pdfMatchId,
      phoneMatchedCandidateId: identity.phoneMatchId,
      resolvedCandidateId: candidateId,
      resumeId,
      workspaceId,
    }),
    db
      .update(item)
      .set({ objectKey: pdfObjectKey, runId, status: "accepted", submissionId: file.id })
      .where(eq(item.id, file.id)),
  ]);
  return {
    candidateId,
    identityStatus,
    matches: identity.matches,
    parseStatus: "succeeded" as const,
    pdfMatchId: identity.pdfMatchId,
    phoneMatchId: identity.phoneMatchId,
    resumeId,
    submissionId: file.id,
    uploadId: file.id,
    version: 1 as const,
  };
}

export async function importExternalResume(
  db: Database,
  storage: ResumeObjectStore,
  workspaceId: string,
  userId: string,
  input: { uploadId: string; profile: ResumeParsedProfile; markdown?: string },
  audit: OperationAudit,
) {
  const upload = await findExternalUpload(db, input.uploadId);
  if (upload?.file.workspaceId !== workspaceId || upload.uploaderId !== userId) {
    return { error: "UPLOAD_UNAVAILABLE" } as const;
  }
  const { file } = upload;
  const existingSubmission = file.submissionId
    ? await getImportedResume(db, workspaceId, input.uploadId)
    : undefined;
  if (existingSubmission) {
    await audit.success({
      resumeId: existingSubmission.resumeId,
      reused: true,
      submissionId: file.submissionId,
      uploadId: file.id,
    });
    return existingSubmission;
  }
  const original = await readExternalOriginal(db, storage, file);
  if ("error" in original) {
    return original;
  }
  return recordExternalImport(db, storage, original, file, input, audit);
}

export type CandidateResolution = { candidateId: string } | { name: string };

export async function resolveSubmissionCandidate(
  db: Database,
  workspaceId: string,
  submissionId: string,
  input: CandidateResolution,
  audit?: OperationAudit,
) {
  const record = await db
    .select()
    .from(submission)
    .where(
      and(
        eq(submission.id, submissionId),
        eq(submission.workspaceId, workspaceId),
        eq(submission.identityStatus, "pending_review"),
      ),
    )
    .get();
  if (!record) {
    return { error: "SUBMISSION_NOT_FOUND" } as const;
  }
  const candidateId = "candidateId" in input ? input.candidateId : crypto.randomUUID();
  if (
    "candidateId" in input &&
    !(await db
      .select({ id: candidate.id })
      .from(candidate)
      .where(and(eq(candidate.id, candidateId), eq(candidate.workspaceId, workspaceId)))
      .get())
  ) {
    return { error: "CANDIDATE_NOT_FOUND" } as const;
  }
  const createdAt = new Date();
  await db.batch([
    ...("name" in input
      ? ([
          db.insert(candidate).values({
            createdAt,
            creationSource: "manual",
            id: candidateId,
            name: input.name,
            workspaceId,
          }),
        ] as const)
      : ([] as const)),
    db
      .update(resume)
      .set({ candidateId })
      .where(and(eq(resume.id, record.resumeId), isNull(resume.candidateId))),
    db
      .update(submission)
      .set({ identityStatus: "resolved", resolvedCandidateId: candidateId })
      .where(eq(submission.id, record.id)),
    ...(audit
      ? [
          audit.success(
            {
              candidateId,
              changes: {
                identityStatus: { after: "resolved", before: record.identityStatus },
                resolvedCandidateId: { after: candidateId, before: record.resolvedCandidateId },
              },
              createdCandidateId: "name" in input ? candidateId : undefined,
              resumeId: record.resumeId,
              submissionId,
            },
            createdAt,
          ),
        ]
      : []),
  ]);
  return { candidateId, jobId: record.jobId, version: 1 } as const;
}
