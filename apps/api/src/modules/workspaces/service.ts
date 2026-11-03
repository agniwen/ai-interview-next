import { member, organization, user } from "@ai-interview/db/schema";
import { and, asc, eq, or, sql } from "drizzle-orm";
import type { Database } from "@ai-interview/db";

export async function generateWorkspaceId(database: Database) {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
  while (true) {
    // 拒绝 252–255，使 36 个字符等概率。Reject 252–255 to sample all 36 characters uniformly.
    const id = [...crypto.getRandomValues(new Uint8Array(8))]
      .filter((byte) => byte < 252)
      .map((byte) => alphabet[byte % alphabet.length])
      .join("");
    if (!/^(?=.*[a-z])(?=.*\d)[a-z0-9]{8}$/u.test(id)) {
      continue;
    }
    // 每轮依赖上轮的查重结果。Each retry depends on the previous uniqueness check.
    // oxlint-disable-next-line no-await-in-loop
    const [existing] = await database
      .select({ id: organization.id })
      .from(organization)
      .where(or(eq(sql`lower(${organization.id})`, id), eq(sql`lower(${organization.slug})`, id)))
      .limit(1);
    if (!existing) {
      return id;
    }
  }
}

export async function createInitialWorkspace(
  database: Database,
  account: { id: string; name: string },
) {
  const id = await generateWorkspaceId(database);
  const createdAt = new Date();
  await database.batch([
    database
      .insert(organization)
      .values({ createdAt, id, name: `${account.name}的工作区`, slug: id }),
    database.insert(member).values({
      createdAt,
      id: crypto.randomUUID(),
      organizationId: id,
      role: "owner",
      userId: account.id,
    }),
    database.update(user).set({ lastWorkspaceId: id }).where(eq(user.id, account.id)),
  ]);
}

export async function listWorkspaces(database: Database, userId: string) {
  const [workspaces, [account]] = await Promise.all([
    database
      .select({ id: organization.id, name: organization.name, role: member.role })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(eq(member.userId, userId))
      .orderBy(asc(organization.createdAt)),
    database
      .select({ lastWorkspaceId: user.lastWorkspaceId })
      .from(user)
      .where(eq(user.id, userId)),
  ]);
  return { lastWorkspaceId: account.lastWorkspaceId, workspaces };
}

export async function activateWorkspace(database: Database, userId: string, workspaceId: string) {
  const [membership] = await database
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, workspaceId)));
  if (!membership) {
    return false;
  }
  await database.update(user).set({ lastWorkspaceId: workspaceId }).where(eq(user.id, userId));
  return true;
}
