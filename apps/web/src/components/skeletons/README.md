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
3. 将路由骨架接到 `pendingComponent`，数据骨架接到首次 `isPending`，懒加载骨架接到 `Suspense`。不要使用后台 `isFetching` 把缓存内容换成骨架。
   Connect route skeletons to `pendingComponent`, data skeletons to initial `isPending`, and lazy skeletons to `Suspense`. Do not replace cached content based on background `isFetching`.
4. 加载区域提供 `aria-label` 与 `aria-busy="true"`，其中的装饰元素使用 `aria-hidden="true"`。纯装饰演示占位可整体隐藏。骨架不包含可操作控件。
   Label loading regions and set `aria-busy="true"`; hide decorative shapes with `aria-hidden="true"`. Entirely decorative demo fallbacks may be hidden as a whole. Skeletons contain no interactive controls.
5. 验证首次加载、缓存返回、后台刷新和窄屏布局。错误与空状态分别使用各自的界面，操作中的 Spinner 保留。
   Verify initial loading, cached returns, background refreshes, and narrow layouts. Errors and empty results use their own UI; actions retain their progress indicators.

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
