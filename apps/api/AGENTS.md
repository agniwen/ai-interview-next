# API 工作规则

修改 API 模块组织、HTTP 或后台入口、资源绑定、共享依赖前，先阅读 [README.md](./README.md)。新增或拆分路由、service、中间件时，对照 [examples](./examples/app.example.ts) 的完整调用链。本文件补充根目录 AGENTS.md。

## 目录与命名

- 按能力组织 `src/modules/<name>/`。模块的 HTTP 入口用 `routes.ts`，业务操作用 `service.ts`，输入定义用 `input.ts`，专属中间件用 `middleware.ts`；类型就近定义和导出。采用 `service.ts`，不再并列引入同义的 `operations.ts` 或独立 controller 层。
- 跨模块复用的 HTTP 中间件放在 `src/middleware/<concern>.ts`；业务中间件留在所属模块。`service.ts` 或 `middleware.ts` 内出现多个独立且复杂的职责时，再拆为模块内的 `services/` 或 `middleware/` 目录。
- `index.ts` 承接平台事件，`app.ts` 显式挂载模块路由及通用中间件。简单健康检查可以留在 `app.ts`。按实际需要增加文件，不创建空模板目录。

## Routes 与输入

- 模块导出链式创建的 Hono 路由，由 `app.ts` 通过 `.route()` 挂载 `/api/<name>` 前缀；`/health` 保留为 API 自身的健康检查。Web 将 `/api/*` 原样转发到 API，模块不依赖 Web 重写路径。保留推断类型，供 `AppType` 和 core-client 使用，不把路由对象注解成丢失具体 schema 的宽泛 Hono 类型。
- 路由只负责 HTTP 输入、依赖与身份的取得、service 调用、状态码和响应序列化。简单的一次性查询可以内联；业务规则、多步骤操作或复用逻辑放入 service。
- 外部输入在对应入口用 Zod 和 Standard Validator 校验一次，路由从 `c.req.valid()` 取值。输入 schema 按操作选择客户端可提交的字段，service 使用校验后的类型；表的插入类型不自动成为公开请求契约。
- 业务数据保留在 service 返回值中，由路由通过 `c.json(data, status)` 明确响应。service 已有可预期的失败结果由路由映射到 HTTP；不为示例预建统一响应包装或通用异常体系。

## Services 与依赖

- service 导出按业务动作命名的普通函数，显式接收所需的数据库、外部依赖、输入和身份信息，返回业务数据。service 不读取 Hono Context、原始 Request、HTTP 响应或整个平台 env。
- 身份中间件处理会话和通用登录要求，具体资源的归属与操作权限在相应业务操作中落实；后台调用也需提供其操作所需的身份信息。
- 同进程模块通过函数调用协作，跨进程使用公开接口；service 不反向导入路由或中间件。直接使用 Drizzle 查询；查询实现确有复用或复杂度后，再在所属模块内提取，不预建通用 Repository、基类或依赖注入容器。
- 在应用配置中显式声明绑定、连接参数与凭据来源，在请求或任务内创建依赖。保留自有环境可检查、可配置的资源装配；不引入 `void/db` 一类依赖隐式环境或自动创建资源的访问层。

## Middleware 与 Context

- 使用 Hono 内置中间件或 `createMiddleware`。全局 request ID、日志等通用处理在 `app.ts` 注册；模块策略在模块路由注册；数据库、会话等依赖只挂到实际使用它们的模块或路由。
- 注册顺序显式可见：通用中间件 → 模块策略与身份 → 路由所需依赖和输入校验 → handler。下游使用某个 Context 字段前，负责初始化该字段的中间件必须已经执行。
- 用 `Bindings` 声明外部绑定，用 `Variables` 声明中间件实际写入的请求数据，通过 `c.set()` / `c.get()` 传递。类型声明本身不创建值；不在模块全局缓存请求状态或数据库实例。
- 委托下游时返回 `next()`；需要后处理时等待 `next()` 后再读取或修改响应。中间件只处理 HTTP 共同行为和依赖装配，业务操作仍由 service 执行。

## 共享、示例与验证

- 表与迁移以 `@ai-interview/db` 为唯一来源。API 与后台 worker 共用 schema 时依赖数据库包；出现共同业务实现后再提取对应能力包，共享实现保持不依赖应用与 HTTP 框架。
- 实际队列或定时任务的适配放在其所属应用的 `jobs/`、`queues/` 或 `crons/`，由入口解析消息、装配依赖并调用 service。当前不预建 worker 应用或通用 core 包。
- 教学代码放在 `examples/`，采用 `.example.ts` 后缀，纳入现有类型检查。生产入口不导入示例，不为示例新增生产表、迁移或资源。
- 路由与中间件的行为通过真实 Hono app 验证，检查 core-client 的类型推断；数据库逻辑使用现有临时本地 D1。后台复用示例直接调用同一 service，不另写一份业务算法。
- 绑定变化后重新生成 Wrangler 类型；组织方式变化后同步 README 和相关示例。认证凭据与部署步骤以 README 链接的登录文档为准。
- 本地变量使用 API 的 `.env`，生产发布使用 `.env.production`；只提交对应 `.example` 模板。API 发布命令显式选择生产 env 文件并上传为 Worker Secrets，Web 通过 Service Binding 调用 API，不复制认证密钥。
