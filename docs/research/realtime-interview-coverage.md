# Realtime 面试题目覆盖与采集证据：旧实现对照与建议方案

状态：**研究完成，方案建议，尚未实施**。核查日期：2026-11-08。本文只讨论本次 realtime 实现，以及未来兼容 LLM/STT/TTS 的业务边界；不设计运行中切换、自动降级或双模式实现。供应商未定，以下插件对照仅说明能力差异，不构成选型。

## 结论与保证边界

“问过所有题”和“每个采集点有证据”应由业务状态决定，不能由提示词、模型调用了结束工具、AgentTask 已完成或聊天记录长度替代。LiveKit 提供任务、结构化工具、会话状态与播放事件，业务仍需定义题目覆盖和证据充分的含义。这是基于下文源码与文档的设计推论，并非官方提供了面试覆盖保证。

应分开记录三件事：题目已安排、提问内容已播放、回答已有可追溯证据。生成结束不等于音频播放结束；播放结束也只表示媒体输出侧完成，不证明候选人实际听见或理解。模型填入结构化字段不等于内容有依据。候选人拒答、明确不知道或时间耗尽应形成明确结果，不能伪装成“已采集到能力证据”。

官方 [workflows](https://docs.livekit.io/agents/logic/workflows/) 推荐工具、任务和有序任务组来表达流程；[tasks](https://docs.livekit.io/agents/logic/tasks/) 支持完成返回值，但没有面试业务完整性校验。官方 [survey 示例（1.8.10）](https://github.com/livekit/agents/blob/livekit-agents%401.8.10/examples/survey/agent.py) 已有行为面试采集：逐项工具保存 strengths / weaknesses / work_style，字段齐全后才 `complete()`。该示例证明可实现结构化流程，不证明模型总结忠实，也不是所有 realtime 插件的兼容性认证。

## 核查环境与来源方法

- 仓库声明：`apps/voice-agent/pyproject.toml:10` 为 `livekit-agents~=1.8.10`。本地 `.venv` 的 `livekit_agents-1.8.10.dist-info/METADATA` 确认安装版本 1.8.10；并非仅依据约束猜版本。
- 本地 [agent.py](/Users/wen/dev/github/ai-interview-next/apps/voice-agent/src/agent.py:35) 仍配置 inference LLM/STT/TTS；本次目标是 realtime，不能将目标描述为已经接入。本文不改运行代码。
- 本地 plugins 目录只有 `ai_coustics`；未安装的 Google/OpenAI 插件不能声称已在此环境运行验证。额外查看的是官方 **1.8.10 tag** 源码。
- 已执行根目录 Intent list，公开列出的技能均属 TanStack，没有与 Python realtime 研究匹配的技能，未加载无关技能。已读取 `.agents/skills/reading-livekit-docs/SKILL.md`。
- Docs MCP 未使用；按 `lk docs --help` 使用 search、get-page、code-search、changelog。CLI 提示 docs server 1.5.0 / CLI 1.4.x 的文档协议版本差异，查询成功；它们不是 Agents SDK 版本。
- 官方 issues 与 PR 的日期、状态、评论通过 GitHub API 实时核对。下文“已修复”区分维护者判断、PR 合并、已发布和本地代码，不以 closed 自动推断修复。
- 本次没有运行真实模型、会议或付费验证，没有发外部消息。只补充本研究文档；此前的应用改动保持不动。

## AgentTask、TaskGroup、userdata 与结构化工具

| 机制                                                 | 官方支持                                                                                                         | 面试中的适用边界                                                                       |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `AgentTask[T]`                                       | 可等待的会话任务，`complete(result)` 返回结果并交回控制；可从工具或 agent 的 on_enter/on_exit 等受支持上下文等待 | 可表示一道题或一个采集主题；`complete()` 只是程序设置 Future，不自动检查证据或播放状态 |
| `TaskGroup`                                          | 有序任务、回访前序任务、共享 chat context；默认总结上下文                                                        | 可表达访谈流程，但总结不是原始证据；逐题 task 会增加上下文切换，需先核对目标插件       |
| `AgentSession(userdata=...)` / `RunContext.userdata` | 同一 session 的共享应用数据                                                                                      | 可引用业务进度和证据账本；userdata 是内存对象，不是数据库或跨重连持久化保证            |
| `@function_tool` / typed arguments                   | 根据类型和描述形成工具 schema，工具执行应用逻辑                                                                  | 在工具入口验证 questionId、采集点、证据引用；schema 限定形式，不验证事实真伪           |
| `chat_ctx`                                           | 默认新 agent/task 使用新上下文；需要显式传入历史                                                                 | 共享 userdata 不意味着自动共享所有对话；模型上下文和业务事实必须分开                   |

来源：[Tasks](https://docs.livekit.io/agents/logic/tasks/)、[Agents and handoffs](https://docs.livekit.io/agents/logic/agents-handoffs/)、[Function tools](https://docs.livekit.io/agents/logic/tools/definition/)。

本地源码（以下统一相对 `apps/voice-agent/.venv/lib/python3.14/site-packages/livekit/agents/`）：

- `voice/agent.py:878`：`AgentTask` 构造支持 `llm.LLM | llm.RealtimeModel`；`:939` 是 `complete()`；`:962` 起执行上下文限制；`:1017` 附近明确警告：若 realtime 不支持 `manual_function_calls`，在 function tool 内等待 AgentTask 可能出现非预期行为。构造函数接受 realtime 不代表每种嵌套工作流都可用。
- `beta/workflows/task_group.py:46`：TaskGroup；`:56` 起说明顺序、回访和默认 `summarize_chat_ctx=True`。仍位于 beta。
- `voice/agent_session.py:793`：userdata；`voice/events.py:95`：工具取得 session.userdata。
- `voice/agent.py:888`：`preserve_function_call_history=False` 默认值；是否保留工具历史应明确决定，不把“所有上下文都会原样继承”当契约。

建议先采用一个持续掌控会话的 interviewer，加稳定的结构化采集工具和显式题目进度；只在确有提示词复杂度或可复用采集流程时引入 task。若选定插件支持所需能力，可将同一业务步骤封装成 AgentTask；不要先把“每题必须 handoff”作为架构前提。

## 音频、转写、回合与播放：不同事件代表什么

[Realtime overview](https://docs.livekit.io/agents/models/realtime/) 说明模型直接接收语音；转写可能明显延迟，甚至晚于助手回复。文档概括 realtime 缺少 interim 转写，但 SDK 事件有 `is_final`，不能把概括解释为所有未来供应商永远不支持 interim。

| 信号                                 | 能确认的事实                                             | 不应据此确认的事实                                                         |
| ------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| 输入音频 / 服务端 speech start、stop | 音频进入 realtime，供应商检测到说话边界                  | 回答文本已经完整，或采集点已经有证据                                       |
| `user_input_transcribed`             | 一次转写更新，检查 `is_final` 和可用的 item_id           | 回调顺序就是说话顺序；非 final 内容可立即当最终证据                        |
| `conversation_item_added`            | 消息提交到 session 历史，含 role、id、interrupted 等信息 | 每个消息都代表一道新题；该事件是生成前控制钩子；收到最后消息表示会话应结束 |
| `on_user_turn_completed`             | agent 控制的用户回合结束、回复前修改上下文的钩子         | 服务端自动 realtime 回合中一定会先调用它                                   |
| `SpeechHandle.wait_for_playout()`    | 整个 assistant turn 的播放和相关工具后续完成             | 此轮没被打断，或完整题干确实被讲出                                         |
| `RunContext.wait_for_playout()`      | 当前工具之前、相应步骤的讲话播放结束                     | 等待该工具自身及整轮所有后续完成                                           |

来源：[Nodes](https://docs.livekit.io/agents/logic/nodes/)、[Events](https://docs.livekit.io/reference/agents/events/)、[Speech and audio](https://docs.livekit.io/agents/multimodality/audio/)、[Turns](https://docs.livekit.io/agents/logic/turns/)。

本地核对：

- `llm/realtime.py:176` 的 `InputTranscriptionCompleted` 包含 item_id、is_final、confidence、可选 turn_started_at；`:184` 说明延迟转写的时间定位用途。
- `voice/agent_activity.py:2297`：转写事件先发布，final 才生成 user ChatMessage；有 turn_started_at 时回填 created_at。**不能用接收回调时的 currentQuestionId 给所有迟到消息归属题目**；应关联稳定消息 ID、输入回合和时间范围，无法确定时保留待关联。
- `voice/agent_activity.py:2330` 起：模型生成事件直接进入 realtime generation 路径。`:2892` 的 on_user_turn_completed 是另一路 agent 回合处理。官方明确：realtime 使用该钩子，必须把 turn detection 放到 agent 侧；这是 turn-taking 配置变化，不是改为 pipeline，但仍受供应商能否关闭服务端检测等能力约束。
- `voice/agent_activity.py:4515` 起逐消息处理音频和播放；`:4716` 起跳过未播放消息，partial 标为 interrupted，只有支持 message_truncation 才调用提供商截断；`:4747` 提交助手消息。
- `voice/speech_handle.py:229` 与 `voice/events.py:110` 明确区分两种等待。不能在拥有该 SpeechHandle 的工具里等待整个 SpeechHandle，自等待会被 SDK 拒绝；工具内用 RunContext 对应步骤等待。

因此，“已提问”至少需要题目与实际助手消息绑定、题意确实表达、相关播放完成并检查打断状态。若问题关键部分未说完，保持未完成或待补问；仅有 `generate_reply()` 返回值或 tool 执行成功不够。即使无打断，realtime 生成仍可能改写/遗漏问题；按意图生成语音不提供逐字脚本保证。大多数 realtime 模型 `session.say(text)` 另需 TTS，不能为精确读题悄悄引入本次未授权的 TTS 路径。

## 工具控制与结束判定

1.8.10 的 `llm/realtime.py:59` 定义能力：`message_truncation`、`manual_function_calls`、`auto_tool_reply_generation`、`mutable_chat_context`、`mutable_tools`、`per_response_tool_choice` 等。`voice/agent_activity.py:4257` 在支持时按响应传工具，不支持时尝试 session 级更新并恢复。这层统一接口不补齐供应商本身缺失的语义。

- OpenAI 协议引擎本地 `llm/_realtime/openai.py:506` 起声明 manual_function_calls、mutable_tools、per_response_tool_choice 为 true；[官方插件 1.8.10](https://github.com/livekit/agents/blob/livekit-agents%401.8.10/livekit-plugins/livekit-plugins-openai/livekit/plugins/openai/realtime/realtime_model.py) 复用该引擎。这里只确认接口能力，未运行服务验证模型遵循度。
- [Google 插件 1.8.10](https://github.com/livekit/agents/blob/livekit-agents%401.8.10/livekit-plugins/livekit-plugins-google/livekit/plugins/google/realtime/realtime_api.py#L347) 上述三个能力为 false，auto_tool_reply_generation 为 true。`:637` 起 `tool_choice='none'` 用拒绝模型工具调用来模拟；required/指定工具等不支持时回到 auto。`:1547` 起拒绝循环还有次数限制。这不是供应商原生“绝不会生成工具调用”的承诺。
- 不把普通 `inference.LLM.chat(parallel_tool_calls=False)` 外推到 realtime：本地 realtime 基类和所查引擎没有对应统一选项。一次回复可能包含多个工具调用；工具调用完成、题目完成、handoff 不是一个原子操作。
- [Events 文档](https://docs.livekit.io/reference/agents/events/#function_tools_executed) 对 `reply_required=False` 列出供应商限制：Gemini 需 NON_BLOCKING 且 Vertex 不支持相关 scheduling，Nova Sonic 不支持抑制回复。这个最新文档说明设计边界，**未逐项验证所有插件的 1.8.10 实现**。

业务结束应是显式决策：必问题均有提问记录、各必需采集点有证据或约定的未取得结果、没有待关联转写/未完成采集，才允许标为正常完成。模型提出结束只是请求。候选人主动结束或时间耗尽可结束会话，但应记录对应终止原因和缺项，而不是伪造全部覆盖。告别语的播放完成与业务完成分开；不能要求“结束工具返回后一定恰好讲一句告别”而不检查供应商能力。这些是设计建议，未新增应用校验或实现。

## 官方 issues：报告、维护结论与修复状态

Python 插件位于 `livekit/agents` 同一 monorepo 的 `livekit-plugins/`，不将 agents-js 的问题当作 Python 证据。状态均为 2026-11-08 查询结果。

| 报告                                                                                        | 日期、版本、状态                                                                     | 已核实结论与适用边界                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#6002 Gemini 工具控制](https://github.com/livekit/agents/issues/6002)                      | 2026-06-08；agents 1.5.17，gemini-live-2.5-flash-native-audio；06-22 closed          | longcw 指出默认 blocking 调用等待结果；[PR #6166](https://github.com/livekit/agents/pull/6166) 06-22 合并，以错误工具结果拒绝调用，解除挂起。1.8.10 tag 已有实现；修的是处理路径，不是让 Gemini 获得原生 per-response tool_choice。                                                                                                      |
| [#6479 重启时工具结果丢失](https://github.com/livekit/agents/issues/6479)                   | 2026-07-18；agents/google 1.6.5；09-09 closed                                        | longcw 明确称 fixed in [#6000](https://github.com/livekit/agents/pull/6000)，该 PR 09-09 合并：恢复 session 时按 snapshot 发上下文 diff，离线更新排队，包含工具结果。目标是该重启窗口，不证明所有 handoff/reconnect 都不会丢上下文。插件未本地安装，未做实际会话复现。                                                                   |
| [#4792 handoff 后转写顺序改变](https://github.com/livekit/agents/issues/4792)               | 2026-02-11；agents 1.3.12、livekit 1.0.23，Gemini native-audio preview；08-12 closed | 无评论中的维护者修复结论；相关 [#4927](https://github.com/livekit/agents/pull/4927) 已 closed 但未合并。不能据关闭状态称已修。当前本地 InputTranscriptionCompleted 有 turn_started_at，merge 仍使用 created_at 排序（chat_context.py:738,767）；是否解决原报告取决于插件提供的时间，未复现。                                             |
| [#7324 复制上下文丢无 name 工具结果](https://github.com/livekit/agents/issues/7324)         | 2026-09-17；agents 1.8.2；09-18 closed                                               | longcw 指向已合并 [#7330](https://github.com/livekit/agents/pull/7330)。本地 chat_context.py:640–676 已按 call_id 关联无 name 输出，源码确认包含修复。PR 还纠正报告者对实际 OpenAI realtime 进入路径的推断，不能全盘照搬 issue 根因叙述。                                                                                                |
| [#8307 AgentTask 完成调用与并行调用丢上下文](https://github.com/livekit/agents/issues/8307) | 2026-11-01；agents 1.8.10，TaskGroup，Gemini 3.1 flash-lite 经 openai.LLM；open      | 无维护者结论、未确认修复。报告者称 completing call 在批次落历史前被 task 恢复/复制遗漏，preserve_function_call_history 也未避免。**这是普通 LLM 路径，不是 Gemini Live realtime 复现**；仅支持检查共用任务/工具顺序，不能宣称 realtime 必现。                                                                                            |
| [#8279 on_enter 后结束工具持续隐藏](https://github.com/livekit/agents/issues/8279)          | 2026-10-30；明确 1.8.10，另报 1.6.6/1.6.10/1.7.1；11-03 closed                       | [#8280](https://github.com/livekit/agents/pull/8280) 11-03 已合并，清理长生命周期任务继承的 on_enter ContextVar；列入 [1.8.11 release](https://github.com/livekit/agents/releases/tag/livekit-agents%401.8.11)。本地 1.8.10 agent_activity.py:1221 未包含该清理包装，不能视为已修。只影响相关标记和任务/切回路径，不是所有结束工具失效。 |

补充：[#6569](https://github.com/livekit/agents/issues/6569)（2026-07-27，08-14 closed）报告 Gemini 工具出现在音频中途导致提前视为播放完成、音频截断和会话等待。后续复现评论给出 agents/google 1.6.7 与 1.6.9。longcw 曾要求完整复现并推测 [#6600](https://github.com/livekit/agents/pull/6600) 应处理其中工具被打断的问题；本次未核实该报告所有现象对应的最终修复，因此只作为“生成完成与播放完成必须区分”的历史案例，不作为当前版本有相同故障的断言。

## 旧项目实际如何做

核查 `/Users/wen/dev/github/ai-interview` 的 HEAD `f6c1378e2`。默认模式是 realtime；环境变量可以选择 pipeline，入口构造的是两个不同 Agent。它们共用题目结果 DTO 和上报机制，但没有共享完整的题目控制器，也不是同一通话中自动切换。来源：[agent_config.py](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/agent_config.py:7)、[Agent 入口](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/agent.py:899)。

### Pipeline：程序逐题推进，模型提交决策

1. `ReadyCheckTask → InterviewQuestionTaskGroup → WrapUpTask`。每个题目有独立 AgentTask，问题阶段不暴露挂断工具；TaskGroup 关闭默认摘要，保留对话以支持候选人主动补充先前题目。来源：[InterviewAgent.on_enter](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/interview_agent.py:395)、[build_question_task_group](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/interview_question_task.py:1058)。
2. 每题进入时由 `session.say(question.content, allow_interruptions=False)` 读题并等待播放；在该阶段拒绝题目决策，减少上一题尾音被当成下一题回答的机会。这比“设置了 currentQuestion 就算问过”更接近实际提问，但仍不证明人已听到。来源：[QuestionTask.on_enter](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/interview_question_task.py:554)。
3. 普通 LLM 只能输出 `submit_question_decision`，过滤自由文本；决策包含已答、追问、澄清、等待、跳过、补充等。提问措辞和推进动作主要由应用控制。来源：[llm_node](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/interview_question_task.py:610)。
4. `all_required` 有结构化 facet ID，帮助生成缺项追问；但 `action=answered` 分支直接调用 `record_answered()`，没有逐个检查必需 facet 是否都有证据。顺序受到控制，语义完成仍依赖模型。来源：[submit_question_decision](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/interview_question_task.py:796)、[record_answered](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/interview_question_task.py:313)。

不直接移植这一语音控制层：`llm_node` 过滤输出、具名工具强制选择、`say()` 精确脚本是该 pipeline 的实现条件，不能假设 realtime 也有相同接口行为。

### Realtime：自然对话、采集清单和异步转写核对

- **题目清单**：模型自行安排话题，可一段回答覆盖多题。`set_active_topics` 或 `record_answers.next_question_ids` 表示准备进入的话题；`_activate` 立即写入 `_started`。这只记录提问意图，尚未绑定真正播放过的助手消息。来源：[set_active_topics](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:705)。
- **采集进度**：`record_answers` 保存摘要、状态、covered_topics。`all_required` 的必需标签未齐时，程序把 answered 改回 in_progress，并在回执返回 missing_topics；标签含“标记、评价、判断、评估”的项被当作评价项排除。标签是否得到事实支持仍由模型判断。来源：[_missing_topics](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:229)、[_record_updates](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:768)。
- **转写补漏**：`conversation_item_added` 把真实消息 ID、角色和时间交给 Agent，触发后台核对。另一个普通文本 LLM 重读整段转写，抽取每题摘要、覆盖标签、候选人引文，也推断问过但没答的题。代码确认引文确实是对应 user turn 的子串，排除引用面试官或不存在的文本。来源：[消息订阅](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/agent.py:794)、[extract_answers](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/answer_reconciliation.py:31)、[reconcile_answers](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:361)。
- **纠正和记忆**：答案有 revision，未变化不重复写；新结果同步回模型 instructions。核对不阻塞日常保存，读状态最多等 3 秒，结束最多等 8 秒。这是流畅度取舍，超时并不表示证据核对成功。来源：[等待逻辑](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:607)、[record_answers](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:728)。
- **结束**：`finish_interview(completed)` 检查是否仍有未记录或 in_progress 的题；候选人要求结束、系统时间耗尽允许部分结束。skipped 和 insufficient 已是终态，所以全部拒答也可能成为“所有条目已处理”。来源：[_state](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:668)、[finish_interview](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:884)。

### 旧方案的保证边界

| 希望保证的事       | 旧实现能支持的判断                                     | 仍然缺少的证据或约束                                                                              |
| ------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 所有问题都问过     | pipeline 的任务顺序；realtime 的 active 标记与转写抽取 | realtime active 先于发声；没有每题播放记录；抽取 asked IDs 也没有逐项助手引文验证                 |
| 采集点全部收集     | realtime 对 all_required 比较 covered_topics 标签      | 标签仍由模型申报；没有每个 facet 对应的独立证据；pipeline answered 路径不强制检查缺项             |
| 摘要有来源         | 核对输出必须有真实候选人引文                           | 引文存在不证明整段摘要由它支持；核对会保留直接听音频的 voice 摘要并合并标签，不能称为独立语义复核 |
| 完成状态可信       | 未处理条目阻止正常 finish                              | “处理完”包括 skipped/insufficient；不要求所有条目证据已核对；音频结束和信息齐全是不同事实         |
| 结果可恢复、可审计 | 逐题 callback 保存摘要、状态、revision                 | 该 DTO 没有 covered_topics、证据引文、turn ID 或实际播放信息；它们在内存中存在不等于已持久化      |

逐题保存来源：[回调入口](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/agent.py:886)、[InterviewQuestionOutcome.to_payload](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/interview_question_task.py:71)、[服务端共享 schema](/Users/wen/dev/github/ai-interview/packages/shared/src/interview/question-outcomes.ts:22)。后端 `isInterviewQuestionSetComplete` 同样将 answered、insufficient、skipped 都视为已处理；它不表示全部答齐。

另一个容易误读的地方：旧代码注释说报告阶段会等待完整核对，但正常 `finish_interview` 已设置 `_closing=True`，而 `reconcile_answers` 在 closing 时立即返回。报告调用该函数并不能保证补上正常结束时仍未完成的核对。此判断来自 [finish](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:945)、[核对入口](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/realtime_interview_agent.py:361)、[报告入口](/Users/wen/dev/github/ai-interview/apps/livekit-agent/src/agent.py:568) 的执行条件；本次不修改旧项目。

## 本次建议：一个 realtime 面试官，共用业务进度与证据

采用持续的 `AgentSession + Agent + function_tool`，应用负责冻结计划、保存进度、计算缺项、接受结束请求。先不逐题 handoff，不搬运旧项目的私有 TaskGroup 字段访问，不创建双模式框架。原生 SDK 足够承载语音、工具和消息事件；它没有面试采集点的证据模型，因此需要补的是领域数据与完成规则，而非自建语音调度器。

### 1. 先确定采集契约

当前快照已有稳定的题目 ID、题干、评价重点和自由文本追问方向，但没有结构化采集点。不能把自由文本当成可靠、可计算的完整性规则。来源：[InterviewQuestions](/Users/wen/dev/github/ai-interview-next/packages/db/src/interview-questions.ts:20)、[ConversationQuestion](/Users/wen/dev/github/ai-interview-next/apps/voice-agent/src/interview_context.py:49)。

建议在题目设计或开始前准备阶段固定采集点：`pointId、label、kind、required`。kind 区分候选人能回答的事实和事后评价；不继续用中文关键词猜评价项。采集点若由模型生成，也只在准备阶段生成并冻结，不能由现场面试官一边答一边改完成标准。旧题没有结构化点时只能报告题级结果，不能展示“所有细项已覆盖”。

“每道题必须出声提问”和“信息已经主动讲到可不重问”是两个目标。建议保留两个独立事实：提问记录、采集结果。默认以信息采集为目标，主动回答可覆盖多个点；若明确要求某题必须询问，需在计划里声明，并在报告中单独检查它的提问记录。这是产品建议，不是从旧状态推断出的既有规则。

### 2. 记录实际提问和证据，状态不要混成一个 completed

| 数据       | 最小内容                                                        | 由谁确认                                  |
| ---------- | --------------------------------------------------------------- | ----------------------------------------- |
| 题目计划   | 快照题目 ID、采集点、必需属性                                   | 开始前冻结的业务数据                      |
| 提问记录   | questionId、助手消息 ID、提问文本、播放结果/打断状态            | realtime 消息与播放事件；语义关联仍需识别 |
| 采集证据   | questionId、pointId、候选人 turn ID、原文片段、摘要、来源、修订 | 模型提出关联；应用验证来源和引用，再保存  |
| 采集点结果 | 未取得、待核对、已有支持、拒答、不知道/记不清                   | 从记录计算或由带来源的明确结果更新        |
| 结束结果   | 结束原因、尚缺项、是否仍待核对                                  | 业务服务计算并持久化                      |

项目自有 JSON 顶层使用必填非 null `version`，数组放在对象字段里。复用本轮已冻结 snapshot 的题目 ID；不重新生成另一套题目身份。简历和预填表单可以作为对话依据，但必须保留来源，不能冒充本次候选人口头回答。初版不因此新增录音系统；现有能力没有音频归档时，只能提供文字原文可追溯性。

“已有支持”也只表示相关证据存在且模型判定足以回答采集目标，不证明履历事实真实。对于“是否用过某工具”，明确“没用过”可以完整回答该问题，但不能视为已经证明使用能力。

### 3. 日常对话保持流畅，证据核对异步进行

保留三个业务工具概念即可：

- `record_answers`：一次提交涉及的题目、采集点、摘要和候选人来源引用，允许跨题补充和更正；返回本次写入结果和相关缺项。
- `get_interview_state`：返回已确认信息、待核对项和未处理采集点，帮助模型继续追问，避免重复询问已经给出的事实。
- `finish_interview`：提出结束原因，业务层根据当前记录返回可结束或仍缺哪些项。

工具名仅是建议；不要求另做通用工作流平台。下一题可按冻结顺序从未处理项中建议，realtime 决定自然措辞。模型漏调采集工具时，未保存的项不能悄悄变成完成；在转写到达后的核对或结束检查中补齐。不要每个音频片段都跑全量历史分析。

转写未到时先保存“音频理解所得、待文字关联”的候选记录，不能虚构不存在的 turn ID。转写到达后关联稳定 item ID 和回合时间，不拿“当前题”强行归属；没有可靠来源则保持待核对。模型不能天然知道 SDK 内部 ID，适配层要把已到达转写与可引用 ID 暴露给模型，再接受引用。记录和下一段语音互不等待；严格的“采集完整”判定要等相关证据关联完成。

旧实现用额外文本 LLM 重读整份转写，其成本、延迟和上下文增长都应单独评估。**本次最小方案不默认增加第二个模型**：先使用 realtime 的结构化采集和已有转写做引用校验；必要的语义补录由同一 realtime 会话完成。若选定供应商无法稳定支持静默核对，或实际测试出现较多漏采，再单独决定是否引入异步提取器；这不属于语音 pipeline 切换，但也是额外模型依赖，不能默认为用户已选择。仅做字符串引用校验时，应明确不提供独立语义复核。

### 4. “结束通话”和“全部采集到”分开

- 只有所有必需采集点都有可追溯的充分回答、必问项有相应提问记录、且没有相关待核对项时，才标记采集完整。
- 拒答、不知道或合理追问后仍不足，可以让访谈流程结束，但保留各点的结果与缺项；不能把“流程已处理完”显示成“信息全齐”。
- 候选人主动结束始终可以结束，保存缺项即可；不要让证据核对阻止候选人离开。语音结束后仍有未核对信息时，其结果继续标为待核对，不预先宣布采集完整。
- 告别与关闭使用 SDK 原生播放等待和 session shutdown。是否能禁用后续工具、是否会自动生成工具回复，要以选定 realtime 插件为准；不能照搬当前 pipeline 的 `tool_choice="none"` 假设。

这些是待实现的主要业务条件，不是已经上线的防护。本轮没有增加新的 guard，也没有替用户批准其后续实现。

### 5. 为未来 pipeline 留下的边界

业务函数只接收题目计划、提问记录、答案证据和结束原因；不要接收 SDK ChatContext、SpeechHandle 或依赖 `on_user_turn_completed` 的特殊调用顺序。realtime 适配负责消息、转写、播放映射；以后 pipeline 用自己的 STT final、受控 TTS 播放事件映射到同一数据即可。

两种模式都通过同一业务服务保存结果、读取缺项、判定采集完整。未来切换发生在创建新会话时选择语音实现；本次只实现 realtime，既不增加配置开关，也不规划同一通话的热切换。持久化进度支持恢复业务事实，但不等同于恢复供应商内部声学状态。

## 实施前核对与验收

供应商、模型和插件尚未确定。确定后先验证：原生工具调用、稳定消息 ID/转写、输出播放与打断事件；有这些能力才能兑现上面的关联方案。不要先承诺具名工具强制选择、关闭并行工具、逐字读题、任意 task 嵌套均可用。旧项目 Qwen 适配仅是参考，不因它已经存在就默认采用；它声明的 capabilities 也不等于经过本次实测。

本地 SDK 为 1.8.10；1.8.11 于 2026-11-05 发布并包含 #8279 的修复。采用相关任务路径前应升级验证或避开受影响路径，本研究未升级依赖。GitHub API 核查为 closed；搜索页缓存仍曾显示 open，因此状态以本次 API 为准。

后续验收应覆盖真实实现：一段话答多题、迟到转写、更正公司/数字、题干中途打断、明确没经历、部分拒答、要求跳过、结束时尚有缺项、刷新继续、最后一句话与结束接近。断言持久化结果和实际播放，不能只断言模型调用过某工具。状态规则可做确定性测试，语音时序需要选定 realtime 模型的实际会话验证。

本次在旧项目现有虚拟环境运行 `test_realtime_interview_agent.py` 与 `test_answer_reconciliation.py`：57 项通过。这些确定性测试验证实际工具与核对实现，外部提取器使用测试替身；它们不证明真实语音模型每次都会正确调用。真实 realtime 会话、覆盖率和误判率尚未验证，不能据本研究承诺百分之百问到或采集到。
