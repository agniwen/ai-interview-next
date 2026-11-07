# TanStack Query 查询键管理

本文记录接入 Query Key Factory 前的仓库现状与方案对比。现行约定见 [AGENTS.md](../../AGENTS.md#query-keys-and-mutations--查询键与写入)。

## 仓库现状

- **ATS 多数直接写数组。** 岗位、候选人、简历、应聘和项目的列表键形如 `["ats", workspaceId, "jobs", query]`，最后一项带上页码、每页条数和筛选。写入后用 `["ats", workspaceId, "jobs"]` 让该工作区的所有岗位列表失效，部分操作则用 `["ats", workspaceId]` 刷新整个 ATS。仓库规则规定了分页和工作区参数如何入键，目前各功能分别组织自己的键。 [分页约定](../../AGENTS.md#list-pagination--列表分页) · [岗位查询和失效](../../apps/web/src/components/features/ats/jobs-page.tsx#L132) · [简历失效](../../apps/web/src/components/features/ats/resumes-page.tsx#L155)
- **项目列表和下拉选项共用前缀。** 列表键为 `["ats", workspaceId, "projects", query]`，选项键为 `["ats", workspaceId, "projects", "options"]`。新建项目后按 `["ats", workspaceId, "projects"]` 失效，两种缓存都在范围内。 [项目列表](../../apps/web/src/components/features/ats/projects-page.tsx#L84) · [项目写入后的失效](../../apps/web/src/components/features/ats/projects-page.tsx#L118) · [项目下拉](../../apps/web/src/components/features/ats/project-select.tsx#L27)
- **Workspaces 和 Agent 已经有 `queryOptions`。** 工作区会话复用同一个选项定义，路由用它读取，工作区操作从它取键做失效。Agent 会话也有 `agentSessionsQueryOptions(workspaceId)`，但会话页和回收站仍各自手写 `["agent-sessions", workspaceId]` 来失效。工作区详情和邀请仍分开写数组。 [工作区会话定义](../../apps/web/src/lib/workspaces/session-query.ts#L4) · [路由读取](../../apps/web/src/routes/_a.tsx#L8) · [工作区失效](../../apps/web/src/lib/workspaces/actions.ts#L28) · [Agent 会话定义](../../apps/web/src/lib/agent/queries.ts#L4) · [会话页](../../apps/web/src/components/features/agent/page.tsx#L236) · [回收站](../../apps/web/src/components/features/agent/trash-page.tsx#L25)

## 官方和社区做法

- **TanStack Query v5** 用可序列化数组标识查询，把会改变查询结果的变量纳入键。`queryOptions` 把 `queryKey` 和 `queryFn` 放在一起，保留类型推断，供组件、路由预取和缓存操作复用。无限查询有对应的 `infiniteQueryOptions`。`invalidateQueries` 支持按前缀匹配，`exact: true` 可限于单个完整键。 [Query Keys](https://tanstack.com/query/v5/docs/framework/react/guides/query-keys) · [Query Options](https://tanstack.com/query/v5/docs/framework/react/guides/query-options) · [Query Invalidation](https://tanstack.com/query/v5/docs/framework/react/guides/query-invalidation)
- **TkDodo 的 TypeScript 工厂**把键留在业务模块里，从资源前缀逐层扩展到列表、详情和具体参数。批量失效复用前缀，精确操作复用完整键。这个结构可以用普通 TypeScript 函数和 `as const` 表达。 [Effective React Query Keys](https://tkdodo.eu/blog/effective-react-query-keys)
- **`@lukemorales/query-key-factory`**通过 `createQueryKeys` 生成类型化的键和查询函数，可通过 `_def` 取前缀、通过 `mergeQueryKeys` 合并定义。截至 2026-11-06，npm 的 `latest` 为 2024-02-25 发布的 `1.3.4`。 [项目文档](https://github.com/lukemorales/query-key-factory) · [GitHub 发布记录](https://github.com/lukemorales/query-key-factory/releases/tag/v1.3.4) · [npm 注册信息](https://registry.npmjs.org/@lukemorales%2Fquery-key-factory)
- **React Query Kit** 用 `createQuery` 和 `createInfiniteQuery` 生成可复用的 hooks，提供 `getKey`、`getOptions` 和 `getFetchOptions`。它也提供按资源组织查询和中间件的 API，适合需要统一封装 hooks 的项目。 [项目文档](https://github.com/HuolalaTech/react-query-kit)
- **官方 lint** 的 `@tanstack/query/exhaustive-deps` 检查查询函数使用的变量是否入键，`prefer-query-options` 鼓励通过选项工厂传递查询配置。仓库当前用 Ultracite 和 Oxlint，官方文档给出了通过 Oxlint JS 插件接入的方式，可作为单独的后续决定。 [Exhaustive Deps](https://tanstack.com/query/latest/docs/eslint/exhaustive-deps) · [Prefer Query Options](https://tanstack.com/query/latest/docs/eslint/prefer-query-options) · [Oxlint 接入](https://tanstack.com/query/latest/docs/eslint/eslint-plugin-query#oxlint) · [仓库 lint 配置](../../oxlint.config.ts#L1)

## 建议

沿用现有的 `queryOptions`，按业务模块导出需要共享的查询选项，再用小型 TypeScript 工厂定义批量失效所需的前缀。先把 Agent 会话页和回收站的失效调用改成使用 `agentSessionsQueryOptions(workspaceId).queryKey`。ATS 可以先从项目开始，用 `projectKeys.all(workspaceId)` 表达现有项目范围，让 `list(workspaceId, query)` 和 `options(workspaceId)` 都从它派生，保持新建项目后同时刷新列表与下拉选项的语义。 [Agent 会话定义](../../apps/web/src/lib/agent/queries.ts#L4) · [项目写入后的失效](../../apps/web/src/components/features/ats/projects-page.tsx#L118)

接下来按实际需要迁移其他 ATS 资源。普通列表从 URL 解析出工作区、页码、每页条数和筛选，再用同一组参数构造请求与键。无限加载把搜索词放入键，逐页游标或页码由 `pageParam` 管理，简历选择器已有这一结构。当前的复用需求可以由原生助手和 TypeScript 工厂覆盖。 [分页约定](../../AGENTS.md#list-pagination--列表分页) · [简历选择器](../../apps/web/src/components/features/ats/application-resume-field.tsx#L89) · [Infinite Queries](https://tanstack.com/query/v5/docs/framework/react/guides/infinite-queries)
