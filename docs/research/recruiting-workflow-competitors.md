# 招聘流程、状态与详情操作栏竞品调研

核验日期：2026-11-07。研究对象为 Metaview、Ashby、BrightHire，重点核查 Metaview 的 Application Review、AI Screening、人工面试与 ATS 衔接。仅使用厂商及集成双方的官方公开资料；未登录产品实测、未调用客户 API。英文名称按来源保留，但帮助页上的显示名称不等于已核实的后台枚举。文中的中文流程示例和 Sainoa 建议均单独标明，不作为竞品固定状态。

**建议 Sainoa 将「当前招聘阶段」「本次应聘结果」「面试执行」「AI 评价任务」「人工决策」「外部同步」分开表达。详情 toolbar 服务于本次应聘的推进、拒绝、退出和录用；邀请、重做面试、重新评价放到对应活动上。** 依据是：Ashby 的申请 API 同时返回整体状态与当前阶段；Metaview 可以在面试已完成后等待评价，也可以只在本地保存人工决定。这些事实无法由一个线性状态字段准确表达。 [Ashby 申请 API](https://developers.ashbyhq.com/reference/applicationinfo) · [Metaview Screening 积分](https://support.metaview.ai/screening/credits) · [Metaview Screening 设置](https://support.metaview.ai/screening/setup)

## 结论与产品定位

1. **Metaview 已经覆盖简历评审和 AI 主持初筛，不能只按面试记笔记产品分析。** Application Review 根据岗位画像评估申请；Screening 负责双向语音面试并提供评分、记录和人工决策入口；Notes 支持后续真人面试的记录及反馈整理。 [Application Review 产品页](https://www.metaview.ai/application-review) · [Screening 产品页](https://www.metaview.ai/screening) · [Notes 概览](https://support.metaview.ai/notes/overview)
2. **AI 结果与招聘决定不是同一回事。** Metaview 的匹配评级和人工反馈独立于推进／拒绝；BrightHire Screen 也由招聘人员决定去留。Metaview Screening 有一个需单独说明的例外：可显式开启逾期未完成自动拒绝，默认关闭，触发依据不是 AI 评分。 [Metaview 评审概览](https://support.metaview.ai/application-review/overview) · [Screening FAQ](https://support.metaview.ai/screening/screening-faqs) · [BrightHire 招聘人员体验](https://brighthire.com/ai-interviewer/recruiter-experience/)
3. **Ashby 提供最清晰的完整 ATS 参照。** 岗位配置面试计划，阶段中挂活动，活动有排期和反馈进度；整体申请结果另有字段。归档原因区分组织拒绝、候选人退出和其他原因，录用也可有 offer 后置步骤。 [面试计划](https://docs.ashbyhq.com/interview-plans) · [活动](https://docs.ashbyhq.com/activities) · [归档原因](https://docs.ashbyhq.com/configuring-archive-reasons) · [Offer 阶段配置](https://docs.ashbyhq.com/configuring-offer-stage-admin-settings)
4. **「已完成」必须说明完成了什么。** 面试结束、AI 评价可查看、面试官提交反馈、招聘人员决定推进、ATS 收到决定，是不同事件。Greenhouse 集成明确要求用户审阅并提交 scorecard，不能把自动生成内容视为已提交人工评价。 [Metaview–Greenhouse 集成](https://support.greenhouse.io/hc/en-us/articles/55720525030811-Metaview-integration) · [Ashby 活动状态](https://docs.ashbyhq.com/understanding-candidate-activity-statuses)

## 三家产品如何划分流程

| 维度                | Metaview                                                                                                                                                                                 | Ashby                                                                                                                                                                     | BrightHire                                                                                                                                                                                               |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 招聘申请 stage      | ATS 模式关联岗位和导入阶段；初筛还配置推进、拒绝的目标阶段。独立邀请模式没有 ATS 阶段同步。 [设置](https://support.metaview.ai/screening/setup)                                          | 面试计划包含系统阶段及岗位自定义阶段，阶段按顺序组织。 [计划](https://docs.ashbyhq.com/interview-plans)                                                                   | Screen 可由 ATS 阶段变化发起邀请，也能独立使用。未找到它自己的完整申请阶段定义。 [产品页](https://brighthire.com/ai-interviewer/)                                                                        |
| 整体 outcome/status | 能读入 ATS 整体申请状态；未发现其公开定义一套跨 ATS 的完整申请结果枚举。 [Ashby 集成](https://docs.ashbyhq.com/metaview)                                                                 | API 的申请 `status` 与 `currentInterviewStage` 分开；前者明确列出 `Lead`、`Active`、`Hired`、`Archived`。 [API](https://developers.ashbyhq.com/reference/applicationinfo) | 所读资料描述筛选、评分、人工判断与 ATS 回流，未公开完整申请结果枚举。 [Screen 集成](https://support.greenhouse.io/hc/en-us/articles/44305038086427-BrightHire-Screen-integration)                        |
| 面试执行            | 邀请、候选人开始、完成、重做属于 Screen 内部过程；邀请发送不等于面试开始。 [FAQ](https://support.metaview.ai/screening/screening-faqs)                                                   | 排期、候选人可用时间、面试、待反馈等活动状态独立存在。 [活动状态](https://docs.ashbyhq.com/understanding-candidate-activity-statuses)                                     | Greenhouse 可发出 Screen 测评并显示测评进度，完成后访问报告；不能据此推导 BrightHire 内部全量状态。 [集成](https://support.greenhouse.io/hc/en-us/articles/44305038086427-BrightHire-Screen-integration) |
| AI 评价任务与结果   | 简历评审有版本生命周期；初筛有等待积分的处理状态和独立匹配评级。 [评审 FAQ](https://support.metaview.ai/application-review/faqs) · [积分](https://support.metaview.ai/screening/credits) | AI 按条件返回满足、不满足、无法确定及理由，支持更新条件后重评；这与人工平均评分独立。 [AI 评审](https://docs.ashbyhq.com/ai-assisted-application-review)                  | 可选择只总结或评价并生成评分卡。未核实 AI 任务队列及失败状态枚举。 [集成](https://support.greenhouse.io/hc/en-us/articles/44305038086427-BrightHire-Screen-integration)                                  |
| 人工决策            | 评审和初筛都能由人推进／拒绝；AI 评级本身不执行去留。 [评审产品页](https://www.metaview.ai/application-review) · [初筛概览](https://support.metaview.ai/screening/overview)              | 更换阶段、归档、处理 offer 是不同操作。 [候选人详情](https://docs.ashbyhq.com/candidate-profile) · [Offer](https://docs.ashbyhq.com/offers-and-offer-letters)             | 招聘人员审阅后决定；不能从「双向数据同步」宣传推断所有处置按钮都存在。 [招聘人员体验](https://brighthire.com/ai-interviewer/recruiter-experience/)                                                       |
| ATS 同步            | 写回能力按 ATS、产品模块、权限而异；Greenhouse 明确是 ATS 数据的事实来源。 [集成](https://support.greenhouse.io/hc/en-us/articles/55720525030811-Metaview-integration)                   | 自身管理申请与招聘计划，也承接第三方面试记录。 [Metaview 集成](https://docs.ashbyhq.com/metaview)                                                                         | Screen 结果可回到 ATS；Inbound 另外支持阶段变化回写。 [Screen](https://brighthire.com/ai-interviewer/) · [Inbound](https://brighthire.com/application-review/)                                           |

## Metaview：从申请评审到初筛、真人面试与 ATS 决策

### Application Review：评估、反馈、决定分别存在

可以选择 ATS 岗位及某个阶段，也可直接上传简历。团队提供岗位信息、调整 ICP，再启动评审。ATS 模式默认选申请评审阶段，但可以选其他阶段；上传模式的决定留在 Metaview，不能假定后续连接 ATS 会追溯同步旧决定。 [评审概览](https://support.metaview.ai/application-review/overview) · [设置](https://support.metaview.ai/application-review/application-review-setup) · [FAQ](https://support.metaview.ai/application-review/faqs)

必须区分以下三类信息：

| 对象             | 官方可确认的名称或行为                                                                                                                                                                                                                                                                                                    | 解释边界                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 匹配结果         | 2026-09-08 官方流程文章使用 `Great / Good / Okay / Poor`。当前帮助页则写 `Strong match / Good match / Partial match / Low match / Inconclusive`。 [流程文章](https://www.metaview.ai/resources/blog/where-to-put-ai-screening-in-your-hiring-process) · [帮助页](https://support.metaview.ai/application-review/overview) | 两套文案同时可见，不能合成统一内部枚举，也不能断言变更时间。后者的无法判断可由缺简历、文件损坏或解析失败导致，不等于匹配度低。 |
| 人工校准反馈     | `Yes / Maybe / No` 及文字反馈可用于调整评估；修改 ICP 后会重评。 [概览](https://support.metaview.ai/application-review/overview)                                                                                                                                                                                          | 这是帮助校准 AI 的反馈，不能将其中否定值直接当成已拒绝申请。                                                                   |
| 评审版本生命周期 | `Draft → Evaluating → Active`；被新版替代后为 `Archived`。 [FAQ](https://support.metaview.ai/application-review/faqs)                                                                                                                                                                                                     | 明确属于每个 review version，不是候选人的招聘生命周期，也不是单份简历后台任务枚举。活跃表示评估已完成、可供人工查看。          |

人工选择推进或拒绝后，ATS 连接模式按集成能力写回；上传模式只保留本地决定。暂停 review 会停止新评价，恢复时处理仍在导入阶段的未评价申请；暂停期间已在 ATS 推进或拒绝的人不会重新评估。删除 review 被描述为归档 review，不应解释成拒绝其所有候选人。 [评审概览](https://support.metaview.ai/application-review/overview)

ATS 写入需要相应权限；不支持写回的集成不能靠按钮文案掩盖。拒绝原因和邮件模板来自 ATS，邮件是否发送取决于配置；因此「拒绝申请」与「发拒信」应作为关联但不同的结果理解。 [设置](https://support.metaview.ai/application-review/application-review-setup)

### AI Screening：进入阶段、加入初筛、发邀请、面试、评价、决定

Screen 是按岗位配置的一套面试及评分规则。连接 ATS 时分别配置导入、推进和拒绝阶段；**候选人进入导入阶段只会出现在未加入列表，不会因创建 Screen 就被联系**。加入可逐个、批量或自动执行，之后按配置发邀请。另一种模式是公开邀请链接，候选人登记姓名和邮箱后取得个人面试链接；同一 Screen 生命周期内不能混用两种来源模式。 [Screening 设置](https://support.metaview.ai/screening/setup)

已确认的界面概念如下。它们分属不同对象，不组成一条全局状态链：

| 层次       | 已确认名称／行为                                                                          | 来源及限制                                                                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 加入与邀请 | `Unenrolled`；Outreach 列出现 `Not invited`、`Invited`；另有打开时间。                    | 未发邀请也可能只是配置了延迟，邮件打开不证明参加面试。这里不是完整邀请状态枚举。 [设置](https://support.metaview.ai/screening/setup)                                                          |
| 执行       | 候选人开始对话、完成对话；断线或中止后可在 5 分钟内恢复，超过窗口则结束并共享已完成部分。 | 这是候选人侧行为，不将其翻译为未经证实的英文内部枚举。 [候选人指南](https://support.metaview.ai/screening/candidate-guide)                                                                    |
| 评价处理   | `Awaiting credits`。                                                                      | 已加入者即使余额不足仍能完成面试，评价可等待积分。因此面试完成与报告可用不是同一事件。 [积分说明](https://support.metaview.ai/screening/credits)                                              |
| 评价输出   | `Great / Good / Okay / Poor / Inconclusive`，附总体总结、逐题内容和转录证据。             | 是评分结果，不是运行状态或人工决定；无法判断也可能因面试过短或缺少回答。 [概览](https://support.metaview.ai/screening/overview) · [FAQ](https://support.metaview.ai/screening/screening-faqs) |
| 人工决定   | `Progress`、`Reject`。                                                                    | ATS 模式按预设目标写回；独立邀请模式只保存本地决定，拒信由招聘团队负责。 [概览](https://support.metaview.ai/screening/overview)                                                               |

评价来自转录内容。Screening 的评分卡是 AI 对候选人回答的评估；真人面试后的 ATS scorecard 辅助填写则是另一条工作流，不能用后者「主观字段留空」的约束否认 Screening 有评分能力。 [初筛概览](https://support.metaview.ai/screening/overview) · [Ashby scorecard 集成](https://support.metaview.ai/integrations/ats-integrations/ashby)

Notes 还可归档和恢复通话记录；归档保留内容、移出活跃列表，删除则不可恢复。这里操作的对象是 conversation，与评审版本被归档、申请被 ATS 归档是三种不同含义。 [Notes 概览](https://support.metaview.ai/notes/overview)

### 操作核查：哪些事情会真正改变申请

| 动作                           | 已确认行为与限定条件                                                                                                                                                                                                                                                               | 不能据此声称                                                        |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 推进／拒绝                     | 初筛由人查看结果后操作；ATS 模式使用配置的目标阶段。Greenhouse 写入前核查当前申请，避免旧操作覆盖 ATS 新变化。 [初筛概览](https://support.metaview.ai/screening/overview) · [Greenhouse 集成](https://support.greenhouse.io/hc/en-us/articles/55720525030811-Metaview-integration) | AI 得分高就自动推进；所有 ATS 支持相同动作。                        |
| 加入并邀请                     | 需确认邮箱、可用额度和已配置好的 Screen；退出 AI 初筛的人须先恢复参与，才能再次加入。 [FAQ](https://support.metaview.ai/screening/screening-faqs)                                                                                                                                  | 在 ATS 换阶段必定立即发出邀请。                                     |
| 退出 AI 初筛                   | 邀请可配置 opt-out 入口，退出后不再发后续邮件，不能继续加入，除非恢复参与。 [设置](https://support.metaview.ai/screening/setup)                                                                                                                                                    | 退出 AI 等于撤回整次岗位应聘；未找到这种自动映射证据。              |
| 逾期拒绝                       | 可显式启用 `Reject at deadline`，默认关闭；未按期完成才触发，不由答案或评分触发。 [设置](https://support.metaview.ai/screening/setup)                                                                                                                                              | 可以无条件宣称所有拒绝都必须逐次手动点击。                          |
| 延期／重开链接                 | `Extend deadline` 改单人截止时间并调整剩余提醒；链接过期后也可重新开放。 [FAQ](https://support.metaview.ai/screening/screening-faqs)                                                                                                                                               | 自动撤销已写入 ATS 的拒绝，或重开已归档的申请。                     |
| 重做面试                       | `Reset attempt` 删除上一场面试，让候选人使用邀请链接再做，并重新开放邀请和提醒邮件。 [FAQ](https://support.metaview.ai/screening/screening-faqs)                                                                                                                                   | 这是无损的 AI 报告重算；文档明确描述会移除先前面试。                |
| 重评                           | 修改已启用的面试计划后，要发布更新才影响候选人；更新计划并发布会重新生成评分卡。 [初筛概览](https://support.metaview.ai/screening/overview)                                                                                                                                        | 提供了逐人「AI 任务失败重试」按钮，或公开了其后台重试策略。         |
| 录用、撤销录用、申请回退／重开 | 所读 Metaview 文档未确认这些独立申请操作的 UI、权限或规则；需要在相应 ATS 中继续核查。 [已公开的 Screening 操作范围](https://support.metaview.ai/screening/overview) · [集成的数据范围](https://docs.ashbyhq.com/metaview)                                                         | 读取 offer、申请状态意味着 Metaview 自己支持创建 offer 或标记录用。 |

### ATS 同步不能只有一个「已同步」概念

| 集成或运行方式       | 已核实的行为                                                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Greenhouse           | Greenhouse 是 ATS 数据事实来源；Metaview 直接写回，随后按常规同步反映到本地。约每 30 分钟检查更新，处理可能更久。整体同步、单次阶段变化与反馈提交不能混为一谈。 [官方集成](https://support.greenhouse.io/hc/en-us/articles/55720525030811-Metaview-integration) |
| Greenhouse scorecard | Metaview 帮填事实内容；用户补主观评价并在 Greenhouse 提交，不通过此 Harvest v3 集成自动提交完成的评分卡。 [官方集成](https://support.greenhouse.io/hc/en-us/articles/55720525030811-Metaview-integration)                                                       |
| Ashby scorecard      | 匹配到带反馈表的面试后可在 Metaview 填写并提交；人工必须补总体推荐和其他必填项。自动生成草稿不等于自动提交。 [Metaview 官方集成](https://support.metaview.ai/integrations/ats-integrations/ashby)                                                               |
| Ashby 数据读取       | 官方集成列出申请、面试阶段、offer、反馈等资源，且在 Metaview 展示整体申请状态与拒绝类型／原因。这说明能读取上下文，不代表每项都有写入能力。 [Ashby 官方集成](https://docs.ashbyhq.com/metaview)                                                                 |
| Gem ATS              | 允许推进申请，但其 API 不支持拒绝申请，因此 Application Review 的拒绝不能回写。不能仅凭出现在支持名单中，就认为读写全部对称。 [Gem 专项文档](https://support.metaview.ai/integrations/ats-integrations/gem-ats)                                                 |
| 本地模式             | 上传简历的评审与独立邀请的初筛可保存本地决定；独立初筛无 ATS 阶段写回，也不自动发 ATS 拒信。 [评审设置](https://support.metaview.ai/application-review/application-review-setup) · [初筛设置](https://support.metaview.ai/screening/setup)                      |

产品页列出的支持名单比帮助页短；帮助页还明确指出部分集成仅能导入评审。因此本研究按具体集成说明判断能力，不将营销页名单当成永久、统一的功能矩阵。 [产品页 FAQ](https://www.metaview.ai/application-review) · [Application Review 设置](https://support.metaview.ai/application-review/application-review-setup)

## Ashby：完整 ATS 的阶段、结果与活动进度

### 数据对象与可确认状态

**同一个人可以对应多次岗位应聘。** Ashby 的候选人详情按 job consideration 展示阶段、反馈与归档；恢复误归档可以修改原应聘阶段，若想保留旧记录则再次考虑该人选。不能把一次岗位拒绝写成候选人永久终止。 [候选人详情](https://docs.ashbyhq.com/candidate-profile)

| 层次         | 官方定义                                                                                                                                                                                                              | 对建模的含义                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 申请整体状态 | `Lead / Active / Hired / Archived`，API 明确标为 enum。 [申请 API](https://developers.ashbyhq.com/reference/applicationinfo)                                                                                          | 是明确核实的 API 枚举；未包含单独的 Withdrawn，退出通过归档原因表达。   |
| 当前阶段     | 阶段有 ID、标题、计划和排序。API 对类型举例为 `Active / Archived / Hired / PreInterviewScreen / Offer / Lead`，该字段标为字符串，文案为举例。 [阶段 API](https://developers.ashbyhq.com/reference/interviewstagelist) | 不将这些例子冒充完整封闭枚举，也不把岗位自定义标题硬编码。              |
| 面试计划结构 | Lead、Application Review、Active、Offer、Completed 是帮助页的结构。活动面试阶段可配置；完成区仅含录用与归档。 [面试计划](https://docs.ashbyhq.com/interview-plans)                                                    | ATS 的 UI 可以将结果表现为终点阶段，同时 API 仍区分整体状态和当前阶段。 |
| 归档原因     | 类型为 `Rejected by Organization / Rejected by Candidate / Other`；具体原因由组织配置。 [归档原因](https://docs.ashbyhq.com/configuring-archive-reasons)                                                              | 公司拒绝、候选人退出、岗位关闭等需要可区分，不能全显示成「不合格」。    |
| AI 评价结果  | 每项条件判断满足、不满足或不能确定，支持查看理由、筛选和重新评价；人工平均分独立计算。 [AI 评审](https://docs.ashbyhq.com/ai-assisted-application-review)                                                             | AI 结论不是申请状态；公开材料没有给出全量 AI 运行任务状态。             |

### 阶段内状态回答「下一步该做什么」

Ashby 帮助页公开了活动状态和触发条件。以下保留重点英文显示名，其余用中文解释；完整显示名称见原表，**不是新增一套中文产品枚举**。 [活动状态原表](https://docs.ashbyhq.com/understanding-candidate-activity-statuses)

| 活动进度              | 何时出现或变化                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Needs Scheduling`    | 有待处理的面试／作业，尚未安排；排期流程还区分请求排期、发送预订链接、等待候选人时间、时间已提交等步骤。外部自行转发链接不自动触发平台发送状态。 |
| `Scheduled`           | 活动已排期；临时占位有独立显示和套餐条件。                                                                                                       |
| `Waiting on Feedback` | 预约面试时间已过后自动出现。它不是“已收到面试官结论”。                                                                                           |
| `Needs Decision`      | 面试或作业活动被标记完成后，下一步需要招聘决定。                                                                                                 |
| `In Stage Since`      | 没有更具体活动状态时，用当前阶段的停留时间提示。                                                                                                 |
| 测评／作业            | 另有等待测评、测评已提交、等待作业提交等活动进度；不等于申请推进。                                                                               |
| Offer                 | 另有待创建、待内部审批、待候选人接受、已接受和候选人拒绝等进度。                                                                                 |

同阶段多个活动并行时，顶层提示取流程进度较早的活动，例如一场已排期、另一场未排期，仍提示需要排期。取消面试或作废排期链接可回到待排期；删光活动可能回到阶段停留提示。因此活动状态会倒退，而当前招聘阶段未必改变。 [活动状态](https://docs.ashbyhq.com/understanding-candidate-activity-statuses)

### 推进、退出、录用和恢复的操作规则

| 动作               | 已核实的产品行为                                                                                                                                                                                                                                                                        |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 推进或换阶段       | 详情提供更换阶段；申请 API 接收目标阶段 ID，需要 `candidatesWrite`。转入归档类型阶段时必须给归档原因。没有“所有阶段只能前进一格”的公开约束。 [候选人详情](https://docs.ashbyhq.com/candidate-profile) · [更换阶段 API](https://developers.ashbyhq.com/reference/applicationchangestage) |
| 人工拒绝           | 归档本次岗位应聘，选原因，可加备注和立即／延时拒信。 [候选人详情](https://docs.ashbyhq.com/candidate-profile)                                                                                                                                                                           |
| 候选人退出         | 归档并选择候选人拒绝类原因；这是组织维护的原因体系，不是公开 API 中独立的申请状态。 [归档原因](https://docs.ashbyhq.com/configuring-archive-reasons)                                                                                                                                    |
| 误归档恢复         | 直接改回目标面试阶段；若是日后重新考虑且需保留旧归档记录，则创建新的岗位考虑记录。 [候选人详情](https://docs.ashbyhq.com/candidate-profile)                                                                                                                                             |
| 接受 offer 与录用  | 可配置接受 offer 后自动推进；也可在 offer 区增加背调等后置阶段。因此“接受 offer 必然立刻录用”不是通用规则，相关配置只在指定套餐开放。 [Offer 阶段配置](https://docs.ashbyhq.com/configuring-offer-stage-admin-settings)                                                                 |
| 候选人拒绝 offer   | 更新 offer 响应后会提示归档，但不会自动归档。拒绝 offer 与申请已终止是两个变化。 [Offer 操作](https://docs.ashbyhq.com/offers-and-offer-letters)                                                                                                                                        |
| 已录用后撤回／归档 | 先将人选从录用移回 Offer，详情才出现归档操作；必要时更新 offer 响应，再按原因归档。 [Offer 操作](https://docs.ashbyhq.com/offers-and-offer-letters)                                                                                                                                     |
| 换阶段与未交反馈   | 配置了相应默认行为时，换阶段会将未完成反馈标记完成并停止提醒；不能假定推进永远等待所有反馈。 [反馈配置](https://docs.ashbyhq.com/feedback-forms-and-interviews)                                                                                                                         |
| 自动拒绝           | 另有按申请表答案配置的规则，仅在提交申请时执行，不在任意面试阶段执行。不要将它与 AI 简历评级等同。 [自动拒绝](https://docs.ashbyhq.com/auto-reject-applications)                                                                                                                        |

Ashby 的重新评价是修改条件后的 AI 工作；取消、重新安排面试是活动工作；恢复申请是阶段／结果工作。三者不应共享一个含糊的「重试」按钮。前两者行为分别见 [AI 评审](https://docs.ashbyhq.com/ai-assisted-application-review) 和 [活动状态](https://docs.ashbyhq.com/understanding-candidate-activity-statuses)，恢复见 [候选人详情](https://docs.ashbyhq.com/candidate-profile)。

## BrightHire：相近 AI 面试产品的对照

选择 BrightHire 是因为它同时覆盖 AI 初筛与真人面试记录，并已有 Inbound 申请评审。官方 Inbound 页面描述从岗位要求生成规则、逐份评审、呈现依据，再由团队推进或结束申请并写回 ATS；它也不能只归类为录音工具。 [Inbound](https://brighthire.com/application-review/)

Screen 的公开流程是配置岗位问题及 rubric，审核面试内容，从 BrightHire 或 ATS 阶段变化邀请候选人，异步进行双向面试，返回转录、摘要、评分和录音供招聘人员查看。可在开始前进行练习及设备检查；练习不是正式面试失败后的重试功能。 [Screen](https://brighthire.com/ai-interviewer/) · [候选人体验](https://brighthire.com/ai-interviewer/candidate-experience/)

Greenhouse 的官方集成将其分为只总结，以及评价并生成 scorecard 两种模式；两者都由招聘团队决定推进或拒绝。在岗位面试计划中添加 Screen 测评后，使用 `Send Test` 发出，Greenhouse 展示进度，完成后通过 Interview Kit 中的 `View Report` 查看结果。**测评已提交只是报告可供评审，不等于申请已推进。** [Greenhouse–BrightHire Screen](https://support.greenhouse.io/hc/en-us/articles/44305038086427-BrightHire-Screen-integration)

| 待核查动作          | 本次能确认的范围                                                                                                                                                                                                                                         |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 推进／拒绝          | Screen 官方明确最终由人决定；Inbound 明确可回写阶段。未找到足以证明 Screen 在所有 ATS 内都拥有同一组处置按钮的文档。 [招聘人员体验](https://brighthire.com/ai-interviewer/recruiter-experience/) · [Inbound](https://brighthire.com/application-review/) |
| 退出／录用          | 未从所读 Screen 资料核实独立申请级动作及限制；不能借用 ATS 的状态作为 BrightHire 原生枚举。 [Screen 文档范围](https://brighthire.com/ai-interviewer/)                                                                                                    |
| 重开／重做／AI 重试 | 未检索到足够详细的官方帮助页确认可用按钮、谁可操作、是否保留旧面试、是否重新计费。候选人练习功能不足以回答这些问题。 [候选人体验](https://brighthire.com/ai-interviewer/candidate-experience/)                                                           |
| AI 处理状态         | 已确认有结果摘要和可选评价，未取得任务排队、失败、重跑的正式枚举；不能凭“转录→评分”的描述编造后台状态机。 [集成](https://support.greenhouse.io/hc/en-us/articles/44305038086427-BrightHire-Screen-integration)                                           |

## Metaview 题目配置补充

2026-11-07 再次核对 Screening Setup：Interview 按步骤组织，每步有标题、目标和题目；步骤及题目均可排序。每题分别配置提问形式、题干、可选追问、答案格式及评价标准（rubric）。答案格式中的 Text、Number、Date 等用于提取结构化答案，不等于候选人在面试前填写对应表单控件。[官方题目设置](https://support.metaview.ai/screening/setup#interview-the-plan-itself)

该页支持测试单题及完整面试，但没有将面试明确划分为独立的「先填表、再沟通」两阶段，也不足以证明存在独立的可复用题库。Sainoa 的题目菜单、表单题和沟通题属于本产品待明确的设计，不能将其写成 Metaview 已核实的固定流程。

## 实际流程示例：可配置的实例，不是固定官方枚举

### 示例一：先审简历，再 AI 初筛，最后真人面试

这是 Metaview 官方文章明确的默认安排。下列「技术面试」「综合面试」为示例岗位自定义名称；后半段 offer／录用由 Ashby 这类 ATS 管理，不表示 Metaview 有同名完整阶段。 [Metaview 流程文章](https://www.metaview.ai/resources/blog/where-to-put-ai-screening-in-your-hiring-process) · [Ashby 面试计划](https://docs.ashbyhq.com/interview-plans)

1. 团队在 ATS 建立岗位及流程，Metaview 读取岗位信息，团队确认 ICP。
2. 申请进入简历评审；AI 返回匹配依据，招聘人员决定是否推进。
3. 进入自定义的 AI 初筛阶段后，在 Screen 加入候选人并发送邀请。
4. 候选人完成初筛，AI 输出结果；招聘人员查看记录并推进到技术面试，或拒绝。
5. 在 ATS 安排技术／综合面试，Metaview 记录真人访谈；面试官审阅并提交反馈。
6. 招聘人员进入 offer 流程，完成必要审批和后置步骤，最终标记录用；不继续者归档并记录原因。

步骤 1–4 的能力见 [评审设置](https://support.metaview.ai/application-review/application-review-setup) 和 [初筛概览](https://support.metaview.ai/screening/overview)；步骤 5–6 见 [Ashby scorecard 集成](https://support.metaview.ai/integrations/ats-integrations/ashby) 和 [Offer 配置](https://docs.ashbyhq.com/configuring-offer-stage-admin-settings)。

同一时刻可以是「申请仍在 AI 初筛阶段、面试已完成、AI 评价等待积分、尚未人工决定」。另一人可能是「申请已推进、面试报告已存在、ATS 新状态尚未回流」。这两个组合由公开功能推导，用来解释各层独立，并非某产品的固定复合状态。 [初筛积分](https://support.metaview.ai/screening/credits) · [Greenhouse 同步](https://support.greenhouse.io/hc/en-us/articles/55720525030811-Metaview-integration)

### 示例二：先面试收集证据，再审阅完整申请

Metaview 官方文章也允许团队主动选择先给申请人初筛机会，再由人结合会话证据筛选。适用于部分能力从简历难以观察的岗位；这是配置策略，不是另一套固定产品阶段。应提前明确未完成初筛如何处理。 [官方两种安排](https://www.metaview.ai/resources/blog/where-to-put-ai-screening-in-your-hiring-process)

操作实现上须区分 ATS 连接和公开邀请链接：前者写回已关联的申请，后者的决定留在 Metaview，不能把「先发链接」自动理解成已经建立 ATS 申请并能写回。 [Screening 设置](https://support.metaview.ai/screening/setup)

### 示例三：真实客户的 BrightHire 初筛实践

BrightHire 发布的 Unanet 客户案例中，招聘人员先发说明并提供个人介绍视频，给候选人七天完成初筛，随后查看录音、搜索转录或使用对话工具检查结果，再由招聘人员决定。这里的七天是该客户做法，不能作为产品固定时限；案例也不能提供后台状态枚举。 [官方客户案例](https://brighthire.com/blog/included-health-and-unanet-screen-success-stories/)

## 对 Sainoa 的建议：产品设计判断，不是竞品事实

### 用分层信息组织详情页

建议以「某候选人对某岗位的这次应聘」为详情页主体。下面是模型职责划分，尚不是 API 或数据库最终方案：

| 信息     | 建议承担的职责                                                                                                                   | 建议放置位置             |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 当前阶段 | 简历评审、AI 初筛、真人面试、Offer 等；允许岗位流程配置，不以报告生成状态替代。                                                  | 页头和流程导航。         |
| 应聘结果 | 进行中、已录用、已拒绝、候选人退出；若采用统一关闭模型，则用关闭类型保留后三者的区别。选一种表达，不同时维护两套互相矛盾的真相。 | 页头明确标记。           |
| 面试执行 | 每场邀请及面试是否发出、开始、结束、取消；多轮面试独立存在。                                                                     | 面试活动或轮次卡片。     |
| AI 评价  | 本次任务是否运行、成功、失败，输出版本及理由；无法判断是结果质量，不直接当成技术失败。                                           | 报告／评价卡片。         |
| 人工决定 | 谁基于哪些材料做了什么决定，适用于哪次应聘和哪一轮。                                                                             | 决策区及活动历史。       |
| 外部同步 | 哪个目标系统、哪次动作已确认或仍需处理；没有 ATS 连接时不显示虚假的同步成功。                                                    | 动作结果提示和集成详情。 |

这些分层分别受到 Ashby 的申请／阶段拆分、Metaview 的等待评价状态及双模式决策路径启发；表中的 Sainoa 中文名称由本研究提出，未冒充官方枚举。 [Ashby API](https://developers.ashbyhq.com/reference/applicationinfo) · [Metaview 积分](https://support.metaview.ai/screening/credits) · [Screening 模式](https://support.metaview.ai/screening/setup)

### Toolbar 应突出招聘决定，活动卡片承担执行动作

| 用户当前要处理的事     | 建议主要动作                                                         | 设计含义                                                               |
| ---------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 审阅后决定是否继续     | 「推进到下一阶段」并展示目标阶段；另有「拒绝」和「记录候选人退出」。 | 不用含义不明的「通过」同时表示 AI 高分、人工推荐和阶段推进。           |
| 尚未安排 AI 面试       | 在面试卡片上提供「邀请面试」或「复制邀请链接」。                     | 进入初筛阶段与发出邀请是两件事；若支持自动邀请，配置中明确说明。       |
| 面试已结束、报告处理中 | 报告卡片显示处理进度，完成后提供查看报告。                           | 不因 AI 任务仍在运行，把申请本身改成「处理中」。                       |
| AI 评价失败            | 在失败任务上提供「重新评价」，说明使用的面试材料。                   | 不重新邀请候选人，不重置招聘阶段。属于建议，尚无竞品统一重试语义依据。 |
| 候选人需要再做一次     | 在对应面试上提供「重新面试」，明确旧记录怎样处理。                   | 与报告重算分开。Metaview 删除上一场的行为是证据，不是建议照搬。        |
| 完成录用决定           | 「标记录用」独立于 offer 发出／接受。                                | 若未来支持 offer 审批或背调，再把这些活动加入流程。                    |
| 已拒绝或已退出         | 可提供「重新开启」，明确恢复到哪个阶段；再次投递也可新建一次应聘。   | 恢复原记录与创建新流程应分清，保留历史含义。                           |

以上是 toolbar 的职责建议，不代表本次要实现所有动作或增加通用拦截规则。是否允许跳阶段、报告未生成时能否推进、录用后怎样撤销，都应由 Sainoa 自身业务定义；不能把未核实的竞品限制直接变成产品 guard。

优先确定三个产品口径：**「退出」是退出整次应聘还是只退出 AI 面试；「通过」究竟是评价还是推进；「重试」重跑的是 AI 任务还是候选人的面试。** 这三处不清楚，单纯调整按钮布局仍会保留状态歧义。

## 证据边界与仍需产品实测的项目

- **命名存在差异。** Metaview 的申请匹配等级在官方博客与帮助页中不同；未取得版本公告或租户 UI，不推断哪个名称在所有客户中生效。 [博客](https://www.metaview.ai/resources/blog/where-to-put-ai-screening-in-your-hiring-process) · [帮助页](https://support.metaview.ai/application-review/overview)
- **公开显示状态不等于后台枚举。** Metaview 的评审版本生命周期有明文，但 Screening 全量执行／AI 任务枚举未公开；BrightHire 的任务和处置状态证据更有限。Ashby 只有在 API 明确标 enum 时才作为枚举引用。 [评审 FAQ](https://support.metaview.ai/application-review/faqs) · [Screening FAQ](https://support.metaview.ai/screening/screening-faqs) · [Ashby API](https://developers.ashbyhq.com/reference/applicationinfo)
- **需要实测撤销的副作用。** Metaview 重开过期链接是否涉及已拒绝申请、重做后 ATS 已同步记录如何处理、重评分是否改变历史报告，本次资料不能完整回答。不要把重开链接、重做面试、重开应聘互相替代。 [Screening FAQ](https://support.metaview.ai/screening/screening-faqs)
- **需要实测动作资格与失败处理。** 未得到 Metaview／BrightHire 对所有终态候选人的按钮可见性、重复点击语义、单次同步失败后的重试入口和权限矩阵。文档没有列出，不代表产品必然没有。 [Metaview 已公开操作](https://support.metaview.ai/screening/setup) · [BrightHire 已公开集成](https://support.greenhouse.io/hc/en-us/articles/44305038086427-BrightHire-Screen-integration)
- **配置与集成优先于通用文案。** Ashby 的 offer 通用说明与可配置后置阶段要一起读；Metaview 的“人工决定”要结合逾期拒绝开关，支持 ATS 名单要结合每家写入能力。 [Offer 配置](https://docs.ashbyhq.com/configuring-offer-stage-admin-settings) · [Screening 设置](https://support.metaview.ai/screening/setup) · [Gem 集成](https://support.metaview.ai/integrations/ats-integrations/gem-ats)
- **没有将第三方连接器说明、招聘通用博客的步骤、或营销示意图当成内部状态定义。** 流程示例只组合已核实功能；Sainoa 建议是本文的设计判断。本次只写研究文档，不修改实现，也不作提交或推送。
