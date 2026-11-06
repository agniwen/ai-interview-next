# 骨架屏 / Skeletons

异步内容首次加载时，骨架屏占据真实内容的位置。已有内容后台刷新时继续显示原内容；共享外壳、导航与 tabs 不因局部数据加载而替换。
Skeletons occupy the real content's space during initial loading. Background refreshes preserve existing content, shared layouts, navigation, and tabs.

```text
skeletons/
├── pages/       页面内容级别 / Page content
└── components/  局部区域级别 / Component regions
```

按被替代的页面或区域命名，使用 `*-skeleton.tsx` 与 `*Skeleton` 导出。直接导入具体文件。基础原语继续使用 `@/components/ui/skeleton`，不在此复制。
Name files and exports after the page or region they replace (`*-skeleton.tsx`, `*Skeleton`). Import concrete files directly. Reuse the existing `@/components/ui/skeleton` primitive.

页面骨架可以组合组件骨架、基础 Skeleton，或两者混用。组件骨架按真实布局拆分，不要求每一条矩形都抽成单独组件。只依赖展示所需的基础组件，避免把正在加载的业务分包引入首屏。
Page skeletons can compose component skeletons, base Skeleton elements, or both. Extract meaningful regions rather than individual rectangles. Keep dependencies presentational so fallbacks do not pull in the feature chunk they replace.

## 新建页面 / New pages

1. 确定首次等待的边界：路由、组件数据或懒加载区域。纯静态内容与仅重定向的路由不必新增骨架。
   Identify the initial loading boundary: route, component data, or lazy region. Static content and redirect-only routes do not need skeletons.
2. 在对应目录实现骨架，与真实布局保持宽度、间距、主要区块和移动端行为一致。页面骨架只覆盖页面内容；已存在的共享外壳由父布局保留。
   Implement the skeleton in the matching directory, preserving widths, spacing, major regions, and mobile behavior. Page skeletons cover page content; parent layouts retain mounted shared UI.
3. 路由骨架使用 `pendingComponent`，由 Router 统一保证至少显示 1 秒。组件数据用 `useSkeletonPhase` 接收首次 `isPending`，等待 150 毫秒再显示骨架，出现后保留至少 1 秒。`pending` 阶段保留外壳，`ready` 后显示内容、错误或空状态。懒加载区域用 `SkeletonSuspense` 保留已出现的骨架。
   Use `pendingComponent` for route skeletons. The router keeps them visible for at least one second. For initial component data, pass `isPending` to `useSkeletonPhase`. It waits 150 ms before showing a skeleton, then keeps it visible for at least one second. Keep the surrounding layout in the `pending` phase and show content, errors, or empty states in the `ready` phase. Use `SkeletonSuspense` to hold visible fallbacks for lazy regions.
4. 加载区域提供 `aria-label` 与 `aria-busy="true"`，其中的装饰元素使用 `aria-hidden="true"`。纯装饰演示占位可整体隐藏。骨架不包含可操作控件。
   Label loading regions and set `aria-busy="true"`; hide decorative shapes with `aria-hidden="true"`. Entirely decorative demo fallbacks may be hidden as a whole. Skeletons contain no interactive controls.
5. 验证首次加载、缓存返回、后台刷新和窄屏布局。错误与空状态分别使用各自的界面，操作中的 Spinner 保留。
   Verify initial loading, cached returns, background refreshes, and narrow layouts. Errors and empty results use their own UI; actions retain their progress indicators.

工作台分页表格用 Skullet 在各单元格内部测量与真实表格共用布局的样例内容，固定操作列也在其自身层级内绘制。不要用一个测量覆盖层包裹整张表格，否则带阴影的表体会被识别为大色块，固定列也会遮挡覆盖层。样例使用静态占位数据，无需保存测量结果。
Workbench lists use Skullet inside each cell to measure sample content sharing the real table layout; pinned actions draw within their own stacking context. Do not wrap the whole table in one measurement overlay: the shadowed body becomes one block, and pinned cells cover that overlay. Samples use static placeholder data and measurements are not persisted.

## 当前接入 / Current coverage

| 页面或区域 / Page or region                 | 首次数据加载 / Initial data loading             | 路由加载 / Route loading            |
| ------------------------------------------- | ----------------------------------------------- | ----------------------------------- |
| 认证区首次进入 / Authenticated entry        | 工作区会话 / Workspace session                  | `WorkspacesPageSkeleton`            |
| 工作区选择、不可用工作区 / Workspace picker | `InvitationCardSkeleton`                        | `WorkspacesPageSkeleton`            |
| Agent                                       | `ChatTranscriptSkeleton`, `SessionListSkeleton` | `AgentPageSkeleton`                 |
| 工作区设置 / Workspace settings             | `WorkspaceSettingsPageSkeleton`                 | 同左 / Same                         |
| 个人中心 / Account                          | `AccountSettingsSkeleton`                       | `AccountPageSkeleton`               |
| 邀请 / Invitation                           | `InvitationCardSkeleton`                        | `InvitationPageSkeleton`            |
| 回收站 / Trash                              | `TrashListSkeleton`                             | `AgentTrashPageSkeleton`            |
| 登录 / Sign-in                              | `SignInSessionSkeleton`                         | 静态页面外框 / Static page frame    |
| 用户菜单 / User menu                        | `UserMenuSkeleton`                              | 由所在布局保留 / Retained by layout |
| 首页演示 / Homepage demo                    | `DemoWindowSkeleton`, `DemoPanelSkeleton`       | 静态首页 / Static homepage          |

首页主体、Hub 当前概览占位与 404 是静态内容；为它们新增异步数据时，按上述规则一并补齐骨架。
The homepage body, current Hub dashboard placeholder, and 404 are static. Add skeletons with any future asynchronous data introduced to these pages.
