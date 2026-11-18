# 简历文字提取

DeepSeek OCR 接收 PDF、JPEG 或 PNG。用服务端的 `DEEPSEEK_API_KEY` 向 `/v1/tools/ocr` 提交文件，并将成功识别的各页按页码拼成正文，供简历结构化任务使用。遇到普通识别被截断的页面时，通过版面识别补齐；两种模式都截断时，将失败交给现有队列重试。

[接口定义](./index.ts) · [DeepSeek 实现](./deepseek.ts) · [官方 OCR 文档](https://api-docs.deepseek.com/zh-cn/guides/ocr/)
