# Sainoa Voice Agent

基于 [LiveKit 官方 Python starter](https://github.com/livekit-examples/agent-starter-python) 的独立语音服务。使用 Python 3.14、uv、AgentServer 和 AgentSession；Python 项目名为 `ai-interview-voice-agent`，由根目录 Makefile 直接管理，不属于 Bun workspace。

## 启动

本机需要 uv；在仓库根目录执行：

```bash
make voice-install
cp apps/voice-agent/.env.example apps/voice-agent/.env
# 填入 LiveKit Cloud 项目的 URL、API key 和 API secret
make voice-download
make voice-dev
```

正式面试入口需要服务端调度元数据。运行 `make voice-dev` 后，通过 Web 候选人邀请页完成设备检查并开始沟通，由 API 显式调度 Agent。API 和本地 Agent 的 `LIVEKIT_AGENT_NAME` 必须一致；`INTERVIEW_AGENT_API_URL` 必须能从 Agent 进程访问。命名 Agent 不会自动加入所有房间。

普通 `voice-console` / Playground 调度不带本轮凭证，不能直接启动正式面试。模型行为测试使用下方的合成材料，不依赖真实候选人数据。

凭据也可以通过进程环境变量注入，优先于 `.env`。环境文件不提交，也不会进入 Docker 镜像。多人联调时，在各自 `.env` 中设置 `LIVEKIT_AGENT_NAME=sainoa-voice-agent-你的名字`，并让客户端调度对应名称。未设置时使用默认名称 `sainoa-voice-agent`。

| 命令                  | 用途                    |
| --------------------- | ----------------------- |
| `make voice-install`  | 按 uv.lock 安装依赖     |
| `make voice-download` | 下载语音模型资源        |
| `make voice-console`  | 终端语音交互            |
| `make voice-dev`      | 开发模式连接 LiveKit    |
| `make voice-start`    | 生产模式启动            |
| `make voice-deploy`   | 发布到 LiveKit Cloud    |
| `make voice-status`   | 查看云端 Agent 状态     |
| `make voice-logs`     | 查看云端 Agent 实时日志 |

Web 继续使用 `make dev`，两个服务可分别运行。Python 依赖由 uv 和本目录 `uv.lock` 独立管理。

## LiveKit Agent Skills

项目在根目录 `.agents/skills/` 安装了 [LiveKit 官方 skills](https://github.com/livekit/agent-skills)，供 Codex 按任务加载，覆盖文档查询、开发、调试、测试、场景编写、模拟和运维。来源与内容哈希由根目录 `skills-lock.json` 记录。

在仓库根目录重新安装或更新这套 skills：

```bash
bunx skills add livekit/agent-skills --agent codex --yes
bunx --no-install skills list --agent codex
```

安装后，Codex 从下一轮对话开始发现这些 skills。当前安装方式仅管理 skills；LiveKit Docs MCP 需单独配置。项目继续使用上述命令维护这套 skills。通过 Homebrew 安装的 LiveKit CLI 可运行 `brew upgrade livekit-cli` 更新；工具命令以本机 `lk --help` 为准。

## 当前配置

入口为 `src/agent.py`，实时面试通过 `QWEN_KEY` 使用 `qwen-audio-3.1-realtime-plus`、`longanlingxin` 音色和 `smart_turn`，保留 ai-coustics 音频增强。`src/qwen_realtime.py` 从旧项目 `ai-interview/apps/livekit-agent` 迁移，适配 LiveKit Agents 1.8 的音频、转写、工具和恢复事件。`QWEN_REALTIME_MODEL`、`QWEN_REALTIME_VOICE`、`QWEN_REALTIME_BASE_URL` 可覆盖默认值；可选 `QWEN_WORKSPACE_ID` 指定百炼工作空间。默认连接中国内地端点，密钥必须属于对应地域。摄像头仅用于本地预览，不传给模型。

Qwen 协议无法直接代替 OpenAI Realtime：音频输入为 16kHz PCM、输出为 24kHz PCM，工具格式、转写和恢复事件也不同。适配器负责协议转换，LiveKit 负责执行工具，业务账本仍由应用管理。Qwen 不支持强制命名工具选择；开场只暴露 `prepare_interview`，通过指令先保存计划，再切换到访谈工具。协议参考：[客户端事件](https://help.aliyun.com/zh/model-studio/fun-audiochat-client-events)、[服务端事件](https://help.aliyun.com/zh/model-studio/qwen-audio-realtime-server-events)。

Agent 通过 dispatch 的 `{ version: 1, contextUrl, contextToken }` 读取冻结的岗位、简历、表单、题目和面试官配置，凭证不进入浏览器或模型。开始前冻结每题的事实采集点；自然对话允许跨题、闲聊、更正、拒答和主动结束。采集引用候选人真实转写，转写迟到时等待核对，不按当时的“当前题”分配回答。

使用短题号、精简工具回执、按需分页读取材料，以及 Qwen 的 `max_history_turns=20` 限制上下文；已听取的音频轮次转为文本历史，避免持续重复发送历史音频。D1 独立保存采集计划、进度、消息原文和 token 用量；新 Agent 进程加载账本和最近转写继续交流。无需 Durable Object：LiveKit 已负责实时连接，DO 不会减少模型输入 token。

每个 Session 绑定本轮候选人 identity。暂时离开、刷新、断线不结束面试；候选人按钮或明确口头要求可主动结束。正常完成先提供补充/反问机会，再调用业务结束接口，成功后告别。全部点有处理结果才允许正常收尾，拒答或信息不足不计为采集齐全。招聘方结果页展示摘要、采集状态、原文证据和转写；候选人只看到完成提示与体验反馈。真人结果展示已有面试官反馈，不生成 AI 评分。

Realtime 自动重连和历史恢复由迁移的 Qwen 适配器处理：恢复已确认历史，不重放未确认工具；应用通过 LiveKit 事件记录重试次数、恢复和耗尽状态，并将房间连接与模型连接分开显示。重试耗尽会显示异常中断，候选人可以重新进入原轮次。正式结束原因由业务接口记录。关闭后使用 `OPENAI_REPORT_MODEL`（默认 `gpt-5.4-mini`）核对已保存转写、采集点和摘要，修正听到的原话与转写用词的差异；失败时保留已有内容并标记报告失败。该文本调用仅用于结果整理，实时访谈仍只使用 Realtime。

## 验证

使用 Python 标准库测试与 LiveKit 原生 AgentSession 测试接口：

```bash
uv run --project apps/voice-agent --locked python -m unittest discover -s apps/voice-agent/tests -v
LIVEKIT_TEST_MODEL=1 uv run --project apps/voice-agent --locked python -m unittest discover -s apps/voice-agent/tests -v
```

默认运行本地 HTTP 与采集账本测试；第二条使用 `.env` 中的 `QWEN_KEY` 调用真实 Qwen 模型，并使用 `OPENAI_KEY` 做收尾核对，两者均产生用量，验证自然聊天、证据采集、更正、内部信息边界，以及暂时离开、成功结束和结束写入失败的行为。它不代替浏览器麦克风、摄像头和端到端语音验收。

### 多轮真实模型与落库验收

`tests/e2e_interview.py` 使用相同的 `InterviewAgent`、Realtime 模型和收尾核对模型，通过正在运行的本地 API 写入 D1，再独立读回转写、采集计划及逐点结果。它为每轮创建合成候选人、岗位、应聘和已开始的面试快照，不读取真实候选人材料。测试数据保留在本地以便检查；这组测试从已开始的面试运行至结束，不覆盖创建邀请和浏览器设备检查。

先启动本地 API，并将 `INTERVIEW_E2E_DB` 设置为该 API 使用的 `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` 下业务 SQLite 文件（不是 `metadata.sqlite`），然后从仓库根目录执行：

```bash
mkdir -p .eval/interview-e2e
uv run --project apps/voice-agent --locked python apps/voice-agent/tests/e2e_interview.py \
  --database "$INTERVIEW_E2E_DB" --output .eval/interview-e2e \
  cross-topic-correction resume-memory refusal-unknown end-write-failure early-stop long-memory
```

这些是付费验收，不随默认单元测试运行。每次运行单独保存带 `version: 1` 的 JSON，包含场景、源文件哈希、逐轮对话、工具事件、D1 快照、断言、耗时、原始 token 用量及费用估算；失败记录也保留，失败时命令返回非零。`long-memory` 包含 69 次候选人发言；`resume-memory` 真正关闭 Session 并从 API 恢复新的 Agent。`end-write-failure` 通过本地转发代理注入结束接口 503，其余请求仍进入真实 API。

迁移 Qwen 后，验收仍保存供应商原始用量，但实时模型与总费用标为未核价，不再套用 OpenAI Realtime 单价。收尾核对仅在 `gpt-5.4-mini` 时按 2026-11-08 单价估算；更换模型后标为未核价。历史 OpenAI 验收报告保留当时的模型与价格，不作为当前 Qwen 成本。参考 [OpenAI 价格](https://developers.openai.com/api/docs/pricing)、[GPT-5.4 mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)。

### 真实语音房间验收

`tests/e2e_worker.py` 保留正式 `voice_agent` 入口，只在真实 Session 上附加用量监听。使用独立的调度名称启动，避免接收常规面试任务：

```bash
LIVEKIT_AGENT_NAME=sainoa-e2e-local E2E_USAGE_DIR=.eval/interview-e2e \
  uv run --project apps/voice-agent --locked python apps/voice-agent/tests/e2e_worker.py dev --no-reload
```

在另一终端运行：

```bash
uv run --project apps/voice-agent --locked python apps/voice-agent/tests/e2e_audio_interview.py \
  --database "$INTERVIEW_E2E_DB" --output .eval/interview-e2e --agent-name sainoa-e2e-local
```

加 `--interrupt` 验证面试官说话时插话更正；默认验证候选人断开房间后重新加入。脚本用本机已有的 macOS `say` 和 `ffmpeg` 生成语音，经真实 LiveKit 房间、语音增强、Realtime 和转写进入正式业务链路。转写保留 SDK 返回的音频秒数，不套用旧 `gpt-transcribe` 单价；LiveKit 传输、语音增强和录制的实际费用取决于套餐及剩余额度，单独标为待账单核对。需代理时为 worker 设置 SDK 支持的 `HTTPS_PROXY`，只设置小写 `https_proxy` 不会传递给其模型连接。

语音测试在结束后删除本次创建的房间；完成测试后停止独立 worker。它验证合成语音链路，不代替真人麦克风、浏览器授权或真实嘈杂环境测试。用量接口参考 [LiveKit Session usage](https://docs.livekit.io/testing/observability/data/#session-usage)。

## 部署

可部署到 LiveKit Cloud Agents，或运行 Python/Docker 长驻进程的平台；此服务不运行在 Cloudflare Workers 请求运行时中。Web 仍可部署在 Cloudflare。

当前 LiveKit Cloud 项目为 **Sainoa**，项目与 Agent 绑定保存在 `livekit.toml`，已部署到 `ap-south` 区域。本机通过 `lk cloud auth` 授权该项目后，执行 `make voice-deploy` 发布后续版本，使用 `make voice-status` 和 `make voice-logs` 验证运行状态。LiveKit Cloud 自动注入连接凭据；发布前需为 Agent 配置 `QWEN_KEY`（实时面试）和 `OPENAI_KEY`（收尾文字核对）；API 与 Agent 的调度名称和回调地址必须匹配。

调度名称为 `sainoa-voice-agent`。正式面试需要由 API 携带本轮元数据调度。更换云项目时，应在新项目创建 Agent 并重新生成 `livekit.toml`，不要复用旧项目的 Agent ID。

从仓库根目录构建，应用目录作为 Docker context：

```bash
docker build -t sainoa-voice-agent apps/voice-agent
docker run --rm --env-file apps/voice-agent/.env -p 8081:8081 sainoa-voice-agent
```

镜像使用锁文件安装生产依赖，在构建阶段下载模型，以非 root 用户运行。生产启动使用 `start`，由 LiveKit SDK 处理任务生命周期和关闭；平台应给进程留出 SDK 的排空时间，不要立即强制结束进行中的会话。8081 为 AgentServer 的健康检查端口。

参考：[快速开始](https://docs.livekit.io/agents/start/voice-ai/)、[Agent 调度](https://docs.livekit.io/agents/server/agent-dispatch/)、[自托管部署](https://docs.livekit.io/deploy/custom/deployments/)。
