# Sainoa

Sainoa，取意于日语「才能」（sainō），寓意“看见每个人的才能”。命名来源、读音与品牌表达见 [品牌命名说明](docs/brand/naming.md)。

Bun + Turborepo monorepo，应用放在 `apps/`，共享包放在 `packages/`。

```text
apps/
  api/                       # Hono API、Better Auth（Cloudflare Workers）
  voice-agent/               # Python / LiveKit Agents，独立语音服务（uv）
  web/                       # TanStack Start / React 应用，部署到 Cloudflare Workers
    src/
    components.json
    tsconfig.json
    vite.config.ts
    wrangler.jsonc
packages/
  db/                        # 共享 Drizzle schema、D1 数据库工厂和迁移
  core-client/               # TypeScript Hono RPC 客户端
  typescript-config/         # 共享 TypeScript 配置
    base.json
package.json                 # Bun workspaces 和统一命令
bun.lock                     # JavaScript workspace 依赖锁文件
turbo.json                   # 任务依赖和构建缓存
```

## 开发

使用 `package.json` 中指定的 Bun 1.4.2，在仓库根目录执行：

```bash
bun install
bun run dev
```

Web 应用运行在 `http://localhost:3000`，API 运行在 `http://localhost:8787`。`make dev` 同时启动二者；语音服务仍单独启动。

也可以使用根目录的 Makefile：首次执行 `make install` 安装依赖，之后运行 `make dev` 启动。执行 `make` 或 `make help` 查看所有快捷命令。Makefile 直接调用现有 Bun 脚本，保留 Turbo 的编译依赖和缓存流程。

| 命令                      | 用途                                               |
| ------------------------- | -------------------------------------------------- |
| `bun run dev`             | 启动应用开发服务                                   |
| `bun run build`           | 按依赖顺序构建，缓存构建产物                       |
| `bun run typecheck`       | 生成路由并用 tsrs 检查 TypeScript 类型             |
| `bun run check`           | 对整个仓库执行 Ultracite 格式和 lint 检查          |
| `bun run fix`             | 对整个仓库执行 Ultracite 自动修复                  |
| `bun run generate-routes` | 重新生成应用路由                                   |
| `bun run preview`         | 构建并本地预览应用                                 |
| `bun run deploy`          | 先部署 API，再构建并部署 Web 到 Cloudflare Workers |
| `bun run hooks`           | 安装 Lefthook Git hooks                            |

仅运行指定 workspace 的任务：

```bash
bun run build --filter=@ai-interview/web
bun run dev --filter=@ai-interview/web
```

## Web 页面渲染

首页和登录页使用 TanStack Start 静态预渲染（SSG）。`bun run build --filter=@ai-interview/web` 在 `apps/web/dist/client/_localized/` 为每种语言生成首页和登录页。公开地址为 `/` 和 `/sign-in`，Web Worker 根据语言 Cookie 从 ASSETS 读取对应的 HTML。其他页面按请求 SSR，`/api/*` 通过 Service Binding 转发到 API。登录状态和操作由客户端通过 Better Auth API 处理。

`bun run dev` 仍使用开发服务器渲染。验证实际 SSG 行为请运行 `bun run preview --filter=@ai-interview/web`，它会先构建再启动 Cloudflare 本地预览。

## API 与 Core Client

`apps/api` 提供 `GET /health` 和 Better Auth 的 `/api/auth/*`，使用 Drizzle ORM 访问 Cloudflare D1。输入校验采用 Zod 4 + `@hono/standard-validator`；健康检查不接受查询参数，额外参数返回 400，也不依赖数据库或认证配置。执行 `make api-dev` 单独启动，`make api-build` 验证 Cloudflare 构建（不部署）。`make deploy` 先部署 API，再构建并部署 Web；本地与生产变量分别位于 API 的 `.env` 和 `.env.production`，配置步骤见 [Google 登录](docs/auth/google-login.md)。

`packages/db` 是系统数据库定义的唯一来源，通过 `@ai-interview/db/schema` 导出表，通过 `@ai-interview/db` 导出 `createDatabase(binding)` 和 `Database` 类型。API 和后续后台 worker 使用同一套 schema，各自在请求或任务内用自己的 D1 binding 创建数据库实例。数据库包不依赖 API、Web 或 Better Auth。新增业务表放在 `packages/db/src/schema/` 并从 `index.ts` 导出，再执行 `bun run --filter @ai-interview/db db:generate` 生成增量迁移；`make db-migrate` 和 `make db-migrate-remote` 由 API 的 Wrangler 配置应用这些迁移。

Web 通过 `src/routes/api/$.ts` 将所有 `/api/*` 请求原样转发到 API Service Binding，支持所有 HTTP 方法。新增业务接口统一在 API 的 `app.ts` 挂载 `/api/<name>`，浏览器使用同源路径调用；无需在 Web 为每个接口重复声明路由。Cookie、请求体和响应流直接传递，校验和授权仍由 API 执行。现有 `/api/auth/*` 保持不变，`/health` 继续用于直接检查 API。

TypeScript 调用方使用 `@ai-interview/core-client` 的 `createCoreClient({ baseUrl, fetch })`；`fetch` 可省略。包使用 Hono RPC，通过 API 的公开类型出口推断响应，不包含服务端实现。当前通过源码导出供仓库内消费，无单独发布产物。

跨语言边界、后续 Python 客户端和反向会话控制设计见 [架构文档](docs/architecture/discussion.md)。

## Python 语音服务

`apps/voice-agent` 使用 Python 3.14 + LiveKit Agents，依赖独立锁定在 `uv.lock`，由 Makefile 直接调用 uv，不使用 `package.json` 或 Bun workspace。首次执行 `make voice-install`，配置 LiveKit 凭据后执行 `make voice-download` 和 `make voice-console`；房间开发模式使用 `make voice-dev`。`make voice-deploy` 发布到 LiveKit Cloud，`make voice-status` 查看状态，`make voice-logs` 查看日志。详见 [Voice Agent 使用与部署](apps/voice-agent/README.md)。Web 开发和 Cloudflare 部署命令保持独立。

## 应用与共享包

Web 应用的源码、Vite、路由、shadcn 和 Cloudflare 配置都在 `apps/web/`；应用内的 `@/*` 和 `#/*` 指向其 `src/`。路由文件位于 `apps/web/src/routes/`，`routeTree.gen.ts` 由工具生成，请勿手动编辑。

新增应用放在 `apps/<name>/`，共享包放在 `packages/<name>/`，每个目录提供独立的 `package.json`，包名统一使用 `@ai-interview/<name>`。根包名为 `@ai-interview/workspace`，当前应用为 `@ai-interview/web`，共享配置包为 `@ai-interview/typescript-config`。使用 `workspace:*` 声明内部依赖，Turborepo 会据此建立任务依赖关系。TypeScript 项目可以继承 `@ai-interview/typescript-config/base.json`。

在根目录统一安装依赖；为某个应用添加依赖时，使用 Bun 的 workspace 过滤：

```bash
bun add <dependency> --filter @ai-interview/web
```

Ultracite 和 Lefthook 配置保留在根目录。`build` 缓存 `dist/` 和 Cloudflare 的 `.wrangler/deploy/` 元数据；`dev`、路由生成和部署不缓存。环境文件按应用归属存放；API 使用 `.env` 做本地开发、`.env.production` 做生产发布，真实值不提交，只提交 `.example` 模板。环境文件变更会影响构建缓存；新增通过进程注入的构建环境变量时，在 `turbo.json` 的任务 `env` 中声明。

## 测试

在根目录运行 `bun run test` 执行所有 workspace 的 Vitest 测试，`bun run test:watch` 开启监听，`bun run test:coverage` 生成覆盖率报告。使用 `bun run test --filter=@ai-interview/web` 只测试 Web 应用。请使用 `bun run test`；`bun test` 会启动 Bun 自带的测试运行器。

Web 测试使用独立的 `apps/web/vitest.config.ts`，默认 Node 环境，支持 `@/*` 和 `#/*` 别名，不加载 Cloudflare 开发插件。测试放在 `src/` 或 `tests/` 下，文件以 `.test.ts(x)` 或 `.spec.ts(x)` 结尾。覆盖率 HTML 报告在 `apps/web/coverage/index.html`。当前配置用于单元测试；涉及 DOM 的组件测试需要另外配置浏览器或 DOM 环境。

新增 workspace 时，在该包内声明 Vitest 依赖和同名测试脚本，根目录的 Turbo 命令会自动发现它。

配置参考：[Vitest 官方文档](https://vitest.dev/config/)。

## Cloudflare 部署

Web 部署目标为 Worker `sainoa-web`，自定义域名为 `sanioa.akumanoko.com`（按指定域名拼写），通过 Service Binding `API` 将 `/api/*` 请求转发到 `sainoa-api`。`apps/web/wrangler.jsonc` 中的 Custom Domain 配置由 Wrangler 在部署时创建对应 DNS 和 HTTPS 绑定。

在 `apps/web/wrangler.jsonc` 中配置 Worker 名称和资源绑定。首次部署前，在应用目录执行 `bunx --no-install wrangler login`；然后从根目录运行 `bun run deploy`。CI 可提供 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

API 构建及两个应用的部署脚本设置 `WRANGLER_NO_SKILLS_UPDATE_PROMPTS=true`，关闭 Wrangler 在命令完成后询问是否更新 Cloudflare skills 的交互提示，避免发布成功后仍等待输入、阻塞后续 Web 部署。此设置只影响 skills 更新提示，认证和资源配置确认保持原有行为。

参考：[Turborepo 工作区结构](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)、[TanStack Start](https://tanstack.com/start)。

## 全局路由国际化

使用 Paraglide 编译文案。语言切换器写入站点 Cookie `PARAGLIDE_LOCALE`，随后刷新当前地址，保留查询参数和锚点。首次访问默认使用英文。旧语言前缀链接会保存对应语言，并跳转到相同的无前缀地址。

- 翻译源文件：`apps/web/messages/{locale}.json`。语言列表和默认语言位于 `apps/web/project.inlang/settings.json`，Cookie 策略位于 `apps/web/paraglide.config.ts`。
- `src/server.ts` 使用 Paraglide middleware 隔离请求语言。公开页按 Cookie 选择静态文件，工作区使用同一 Cookie 渲染首屏。API 和 OAuth 回调沿用原路径。
- `src/paraglide/` 是生成输出，已排除版本控制、lint 和覆盖率统计。通过根目录 Turbo 命令执行开发、构建、测试和类型检查时会先编译文案。单独编译：`bun run --filter @ai-interview/web i18n:compile`。

首页布局与交互演示迁自旧项目 `ai-interview`，保留暖白背景色调、Tabler 图标和整个首页的 ScrollArea。演示包括招聘台、候选人详情、AI 面试、人工面试及评估流程，数据均为本地示例，不调用业务后端。筛选简历和工作台入口暂时禁用，标注“即将上线”；登录入口已接入 Better Auth + Google，认证数据使用 Cloudflare D1，配置见 [Google 登录](docs/auth/google-login.md)。

首页组件位于 `apps/web/src/components/home`；`screens` 包含交互演示及自动播放，`support` 包含迁移所需的展示组件与示例配置。通用控件复用本项目 `components/ui`，语言入口继续使用全局路由方案。
