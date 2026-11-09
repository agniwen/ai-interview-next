/* oxlint-disable typescript/no-non-null-assertion -- 成功的结构化阶段已提交简历及其结构化产物。 / The successful structuring stage has committed the resume and its parsed profile. */
import type { Database } from "@ai-interview/db";
import type { ResumeParsedProfile } from "@ai-interview/db/resume-profile";
import { candidate, resume, resumeSubmission as submission } from "@ai-interview/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { matchSubmissionJob } from "./applications";

function preferredContact(contacts: NonNullable<ResumeParsedProfile["identity"]>["phones"]) {
  const owned = contacts?.filter((contact) => contact.owner === "candidate" && contact.value) ?? [];
  if (owned.length === 1) {
    return owned[0]?.value;
  }
  const primary = owned.filter((contact) => contact.isExplicitlyPrimary);
  return primary.length === 1 ? primary[0]?.value : null;
}

export function normalizedPhone(profile: ResumeParsedProfile) {
  const digits = preferredContact(profile.identity?.phones)?.replaceAll(/[\s().-]/gu, "");
  if (digits && /^\+[1-9]\d{7,14}$/u.test(digits)) {
    return digits;
  }
  return digits && /^1[3-9]\d{9}$/u.test(digits) ? `+86${digits}` : null;
}

export function findCandidateByPhone(db: Database, workspaceId: string, phone: string) {
  return db
    .select({ id: candidate.id, name: candidate.name })
    .from(candidate)
    .where(
      and(
        eq(candidate.workspaceId, workspaceId),
        eq(candidate.phoneNormalized, phone),
        isNull(candidate.archivedAt),
      ),
    )
    .get();
}

export function preferredEmail(profile: ResumeParsedProfile) {
  return preferredContact(profile.identity?.emails)?.trim().toLowerCase() || null;
}

export function candidatesByEmail(db: Database, workspaceId: string, email: string) {
  return db
    .select({ id: candidate.id, name: candidate.name })
    .from(candidate)
    .where(
      and(
        eq(candidate.workspaceId, workspaceId),
        eq(sql`lower(${candidate.email})`, email),
        isNull(candidate.archivedAt),
      ),
    )
    .orderBy(candidate.id);
}

export function latestEmployer(profile: ResumeParsedProfile) {
  const ranked = (profile.employment ?? []).flatMap(({ employer, period }) => {
    if (!employer) {
      return [];
    }
    if (period?.end === "ongoing") {
      return [{ employer, rank: Number.POSITIVE_INFINITY }];
    }
    const date = period?.end;
    if (!date?.year) {
      return [];
    }
    return [{ employer, rank: date.year * 10_000 + (date.month ?? 0) * 100 + (date.day ?? 0) }];
  });
  const highestRank = Math.max(...ranked.map(({ rank }) => rank));
  const latest = new Set(
    ranked.filter(({ rank }) => rank === highestRank).map(({ employer }) => employer),
  );
  return latest.size === 1 ? (latest.values().next().value ?? null) : null;
}

async function importCandidate(
  db: Database,
  pdf: typeof resume.$inferSelect,
  profile: ResumeParsedProfile,
  name: string,
  email: string | null,
  phone: string | null,
) {
  await db
    .insert(candidate)
    .values({
      createdAt: new Date(),
      creationSource: "resume_import",
      email,
      id: pdf.id,
      latestEmployer: latestEmployer(profile),
      name,
      phoneNormalized: phone,
      workspaceId: pdf.workspaceId,
    })
    .onConflictDoNothing();
  if (!phone) {
    return pdf.id;
  }
  const current = await db
    .select({ id: candidate.id })
    .from(candidate)
    .where(
      and(
        eq(candidate.workspaceId, pdf.workspaceId),
        eq(candidate.phoneNormalized, phone),
        isNull(candidate.archivedAt),
      ),
    )
    .get();
  return current?.id ?? pdf.id;
}

async function resolveResumeSubmission(
  db: Database,
  pdf: typeof resume.$inferSelect,
  record: typeof submission.$inferSelect,
) {
  const profile = pdf.parsedProfile!;
  const phone = pdf.phoneMatchDisabledAt ? null : pdf.extractedPhoneNormalized;
  const email = preferredEmail(profile);
  const matchedPhone = phone ? await findCandidateByPhone(db, pdf.workspaceId, phone) : undefined;
  let owner = matchedPhone?.id ?? pdf.candidateId;
  const lookup = {
    pdfMatchedCandidateId: pdf.candidateId,
    phoneMatchedCandidateId: matchedPhone?.id ?? null,
  };
  if (!owner) {
    const name = profile.identity?.name?.trim();
    const sameEmail = email && (await candidatesByEmail(db, pdf.workspaceId, email).get());
    if (sameEmail || !name) {
      await db
        .update(submission)
        .set({ ...lookup, identityStatus: "pending_review" })
        .where(eq(submission.id, record.id));
      return;
    }
    owner = await importCandidate(db, pdf, profile, name, email, phone);
  }
  await db.batch([
    db
      .update(resume)
      .set({ candidateId: owner })
      .where(and(eq(resume.id, pdf.id), isNull(resume.candidateId))),
    db
      .update(submission)
      .set({
        ...lookup,
        identityStatus: "resolved",
        phoneChangeStatus:
          pdf.candidateId && phone && !matchedPhone ? "pending_confirmation" : null,
        resolvedCandidateId: owner,
      })
      .where(eq(submission.id, record.id)),
  ]);
  if (record.jobId) {
    await matchSubmissionJob(db, pdf.workspaceId, record.id, record.jobId, {
      id: "resume-processing",
      type: "system",
    });
  }
}

export async function resolveParsedResume(db: Database, resumeId: string, submissionId?: string) {
  const [pdf] = await db.select().from(resume).where(eq(resume.id, resumeId));
  const records = await db
    .select()
    .from(submission)
    .where(
      and(
        eq(submission.resumeId, resumeId),
        eq(submission.identityStatus, "pending"),
        submissionId ? eq(submission.id, submissionId) : undefined,
      ),
    );
  for (const record of records) {
    // oxlint-disable-next-line no-await-in-loop -- 按投递顺序写入同一份简历的归属。 / Process submissions in order because they share resume ownership.
    await resolveResumeSubmission(db, pdf!, record);
  }
}
