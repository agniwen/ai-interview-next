import { member } from "@ai-interview/db/schema";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { AuthenticatedEnv } from "./authenticated";

/** 成员身份允许进入工作区，但不授予读取其他成员私人聊天的权限。
 * Membership grants workspace access, not access to another member's private chats. */
export const requireWorkspace = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  const workspaceId = c.req.param("workspaceId")?.toLowerCase();
  const [membership] = await c
    .get("database")
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, c.get("userId")), eq(member.organizationId, workspaceId ?? "")));
  if (!membership) {
    return c.json({ error: "WORKSPACE_NOT_ACCESSIBLE" }, 404);
  }
  c.set("workspaceId", workspaceId ?? "");
  c.set("scope", JSON.stringify([workspaceId, c.get("userId")]));
  return next();
});
