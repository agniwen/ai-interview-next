import { createModels, createProvider } from "@earendil-works/pi-ai/models";
import type { Model } from "@earendil-works/pi-ai";
// 静态导入避免 Workers 单文件打包时 lazy 模块的循环初始化。
// Static loading avoids cyclic lazy-module initialization in the single-file Workers bundle.
import * as openAICompletionsApi from "@earendil-works/pi-ai/api/openai-completions";

export interface AgentModelConfig {
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_BASE_URL: string;
  DEEPSEEK_MODEL: string;
}

export function createAgentModels(config: AgentModelConfig) {
  const model: Model<"openai-completions"> = {
    api: "openai-completions",
    baseUrl: config.DEEPSEEK_BASE_URL,
    compat: {
      supportsDeveloperRole: false,
      supportsReasoningEffort: false,
      supportsStore: false,
      thinkingFormat: "deepseek",
    },
    contextWindow: 128_000,
    cost: { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 },
    id: config.DEEPSEEK_MODEL,
    input: ["text"],
    maxTokens: 8192,
    name: config.DEEPSEEK_MODEL,
    provider: "agent-chat",
    reasoning: true,
  };
  const models = createModels();
  models.setProvider(
    createProvider({
      api: openAICompletionsApi,
      auth: {
        apiKey: {
          name: "Agent Chat",
          resolve: () => Promise.resolve({ auth: { apiKey: config.DEEPSEEK_API_KEY } }),
        },
      },
      baseUrl: config.DEEPSEEK_BASE_URL,
      id: "agent-chat",
      models: [model],
      name: "Agent Chat",
    }),
  );
  return { model, models };
}
