# Agent 页面与运行架构

本文记录首版实现的产品行为、运行边界和接入方式。

## 已确认

- 聊天会话按工作区和创建者隔离，仅创建者可以查看和操作，见 [会话权限决策](../adr/0003-private-workspace-chat-sessions.md)。
- 点击“新建聊天”进入空白聊天页，不立即创建持久化会话；首次发送消息时创建会话并加入侧栏列表，避免积累空会话。
- 会话首次发送后，先用首条消息摘要作为临时标题，再由模型生成简短标题；允许用户手动重命名，手动修改后不再自动覆盖。
- 侧栏会话按最近一次用户发送消息的时间倒序排列；接收流式输出、拖动队列和修改标题不改变列表顺序，避免多个会话运行时列表不断跳动。
- 会话中的“删除”为移入回收站：停止该会话全部任务，暂停并保留待处理队列，保留历史；不执行永久删除。
- 回收站支持恢复会话：恢复到会话列表并保留历史与队列，任务不自动恢复。
- 仅回收站中的“永久删除”清除会话、历史和待处理队列，操作前二次确认。回收站按工作区和创建者隔离，仍仅本人可见；第一版不自动清理。
- 产品与代码将回收站状态称为“移入回收站”与 `trashed`，不与“归档”混用。
- 切换聊天、离开 Agent 页面、关闭浏览器或断开连接，不主动停止服务端任务；重新进入后恢复已保存的历史与当前执行状态。用户通过明确的“停止”操作中止任务，页面连接的生命周期不决定任务的生命周期。
- Agent 运行中发送的新消息默认排队追加；Composer 内展示待处理消息队列，并提供手动“插队”操作。
- Composer 内的待处理消息支持拖动排序，调整本轮结束后的处理顺序；拖动不触发插队，参与当前任务仍通过明确的“插队”操作触发。
- 待处理消息支持编辑和移除：编辑保存后保留原队列位置，移除仅取消该条待处理消息；已经开始处理的消息不再允许直接编辑或移除。
- 手动插队将选中的待处理消息转为当前任务的补充指令，在下一次可接收输入时生效，不强行取消正在执行的工具；该消息不再作为普通排队消息于本轮结束后重复处理。插队不是单纯移到队首。
- 点击“停止”中止当前任务并暂停队列，保留待处理消息；用户明确点击“继续”后才处理队列。停止需要落实到服务端执行，不能只断开前端连接或隐藏输出。
- 停止范围包含本会话的当前任务及其后台子任务，其他聊天不受影响；前端不能在相关工作尚未确认结束时显示“已停止”。
- 侧栏通过 Magic Portal 展示 Agent 页的新建聊天入口和会话列表。
- 内容区复用已有 messages 与 composer 组件，滚动区域使用 ScrollArea，视觉延续现有 coss 风格。
- Agent 使用 pi-durable，保留未来自主部署与选择存储后端的能力，见 [运行宿主决策](../adr/0002-portable-agent-runtime.md)。
- 首版实现文本聊天、流式回答、会话恢复、队列与停止；暂不接业务工具、文件附件和子 Agent。运行层保留后续接入边界，已确认的子任务停止规则在后续引入子任务时同样适用。
- 首版由服务端统一配置一个模型，用户无需填写 API Key，页面暂不提供模型切换；服务商、模型 ID 与密钥由服务端配置管理，密钥不下发浏览器。
- 模型通过阿里云 DashScope 的 OpenAI 兼容接口调用；服务端配置为 `AGENT_CHAT_MODEL=deepseek-v4.1-flash`、`AGENT_CHAT_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1`，密钥使用 `AGENT_CHAT_KEY`。保留用户指定地址，联调时验证账户权限及端点可用性，不自动替换模型或地址。

## 实现位置

- `packages/agent`：前后端共享的命令、状态和消息 schema，入口只验证一次。
- `apps/api/src/modules/agent/runtime.ts`：平台无关的 pi-durable 调度、队列、停止与标题逻辑。
- `apps/api/src/modules/agent/cloudflare.ts`：每聊天一个 Durable Object，隔离 SQLite、alarm 和后台工作生命周期。
- `apps/api/src/lib/redis`：Redis 风格的会话目录接口及 Cloudflare 实现。
- `apps/api/src/middleware`：外层统一 CSRF、登录校验，工作区路由校验成员关系；目录和聊天对象均按工作区与创建者隔离。
- `apps/web/src/components/agent`：聊天、队列和个人中心回收站；`lib/agent` 处理请求和 SSE。
- 回收站入口在个人中心，路径为 `/w/$workspaceId/account/trash`，聊天侧栏仅显示正常会话。

本地在 `apps/api/.env` 配置 `AGENT_CHAT_KEY`，模型和地址使用 Wrangler vars。运行项目已有开发命令，API 和 Web 必须使用相同的开发服务注册目录。部署使用既有脚本，DO 的 SQLite 类迁移已写入 Wrangler 配置。

已通过本地真实 DashScope 调用；SQLite 重开测试验证暂停、历史和队列持久化。后续自部署仍需补齐 HTTP 宿主、调度器与目标存储适配，当前不包含独立的自部署服务入口。

## 接入参考

- [pi-durable 官方文档](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md)
- [Cloudflare 与 React 官方示例](https://github.com/earendil-works/pi-durable-cloudflare)
- [阿里云 DeepSeek API](https://help.aliyun.com/zh/model-studio/deepseek-api)：官方文档列有所选模型；当前服务接入章节使用带业务空间 ID 的地域地址，用户指定的 DashScope 地址已通过本地真实调用验证。

参考示例的连接、事件状态与展示分层；最终协议和组件组合需适配本项目的鉴权、工作区边界与既有组件。

### 停止与恢复

pi-durable 的 `conversation.abort(context)` 会撤回排队输入，并等待当前工作停止、会话空闲；普通停止不包含以 `background: true` 为边界的后台任务，包含后台任务需要显式选项。产品要求保留并暂停队列，因此不能直接把内置 abort 的队列结果当作产品队列；产品队列持久化在独立 pi 文档中，停止先保存暂停意图，再取消运行与后台工作；尚未进入上下文的插队消息通过提交回执恢复到队首。停止期间不派发下一条，刷新后保留队列。

停止范围已确认包括本会话的后台子任务，需要使用包含后台工作的取消能力。采用“运行中 → 停止中 → 已停止”的状态表达，服务端确认相关工作结束后才展示“已停止”。模型请求、工具和子任务须传递取消上下文；外部服务或隔离进程需要各自的取消能力。已经完成的外部副作用不会因取消自动回滚，也不能把关闭网络连接等同于供应商停止执行。无法确认取消完成时，需要如实展示状态，不能承诺已彻底终止。

参考：[Abort and Subagents](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md#abort-and-subagents)。
