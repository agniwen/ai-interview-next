# 后端架构与多平台部署讨论

日期：2026-11-02

状态：讨论草案，正在通过逐项访谈确认。本文记录目标和候选方案，不是已批准的实施规范。未确认的建议不能作为新增依赖、拆分服务或部署基础设施的授权。

## 已明确的目标

- `ai-interview-next` 是重构版本；`ai-interview` 只作为业务规模参考，不要求继承其架构和依赖。
- 使用 TanStack Start，默认考虑 Cloudflare 部署，同时允许 Vercel、Node host 等部署选择。
- 使用 monorepo，应用放在 `apps/`，包放在 `packages/`，采用 `@ai-interview/*` 命名。
- 后端需要考虑扩容、伸缩和微服务；具体服务数量、边界和拆分时机尚未确认。
- 正在评估 TypeScript / Node.js、Hono 以及服务间 RPC；尚未最终确认后端技术组合。

## 已有实现

- `apps/web`：TanStack Start 应用，当前使用 Cloudflare Vite 插件。
- `packages/typescript-config`：共享 TypeScript 配置。
- Bun workspaces、Turborepo 构建编排和缓存。
- Vitest 单元测试、覆盖率、监听命令，以及统一类型检查和 Ultracite 检查。
- 尚未实现本文讨论的独立后端服务、服务客户端、消息系统或多平台部署组合。

## 已确认的架构决策

- 第一版将 Core API 与 Processing API 合并为 `apps/api`，统一提供业务接口、任务提交、状态与报告查询。
- API 内部按业务模块组织，不为这些模块预设独立网络服务。未来拆分需有明确的独立伸缩、发布或业务边界需求。
- 保留 `packages/core-client`（`@ai-interview/core-client`）作为合并后 API 的统一类型化调用入口；不另建功能重复的 `api-client`。
- 后台执行仍建议放在独立的 `apps/worker`，其部署平台与运行方式待确认。

## 候选服务边界

以下为助手建议，待用户逐项确认。

| 模块            | 职责                                           | 部署位置                            |
| --------------- | ---------------------------------------------- | ----------------------------------- |
| Web / BFF       | 页面、SSR、面向页面的接口组合                  | TanStack Start 应用，部署方式待确认 |
| Core            | 工作区、权限、岗位、候选人、面试安排和回答记录 | 合并后的 API                        |
| Processing 接口 | 任务提交、状态、报告查询                       | 合并后的 API                        |
| Processing 执行 | 解析、转录、评分、报告生成                     | 建议独立 Worker，待确认             |
| Realtime        | 实时语音连接和会话执行                         | 按需求独立部署，待确认              |

Core 与 Processing 是当前方案中的业务模块名称，不代表必须拆成独立微服务。API 与 Worker 可以作为同一后端的不同运行入口，共享适当的业务实现。

## 候选代码组织

```text
apps/
  web/
  api/
  worker/
  realtime/
packages/
  core/
  processing/
  api-contracts/
  core-client/
  typescript-config/
deploy/
  compose/
  cloudflare/
```

该目录树表达候选职责，不要求一次性创建所有目录。服务入口负责协议适配、配置、资源初始化和生命周期；业务包按业务能力组织。Hono Context、平台 bindings 和 HTTP 响应类型留在入口层。

## 共享和通信方案

- 纯函数和通用基础设施接入可以通过共享包本地复用；共享包本身不是远程服务。
- 服务自己的 API 和消费者可以共用该服务的内部业务实现。
- 合并后的 API 内部模块通过函数调用协作，不为了模块分层增加 RPC。
- 跨服务业务能力通过公开 API 或消息使用，不直接导入对方业务实现或查询对方数据库。
- 同步调用候选为 HTTP + Hono RPC；客户端只引入必要类型和调用逻辑，不携带服务端运行代码。
- Hono RPC 提供 TypeScript 推断，不自动提供运行时校验、服务发现、鉴权、重试或版本兼容。
- 耗时任务使用持久化任务或事件。任务表达执行请求，事件表达已发生的业务事实。
- 独立发布需要兼容旧调用方和已排队消息，并明确超时、重复执行、权限及请求关联信息。

## Core Client

已确认保留 `@ai-interview/core-client` 的客户端设计。这里的 Core 指统一后端 API，不表示恢复独立的 `core-api` 部署单元。Hono RPC 仍为具体实现候选。

### 职责与调用关系

```text
Web 服务端 / 其他服务
  → @ai-interview/core-client
  → HTTP
  → apps/api
  → 业务模块和数据访问
```

- 客户端封装类型化接口调用，部署地址和凭据由调用方提供，包内不固定平台地址、不读取部署密钥。
- 服务端公开输入、输出和状态码契约；客户端仅依赖必要的公开类型及请求逻辑，不包含数据库驱动、业务实现或 Cloudflare bindings。
- 若使用 Hono RPC，通过稳定的类型导出消费路由类型；具体类型出口和声明构建方式在实现时确定，避免从应用内部源码深路径导入。
- Web 服务端可以使用服务端凭据。若浏览器也使用客户端，必须使用适合浏览器的认证方式，不能将服务凭据传入浏览器；是否允许浏览器直连 API 待确认。
- 合并后的 API 内部继续通过函数调用协作，不通过客户端绕回自身。Worker 仅在需要远程 API 能力时使用客户端，不要求所有操作都走 RPC。

### 初始化示意

以下示意约定了客户端组合方式，不是已存在的接口实现：

```ts
import { createCoreClient } from "@ai-interview/core-client";

const core = createCoreClient({
  baseUrl: config.coreApiUrl,
  fetch: authenticatedFetch,
});
```

`authenticatedFetch` 表示由调用方配置的请求传输，可承载认证和请求关联信息。若选择 Hono RPC，可在工厂内部使用 `hc<AppType>`，保留其路由和状态码类型推断；无需为每个端点再写一层重复包装。

### 独立部署约定

- 本地、容器和云端通过配置切换 API 地址，调用业务代码保持一致。
- 客户端类型正确不代表线上服务版本一致；接口变化需兼容尚未更新的调用方。
- 超时、错误映射、服务身份与用户身份的传递方式仍需确认。写请求是否重试取决于具体业务的幂等约定，客户端不默认重试全部请求。
- 长时间评分、转录通过提交任务并查询状态完成，不把远程客户端调用等同于可靠后台执行。

## 数据和基础设施候选

- PostgreSQL 作为统一数据库候选，避免默认部署与自托管使用不同数据库方言。
- API 与 Worker 的数据访问和迁移归属仍待确认，不因进程拆分而强制拆数据库。未来形成独立业务服务时，再明确各自的数据所有权和访问边界。
- 对象存储以 S3 兼容能力为候选，云端可用 R2。
- 队列产品尚未选择。云端与自托管适配需要明确确认、重试、并发及死信语义，不能假定任意产品完全等价。
- 业务状态与消息可靠衔接、消费者幂等性等机制随实际异步流程设计，尚未决定具体实现。

## 部署与伸缩候选

- Cloudflare 优先不必然等于全部功能运行于 Workers；是否允许混合 Node 计算尚待确认。
- Hono HTTP 层可提供 Cloudflare、Node、Vercel 入口，但数据库驱动、原生依赖、队列消费者和实时服务需单独验证运行环境。
- Node 自托管可提供完整部署组合；是否要求不依赖 Cloudflare 账号或其他托管服务，尚待确认。
- Web/API 按在线请求压力伸缩，消费者按积压、耗时及模型配额调整并发，实时服务按会话容量规划。
- 每个部署单元拥有构建产物和配置；迁移按服务归属独立执行，发布需考虑 API、消费者与契约的兼容。
- Turborepo 负责仓库任务编排，运行时部署和扩容由部署平台负责。

## 待逐项确认的决策

1. 默认 Cloudflare 部署是否允许独立 Node 后台计算和实时服务。
2. 自托管的支持范围：迁移 Web，还是完整功能无需 Cloudflare 账号。
3. 第一版业务范围与实际负载目标，包括实时语音、后台任务量和可接受等待时间。
4. 初始服务边界、数据归属与必须独立伸缩的单元。
5. Hono、同步调用契约、身份认证和授权边界。
6. 数据库、文件存储、消息系统及模型服务的部署选项。
7. 独立发布、迁移、可观测性和部署验收方式。

## 访谈记录

### D01：合并 API 部署单元

- 用户决定：Core API 和 Processing API 合并。
- 原因：两者均提供 API，第一版无需分别部署。
- 影响：使用 `apps/api` 和统一 API 客户端；内部保留业务模块，取消两者之间预设的 RPC 调用。后台执行是否独立及其部署方式仍待确认。

### D02：保留统一 Core Client

- 用户决定：将此前讨论的 `core-client` 设计纳入文档。
- 影响：使用 `packages/core-client` 调用合并后的 `apps/api`，替换草案中的 `api-client` 名称；不恢复独立 Core API，也不新增客户端实现。
- 待定：Hono RPC 的最终选型、类型导出方式、认证传递和浏览器直连范围。

当前待回答：默认 Cloudflare 部署是否允许独立 Node 后台计算和实时服务。每轮只讨论一个问题，达到共同理解后再形成正式方案和实施范围。

## 参考资料

- [TanStack Start 部署](https://tanstack.com/start/latest/docs/framework/react/guide/hosting)
- [Hono Node.js](https://hono.dev/docs/getting-started/nodejs)
- [Hono Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Hono Vercel](https://hono.dev/docs/getting-started/vercel)
- [Hono RPC](https://hono.dev/docs/guides/rpc)
