# PDF 文本提取

将一份 PDF 的可见文字转录为 Markdown，包括扫描页中的文字。调用方传入 `Uint8Array`，得到 `Promise<{ text: string }>`。

- [index.ts](./index.ts) 定义通用接口 `PdfTextExtractor`。
- [vercel-gateway.ts](./vercel-gateway.ts) 提供 `createVercelGatewayPdfTextExtractor`，通过 Vercel AI Gateway 将整份 PDF 交给 `anthropic/claude-haiku-5.5`。

```ts
import { createVercelGatewayPdfTextExtractor } from "./vercel-gateway";

const extractPdfText = createVercelGatewayPdfTextExtractor({ apiKey });
const { text } = await extractPdfText(pdfBytes);
```

调用方负责读取服务端的 `AI_GATEWAY_API_KEY` 并通过 `apiKey` 注入。请求默认在 120 秒后超时，网关请求失败时由调用方处理异常。
