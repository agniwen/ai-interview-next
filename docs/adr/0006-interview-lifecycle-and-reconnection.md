# 面试生命周期、操作记录与刷新重连 / Interview lifecycle, activity, and reconnection

AI 面试和真人面试共用业务生命周期：发起、实际开始、正式结束。浏览器连接状态与该生命周期分离，刷新、断线、暂时离开和重连不会重置面试，也不会视为结束。该决定补充 [ADR-0004](0004-ats-candidates-resumes-and-applications.md)，参考旧项目 `ai-interview` 的会话恢复设计，避免把网络事件误记为业务操作。

AI and human interviews share a business lifecycle: creation, actual start, and formal completion. Browser connection state is separate: refreshes, disconnections, temporary departures, and reconnections neither reset nor complete an interview. This supplements [ADR-0004](0004-ats-candidates-resumes-and-applications.md), drawing on the previous project's recovery design so network events do not become business actions.

## 业务记录 / Business records

- 发起面试、实际开始、正式结束分别写入所属应聘的操作记录，包含发生时间、实际执行者、面试轮次、类型和标签。创建者是发起执行者；AI 开始的执行者是候选人；AI 结束的执行者可以是主动结束的候选人或本轮面试官 Agent。真人开始记录首次进入房间的人，真人结束记录执行结束的指定面试官。
- 状态变更和操作记录在同一数据库事务中提交。每轮每个生命周期事件具有稳定标识，重复请求不增加第二条记录、不改变首次开始或结束时间。仅打开邀请、获取连接令牌、刷新、恢复连接不生成生命周期记录。
- 调整 ADR-0004 的 AI 结束权限：候选人可主动点击「结束面试」，Agent 也可完成访谈后结束。真人仍由任一指定面试官结束。两类面试的「暂时离开」都只断开连接。结束后不再签发本轮连接凭证，也不重新开始该轮。

- Creation, actual start, and formal completion append activity to the owning application, including time, actor, round, kind, and label. The creator initiates the round; the candidate starts an AI interview; either the candidate or its assigned Agent ends it. For human interviews, the first entrant starts the round and an assigned interviewer ends it.
- State and activity commit in the same database transaction. Each round's lifecycle event has a stable identity; retries neither add a second event nor replace the original timestamps. Opening invitations, fetching connection credentials, refreshing, and reconnecting produce no lifecycle activity.
- ADR-0004's AI completion authority is updated: a candidate may explicitly end an AI interview, and its Agent may complete it. Only an assigned interviewer ends a human interview. Leaving temporarily only disconnects either kind. Completed rounds issue no further connection credentials and cannot restart.

## 恢复规则 / Recovery rules

- 刷新后先读取服务端轮次状态。进行中的同一轮恢复原房间及参会身份；AI 继续采用原材料、题目和面试官配置快照，不重新调用开始操作。未开始的轮次仍进入准备流程。
- 短暂断网交给 LiveKit 原生自动重连。连接彻底断开后允许重试原会话；房间被删除、参会者被移除或同身份在其他页面接入时停止当前页面自动恢复，防止两个页面互相抢占。只有服务端正式结束状态才能显示为已结束，不能将所有断线原因统一视作结束。
- 页面会话存储保存版本化的设备选择、麦克风及摄像头开关和是否允许自动恢复，不保存媒体流或房间令牌。刷新沿用最后选择；没有可恢复的设备设置时保持静音和关闭摄像头。主动暂时离开取消自动恢复，用户可以明确选择继续。
- 浏览器 SDK 的预取与断开清理不能调用业务开始或结束接口。前端先获取当前有效的连接信息，再交给官方 `TokenSource.literal`、`useSession` 和 `SessionProvider` 管理媒体连接，避免 SDK 清理阶段再次调用调度接口。
- 真人续接仍需遵循 ADR-0004 的身份、工作区、指定面试官和入场时间规则。刷新恢复不赋予额外权限。

- After a refresh, read the round's server state first. Resume an active round using its existing room and participant identity. AI retains its frozen materials, questions, and interviewer configuration without calling start again. Unstarted rounds stay in preparation.
- LiveKit handles transient network reconnection. A fully disconnected session can retry its existing room. Stop automatic recovery after room deletion, participant removal, or another page joining with the same identity, avoiding competing pages. Only authoritative completion state means the interview ended; disconnection reasons are not interchangeable with business completion.
- Session storage holds versioned device choices, microphone/camera switches, and whether automatic recovery is allowed, never media streams or room tokens. Refresh restores the last choices; absent saved settings, keep the microphone muted and camera off. Deliberately leaving disables automatic recovery until the user chooses to continue.
- SDK prefetch and disconnect cleanup must never start or end a business interview. Fetch valid connection information first, then use the official `TokenSource.literal`, `useSession`, and `SessionProvider` for media, preventing SDK cleanup from calling the dispatch endpoint again.
- Human reconnection remains subject to ADR-0004's identity, workspace, assigned-interviewer, and admission rules. Refresh recovery grants no additional authority.

## 运行记录与结果核对 / Runtime events and result reconciliation

运行时间线独立保存 Agent 启动、恢复、关闭，候选人连接和离开，房间及 Realtime 的重连、恢复、失败，以及报告生成结果。每条记录包含来源、时间、运行标识、错误类别与重试次数；不保存供应商原始错误载荷或密钥。候选人接口仅接受本人的连接事件，正式结束由业务接口写入并区分候选人主动结束和面试官正常收尾。重试耗尽属于异常中断，保留本轮并允许重新进入，不伪造完成状态。

The runtime timeline independently records Agent start/resume/close, candidate presence, room and Realtime reconnect/recovery/failure, and report outcomes. Events carry source, time, run ID, error class and retry count, never raw provider errors or credentials. Candidate endpoints accept only that candidate's connection events; business endpoints record formal completion and distinguish candidate requests from normal Agent wrap-up. Exhausted retries interrupt the round and allow re-entry without fabricating completion.

Realtime 使用从旧项目迁移的 Qwen 协议适配器，模型为 `qwen-audio-3.1-realtime-plus`，密钥为 `QWEN_KEY`。适配器恢复已确认历史，不重放未确认的工具操作；通过 LiveKit 标准错误和恢复事件记录重试，空闲连接轮换单独记录，不计为故障。结束后用 `OPENAI_REPORT_MODEL`（默认 `gpt-5.4-mini`）按有界转写批次核对采集点与原文，结构化输出只能引用本轮编号。此过程不参与实时语音，不引入另一套语音方案。核对失败时保留此前保存的进度与原文，并在结果页明确标记失败。

Realtime uses the Qwen protocol adapter migrated from the legacy project, with `qwen-audio-3.1-realtime-plus` and `QWEN_KEY`. It restores confirmed history without replaying unconfirmed tools, reports retries through LiveKit error/recovery events, and records idle connection rotation separately from faults. After shutdown, `OPENAI_REPORT_MODEL` (default `gpt-5.4-mini`) reconciles bounded transcript batches against collection points, using structured output restricted to this round's IDs. This runs outside the voice conversation and does not introduce a second voice pipeline. Failed reconciliation preserves previously saved progress and transcripts and is explicitly shown on the results page.

## 本次范围 / Current scope

本次实现两类面试的发起记录，以及 AI 的开始、结束和刷新恢复；真人会议入口后续接入相同约定。Realtime 使用独立 D1 账本保存采集计划、进度与原文转写，模型原生截断不删除这些记录。Agent 进程重启时加载账本和最近转写，保留已确认事实；这不等于恢复原模型的完整音频历史。不引入三分钟中断宽限期或 Durable Object。本次已接入 AI 评价草稿与人工正式确认，评价字段、确认权限和推进规则遵循 ADR-0004；录音归档仍不在本次范围内。

This increment records creation for both kinds and implements AI start/end and refresh recovery. The human meeting entry will use the same contract. An independent D1 ledger persists the Realtime collection plan, progress and transcript, unaffected by native model truncation. A restarted Agent loads saved facts and recent transcript, rather than the original model's full audio history. No three-minute grace period or Durable Object is introduced. AI evaluation drafts and formal human confirmation are now included; evaluation fields, confirmation authority and progression follow ADR-0004. Recording archival remains outside this increment.
