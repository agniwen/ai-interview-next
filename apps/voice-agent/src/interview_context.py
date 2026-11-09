from interview_progress import SavedLedger, TranscriptTurn
# 这里是 Python 与业务 API 的数据边界：校验版本化载荷，再把类型明确的材料交给 Agent。
# This is the Python/API data boundary: validate versioned payloads before passing typed materials to the Agent.
from typing import Any, Literal

import aiohttp
from pydantic import BaseModel, Field, HttpUrl


class DispatchContext(BaseModel):
    # 专属调度凭证只用于读取和结束本轮面试，不是候选人的邀请令牌。
    # This dispatch credential authorizes context reads and completion for one round; it is not the candidate invitation token.
    version: Literal[1]
    contextUrl: HttpUrl
    contextToken: str = Field(pattern=r"^[a-f0-9]{64}$")
    mode: Literal["human_transcription"] | None = None


class Candidate(BaseModel):
    id: str
    name: str


class Job(BaseModel):
    id: str
    title: str
    requirements: str
    internalCriteria: str


class Interviewer(BaseModel):
    id: str
    name: str
    description: str
    prompt: str


class Resume(BaseModel):
    id: str
    markdown: str | None
    parsedProfile: dict[str, Any] | None


class FormQuestion(BaseModel):
    type: Literal["text", "single_choice", "multiple_choice"]
    content: str
    description: str
    options: list[str] = Field(default_factory=list)


class ConversationQuestion(BaseModel):
    # 评价标准与追问方向属于面试官内部材料，不作为候选人可见的题目说明。
    # Evaluation criteria and follow-up directions are private interviewer materials, not candidate-facing question descriptions.
    content: str
    difficulty: Literal["easy", "medium", "hard"]
    evaluationCriteria: str
    evaluationFocus: str
    followUpDirections: str


class FormItem(BaseModel):
    # 快照题目 ID 将表单答案与本轮题目关联，不依赖后来可能被编辑的题库。
    # Snapshot item IDs associate answers with this round's questions, independently of later question-bank edits.
    id: str
    question: FormQuestion


class ConversationItem(BaseModel):
    id: str
    question: ConversationQuestion


class Questions(BaseModel):
    version: Literal[1]
    form: list[FormItem]
    conversation: list[ConversationItem]


class FormAnswers(BaseModel):
    version: Literal[1]
    # 文本题保存字符串，选择题保存从零开始的选项索引；多选题使用索引数组。
    # Text answers are strings; choice answers use zero-based option indexes, with lists for multiple selections.
    answers: dict[str, str | int | list[int] | None]


class Snapshot(BaseModel):
    # API 在正式开始时固定这些材料，重连继续使用同一份证据和面试官配置。
    # The API freezes these materials at formal start; reconnects reuse the same evidence and interviewer configuration.
    version: Literal[1]
    candidate: Candidate
    job: Job
    interviewer: Interviewer
    resumes: list[Resume]
    questions: Questions
    form: FormAnswers


class InterviewContext(BaseModel):
    version: Literal[1]
    interviewId: str
    roomName: str
    participantIdentity: str
    startedAt: str
    content: Snapshot
    ledger: SavedLedger | None = None
    turns: list[TranscriptTurn] = Field(default_factory=list)


class InterviewSessionClient:
    def __init__(self, metadata: str) -> None:
        # 调度输入只在此入口校验一次；后续请求复用已解析的 URL 和凭证。
        # Validate dispatch input once at this entry point; later requests reuse the parsed URL and credential.
        self._dispatch = DispatchContext.model_validate_json(metadata)

    @property
    def is_human_transcription(self) -> bool:
        return self._dispatch.mode == "human_transcription"

    async def read_context(self) -> str:
        # 固定请求目标，不跟随重定向；HTTP 失败和载荷不符合契约都会阻止会话启动。
        # Keep the request target fixed without redirects; HTTP or payload-contract failures prevent session startup.
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as http:
            async with http.get(
                str(self._dispatch.contextUrl),
                headers={"Authorization": f"Bearer {self._dispatch.contextToken}"},
                allow_redirects=False,
            ) as response:
                response.raise_for_status()
                return await response.text()

    async def load(self) -> InterviewContext:
        return InterviewContext.model_validate_json(await self.read_context())

    async def post(self, action: str, payload: dict) -> dict:
        # 同一轮次的凭证只在服务端通信中使用，永不加入模型上下文。
        # The round credential is used only for server requests, never model context.
        async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=20)) as http:
            async with http.post(
                str(self._dispatch.contextUrl).rsplit("/", 1)[0] + "/" + action,
                headers={"Authorization": f"Bearer {self._dispatch.contextToken}"},
                json=payload,
                allow_redirects=False,
            ) as response:
                response.raise_for_status()
                return await response.json()

    async def finish(self, reason: str) -> None:
        await self.post("end", {"version": 1, "reason": reason})
