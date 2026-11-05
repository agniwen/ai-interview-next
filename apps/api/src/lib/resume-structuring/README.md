# 简历结构化提取

`ResumeStructurer` 接收简历文本或 Markdown，返回 `Promise<ResumeParsedProfile>`。调用方显式传入 `AGENT_CHAT_*` 的模型配置。

```ts
import { createDefaultResumeStructurer } from "./default";

const structureResume = createDefaultResumeStructurer({
  apiKey: env.AGENT_CHAT_KEY,
  baseUrl: env.AGENT_CHAT_BASE_URL,
  model: env.AGENT_CHAT_MODEL,
});

const profile = await structureResume(text);
```

模型输出按 `@ai-interview/db/resume-profile` 的 v1 结构校验。可定位的原文片段保存在 `evidence` 中。输入文本有明确的分页标记时可以保留页码。网络请求、模型响应或结构校验失败时，调用方收到异常。
