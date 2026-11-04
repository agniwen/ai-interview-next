# Agent UI

基于 [shadcn AI Elements](https://ui.shadcn.com/docs/ai-elements) 的 Base UI 模式，复用项目的 coss 组件、颜色变量和 Tabler 图标。这里仅包含展示与输入组件，不依赖 AI SDK、pi 或服务端存储。

## 组件

| 位置                         | 用途                                         |
| ---------------------------- | -------------------------------------------- |
| `../ui/message.tsx`          | 消息、头像、标题和操作区布局                 |
| `../ui/message-scroller.tsx` | 流式滚动、消息定位和回到底部                 |
| `../ui/trace.tsx`            | 工具、步骤和子任务的可折叠执行轨迹           |
| `../ui/code-block.tsx`       | 代码、工具输出、行号与复制                   |
| `message-response.tsx`       | Streamdown 流式 Markdown、GFM 表格和代码展示 |
| `reasoning.tsx`              | 推理过程折叠、运行状态和耗时                 |
| `tool.tsx`                   | 等待、执行、完成、失败四种工具状态           |
| `prompt-input.tsx`           | 复用 coss Composer 的受控输入、发送和停止    |

基础组件通过 shadcn CLI 从 `base-nova` registry 引入，保留本地 Button 和 Collapsible。新增依赖为 `@shadcn/react`（消息滚动）和 `shiki`（按语言懒加载的代码高亮）。不要用上游 CLI 覆盖本地 coss 基础组件。

## 组合

```tsx
<MessageScrollerProvider>
  <MessageScroller>
    <MessageScrollerViewport aria-label={conversationLabel}>
      <MessageScrollerContent>
        {messages.map((message) => (
          <MessageScrollerItem key={message.id} messageId={message.id}>
            <Message align={message.role === "user" ? "end" : "start"}>
              <MessageContent>
                <MessageResponse>{message.text}</MessageResponse>
              </MessageContent>
            </Message>
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <MessageScrollerButton label={jumpToLatestLabel} />
  </MessageScroller>
</MessageScrollerProvider>
```

滚动区域的父容器需要确定高度并设置 `min-h-0`。`MessageScrollerProvider` 按会话 ID 设置 `key`，避免切换会话后复用原来的滚动状态。滚动区域只处理展示，加载历史与切换订阅由会话层完成。

`PromptInput` 的 `value` 是项目现有 `ComposerValue`，使用 `getComposerText(value)` 取得纯文本。调用方在提交被接受后清空草稿；组件不会自行清空，也不会在请求失败时丢掉草稿。`running` 时只显示停止按钮，桌面端 Enter 仍可发送并排队。

所有按钮标签、状态文案和占位文字由调用方传入 Paraglide 翻译。`CodeBlockCopyButton` 需要 `copyLabel`、`copiedLabel` 和 `onCopyError`；错误反馈使用现有 toast。`useHighlightedCode(value, language)` 的返回值可以逐行交给 `CodeBlockLine`，未知语言使用纯文本。

## pi-durable 接入边界

- 将 `watch()` 的历史 entries 和 `pi.live` 转为消息与 Tool props；完成后的消息沿用稳定 ID。
- 将 `pi.inbox` 转为产品的排队输入视图，不在输入组件中再维护一份运行队列。
- `onSubmit` 调用后端 `submit()`，`onStop` 明确调用 `abort()`；组件卸载不表示停止任务。
- 工具审批、历史分支、会话列表与子任务订阅属于后续接入；本次没有模拟这些后端能力。

Agent 页面通过独立的运行时 API 和 SSE 快照驱动这些组件。

## Prompt Bar 适配

`prompt-input.tsx` 参考 [Beautiful UI Prompt Bar](https://www.beautifului.dev/#prompt-bar)（[MIT](https://www.beautifului.dev/license)，Copyright © 2026 Shane Levine）的紧凑网格、展开布局与小圆角按钮。使用本地 `Composer`、`ComposerInput`、`Button` 和 `ScrollArea`，不引入上游全局 token 或 glimm。短输入单行展示，长输入展开并在 100px 内滚动；产品队列保留在输入区域上方，发送结果由调用方确认后清空草稿。

输入区使用专属轻边框与聚焦样式，保留移动端 16px 输入字号和中文输入法的提交保护。附件、模型选择及语音按钮在首版尚无功能实现，因此不显示示例控件。

## Streamdown

正文和推理内容通过 Streamdown 渲染。实时片段使用 streaming 模式与 isAnimating，历史消息使用 static 模式；插件和自定义组件在模块级声明，保留块级缓存。CJK 插件处理中文标点附近的强调语法，Code 插件按需加载高亮语言。默认 GFM 与安全处理保持启用，不替换 remark/rehype 插件链。

Responses and reasoning use Streamdown. Live fragments use streaming mode and isAnimating; history uses static mode. Module-level plugins and components preserve block memoization. CJK handles emphasis near Chinese punctuation, and Code loads highlighting languages on demand. Default GFM and security processing remain enabled without replacing the remark/rehype chain.
