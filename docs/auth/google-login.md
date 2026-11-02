# Google 登录

首版使用 Better Auth + Cloudflare D1，仅开放 Google 登录。认证入口位于 Web 应用的 `/api/auth/*`，通过同源 Cookie 维护会话。D1 binding 为 `AUTH_DB`，数据库名为 `sainoa-auth`。这是首版认证存储的实际选择；此前架构文档中的 PostgreSQL 属于候选方案。

登录页面为 `/sign-in`、`/zh-CN/sign-in`、`/ja/sign-in`、`/ko/sign-in`。首次 Google 登录自动创建账号，成功后返回当前语言的登录页，展示账号及退出入口；工作台仍在筹备中。首页的登录入口已开放。

## 本地配置

1. 将 `apps/web/.dev.vars.example` 复制为同目录的 `.dev.vars`（已忽略提交）。
2. 填入 Google OAuth Client ID、Client Secret；为 `BETTER_AUTH_SECRET` 生成至少 32 字符的随机密钥，例如运行 `openssl rand -base64 32`。保留 `BETTER_AUTH_URL=http://localhost:3000`。
3. 根目录执行 `make db-migrate`，再执行 `make dev`。

Google Cloud Console 中创建 OAuth「Web application」客户端，配置同意屏幕；测试模式下添加测试用户。允许的 JavaScript 来源为 `http://localhost:3000` 和 `https://sanioa.akumanoko.com`，授权重定向 URI 为：

- `http://localhost:3000/api/auth/callback/google`
- `https://sanioa.akumanoko.com/api/auth/callback/google`

回调路径不带语言前缀。不要将 Client Secret 放进客户端环境变量或提交进仓库。

## Cloudflare 配置

在 `apps/web` 目录依次通过交互输入设置：

```sh
bunx --no-install wrangler secret put BETTER_AUTH_SECRET
bunx --no-install wrangler secret put GOOGLE_CLIENT_ID
bunx --no-install wrangler secret put GOOGLE_CLIENT_SECRET
bunx --no-install wrangler secret put BETTER_AUTH_URL
```

生产 URL 输入 `https://sanioa.akumanoko.com`。先从根目录执行 `make db-migrate-remote`，再执行 `make deploy`。其他 Cloudflare 账号部署时需创建自己的 D1 数据库并替换 Wrangler 中的 database_id。生产与本地应使用不同的 Better Auth 密钥。

D1 已绑定到 Worker 配置；远端迁移、密钥和应用部署是独立步骤，创建数据库不会自动上线登录功能。

## 数据结构与验证

`apps/web/migrations/0001_auth.sql` 包含 Better Auth 的 user、session、account、verification 和 rateLimit 表。生产限流状态存入 D1，使用 Better Auth 默认限额。初始 SQL 由 `bun run --filter @ai-interview/web db:generate-auth` 根据实际配置生成；迁移应用后不要重写历史文件，后续结构变化新增编号递增的迁移。

`bun run test` 使用真实 SQLite 和 Better Auth handler 验证 Google 授权地址、回调限制、携带 Cookie 的跨源请求、会话与退出失效、伪造回调。它不会调用真实 Google OAuth；完整登录还需配置凭据后在浏览器验证。未配置环境变量时认证 API 会报配置错误。

Wrangler binding 类型由 `bun run --filter @ai-interview/web cf:types` 生成；只生成 binding 类型，避免 Worker 全局类型覆盖前端 DOM 类型。

Google 图标本地保存于 `apps/web/public/logos/google.svg`，来源：[lndev logos](https://logos.lndev.me/) / [logos-apps](https://github.com/ln-dev7/logos-apps/blob/master/logos/google-2025.svg)。品牌商标归 Google 所有。

参考：[Better Auth TanStack Start 集成](https://better-auth.com/docs/integrations/tanstack)、[Google provider](https://better-auth.com/docs/authentication/google)。
