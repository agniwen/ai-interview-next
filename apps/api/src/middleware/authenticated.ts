import { createDatabase } from "@ai-interview/db";
import type { Database } from "@ai-interview/db";
import { createMiddleware } from "hono/factory";
import type { ApiBindings } from "../env";
import { getAuth } from "../modules/auth/auth";

export interface AuthenticatedEnv {
  Bindings: ApiBindings;
  Variables: { database: Database; userId: string; workspaceId: string; scope: string };
}

/** 在受保护 API 的外层解析一次登录态，向业务路由传递用户与数据库。
 * Resolve authentication once at the protected API boundary and pass the user and database to business routes. */
export const requireSession = createMiddleware<AuthenticatedEnv>(async (c, next) => {
  c.header("Cache-Control", "private, no-store");
  const database = createDatabase(c.env.AUTH_DB);
  const session = await getAuth(c.env, database).api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    return c.json({ error: "UNAUTHORIZED" }, 401);
  }
  c.set("database", database);
  c.set("userId", session.user.id);
  return next();
});
