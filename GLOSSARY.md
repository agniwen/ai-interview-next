# Sainoa

本术语表记录 Sainoa 已确认的领域用语。

## Language

**工作区（Workspace）**：
用户在 Sainoa 中创建或加入的工作单元，也是业务数据的归属与隔离边界。同一用户可以创建或加入多个工作区；不同工作区的成员不会因此共享业务数据。
_Avoid_：工作台（用于指代页面布局时）

**初始工作区（Initial workspace）**：
用户注册成功后自动为其创建的工作区，初始只有该用户，之后可以邀请其他用户加入。它与其他工作区具有相同的协作能力，不是一种永久仅本人可用的工作区类型。
_Avoid_：个人工作区、永久私有工作区

**工作区成员（Workspace member）**：
用户在某个工作区中的参与身份，具有该工作区内的角色。同一用户在不同工作区中的成员身份和角色彼此独立。
_Avoid_：工作区账号

**工作区所有者（Owner）**：
拥有工作区最高管理权限的成员，工作区创建者初始担任此角色。一个工作区可以有多个所有者，存在期间至少保留一个；工作区删除及所有权转让仅由所有者执行。
_Avoid_：创建者（用于指代当前所有权时）

**工作区管理员（Admin）**：
可以管理工作区设置及成员的成员角色。
_Avoid_：系统管理员

**普通成员（Member）**：
参与工作区业务工作的成员角色，不具有工作区设置及成员管理权限。
_Avoid_：访客

**工作区邀请（Workspace invitation）**：
向指定邮箱发出的工作区加入邀请，受邀者使用对应邮箱登录并接受后成为成员。
_Avoid_：公开加入链接

**当前工作区（Current workspace）**：
用户当前页面所处的工作区，由该页面 URL 中的工作区标识确定。不同标签页可以处于不同工作区。
_Avoid_：全局当前工作区

**最后激活的工作区（Last activated workspace）**：
用户最近一次激活的工作区，用作登录后没有指定工作区目标时的入口。它不改变其他已打开页面的当前工作区。
_Avoid_：默认工作区、初始工作区（用于指代最近使用的工作区时）

**候选人（Candidate）**：
在一个工作区内参与招聘的人。同一个人可以有多份简历，并参与多个岗位的招聘流程。

**简历（Resume）**：
候选人提交的职业与教育经历文件，独立于岗位保存。同一个候选人可以在不同时间提交不同的简历。

**简历头像（Resume Avatar）**

从某一份简历首页提取的候选人照片，属于该简历版本。

**简历解析结果（Resume Parse Result）**：
一份简历的原文转录及从中提取的身份、联系方式和履历事实。它反映提交时简历上的内容，候选人档案记录当前采用的信息。

**简历上传批次（Resume Upload Batch）**：
用户一次发起的一组简历上传。批次汇总进度，每份简历有自己的上传和处理结果。

**简历处理尝试（Resume Processing Attempt）**：
一次简历文本提取、结构化或应聘岗位评价的执行。每次尝试有独立的输入和结果。

**应聘记录（Application）**：
候选人参与某个岗位的一次招聘流程，记录该次应聘的进度和结果。

**应聘材料（Application Resume）**：
某次应聘所采用的简历版本。

**岗位评价（Application Evaluation）**：
针对某次应聘，依据所采用的简历版本和岗位要求生成的评价。

**应聘操作日志（Application Activity）**：
某条应聘发生的业务操作记录，包含发生时间、发起人、动作和结果。执行者可以是招聘人员、候选人或系统。

**面试阶段（Interview Stage）**：
一次应聘中开展面试的招聘阶段，包含该次应聘的多个面试轮次。

**面试轮次（Interview Round）**：
一次应聘中的第几轮面试，以轮次序号标识。初面、复面、终面等描述可用面试标签表达。

**面试实际开始（Interview Start）**：
一轮面试正式进入沟通的业务事件。AI 面试由候选人完成准备后主动开始；真人面试由候选人或指定面试官首次入房开始。

**面试正式结束（Interview Completion）**：
本轮访谈正式终止的业务事件。AI 面试可由候选人主动结束或由面试官 Agent 执行；真人面试由指定面试官执行。暂时离开不属于正式结束。

**面试续接（Interview Reconnection）**：
参加者在刷新页面或连接中断后返回仍在进行的同一轮面试，不构成一次新的开始。

**面试官（Interviewer）**：
创建面试时指定的主持者，可以是系统中的用户，也可以是面试官 Agent；前者对应真人面试，后者对应 AI 面试。

**面试官 Agent（Interviewer Agent）**：
具有名称、说明和提示词的可复用面试官配置，可用于不同的 AI 面试。

**面试标签（Interview Tag）**：
为面试自由填写的描述性标记，可表达面试侧重点或初面、复面等称呼。

**面试邀请链接（Interview Invitation Link）**：
某轮面试的参加入口，区分候选人链接与面试官链接。候选人链接对应本次应聘的这一轮面试。

**入场截止时间（Join Deadline）**：
某轮面试停止接受入场的时间。到期不强制结束已在进行的面试。

**面试材料快照（Interview Material Snapshot）**：
某轮面试实际开始时采用的招聘材料副本，作为回看本轮面试及评价依据的历史记录。后续修改招聘流程绑定的材料不改变该快照。

**面试官配置快照（Interviewer Configuration Snapshot）**：
某轮 AI 面试实际开始时采用的面试官 Agent 配置副本。后续修改可复用的 Agent 配置不改变本轮所用配置。

**表单题（Form Question）**：
由候选人在页面表单中填写答案的面试题，用于沟通前收集信息。

**沟通题（Conversation Question）**：
在面试沟通中由面试官提问、候选人口头回答的面试题，可通过追问深入了解候选人的经历和判断。

**题套（Question Set）**：
具有名称、说明和内部题目顺序的可复用题目集合，分为表单题套和沟通题套。题套可默认适用于多个岗位，同一岗位也可默认使用多套题。

**面试题目快照（Interview Question Snapshot）**：
候选人首次进入某轮 AI 面试页面时固定的题目内容与顺序，由本轮所选题套合并形成。后续访问沿用该内容，不受题库修改影响。

**面试评价（Interview Evaluation）**：
针对某轮面试表现形成的正式评价，由结论和整体评价组成，与普通留言区分。AI 面试结论为通过或不通过；真人面试还可为待定。
A formal assessment of an interview round, consisting of a verdict and overall evaluation, distinct from ordinary comments. AI verdicts are pass or fail; human interviews also allow pending.

**面试整体评价（Overall Interview Evaluation）**：
代表某轮面试整体判断的评价。真人面试只有一位面试官时采用该面试官的评价；有多位面试官时按正式提交时间采用首个非待定评价，所有人均提交待定时整体也为待定。

**面试评价确认人（Interview Evaluation Reviewer）**：
负责填写或审阅 AI 面试评价并确认其结论的工作区成员；未指定时，可由任一工作区成员承担。
A workspace member who writes or reviews an AI interview evaluation and confirms its verdict; when unassigned, any workspace member may take this role.
