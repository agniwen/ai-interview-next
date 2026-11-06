# 简历处理流程设计

首版按[可移植的简历处理流程](../adr/0005-portable-resume-processing.md)实现。现有的[简历文本提取](../../apps/api/src/lib/pdf-text/README.md)和[简历结构化](../../apps/api/src/lib/resume-structuring/README.md)分别作为前两个阶段的执行依赖。岗位评价接收已确定的候选人、应聘、简历解析结果和岗位要求快照，成功结果保存至 `application_evaluation.result`。

## 上传和解析

1. API 为一次选择的 PDF、JPEG 或 PNG 创建上传批次和逐文件上传条目，并为每个对象签发私有 S3 兼容存储的上传地址。每个对象键由服务端分配并绑定该条目。
2. 客户端逐文件直传并确认。API 核对该条目的对象已上传，在同一数据库事务里接受文件、记录处理运行并登记启动解析 Workflow 的 Outbox 消息。批次内其余文件继续独立处理。
3. 解析 Workflow 派发文本提取尝试。消费者读取原件字节，计算 SHA-256 并按工作区查重。新文件建立 `Resume`，关联该次 `ResumeSubmission`，随后执行文本提取。已解析的文件复用产物，解析中的重复文件则将上传条目关联到已有解析运行。每份上传保留自己的投递记录和后续身份识别状态。
4. 文本提取成功后，消费者在同一阶段尝试[从首页提取头像](../adr/0005-portable-resume-processing.md#ocr-阶段提取简历头像)。保存 Markdown 和已写入 R2 的头像引用后，再派发结构化。结构化成功后保存 `ResumeParsedProfile`，解析 Workflow 结束。每次投递独立应用候选人识别规则。多个上传条目跟随同一次解析运行时，共享解析进度和结果。
5. 上传批次从条目和关联的解析运行汇总上传与解析结果。简历列表展示上传和解析状态，以及是否需要确认候选人。岗位和岗位评价显示在应聘记录中。

`resume.markdown` 和 `resume.parsedProfile` 保存当前阶段产物。失败后的手动重试从失败阶段继续。简历详情的“重新解析”通过 `POST /api/ats/:workspaceId/uploads/:id/reparse` 为已有解析运行分配新的 `executionId`，从 OCR 开始重新执行，保留历次尝试记录。该操作将简历解析状态重置为 pending，使相同文件不会直接复用旧解析结果；原件、投递、候选人和应聘关联不变。旧 Markdown 和结构化内容保留到对应阶段成功写入新结果，已有头像按 OCR 阶段规则继续复用。排队或执行中的解析不能重复发起。

重新解析更新该简历的当前解析结果，不自动重跑或覆盖已保存的岗位评价。按解析执行保存独立产物版本、让历史评价固定引用当时产物，仍是后续的版本管理能力。

## 岗位评价和换岗

解析完成、候选人已确定、岗位已确定且关联应聘有效时，创建独立的评价运行。无论解析或定岗哪一项先完成，最后满足条件的业务入口都登记同一个评价触发，避免一次定岗重复派发。评价运行固定 `applicationId`、简历解析产物引用及当时的岗位要求快照。

匹配岗位从 A 改为 B 时，在同一事务中完成以下写入。

1. 新建或复用候选人在 B 岗的进行中应聘，关联本次投递及其简历。
2. 结束原应聘 A，写入 `closedAt` 和业务结果，并为本次状态变更追加一条 `closed` 日志。
3. 更新投递当前关联的岗位与应聘。如果评价前置条件已满足，同时登记 B 岗评价运行和启动消息。如果简历仍在解析，等条件满足后启动。

换岗属于新的评价触发。旧评价、面试和反馈继续归属 A。A 已结束时，评价消费者在调用模型前读取应聘状态，尚未调用的评价记为跳过。已发出的调用可以完成，成功结果作为 A 的历史保存。

## 处理运行、尝试与发件箱

工作流拥有阶段顺序和业务重试策略。每个阶段独立排队，最多同时执行六个任务。消费者将已知的业务结果写入数据库，再确认队列消息。队列重复投递时，消费者按尝试 ID 读取已有执行结果或执行权，工作流根据数据库中的结果推进。

| 持久记录                    | 职责                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| `resume_upload_batch`       | 一次批量上传的工作区、发起人和创建时间。进度从逐文件条目汇总                                        |
| `resume_upload_item`        | 文件名、对象键、上传确认结果、对应的投递及解析运行。上传确认前可独立存在                            |
| `resume_processing_run`     | 一次解析或评价的业务 ID、处理对象、当前阶段、状态、已完成产物引用和工作流执行标识                   |
| `resume_processing_attempt` | 运行、阶段、尝试序号、认领与截止时间、结果、错误、供应商请求 ID，以及版本化的实际调用参数和输入引用 |
| `resume_processing_outbox`  | 待投递的版本化消息、目的地、可投递时间和投递状态                                                    |
| `application_activity`      | 应聘详情里的已生效业务操作历史                                                                      |

尝试在实际调用前保存模型、提示词版本、有效参数和输入引用。结果保存产物引用或失败原因。PDF、文本、结构化结果及岗位要求通过业务记录引用，调用凭据由适配器在执行时获取。

阶段执行的超时从消费者认领开始计算。结果通知或等候超时后，工作流先读取尝试状态。尝试已有结果时按结果推进，仍在排队时继续等待，执行已超时时按重试预算处理。产物与尝试结果一并提交，只有仍在执行的尝试可以提交本阶段产物。每阶段自动尝试最多三次，默认在 30 秒和 2 分钟后重试，上游指定更长等待时采用该时长。手动重试保留已成功的阶段和既有尝试历史。

Outbox 与业务状态原子提交。正常提交后立即尝试派发，定时任务每分钟补发。消费者保存尝试结果时，同时登记唤醒 Workflow 的消息。阶段消息和结果通知都携带稳定的运行与尝试 ID，结果通知唤醒后仍从数据库读取产物。D1 可用原子 `batch()` 承接相关写入，Cloudflare Workflows 可用事件等候和唤醒来衔接队列阶段。 [D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) · [Workflows 事件](https://developers.cloudflare.com/workflows/build/events-and-parameters/)

## 应聘操作日志

`application_activity` 保存 `id`、`workspaceId`、`applicationId`、`occurredAt`、`actorType`、`actorId`、`action` 和版本化的 `result`。应聘时间线按工作区、应聘和发生时间读取。人工动作使用用户 ID，系统独立发起时使用稳定的系统标识。招聘人员发起换岗所触发的自动结束，记录该招聘人员为发起人。

仅在应聘从进行中转为结束时追加 `closed` 事件，事件时间与 `closedAt` 一致。换岗结束的结果可记录为 `{"version":1,"outcome":"transferred","reason":"job_changed","nextApplicationId":"application_b"}`。失败的业务请求由请求错误反映，模型调用失败进入处理尝试记录。

## 应用接口和 Cloudflare 适配

业务逻辑使用稳定的业务 ID 和显式依赖。建议以这些能力作为适配边界。

```ts
type ResumeStage = "extract_text" | "structure" | "evaluate";

type StageMessage = {
  version: 1;
  runId: string;
  attemptId: string;
};

interface ResumeObjectStore {
  signUpload(objectKey: string, contentType: ResumeMediaType): Promise<string>;
  head(objectKey: string): Promise<{ size: number } | null>;
  read(objectKey: string): Promise<Uint8Array>;
  write(objectKey: string, bytes: ArrayBuffer, contentType: ResumeMediaType): Promise<void>;
}

interface ResumeStageQueue {
  publish(stage: ResumeStage, message: StageMessage): Promise<void>;
}

interface ResumeWorkflowRuntime {
  start(executionId: string, input: { version: 1; runId: string }): Promise<void>;
  notifyAttemptFinished(executionId: string, event: StageMessage): Promise<void>;
}
```

Cloudflare 适配层将对象读写映射到 R2 或 S3 兼容接口，将阶段映射到三个 Queue binding，将工作流启动、等候、延迟和通知映射到 Workflows。队列入口负责消息校验和确认，调用应用中的阶段执行函数。应用数据库保存调度器推进所需的业务状态，后续更换实现时可复用阶段执行、重试策略和状态迁移逻辑。

## 本地运行与部署

先运行 `make db-migrate`，再启动 `make dev`。Hub 工作台中的候选人、简历、岗位和招聘流程从当前工作区分页读取。简历页用于上传、查看简历和确认候选人。岗位页用于新建和查看岗位。招聘流程页通过选择一份已解析的简历和岗位来建立应聘记录，随后可在此查看岗位评价。

Cloudflare 适配由 API Worker 持有，资源名如下：

- 私有 R2 桶：`sainoa-resumes`。
- 队列：`sainoa-resume-extract`、`sainoa-resume-structure`、`sainoa-resume-evaluate`。
- Workflow：`sainoa-resume-processing`，由 Worker 部署注册。

应用通过 [Files SDK 的 R2 适配器](https://files-sdk.dev/guides/cloudflare-workers-r2-storage)读写绑定并生成直传签名。要启用浏览器直接上传到 R2，在 API 环境配置 `RESUME_S3_ENDPOINT`、`RESUME_S3_ACCESS_KEY_ID` 和 `RESUME_S3_SECRET_ACCESS_KEY`，并为应用域名配置桶的 CORS（允许 `PUT` 和 `Content-Type`）。缺少这些配置时，上传走受工作区权限保护的 API。
