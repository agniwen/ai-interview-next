# Sainoa Voice Agent

基于 [LiveKit 官方 Python starter](https://github.com/livekit-examples/agent-starter-python) 的独立语音服务。使用 Python 3.14、uv、AgentServer 和 AgentSession；Python 项目名为 `ai-interview-voice-agent`，由根目录 Makefile 直接管理，不属于 Bun workspace。

## 启动

本机需要 uv；在仓库根目录执行：

```bash
make voice-install
cp apps/voice-agent/.env.example apps/voice-agent/.env
# 填入 LiveKit Cloud 项目的 URL、API key 和 API secret
make voice-download
make voice-console
```

`voice-console` 使用本机麦克风和扬声器。连接浏览器或其他客户端时运行 `make voice-dev`，随后通过 LiveKit Playground 或服务端 dispatch API 将名为 `sainoa-voice-agent` 的 Agent 调度到房间。命名 Agent 使用显式调度，不会自动加入所有房间。

凭据也可以通过进程环境变量注入，优先于 `.env`。环境文件不提交，也不会进入 Docker 镜像。多人联调时，在各自 `.env` 中设置 `LIVEKIT_AGENT_NAME=sainoa-voice-agent-你的名字`，并让客户端调度对应名称。未设置时使用默认名称 `sainoa-voice-agent`。

| 命令                  | 用途                               |
| --------------------- | ---------------------------------- |
| `make voice-install`  | 按 uv.lock 安装依赖                |
| `make voice-download` | 下载语音模型资源                   |
| `make voice-console`  | 终端语音交互                       |
| `make voice-dev`      | 开发模式连接 LiveKit，支持重新加载 |
| `make voice-start`    | 生产模式启动                       |
| `make voice-deploy`   | 发布到 LiveKit Cloud               |
| `make voice-status`   | 查看云端 Agent 状态                |
| `make voice-logs`     | 查看云端 Agent 实时日志            |

Web 继续使用 `make dev`，两个服务可分别运行。Python 依赖由 uv 和本目录 `uv.lock` 独立管理。

## 当前配置

入口为 `src/agent.py`。沿用官方 starter 的 LiveKit Inference 语音流水线：AssemblyAI STT、Gemma LLM、Fish Audio TTS、LiveKit TurnDetector，以及 ai-coustics 音频增强。Inference 使用 LiveKit Cloud 凭据，模型调用按服务用量计费，无需单独配置模型提供商密钥。

当前 STT 按官方示例配置为英语，尚未实现随 Web 语言切换。修改模型、声音、语言和对话提示均在此入口完成。TurnDetector 由 SDK 自动配备 VAD，开启预生成以减少回复等待。每个房间创建独立 Session，日志携带房间名称。

这是独立的语音对话 starter；尚未接入 Web 房间令牌、用户认证、面试数据或评分逻辑。

## 部署

可部署到 LiveKit Cloud Agents，或运行 Python/Docker 长驻进程的平台；此服务不运行在 Cloudflare Workers 请求运行时中。Web 仍可部署在 Cloudflare。

当前 LiveKit Cloud 项目为 **Sainoa**，项目与 Agent 绑定保存在 `livekit.toml`，已部署到 `ap-south` 区域。本机通过 `lk cloud auth` 授权该项目后，执行 `make voice-deploy` 发布后续版本，使用 `make voice-status` 和 `make voice-logs` 验证运行状态。LiveKit Cloud 自动注入连接凭据；当前模型全部使用 LiveKit Inference，不需要上传模型提供商密钥。

调度名称为 `sainoa-voice-agent`，可在 LiveKit Cloud 的 Agent Console 中测试。更换云项目时，应在新项目创建 Agent 并重新生成 `livekit.toml`，不要复用旧项目的 Agent ID。

从仓库根目录构建，应用目录作为 Docker context：

```bash
docker build -t sainoa-voice-agent apps/voice-agent
docker run --rm --env-file apps/voice-agent/.env -p 8081:8081 sainoa-voice-agent
```

镜像使用锁文件安装生产依赖，在构建阶段下载模型，以非 root 用户运行。生产启动使用 `start`，由 LiveKit SDK 处理任务生命周期和关闭；平台应给进程留出 SDK 的排空时间，不要立即强制结束进行中的会话。8081 为 AgentServer 的健康检查端口。

参考：[快速开始](https://docs.livekit.io/agents/start/voice-ai/)、[Agent 调度](https://docs.livekit.io/agents/server/agent-dispatch/)、[自托管部署](https://docs.livekit.io/deploy/custom/deployments/)。
