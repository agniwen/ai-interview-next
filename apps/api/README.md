# Sainoa API

Hono 后端，当前运行于 Cloudflare Workers，使用 Better Auth 和 Drizzle ORM。HTTP 入口与业务模块分开组织，数据库定义由仓库共享包提供。

开发约束见 [AGENTS.md](./AGENTS.md)；跨应用关系见 [后端架构](../../docs/architecture/discussion.md)。

## 当前结构

```text
src/
  index.ts
  app.ts
  types.ts
  env.d.ts
  modules/
    auth/
      auth.ts
      routes.ts
tests/
  auth.test.ts
  examples.test.ts
  database.ts
examples/
  app.example.ts
  context.example.ts
  middleware/database.example.ts
  modules/statistics/
    routes.example.ts
    service.example.ts
    input.example.ts
    middleware.example.ts
  jobs/statistics.example.ts
worker-configuration.d.ts
wrangler.jsonc
```

| 位置                         | 职责                                                            |
| ---------------------------- | --------------------------------------------------------------- |
| `src/index.ts`               | Cloudflare Worker 入口，目前导出 Hono app                       |
| `src/app.ts`                 | 显式挂载模块路由，提供健康检查                                  |
| `src/types.ts`               | 导出推断得到的 `AppType`，供 core-client 使用                   |
| `src/env.d.ts`               | 将生成的绑定类型接入 API，限定 Workers 类型的作用域             |
| `src/modules/auth/auth.ts`   | 校验认证配置，使用显式 D1 binding 创建数据库与 Better Auth 实例 |
| `src/modules/auth/routes.ts` | 将认证请求交给 Better Auth handler                              |
| `worker-configuration.d.ts`  | Wrangler 生成的绑定类型                                         |
| `wrangler.jsonc`             | 当前平台入口、资源绑定与迁移路径                                |

当前端点：

- `GET /health` 返回 `{"status":"ok"}`；额外查询参数返回 400。此端点不访问数据库或认证配置。
- `GET`、`POST /api/auth/*` 由 Better Auth 处理。Web 通过 Service Binding 转发原始请求，浏览器 Cookie 和 Google 回调使用 Web 来源。

Web 的 `src/routes/api/$.ts` 统一转发 `/api/*`，支持所有 HTTP 方法，原样保留路径、查询参数、请求体、Cookie、状态码和响应。后续业务模块在 API 的 `app.ts` 挂载 `/api/<name>` 后，浏览器可直接请求同源的 `/api/<name>`，无需为每个接口增加 Web route。Web 不在此入口解析请求体或执行业务校验，输入校验和授权由 API 负责。`/health` 是 API 自身的入口，不属于这个 Web 转发前缀。

## Routes、services 与 middleware 如何协作

代码按能力聚合在 `src/modules/<name>/`。每个模块的 HTTP 路由、业务操作、输入与专属中间件放在一起；跨模块复用的 HTTP 中间件放在 `src/middleware/`。模块前缀由 `app.ts` 显式挂载，资源由应用配置声明。

新增模块可从以下模板按需选择文件，不要求一次建齐：

```text
src/
  app.ts
  middleware/
    <common-concern>.ts
  modules/<feature>/
    routes.ts
    service.ts
    input.ts
    middleware.ts
```

| 文件                      | 放什么                                                       | 示例                                                                |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `app.ts`                  | 全局中间件、路由前缀和健康检查                               | [示例组装](./examples/app.example.ts)                               |
| `middleware/<concern>.ts` | 可供多个模块使用的 HTTP 依赖装配或通用处理                   | [显式创建数据库](./examples/middleware/database.example.ts)         |
| 模块 `routes.ts`          | 方法、路径、校验、读取 Context、调用 service、返回 HTTP 响应 | [统计路由](./examples/modules/statistics/routes.example.ts)         |
| 模块 `service.ts`         | 数据库查询、业务操作、多个步骤的编排，返回业务数据           | [统计 service](./examples/modules/statistics/service.example.ts)    |
| 模块 `input.ts`           | 外部输入的 schema 及从它推断的操作输入类型                   | [查询输入](./examples/modules/statistics/input.example.ts)          |
| 模块 `middleware.ts`      | 仅属于该模块的 HTTP 策略                                     | [响应缓存策略](./examples/modules/statistics/middleware.example.ts) |
| 后台 `jobs/<name>.ts`     | 消息或定时事件适配、依赖装配、调用 service                   | [后台调用示例](./examples/jobs/statistics.example.ts)               |

一个简单查询可以只写在路由中。出现业务规则、多步骤或复用后，用 `service.ts` 承接业务操作。单文件包含多个独立且复杂的职责时，再在该模块内部拆成 `services/` 或 `middleware/`。类型通常就近导出；多个调用方确实共用独立类型时才提取 `types.ts`。

认证配置和 Better Auth 实例创建继续放在 `modules/auth/auth.ts`，因为认证流程由 Better Auth 执行；当前没有必要再加一层只转发调用的 auth service。

### 依赖方向

```text
app.ts → 模块 routes.ts
              ├→ middleware.ts / 公共 middleware
              ├→ input.ts
              └→ service.ts → Drizzle / 显式传入的外部依赖
后台入口 ────────→ service.ts
```

路由知道 HTTP 方法、请求和状态码，service 通过参数接收操作需要的数据与依赖。Context 中的数据库或身份应在调用 service 时取出，不把整个 Context 或 env 传下去。这样，HTTP 和后台入口可以调用同一函数，业务操作无需依赖 Worker 的 HTTP 运行方式。

service 返回数据，由路由决定 `c.json(data, status)`。确有业务失败结果时，路由负责映射其 HTTP 含义；不提前添加统一响应包装、通用异常基类或 Repository 层。

### 中间件作用域和顺序

| 作用域   | 注册位置                                       | 典型职责                           |
| -------- | ---------------------------------------------- | ---------------------------------- |
| 全局     | `app.ts` 的 `.use()`，位于挂载路由之前         | request ID、请求日志               |
| 模块     | 模块路由的 `.use()`，位于模块 handler 之前     | 模块响应策略、该模块所需的身份信息 |
| 单个路由 | `.get()` / `.post()` 等 handler 前的中间件参数 | 数据库装配、该操作输入校验         |

处理顺序在注册代码中可见。进入时从全局到模块再到路由；等待 `next()` 后的处理按相反顺序返回。只需要委托下游时直接返回 `next()`；响应后处理需要先等待下游完成。

Hono 的 `Bindings` 描述平台绑定，`Variables` 描述已初始化的请求数据。[示例 Context](./examples/context.example.ts) 声明数据库类型，[数据库中间件](./examples/middleware/database.example.ts) 才负责创建实例并写入 Context。路由能读到某个字段的类型，不代表运行时已经创建了这个值，因此使用它的路由必须挂载对应中间件。

会话读取或通用登录要求适合放在需要身份的中间件中；具体资源归属和操作权限属于相应业务操作。健康检查、认证入口等公开端点继续独立注册，不因其他模块需要会话而被迫初始化认证或数据库。

### 输入 schema 与数据库 schema

输入定义表达一次操作接受哪些字段，数据库 schema 表达如何存储。可以复用字段约束，但表的插入类型不自动成为公开接口的请求契约。外部输入在入口校验一次，service 使用推断得到的类型；后台入口负责将自己的外部消息转换为相同的操作输入。

## 可运行示例

`examples/` 是由类型检查和集成测试验证的教学代码，未被生产 `src/app.ts` 导入，也不属于公开 API。示例读取现有 user 表的汇总计数，不创建生产功能、表或迁移。

阅读顺序：

1. [app.example.ts](./examples/app.example.ts)：注册 Hono 内置 request ID 中间件，挂载模块，保留不依赖数据库的健康检查。
2. [routes.example.ts](./examples/modules/statistics/routes.example.ts)：注册模块响应策略，再为统计端点挂载数据库中间件及查询校验。
3. [input.example.ts](./examples/modules/statistics/input.example.ts)：把 URL 中的 `verifiedOnly=true/false` 转换为 service 接受的 boolean。
4. [service.example.ts](./examples/modules/statistics/service.example.ts)：显式接收 Database，执行真实 Drizzle 查询，返回计数。
5. [statistics.example.ts](./examples/jobs/statistics.example.ts)：后台入口用自己的 binding 创建数据库，直接复用同一个 service。

[examples.test.ts](./tests/examples.test.ts) 验证完整链路、RPC 输入输出推断、中间件作用域、400 响应的后处理，以及后台调用与 HTTP 结果一致。它使用与认证测试共用的 [临时 D1 工具](./tests/database.ts)，不 mock 数据库或复制查询算法。运行 API 测试即可执行这些示例。

## 数据库与后台任务

[数据库包](../../packages/db/package.json) 提供 `@ai-interview/db/schema` 和 `createDatabase(binding)`，统一维护表、连接工厂与迁移。API 在请求内用自身的 D1 binding 创建实例；后续 worker 使用自己的绑定和配置。资源创建、绑定及连接方式保持显式，方便部署者检查和替换。

当前数据库适配器为 D1。部署到其他数据库或运行时仍需实现并验证对应连接和迁移方式；显式传递依赖为这种变化保留接入位置。

当前尚无后台 worker、队列或定时任务。实际增加后台入口时，按触发方式组织事件处理代码；API 与 worker 共同使用某项业务实现后，再提取相应能力包。数据库包继续只负责数据库定义和连接。

## 开发与验证

依赖在仓库根目录统一安装。以下命令也从根目录执行：

```sh
bun run --filter @ai-interview/api dev
bun run --filter @ai-interview/api test
bun run typecheck --filter=@ai-interview/api --filter=@ai-interview/core-client
bun run --filter @ai-interview/api build
```

`build` 执行 Wrangler dry-run，不部署。认证测试使用真实 Hono 入口、Drizzle adapter 和临时本地 D1；core-client 测试验证客户端请求与响应类型。其他可用脚本见 [package.json](./package.json)。

## 本地与生产 env

API 的 `.env` 用于本地开发，`.env.production` 用于生产发布，二者均被 Git 忽略。变量清单分别见 [.env.example](./.env.example) 和 [.env.production.example](./.env.production.example)。每份文件包含 `BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`；本地与生产使用独立认证密钥。

`deploy` 脚本显式通过 `--env-file .env.production` 选择发布配置，并通过 `--secrets-file .env.production` 将变量上传为 API Worker Secrets。普通 `build` 仅做 dry-run，不上传本地 `.env`。现有部署继续使用默认 Worker 名称，不额外创建名为 production 的 Cloudflare 环境。

仓库根目录的 `bun run deploy` 先发布 API，再构建并发布 Web；也可分别执行 `bun run deploy:api` 和 `bun run deploy:web`。数据库迁移仍通过 `make db-migrate` / `make db-migrate-remote` 显式应用。

Web 不需要这些认证 env，通过 Service Binding 调用 API；Web 与 API 的开发脚本使用同一服务注册目录。Google 配置、已有环境的密钥迁移及完整部署步骤统一见 [Google 登录](../../docs/auth/google-login.md)。
