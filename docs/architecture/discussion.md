# 后端架构与多平台部署

更新日期：2026-11-02。

本文区分已确认设计、当前实现和未来候选方案。Sainoa 是重新实现的产品：不根据旧项目 `ai-interview` 预设功能、领域模型、数据库结构或权限模型；只有用户明确要求时才参考旧项目。

## 已确认的边界

- Monorepo：应用放在 `apps/`，共享包放在 `packages/`，TypeScript workspace 使用 `@ai-interview/*` 命名。
- `apps/web` 使用 TanStack Start，负责页面与 SSR；当前默认部署到 Cloudflare。
- Core API 与 Processing API 合并为 `apps/api`，使用 Hono。业务模块按实际需求增加，模块间直接调用函数，不预设独立微服务。
- 保留 `packages/core-client`，作为 TypeScript 消费者调用统一 API 的入口，不另建重复的 `api-client`。
- `apps/voice-agent` 使用 Python LiveKit Agents，承担实时语音会话执行。
- 服务拆分以独立运行时、伸缩或明确业务边界为依据，不按功能名称提前拆分。

## 当前实现

```text
apps/
  web/                         TanStack Start 页面与 SSR；同源认证请求转发到 API
  api/
    src/
      app.ts                   Hono 路由组装与 GET /health
      index.ts                 Cloudflare Worker 入口
      types.ts                 公开 AppType 类型
      modules/auth/            Better Auth 配置、实例创建与认证路由
    wrangler.jsonc
  voice-agent/                 Python LiveKit starter，uv 管理依赖
packages/
  db/                          共享 Drizzle schema、D1 连接工厂与迁移
  core-client/
    src/index.ts               createCoreClient，基于 Hono RPC
    tests/client.test.ts       客户端与真实 Hono app 的请求链路测试
  typescript-config/
```

API 已接入 Better Auth + Drizzle ORM + D1，尚无业务模块、队列或 LiveKit 集成。Web 通过 Service Binding 转发同源认证请求，不再创建 Better Auth 实例或直接访问 D1。Python Agent 尚未接入业务 API，Web 也尚未接入 core-client。

API 内部组织方式见 [API README](../../apps/api/README.md)，修改规则见 [API AGENTS.md](../../apps/api/AGENTS.md)。

API 采用 Zod 4 定义输入 schema，通过 `@hono/standard-validator` 接入 Standard Schema。输入在 HTTP 入口校验一次，后续处理通过 `c.req.valid()` 使用已校验的数据；客户端继续从 Hono 路由推断输入和响应类型。暂不接入 OpenAPI 生成。

`/health` 不接受查询参数，未声明的参数由严格对象 schema 拒绝，返回中间件默认的 400 JSON 错误（`success`、`error`、`data`）；无查询参数时保持原有调用方式。

API 的 `/health` 返回 `200 {"status":"ok"}`，只表示入口可以响应，不检查尚未接入的外部依赖。未知路径使用 Hono 默认 404。

认证路由从 Hono 的 `c.env` 取得配置，在请求内创建数据库和 Better Auth 实例；`/health` 不访问这些配置。`packages/db` 提供共享 schema 和 `createDatabase(binding)`，供 API 与后续后台 worker 复用，不依赖应用层。业务代码不直接依赖 Hono Context。

## 共享代码与服务调用

共享包用于同语言的代码复用；服务 API 用于跨进程、跨语言的能力调用。客户端负责通信，业务规则由提供能力的服务执行。

```text
Web / TypeScript 服务
  → @ai-interview/core-client
  → API

Python voice-agent
  → Python CoreClient（有实际调用需求后实现）
  → 同一个 API
```

API 提供业务能力及相应授权。Voice Agent 编排实时对话，通过工具调用使用这些能力。Agent 的提示词不替代 API 授权；调用方也不能仅提交资源 ID 就获得访问权限。具体用户身份、服务身份和授权范围随真实接口设计确定。

跨服务通过公开接口使用能力，不直接查询对方数据库或导入对方业务实现。API 内部模块协作不绕回 core-client 调用自身。

## TypeScript Core Client

```ts
import { createCoreClient } from "@ai-interview/core-client";

const core = createCoreClient({
  baseUrl: "http://localhost:8787",
});

const response = await core.health.$get();
if (response.status === 200) {
  const health = await response.json();
}
```

- 地址和可选 `fetch` 由调用方提供。客户端不读取部署密钥，不固定服务地址，不自动重试请求。
- 使用 `hc<AppType>` 保留路由、响应和状态码推断；当前由 `@ai-interview/api/types` 提供稳定的类型出口，不使用应用源码深路径导入。
- API 类型通过 `import type` 引入，不将路由实现打包进客户端。测试才从 `@ai-interview/api` 导入真实 app。
- 当前是仓库内直接消费 TypeScript 源码的私有包，由消费方编译，无单独发布的 JS / 声明产物。以后独立发布 SDK 时再增加声明构建与版本发布流程。
- `fetch` 注入点可承载认证、请求关联信息，也可适配 Cloudflare Service Binding 的 HTTP 调用；具体适配随调用方接入实现。
- 服务端凭据仅用于服务端，不交给浏览器。浏览器直连范围与认证方式尚未确定。
- 类型推断不是运行时校验；将来有外部输入时，在入口验证一次。独立发布时仍需保持 API 向后兼容。

## Python 与跨语言契约

Python 不能导入 TypeScript 的 core-client，也不能消费 Hono 的 TypeScript 类型推断。两边共享 HTTP/JSON 协议，不共享语言实现。

实际跨语言接口出现后，以 OpenAPI 等语言无关契约描述公开接口，由 API 的输入输出定义维护，避免手工维护多份互不关联的契约。TypeScript 保留 Hono RPC，Python 使用同一组 HTTP 接口。

初期只在 `apps/voice-agent/src/core_client.py` 集中实现已使用的接口；出现第二个 Python 消费者后再提取共享包。接口规模增长后考虑生成 Python 客户端。本次不增加空客户端、OpenAPI 工具链或代码生成流程。

## API 反向使用 Agent 能力

反向调用可能发生，但运行中的 Agent 是有生命周期的会话执行实例，不默认作为固定地址、始终在线的 HTTP 服务。

| 需求类别         | 设计方向                                            |
| ---------------- | --------------------------------------------------- |
| 启动语音会话     | API 通过 LiveKit 调度 Agent                         |
| 控制运行中的会话 | 通过会话消息或 RPC 发送指令；具体协议待实际需求确定 |
| 查询已保存的结果 | 从业务 API 查询持久化数据                           |
| 执行独立 AI 任务 | 按需增加任务接口或队列消费者                        |

因此暂不为 voice-agent 增加 HTTP 服务，也不创建 voice-client。

如果多个入口都需要某项 AI 能力，根据它的数据与业务归属选择实现位置：无状态能力可以直接使用同一模型提供商；需要统一规则和持久化的能力放在 API 或后台任务；依赖当前语音上下文的能力由当前 Agent 执行。不能仅因某段代码先写在 Agent 中，就让所有服务依赖 Agent 执行。

## 后台执行与未来共享包

耗时任务的提交和查询仍属于统一 API。实际出现异步任务后，再决定是否新增 `apps/worker` 及其运行平台。

API 与消费者需要复用业务实现时，按实际能力提取包；不提前创建庞大的 core、processing 或通用 services 包。服务独立发布前，再确定数据所有权、接口兼容和消息语义。

队列、任务可靠提交、重复执行处理、并发控制及结果持久化均待真实任务设计，不能把普通远程调用当作可靠后台执行。

## 环境与部署方向

建议区分 development、staging、production，同一套代码通过配置连接独立资源：

- Cloudflare 环境分别部署 Worker，绑定各自的数据与存储资源，分别配置 secrets。
- LiveKit 按 Project 隔离，Web/API 和 Agent 使用同一环境的项目凭据；`agent.py dev` 只改变运行模式，不隔离项目。
- 配置、数据、Webhook 回调和认证均应属于同一环境。
- 当前没有创建 staging 资源或实现完整环境部署流程。

API 使用 Wrangler 本地开发与 dry-run 构建。Web 的认证请求已通过 Service Binding 调用 API；上线时需先部署 API，再部署 Web。其他 Cloudflare 内部调用可通过客户端注入 Service Binding 的 fetch；跨平台保留 HTTP 接口。未来 Node/Vercel 入口及数据库、队列替代实现需分别验证，不承诺仅切换启动命令即可迁移全部基础设施。

Voice Agent 独立部署到 LiveKit Cloud Agents 或支持 Python 长驻进程的平台。API 和 Agent 可以独立伸缩；Turborepo 只负责仓库内任务编排。

## 尚未决定

- 产品第一批功能及对应领域模型。
- 服务调用的身份及授权方式；浏览器认证已迁移到 API。
- 业务数据存储；D1 当前只用于认证，不能据此视为所有业务数据库的既定选择。
- OpenAPI 工具链、Python 客户端、Agent 控制协议和异步任务实现。
- 自托管范围、实际环境资源与发布流程。

## 参考

- [Hono RPC](https://hono.dev/docs/guides/rpc)
- [Hono Cloudflare Workers](https://hono.dev/docs/getting-started/cloudflare-workers)
- [Cloudflare 环境](https://developers.cloudflare.com/workers/wrangler/environments/)
- [LiveKit 自托管与环境隔离](https://docs.livekit.io/deploy/custom/deployments/)
