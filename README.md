# Sainoa

Sainoa，取意于日语「才能」（sainō），寓意“看见每个人的才能”。命名来源、读音与品牌表达见 [品牌命名说明](docs/brand/naming.md)。

Bun + Turborepo monorepo，应用放在 `apps/`，共享包放在 `packages/`。

```text
apps/
  voice-agent/               # Python / LiveKit Agents，独立语音服务（uv）
  web/                       # TanStack Start / React 应用，部署到 Cloudflare Workers
    src/
    components.json
    tsconfig.json
    vite.config.ts
    wrangler.jsonc
packages/
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

Web 应用运行在 `http://localhost:3000`。

也可以使用根目录的 Makefile：首次执行 `make install` 安装依赖，之后运行 `make dev` 启动。执行 `make` 或 `make help` 查看所有快捷命令。Makefile 直接调用现有 Bun 脚本，保留 Turbo 的编译依赖和缓存流程。

| 命令                      | 用途                                      |
| ------------------------- | ----------------------------------------- |
| `bun run dev`             | 启动应用开发服务                          |
| `bun run build`           | 按依赖顺序构建，缓存构建产物              |
| `bun run typecheck`       | 生成路由并执行 TypeScript 检查            |
| `bun run check`           | 对整个仓库执行 Ultracite 格式和 lint 检查 |
| `bun run fix`             | 对整个仓库执行 Ultracite 自动修复         |
| `bun run generate-routes` | 重新生成应用路由                          |
| `bun run preview`         | 构建并本地预览应用                        |
| `bun run deploy`          | 构建并部署 Web 应用到 Cloudflare Workers  |
| `bun run hooks`           | 安装 Lefthook Git hooks                   |

仅运行指定 workspace 的任务：

```bash
bun run build --filter=@ai-interview/web
bun run dev --filter=@ai-interview/web
```

## Python 语音服务

`apps/voice-agent` 使用 Python 3.14 + LiveKit Agents，依赖独立锁定在 `uv.lock`。首次执行 `make voice-install`，配置 LiveKit 凭据后执行 `make voice-download` 和 `make voice-console`；房间开发模式使用 `make voice-dev`。详见 [Voice Agent 使用与部署](apps/voice-agent/README.md)。Web 开发和 Cloudflare 部署命令保持独立。

## 应用与共享包

Web 应用的源码、Vite、路由、shadcn 和 Cloudflare 配置都在 `apps/web/`；应用内的 `@/*` 和 `#/*` 指向其 `src/`。路由文件位于 `apps/web/src/routes/`，`routeTree.gen.ts` 由工具生成，请勿手动编辑。

新增应用放在 `apps/<name>/`，共享包放在 `packages/<name>/`，每个目录提供独立的 `package.json`，包名统一使用 `@ai-interview/<name>`。根包名为 `@ai-interview/workspace`，当前应用为 `@ai-interview/web`，共享配置包为 `@ai-interview/typescript-config`。使用 `workspace:*` 声明内部依赖，Turborepo 会据此建立任务依赖关系。TypeScript 项目可以继承 `@ai-interview/typescript-config/base.json`。

在根目录统一安装依赖；为某个应用添加依赖时，使用 Bun 的 workspace 过滤：

```bash
bun add <dependency> --filter @ai-interview/web
```

Ultracite 和 Lefthook 配置保留在根目录。`build` 缓存 `dist/` 和 Cloudflare 的 `.wrangler/deploy/` 元数据；`dev`、路由生成和部署不缓存。环境文件放在 `apps/web/`，其变更会影响构建缓存；新增通过进程注入的构建环境变量时，在 `turbo.json` 的任务 `env` 中声明。

## 测试

在根目录运行 `bun run test` 执行所有 workspace 的 Vitest 测试，`bun run test:watch` 开启监听，`bun run test:coverage` 生成覆盖率报告。使用 `bun run test --filter=@ai-interview/web` 只测试 Web 应用。请使用 `bun run test`；`bun test` 会启动 Bun 自带的测试运行器。

Web 测试使用独立的 `apps/web/vitest.config.ts`，默认 Node 环境，支持 `@/*` 和 `#/*` 别名，不加载 Cloudflare 开发插件。测试放在 `src/` 或 `tests/` 下，文件以 `.test.ts(x)` 或 `.spec.ts(x)` 结尾。覆盖率 HTML 报告在 `apps/web/coverage/index.html`。当前配置用于单元测试；涉及 DOM 的组件测试需要另外配置浏览器或 DOM 环境。

新增 workspace 时，在该包内声明 Vitest 依赖和同名测试脚本，根目录的 Turbo 命令会自动发现它。

配置参考：[Vitest 官方文档](https://vitest.dev/config/)。

## Cloudflare 部署

当前部署目标为 Worker `sainoa-web`，自定义域名为 `sanioa.akumanoko.com`（按指定域名拼写）。`apps/web/wrangler.jsonc` 中的 Custom Domain 配置由 Wrangler 在部署时创建对应 DNS 和 HTTPS 绑定。

在 `apps/web/wrangler.jsonc` 中配置 Worker 名称和资源绑定。首次部署前，在应用目录执行 `bunx --no-install wrangler login`；然后从根目录运行 `bun run deploy`。CI 可提供 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

参考：[Turborepo 工作区结构](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)、[TanStack Start](https://tanstack.com/start)。

## 全局路由国际化

使用 Paraglide 编译文案，语言由 URL 唯一决定：英文首页为 `/`，中文为 `/zh-CN`，日文为 `/ja`，韩文为 `/ko`。嵌套页面同样应用前缀，例如 `/interviews/123` 与 `/ja/interviews/123`。不使用 Cookie 或浏览器偏好选择语言。

- 翻译源文件：`apps/web/messages/{locale}.json`。首页相关文案参考旧项目 `ai-interview`，按实际使用范围迁入。
- 语言列表与默认语言：`apps/web/project.inlang/settings.json`；URL 策略：`apps/web/paraglide.config.ts`。
- 路由文件继续使用无语言前缀的路径。Router 的 `rewrite` 统一处理前缀，普通站内导航使用 TanStack `Link`，不要在组件中手动拼接语言前缀。
- 组件使用 `@/paraglide/messages` 的消息函数；全局语言切换组件位于 `components/i18n/language-switcher.tsx`，切换语言时保留路径、查询参数及锚点，通过页面导航重新执行对应语言的 SSR。
- `src/server.ts` 使用 Paraglide middleware 隔离请求语言，Wrangler 的 `main` 必须指向该入口。`/api` 请求不经过文档语言策略；API 调用使用原始 API URL，不使用页面本地化链接函数。
- `src/paraglide/` 是生成输出，已排除版本控制、lint 和覆盖率统计。通过根目录 Turbo 命令执行开发、构建、测试和类型检查时会先编译文案。单独编译：`bun run --filter @ai-interview/web i18n:compile`。

首页布局与交互演示迁自旧项目 `ai-interview`，保留暖白背景色调、Tabler 图标和整个首页的 ScrollArea。演示包括招聘台、候选人详情、AI 面试、人工面试及评估流程，数据均为本地示例，不调用业务后端。筛选简历和工作台入口暂时禁用，标注“即将上线”；登录入口已接入 Better Auth + Google，认证数据使用 Cloudflare D1，配置见 [Google 登录](docs/auth/google-login.md)。

首页组件位于 `apps/web/src/components/home`；`screens` 包含交互演示及自动播放，`support` 包含迁移所需的展示组件与示例配置。通用控件复用本项目 `components/ui`，语言入口继续使用全局路由方案。
