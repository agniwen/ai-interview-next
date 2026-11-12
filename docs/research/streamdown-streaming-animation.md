# Streamdown 2.7.1 跨段流式动画

## 原生动画的边界

官方用法是导入 `streamdown/styles.css`，将一条回复不断追加的 Markdown 作为同一个 `Streamdown` 实例的 children，并随流状态设置 `isAnimating`。默认效果为 `fadeIn`，时长 150ms，分段选项为 `sep: "word"`。正文和行内代码参与动画，围栏代码、SVG 和数学内容跳过逐词动画。 [Animation](https://streamdown.ai/docs/animation) · [Usage](https://streamdown.ai/docs/usage)

2.6.0 起，同一实例的 Markdown 块共用一个以实际时间为基准的调度器。2.7.1 的默认 `stagger` 为 40ms，按相邻单元的**开始时间**推进，因此 150ms 的淡入可以重叠，新一轮渲染也可以压缩积压时间。默认 `maxBacklogMs` 为 320ms，是排队时间的软上限。由此推断，短时间内到达多段时，仍可能看到后一段开始淡入时前一段还在淡入。若产品需要“前段完全显示后再显示后段”，这超出原生逐词动画的语义。 [2.6.0 发布记录](https://github.com/vercel/streamdown/releases/tag/streamdown%402.6.0) · [2.7.1 npm 发布包](https://www.npmjs.com/package/streamdown/v/2.7.1)

用本地安装的 2.7.1 对两段中文做 SSR，第一段四字的 CSS 动画延迟约为 0、40、80、120ms，第二段约为 158、198、238、278ms。按默认 150ms 时长，第一段最后一字约在 270ms 淡入完毕。换成两个实例时，每个实例都从 0ms 左右开始。此检查验证了生成的动画延迟，浏览器中的实际画面仍需复现。

## 社区报告

- [#482](https://github.com/vercel/streamdown/issues/482) 直接报告了列表还在动画时，下一个段落或标题已经开始淡入。2.6.0 将该问题标为修复。同期关闭的 [#535](https://github.com/vercel/streamdown/issues/535) 报告的是链接中词间空白的下划线提前出现，同一修复把尾随空白移入动画 span。 [2.6.0 发布记录](https://github.com/vercel/streamdown/releases/tag/streamdown%402.6.0)
- [#669](https://github.com/vercel/streamdown/issues/669) 报告了中文段落只对首批文字做动画，以及流结束时积压文字突然出现。2.7.1 修复了前者，默认的 `word` 模式已能对 CJK 文字逐字切分。后者仍可发生，`isAnimating` 变为 `false` 时动画包装会被移除。[待合并的 #678](https://github.com/vercel/streamdown/pull/678) 提议保留动画至最后一个单元结束。[2.7.1 发布记录](https://github.com/vercel/streamdown/releases/tag/streamdown%402.7.1)
- [#473](https://github.com/vercel/streamdown/issues/473) 报告围栏代码缺少和正文一致的逐步显示。[#619](https://github.com/vercel/streamdown/pull/619) 提议覆盖正文和代码的动画，此改动未包含在 2.7.1 中。

## 本仓库 Agent 的原有接入

Web 声明 `streamdown: ^2.7.1`，全局样式已导入动画 CSS。后端 `messageView` 合并同一条消息的文本片段，Agent 正文作为一个字符串传给一个 `MessageResponse`。正文中的段落已经共用同一条 Streamdown 时间线。每条消息以及推理区和正文各有独立实例，正文出现时推理区会退出流式状态。 [依赖声明](../../apps/web/package.json) · [全局样式](../../apps/web/src/styles.css) · [Agent runtime](../../apps/api/src/modules/agent/runtime.ts) · [Agent transcript](../../apps/web/src/components/features/agent/transcript.tsx)

`MessageResponse` 使用默认动画配置，随 `streaming` 同时切换 `mode` 和 `isAnimating`。现有测试检查静态与流式的渲染结果，未验证浏览器中的动画时序。若复现发生在持续输出时，可比较同一实例中各段的动画开始时间和重叠程度。若出现在结束时，需同时观察最后一批文本和 `streaming` 变为 `false` 的时间。以上判断来自源码和上游记录，尚未在 Agent 页面复现。 [MessageResponse](../../apps/web/src/components/ai-elements/message-response.tsx) · [渲染测试](../../apps/web/src/components/ai-elements/message-response.test.tsx)
