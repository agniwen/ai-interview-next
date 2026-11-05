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
