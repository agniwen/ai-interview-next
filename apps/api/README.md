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
    workspaces/
      routes.ts
      service.ts
    interviewer-agents/
      input.ts
      routes.ts
      service.ts
    question-sets/
      input.ts
      routes.ts
      service.ts
tests/
  auth.test.ts
  examples.test.ts
  workspaces.test.ts
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
- `GET /api/workspaces` 列出当前用户所属的工作区和最后激活的工作区；`POST /api/workspaces/:workspaceId/activate` 在验证成员关系后持久记录最后激活的工作区。匿名请求返回 401，不可访问的激活目标返回 404。

- `GET /api/interviewer-agents/:workspaceId` 使用 `page`、`pageSize`、`search` 返回 `{ version: 1, rows, page, pageSize, total }`。按名称和说明搜索，按创建时间、ID 倒序排列；列表不携带提示词，`GET /api/interviewer-agents/:workspaceId/:id` 返回完整配置。
- `POST /api/interviewer-agents/:workspaceId` 与 `PUT /api/interviewer-agents/:workspaceId/:id` 接受 `{ version: 1, name, description?, prompt }`。名称去除首尾空白后为 1–200 字符，提示词为 1–30,000 字符，说明最多 30,000 字符；创建时省略说明则为空，编辑时省略保留原值，空字符串可清空。创建返回 `{ version: 1, id }`（201），编辑返回同格式（200）。创建人来自当前会话，编辑保留创建人并更新修改时间。
- 面试官配置供当前工作区成员共同管理。上述接口沿用登录与工作区成员校验；配置不存在或属于其他工作区时返回 `{ version: 1, error: "INTERVIEWER_AGENT_UNAVAILABLE" }`（404），输入校验失败返回 `{ version: 1, error: "INVALID_INPUT" }`（400）。本阶段只管理可复用配置，尚未接入面试轮次或启动访谈。

### 题套 / Question sets

- `GET /api/question-sets/:workspaceId` 接受 `page`、`pageSize`、`search` 和可选 `kind=form|conversation`，返回 `{ version: 1, rows, page, pageSize, total }`。按名称与说明搜索，先筛选再分页；按创建时间、ID 倒序排列。列表只返回名称、说明、类型、题数和维护信息，完整内容由 `GET /api/question-sets/:workspaceId/:id` 读取。
  The list accepts pagination, name/description search and an optional kind filter. Filtering precedes pagination, with creation time and ID descending for stable order. List rows contain summaries and question counts; the detail endpoint returns full content.
- `POST /api/question-sets/:workspaceId` 与 `PUT /api/question-sets/:workspaceId/:id` 接受 `{ version: 1, name, description?, content }`，创建返回 `{ version: 1, id }`（201），编辑返回同格式（200）。名称去除首尾空白后为 1–200 字符，说明最多 30,000 字符；创建时省略说明为空，编辑省略保留原值，空字符串清空。
  Create and update accept the complete set. Trimmed names are 1–200 characters and descriptions at most 30,000. An omitted description defaults to empty on creation and preserves the previous value on edits; an empty string clears it.
- `content` 为 `{ version: 1, kind, questions }`。两类题套分别对应 `form` 和 `conversation`，每套最多 50 题，允许保存空套逐步编辑。题目与选项的数组位置就是顺序，不需要额外排序字段，也不按题干去重；编辑整套替换内容，可增题、删题和调整顺序。
  Versioned content discriminates between form and conversation sets. Each holds up to 50 questions and may be empty while being edited. Array order determines question and option order without prompt deduplication. Whole-set updates support additions, removals and reordering.
- 表单题为 `{ type, content, description?, options? }`：`type` 支持 `single_choice`、`multiple_choice`、`text`；题干为 1–1000 字符，辅助说明最多 500 字符。选择题必须有 2–20 个非空选项，每个最多 200 字符；填写题不接受选项。所有表单题均必填，不接受 `required` 字段。
  Form questions support single choice, multiple choice and text. Prompts contain 1–1000 characters and help text at most 500. Choice questions require 2–20 nonempty options of at most 200 characters each; text questions do not accept options. All questions are required, so a required toggle is not accepted.
- 沟通题为 `{ content, difficulty, evaluationFocus?, followUpDirections?, evaluationCriteria? }`：题干为 1–1000 字符，难度为 `easy|medium|hard`，考核点最多 500 字符，追问方向最多 1000 字符，评价标准最多 2000 字符。省略的辅助文本保存为空字符串。
  Conversation questions contain a prompt, difficulty, evaluation focus, follow-up directions and evaluation criteria. Limits are 1000, 500, 1000 and 2000 characters respectively; difficulty is easy, medium or hard. Omitted guidance is stored as an empty string.
- 读写均要求登录和工作区成员身份；题套不存在或属于其他工作区返回 `{ version: 1, error: "QUESTION_SET_UNAVAILABLE" }`（404），输入不符合格式返回 `{ version: 1, error: "INVALID_INPUT" }`（400）。创建人来自会话，编辑保留创建信息。本步仅提供题套数据与 API，岗位绑定、面试选题、快照与作答按后续步骤实现。
  Reads and writes require authentication and workspace membership. Missing or foreign-workspace sets return the same 404 error; invalid input returns 400. The session supplies the creator, which edits preserve. Job bindings, interview selection, snapshots and answers belong to subsequent steps.

### 招聘数据 / Recruiting data

- `GET /api/ats/:workspaceId/projects/:id` 返回项目预览详情 `{ version: 1, id, title, description, createdAt, jobCount }`，仅限所属工作区成员访问；不存在或不属于当前工作区的项目返回 404。列表不携带长篇说明，Web 在打开项目预览卡或编辑弹窗时加载详情。
- `POST /api/ats/:workspaceId/projects` 与 `PUT /api/ats/:workspaceId/projects/:id` 接受可选的 Markdown `description`（去除首尾空白，最多 30,000 字符）；创建时省略则保存为空字符串，编辑时省略则保留原说明，提交空字符串可清空说明。

- `GET /api/ats/:workspaceId/uploads/:id/processing` 返回 `{ version: 1, upload, run, attempts, resume }`：本次执行的阶段尝试、状态、时间、错误和模型参数，以及简历最近保存的 Markdown、结构化资料和头像是否存在。仅所属工作区成员可访问，缺失或越权返回 404；重新解析时旧产物保留至替换，不提供历史产物快照。头像属于文本提取阶段，没有独立尝试记录。

- `GET /api/ats/:workspaceId/departments` 使用 `page`、`pageSize`、`search` 返回部门分页列表；`POST /departments` 与 `PUT /departments/:id` 接受 `{ version: 1, name, description? }`，名称去除首尾空白后为 1–200 字符；说明以 Markdown 保存，最多 30,000 字符，创建时省略默认为空，编辑时省略保留原值，空字符串可清空。访问和编辑限定在当前工作区内。
- 项目、部门和岗位创建时由服务端从当前会话记录 `createdBy`，编辑不会改变创建人。历史项目与岗位没有创建人记录时保留 `null`，Web 暂不显示创建人字段。

- 岗位支持独立的 Markdown `internalCriteria`（内部标准，最多 30,000 字符），创建时省略默认为空，编辑省略保留原值，空字符串可清空；岗位详情返回此字段。
- 岗位创建和编辑使用可选的 `departmentId` 选择当前工作区部门，`null` 可取消关联；岗位详情返回 `departmentId` 和当前部门名称 `department`。部门改名后详情展示新名称。历史岗位的手填名称通过迁移按工作区归并为部门，无法确定的创建人保留为空。
- 简历列表返回每条记录的 `source`，目前为 `manual_upload`（人工上传）。来源保存在上传批次中，由上传入口设置，历史批次默认回填为人工上传；增加新渠道时扩展来源类型及对应展示文案。

- 招聘流程详情返回 AI 评价历史 `evaluations` 和成员评价 `feedback`。成员评价包含作者、时间及 Markdown 正文；界面第一条固定为 AI 评价，默认展示最新版本，可前后切换历史版本，重新评价成功后在原位置展示新版本。其后的成员消息按时间和 ID 排序。
- AI 每次完成评价、成员每次添加评价时，与评价结果在同一批事务中保存一条活动记录。AI 活动以 `Sainoa Agent` 为执行者，成员活动记录实际作者；记录关联评价 ID，发生时间与评价保存时间一致。
- `POST /api/ats/:workspaceId/applications/:id/feedback` 接受 `{ version: 1, body }`，正文去除首尾空白后为 1–30,000 字符，作者取当前会话。工作区成员可以追加评价，已删除的招聘流程不可访问。
- `POST /api/ats/:workspaceId/applications/:id/reevaluate` 为仍进行中的招聘流程建立一次新的评价任务，返回 `{ version: 1, runId }`（202）。使用最近关联的可用且已解析简历，保存当前岗位要求和内部标准快照；不覆盖历史 AI 结果。创建招聘流程时仍自动发起首次评价。
- 新 AI 评价使用 `version: 3`，固定包含综合判断、推荐等级、匹配依据、风险与待确认项，不再生成六维评价。迁移删除早期 `version: 1` 数字评分及关联活动和任务，将 `version: 2` 定性评价移除六维字段后转为当前格式，运行时代码只处理 `version: 3`。成员发言不会触发 AI 自动回复。模型输出校验及任务重试沿用现有评价队列。

工作区、成员、邀请及固定角色使用 Better Auth Organization 插件；首次创建用户时自动创建初始工作区和 owner 成员关系。所有 Organization 操作都传入明确的组织标识，Web 页面不依赖共享 session 中的当前组织。设计和页面入口见 [工作区文档](../../docs/architecture/workspaces.md)。

工作区使用服务端生成的 8 位小写字母数字 ID；注册时的初始工作区与 Organization 创建钩子共用生成与查重逻辑，重复时重新生成，slug 与 ID 一致。

生产 API 域名为 `https://sainoa-api.akumanoko.com`，健康检查为 <https://sainoa-api.akumanoko.com/health>。域名由 `wrangler.jsonc` 的 Custom Domain 配置管理，发布 API 时由 Cloudflare 配置 DNS 与 HTTPS。Web 继续通过 Service Binding 调用 API；`BETTER_AUTH_URL` 和 Google 回调仍使用 Web 域名 `https://sanioa.akumanoko.com`。

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

题套支持可选的 `defaultJobIds`：创建时省略则无绑定，编辑时省略保留原绑定，传空数组清空；重复 ID 合并。岗位必须属于当前工作区，否则返回 `JOB_UNAVAILABLE`（400），不改变题套内容或绑定。详情返回 `defaultJobs: [{ id, title }]`；列表可用 `jobId` 查询默认绑定该岗位的题套，与题型和关键词筛选共同作用于分页和总数。绑定仅为创建面试提供初始选择，不限制题套的使用范围。

### 面试轮次 / Interview rounds

- `POST /api/interviews/:workspaceId/applications/:applicationId` 创建首轮 AI 或真人面试，返回 `{ version: 1, id }`（201）。请求字段：
  - `version: 1`；AI 面试使用 `kind: "ai"` 和 `interviewerAgentId`，真人面试使用 `kind: "human"` 和非空、不重复的 `interviewerUserIds`（当前工作区成员）。两类配置不可混选。
  - 真人面试专用 `scheduledAt`、`admissionDeadline`：带时区的 ISO 时间；截止时间必须晚于预约开始时间。AI 面试不接收这两个字段，数据库均保存为 `null`，不受预约时间限制。
  - AI 专用 `conversationQuestionSetIds`：按本轮使用顺序排列，至少一套含有题目；`formQuestionSetIds` 可省略或为空。两类选择分别不允许重复 ID。
  - AI 专用 `confirmationUserId`：可省略，默认创建者；指定时必须为当前工作区成员。
  - `label`：可选的自由标签，最多 200 字符。
- `GET /api/interviews/:workspaceId/applications/:applicationId?page=1&pageSize=20` 返回 `{ version: 1, rows, page, pageSize, total }`，按轮次号、ID 升序排列。超出页码返回空列表和同一总数。
- `GET /api/interviews/:workspaceId/applications/:applicationId/setup` 返回 `{ version: 1, sets, reviewer }`，按岗位默认绑定预选题套，包含题型与题数，确认人默认为当前用户。
- `GET /api/interviews/:workspaceId/members?page=1&pageSize=20&search=` 搜索并分页返回工作区成员，供真人面试官或 AI 评价确认人选择；返回 `{ version: 1, rows, page, pageSize, total }`。
- `GET /api/interviews/:workspaceId/:id` 返回轮次字段与 `assignments`（用户信息及 `interviewer`／`reviewer` 职责）。`kind`、`label`、`interviewerAgentId` 为普通列；`questionSelection` 是版本化 JSON，仅保存两类题套的有序 ID。创建不复制题目、Agent 提示词或招聘材料。
- 创建要求招聘记录仍开放，所选真人面试官或 Agent、题套和确认人均属于当前工作区。关闭的招聘记录返回 `APPLICATION_CLOSED`（409），已有轮次返回 `INTERVIEW_ALREADY_EXISTS`（409）。本步只开放首轮，后续轮次将在正式评价确认规则接入后开放。
- 资源不可用返回 `APPLICATION_UNAVAILABLE`／`INTERVIEW_UNAVAILABLE`（404）；所选 Agent、确认人或题套不可用返回 `INTERVIEWER_AGENT_UNAVAILABLE`／`CONFIRMATION_USER_UNAVAILABLE`／`QUESTION_SET_UNAVAILABLE`（400）；沟通题全部为空返回 `CONVERSATION_QUESTIONS_REQUIRED`（400）；真人面试官不属于当前工作区返回 `INTERVIEWER_USER_UNAVAILABLE`（400）；格式错误返回 `INVALID_INPUT`（400）。业务错误响应均含 `version: 1`。
- 本步不生成邀请链接，不开放候选人访问、房间入场或面试启动，也不改变招聘阶段。招聘流程详情的「面试」Tab 已接入创建表单，邀请与快照按后续步骤分别接入。
- `DELETE /api/interviews/:workspaceId/:id` 仅允许轮次创建者删除仍为 `scheduled` 的轮次，返回 `{ version: 1, id }`。按轮次状态而非预约时刻判断是否开始；非创建者返回 `INTERVIEW_DELETE_FORBIDDEN`（403），非预约状态返回 `INTERVIEW_NOT_DELETABLE`（409）。删除不影响面试官或题套。列表行返回当前用户的 `canDelete`，前端据此展示操作。
  Only the round creator can delete a round while its status is `scheduled`; the response is `{ version: 1, id }`. Eligibility follows the round status rather than the scheduled time. A different creator receives 403, and other statuses receive 409. Agents and question sets are retained. List rows expose the current user's `canDelete` permission for the UI.

- 首轮创建支持 `kind: "ai" | "human"`。真人轮次不接收 AI 配置，列表通过 `interviewers` 返回所选成员的姓名和头像。
  First-round creation supports AI and human interviews. Human rounds reject AI-specific settings, and list rows include selected members' names and avatars in `interviewers`.

- `interview_assignment` 保存指定面试官与评价确认人，`position` 保留选择顺序；`(workspaceId, userId, interviewRoundId)` 索引支持按当前用户筛选，轮次与人员在同一批事务中创建，删除轮次级联删除人员关联。人员关系不在 JSON 中重复保存。
  `interview_assignment` stores assigned interviewers and reviewers, preserving selection order with `position`. The workspace/user/round index supports user-based filtering. Rounds and assignments are created atomically; deleting a round cascades to its assignments. JSON does not duplicate these relationships.

- `GET /api/interviews/:workspaceId/:id/edit` 返回 `{ version: 1, round, agent, sets }`，以本轮已保存的人员、题套顺序和时间回填编辑表单，不重新采用岗位默认值。仅创建者或当前工作区 `admin`／`owner` 可访问未开始轮次的编辑配置。
  The edit endpoint loads saved round selections and current choice labels, without reapplying job defaults. Only the creator or a workspace admin/owner may load an unstarted round for editing.
- `PUT /api/interviews/:workspaceId/:id` 完整替换本轮可编辑配置，输入沿用创建格式，但 AI 必须明确提交 `confirmationUserId`，不会因管理员编辑而默认更换确认人。面试类型创建后固定，跨类型修改返回 `INTERVIEW_KIND_IMMUTABLE`（400）。标签、时间、Agent、题套和人员关系在同一批事务中更新；保留轮次 ID、编号和创建信息。人员选择移除后不再出现在该用户负责的面试中。
  PUT replaces the editable configuration using the creation format, with an explicit AI reviewer required. The interview type is fixed after creation; a type change returns `INTERVIEW_KIND_IMMUTABLE` (400). It updates round settings and assignments atomically while retaining round identity and creation metadata. Removed assignees no longer own that responsibility.
- 编辑权限不足返回 `INTERVIEW_EDIT_FORBIDDEN`（403），轮次不再为 `scheduled` 时返回 `INTERVIEW_NOT_EDITABLE`（409）；以实际状态而非预约时刻锁定。列表行的 `canEdit` 控制编辑入口，后端独立执行相同权限和状态规则。
  Editing returns 403 without permission and 409 once the round leaves scheduled status. The list exposes `canEdit`; the backend independently enforces permission and status.
