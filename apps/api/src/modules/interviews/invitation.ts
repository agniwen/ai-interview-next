import type { Database } from "@ai-interview/db";
import { interviewInvitation } from "@ai-interview/db/schema";
import { eq } from "drizzle-orm";
import { getInterview } from "./service";

export async function createInterviewInvitation(db: Database, workspaceId: string, id: string) {
  const result = await getInterview(db, workspaceId, id);
  if (!result) {
    return { error: "INTERVIEW_UNAVAILABLE" as const, status: 404 as const };
  }
  const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  await db
    .insert(interviewInvitation)
    .values({ createdAt: new Date(), interviewRoundId: id, token, workspaceId })
    .onConflictDoNothing({ target: interviewInvitation.interviewRoundId });
  const [invitation] = await db
    .select({ token: interviewInvitation.token })
    .from(interviewInvitation)
    .where(eq(interviewInvitation.interviewRoundId, id));
  return { token: invitation.token, version: 1 as const };
}
