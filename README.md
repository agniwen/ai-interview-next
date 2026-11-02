# AI Interview

Bun + Turborepo monorepo，应用放在 `apps/`，共享包放在 `packages/`。

```text
apps/
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
bun.lock                     # 整个仓库共用的依赖锁文件
turbo.json                   # 任务依赖和构建缓存
```

## 开发

使用 `package.json` 中指定的 Bun 1.4.2，在仓库根目录执行：

```bash
bun install
bun run dev
```

Web 应用运行在 `http://localhost:3000`。

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

在 `apps/web/wrangler.jsonc` 中配置 Worker 名称和资源绑定。首次部署前，在应用目录执行 `bunx --no-install wrangler login`；然后从根目录运行 `bun run deploy`。CI 可提供 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`。

参考：[Turborepo 工作区结构](https://turborepo.dev/docs/crafting-your-repository/structuring-a-repository)、[TanStack Start](https://tanstack.com/start)。
