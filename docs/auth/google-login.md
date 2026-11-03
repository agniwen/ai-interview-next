# Google 登录

认证使用 Better Auth + Drizzle ORM + Cloudflare D1，仅开放 Google 登录。Better Auth handler、认证配置和 D1 binding 均位于 `apps/api`；Web 的 `/api/auth/*` 只通过 Service Binding `API` 将原始请求转发给 `sainoa-api`，并直接返回响应。浏览器继续通过 Web 同源 Cookie 维护会话，Google 回调和登录页面地址不变。D1 binding 为 `AUTH_DB`，数据库名为 `sainoa-auth`；此前架构文档中的 PostgreSQL 属于候选方案。

登录页面为 `/sign-in`、`/zh-CN/sign-in`、`/ja/sign-in`、`/ko/sign-in`。首次 Google 登录自动创建账号、初始工作区和 owner 成员关系。成功后返回指定的工作区或邀请页面；未指定目标时，通过 `/workspaces` 进入最后激活的工作区。工作区与退出入口位于正式页面，详见 [工作区设计](../architecture/workspaces.md)。

## 本地配置

1. 将 `apps/api/.env.example` 复制为同目录的 `.env`（已忽略提交）。原先配置在 Web 或 `.dev.vars` 的认证变量需移到 API 的 `.env`；同一应用只保留一种本地 env 文件，避免 `.dev.vars` 覆盖 `.env`。
2. 填入 Google OAuth Client ID、Client Secret；为 `BETTER_AUTH_SECRET` 生成至少 32 字符的随机密钥，例如运行 `openssl rand -base64 32`。保留 `BETTER_AUTH_URL=http://localhost:3000`。
3. 根目录执行 `make db-migrate`，再执行 `make dev`，同时启动 API（8787）和 Web（3000）。本地 Service Binding 需要 API 开发服务运行；仅启动 Web 无法完成认证。迁移现在写入 API 的本地 D1；旧 Web 本地 D1 数据不会自动转移。

两个应用的 `dev` 脚本通过 `CLOUDFLARE_DEV_REGISTRY_PATH` 使用仓库根目录的 `.wrangler/registry`，使当前 Wrangler 和 Cloudflare Vite 插件能发现彼此。使用已有脚本启动即可。

Google Cloud Console 中创建 OAuth「Web application」客户端，配置同意屏幕；测试模式下添加测试用户。允许的 JavaScript 来源为 `http://localhost:3000` 和 `https://sanioa.akumanoko.com`，授权重定向 URI 为：

- `http://localhost:3000/api/auth/callback/google`
- `https://sanioa.akumanoko.com/api/auth/callback/google`

回调路径不带语言前缀。不要将 Client Secret 放进客户端环境变量或提交进仓库。

## 生产 env 与 Cloudflare 发布

将 `apps/api/.env.production.example` 复制为同目录的 `.env.production`，填入完整的四个变量。这是本地保存的生产配置，不提交 Git。生产 `BETTER_AUTH_URL` 为 `https://sanioa.akumanoko.com`，仍使用浏览器访问的 Web 来源；`BETTER_AUTH_SECRET` 使用与本地不同的随机密钥。Google 客户端必须允许该来源和对应回调地址。

API 的发布脚本显式指定 `--env-file .env.production --secrets-file .env.production`。前者选择发布时的 env 文件，后者将这些变量随本次代码发布一起上传为 API Worker Secrets，避免把本地 URL 或密钥误用于线上。`.env` 仍只用于本地开发；普通构建不会自动上传其中的变量。本次四个认证变量统一由 env 文件管理并存入 Secrets，其中 URL 和 Client ID 本身并非敏感值。

从仓库根目录执行：

```sh
make db-migrate-remote
make deploy
```

`make deploy` 先发布 `sainoa-api`，再构建并发布 `sainoa-web`。单独发布可用 `bun run deploy:api` 和 `bun run deploy:web`。这两套 env 文件对应本地运行与默认线上 Worker，不要求额外传入 `--env production`，也不会创建另一套带 production 后缀的 Worker。

已有远端 D1 继续使用同一 database_id，原迁移名称与内容保留，不重建认证表。如果已有用户和有效会话，迁移时沿用原 `BETTER_AUTH_SECRET`；首次接入且没有会话时可以生成新的生产密钥。其他 Cloudflare 账号部署时需创建自己的 D1 数据库，并替换 API Wrangler 中的 account_id、database_id 和 Web 的账号配置。

D1 只绑定到 API Worker，Web 通过 Service Binding 转发认证，不需要认证 env。API 上线验证通过后，可移除旧 Web Worker 上不再使用的认证 Secrets。远端迁移和发布仍是独立步骤，创建数据库不会自动上线登录功能。

## 数据结构与验证

`packages/db/src/schema/auth.ts` 定义 Better Auth 的 user、session、account、verification 和 rateLimit 表，通过 Drizzle adapter 接入认证。日期列保留原有 D1 的 ISO 字符串存储，Drizzle 查询时转换为 `Date`；布尔列转换为 `boolean`。生产限流状态继续存入 D1，使用 Better Auth 默认限额。

Organization 插件的 organization、member 和 invitation 表定义在 `packages/db/src/schema/organization.ts`，日期列使用毫秒时间戳。用户最后激活的工作区记录在 `user.lastWorkspaceId`，由已登录且属于该工作区的用户激活时更新；普通登录的目标不依赖 session 中的当前组织字段。

`packages/db/migrations/0001_auth.sql` 从 Web 原样迁入；`migrations/meta/` 为 Drizzle 的基线快照。`packages/db/scripts/baseline.ts` 仅用于这次接入时生成基线，不应在后续 schema 修改后重跑。以后修改共享 schema，再执行 `bun run --filter @ai-interview/db db:generate` 生成带时间戳的增量迁移。审阅 SQL 后执行 `make db-migrate` 或 `make db-migrate-remote`；不要重写已应用的历史迁移。

`bun run test` 中 API 测试使用 Wrangler 的临时本地 D1、真实 Drizzle adapter 和 Hono 入口，验证 Google 授权地址、回调限制、携带 Cookie 的跨源请求、会话与退出失效、旧 ISO 日期及会话兼容、伪造回调。它不会调用真实 Google OAuth；完整登录还需配置凭据后在浏览器验证。未配置环境变量时认证 API 会报配置错误。

Wrangler binding 类型分别由 `bun run --filter @ai-interview/api cf:types` 和 `bun run --filter @ai-interview/web cf:types` 生成；只生成 binding 类型，避免 Worker 全局类型覆盖 DOM 类型。

Google 图标本地保存于 `apps/web/public/logos/google.svg`，来源：[lndev logos](https://logos.lndev.me/) / [logos-apps](https://github.com/ln-dev7/logos-apps/blob/master/logos/google-2025.svg)。品牌商标归 Google 所有。

参考：[Better Auth Hono 集成](https://better-auth.com/docs/integrations/hono)、[Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)、[Drizzle D1](https://orm.drizzle.team/docs/connect-cloudflare-d1)、[Google provider](https://better-auth.com/docs/authentication/google)、[Service Binding HTTP](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/http/)。
