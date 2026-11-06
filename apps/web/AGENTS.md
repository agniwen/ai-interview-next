# List page headers / 列表页页头

- Use the shared `PageHeader` for the title and optional description. In `TableFilters` above the table, lay out the filter groups from left to right, with the action group immediately after the last filter. Allow the groups to wrap together.
  列表页使用共用的 `PageHeader` 展示标题和可选说明。表格上方使用 `TableFilters`，筛选组从左向右排列，操作组紧跟最后一个筛选项，空间不足时按顺序换行。
- Apply keyword changes on blur. Apply select and date filters as soon as the user commits a selection.
  关键词输入失焦时应用修改，下拉框和日期筛选在选定后立即生效。
- Use Coss `Group` to join related controls, with `GroupSeparator` between them and `GroupText` for inline labels. Page action buttons use `outline`. Primary actions such as Create and Upload may have a text label. Secondary actions such as Refresh must be icon-only, with an accessible name and a tooltip.
  相关控件用 Coss `Group` 组合，以 `GroupSeparator` 分隔，行内标签用 `GroupText`。页面操作按钮使用带边框的 `outline` 样式。创建、上传等主操作可以带文字。刷新等次要操作只展示图标，并提供可访问名称和 Tooltip。
- Keep the header and filter bar mounted while the list loads, refreshes, fails, or is empty. Keep list empty states focused on the empty-state content.
  列表加载、刷新、报错或为空时，保持页头和筛选栏的位置。列表空状态只展示空状态内容。
- Compose numbered pagination from the existing Coss `Pagination` in the shared list layout. Page links update the page in the URL and preserve filters and page size.
  页码分页直接在共用列表布局中组合现有的 Coss `Pagination`。翻页链接更新 URL 中的页码，并保留筛选条件和每页条数。

# Page loading states / 页面加载状态

When creating or changing a page with asynchronous data or lazy content, read [the skeleton conventions](src/components/skeletons/README.md) and implement its initial loading state in the same change. Static pages and redirect-only routes do not require skeletons.
新建或修改有异步数据、懒加载内容的页面时，阅读[骨架屏约定](src/components/skeletons/README.md)，在同一次修改中实现首次加载状态。纯静态页面和仅重定向的路由不强制提供骨架屏。

- Put page skeletons in `src/components/skeletons/pages/` and component skeletons in `src/components/skeletons/components/`. Keep the base `Skeleton` in `src/components/ui/skeleton.tsx`.
  页面级骨架放在 `src/components/skeletons/pages/`，组件级放在 `src/components/skeletons/components/`，基础 `Skeleton` 保留在 `src/components/ui/skeleton.tsx`。
- Page skeletons may compose component skeletons, base `Skeleton` elements, or both. Match the real content's geometry and responsive layout.
  页面级骨架可以组合组件级骨架，也可以直接拼装基础 `Skeleton`，或混合使用；尺寸和响应式布局应贴合真实内容。
- Connect route loading through `pendingComponent`, component data loading through the initial pending state, and lazy content through `Suspense` fallback. A skeleton must be used by its loading boundary, not merely exported.
  路由加载使用 `pendingComponent`，组件数据使用首次 pending 状态，懒加载使用 `Suspense` fallback。骨架必须接入实际加载边界，不能只创建导出。
- Preserve mounted shared layouts, Sidebar, tabs, known headings, and cached content. Background refetches keep existing content; loading placeholders replace only unavailable content. Keep action progress indicators for submitting, deleting, signing in, and generating responses.
  保留已挂载的共享布局、Sidebar、tabs、已知标题和缓存内容；后台刷新继续展示已有内容，骨架只替代尚不可用的内容。提交、删除、登录和生成回答等操作保留进度提示。
- Skeletons are presentation components: no requests, auth logic, mutations, or imports from the feature being loaded. Use an accessible loading label and `aria-busy` for a loading region; hide decorative shapes from assistive technology.
  骨架只负责展示，不发请求、不处理认证或修改操作，也不导入正在加载的业务组件。加载区域提供可访问的加载标签与 `aria-busy`，装饰图形对辅助技术隐藏。

# Long-form text fields / 长文本表单

Use `src/components/ui/markdown-editor.tsx` for editable long-form fields such as job requirements. Store their values as Markdown strings.
岗位要求等可编辑的长文本字段使用 `src/components/ui/markdown-editor.tsx`，以 Markdown 字符串保存。
