import { createMiddleware } from "hono/factory";

export const statisticsCachePolicy = createMiddleware(async (c, next) => {
  // Hono 在下游返回后仍允许设置响应头。Hono allows response headers to be set after downstream handlers return.
  // oxlint-disable-next-line node/callback-return
  await next();
  c.header("Cache-Control", "no-store");
});
