"""采集与证据独立于语音模型，原文引用不会因上下文截断而丢失。
Collection and evidence remain independent of voice models and context truncation.
"""
from typing import Literal
from pydantic import BaseModel, Field
from livekit.agents import ToolError


class CollectionPoint(BaseModel):
    id: str
    label: str


class PlannedQuestion(BaseModel):
    id: str
    code: str
    content: str
    points: list[CollectionPoint]


class InterviewPlan(BaseModel):
    version: Literal[1] = 1
    questions: list[PlannedQuestion]


class TranscriptTurn(BaseModel):
    id: str
    role: Literal["user", "assistant"]
    text: str
    at: int
    interrupted: bool = False


class Evidence(BaseModel):
    turnId: str
    quote: str


class CollectedAnswer(BaseModel):
    pointId: str
    status: Literal["answered", "declined", "unknown", "insufficient"]
    summary: str
    evidence: list[Evidence]


class AskedQuestion(BaseModel):
    questionId: str
    evidence: list[Evidence]


class TokenUsage(BaseModel):
    inputTokens: int = 0
    cachedInputTokens: int = 0
    outputTokens: int = 0


class InterviewProgress(BaseModel):
    version: Literal[1] = 1
    revision: int = 0
    answers: list[CollectedAnswer] = Field(default_factory=list)
    asked: list[AskedQuestion] = Field(default_factory=list)
    summary: str = ""
    endReason: Literal["completed", "candidate_requested", "interrupted"] | None = None
    finalized: bool = False
    usage: TokenUsage = Field(default_factory=TokenUsage)


class SavedLedger(BaseModel):
    plan: InterviewPlan
    progress: InterviewProgress


class PlanProposal(BaseModel):
    question: str = Field(description="清单短编号，如 q1")
    points: list[str] = Field(min_length=1, max_length=8, description="从该题明确目标拆出的必要事实要点，通常 1 至 4 项，不添加自己的考核要求")


class AnswerProposal(BaseModel):
    point: str = Field(description="采集点编号，如 q1.p1")
    status: Literal["answered", "declined", "unknown", "insufficient"]
    summary: str = Field(min_length=1, max_length=3000, description="该点完整事实摘要，合并已有事实；更正以新说法为准，不虚构或转述内部缺口")
    quotes: list[str] = Field(min_length=1, max_length=20, description="候选人原文的连续子串，可省略末尾标点，绝不自行补句号或替换标点；不能引用简历、面试官或自己。pending_transcript 时从 get_interview_state 复制准确片段再提交")


class AskedProposal(BaseModel):
    question: str = Field(description="已经实际问过的题号，如 q1")
    quote: str = Field(min_length=1, description="刚才自己实际说出的提问原文，不是计划说的话")


class InterviewLedger:
    def __init__(self, saved: SavedLedger | None = None, turns: list[TranscriptTurn] = ()) -> None:
        self.plan = saved.plan if saved else None
        self.progress = saved.progress if saved else InterviewProgress()
        self.turns = {turn.id: turn for turn in turns}
        self.pending: dict[str, AnswerProposal] = {}
        self.pending_asked: dict[str, AskedProposal] = {}

    def observe(self, turn: TranscriptTurn) -> None:
        self.turns[turn.id] = turn
        self.resolve()

    def record(self, updates: list[AnswerProposal], asked: list[AskedProposal]) -> None:
        points = {p.id for q in self.plan.questions for p in q.points}
        codes = {q.code for q in self.plan.questions}
        if any(update.point not in points for update in updates) or any(item.question not in codes for item in asked):
            raise ToolError("请使用 get_interview_state 中的有效题号和采集点编号。")
        # 一次回答可覆盖多题；省略的点保留，补充和更正只修改明确指定的点。
        # One answer may cover several questions; omitted points remain and corrections affect only named points.
        self.pending.update({update.point: update for update in updates})
        self.pending_asked.update({item.question: item for item in asked})
        self.resolve()

    def evidence(self, quotes: list[str], role: str) -> list[Evidence]:
        evidence = []
        turns = sorted(self.turns.values(), key=lambda turn: (turn.at, turn.id), reverse=True)
        for quote in quotes:
            source = next((turn for turn in turns if turn.role == role and quote in turn.text and (role == "user" or not turn.interrupted)), None)
            if source is None:
                return []
            evidence.append(Evidence(turnId=source.id, quote=quote))
        return evidence

    def resolve(self) -> None:
        # Realtime 可能先调用工具再发最终转写；待关联记录不能冒充已有原文证据。
        # Realtime may call tools before final transcription arrives; pending records are not verified transcript evidence.
        answers = {answer.pointId: answer for answer in self.progress.answers}
        for point, proposal in list(self.pending.items()):
            evidence = self.evidence(proposal.quotes, "user")
            if evidence:
                answers[point] = CollectedAnswer(pointId=point, status=proposal.status, summary=proposal.summary, evidence=evidence)
                del self.pending[point]
        self.progress.answers = list(answers.values())
        questions = {q.code: q.id for q in self.plan.questions} if self.plan else {}
        asked = {item.questionId: item for item in self.progress.asked}
        for code, proposal in list(self.pending_asked.items()):
            evidence = self.evidence([proposal.quote], "assistant")
            if evidence:
                asked[questions[code]] = AskedQuestion(questionId=questions[code], evidence=evidence)
                del self.pending_asked[code]
        self.progress.asked = list(asked.values())

    def state(self, *, details: bool = False) -> dict:
        answers = {answer.pointId: answer for answer in self.progress.answers}
        return {
            "version": 1,
            "questions": [{
                "id": q.code,
                "points": [{"id": p.id, "label": p.label, "status": "pending_transcript" if p.id in self.pending else answers[p.id].status if p.id in answers else "missing",
                    "summary": answers[p.id].summary if details and p.id in answers else answers[p.id].summary[:220] if p.id in answers else ""} for p in q.points],
            } for q in self.plan.questions] if self.plan else [],
            "pending": list(self.pending),
        }

    def missing(self) -> list[str]:
        recorded = {answer.pointId for answer in self.progress.answers}
        return [point.id for question in self.plan.questions for point in question.points if point.id not in recorded or point.id in self.pending]
