"""用真实采集实现验证跨题回答、转写延迟、更正及缺项，不复制业务算法。
Exercise the real collection implementation for cross-question answers, late transcripts, corrections and missing points.
"""
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from interview_progress import AnswerProposal, AskedProposal, InterviewLedger, InterviewPlan, TranscriptTurn


def ledger():
    value = InterviewLedger()
    value.plan = InterviewPlan.model_validate({"version": 1, "questions": [
        {"id": "one", "code": "q1", "content": "项目经历", "points": [{"id": "q1.p1", "label": "负责内容"}]},
        {"id": "two", "code": "q2", "content": "离职原因", "points": [{"id": "q2.p1", "label": "原因"}]},
    ]})
    return value


class ProgressTests(unittest.TestCase):
    def test_cross_question_answer_resolves_after_transcript_and_correction_preserves_other_points(self):
        value = ledger()
        value.record([
            AnswerProposal(point="q1.p1", status="answered", summary="订单接口", quotes=["我负责订单接口"]),
            AnswerProposal(point="q2.p1", status="answered", summary="项目停止", quotes=["后来项目停了"]),
        ], [])
        self.assertEqual(value.missing(), ["q1.p1", "q2.p1"])
        value.observe(TranscriptTurn(id="u1", role="user", text="我负责订单接口，后来项目停了。", at=10))
        self.assertEqual(value.missing(), [])
        self.assertEqual(value.progress.answers[0].evidence[0].turnId, "u1")
        value.observe(TranscriptTurn(id="u2", role="user", text="更正一下，是支付接口。", at=20))
        value.record([AnswerProposal(point="q1.p1", status="answered", summary="支付接口", quotes=["是支付接口"])], [])
        self.assertEqual([answer.summary for answer in value.progress.answers], ["支付接口", "项目停止"])
        self.assertEqual(value.progress.answers[0].evidence[0].turnId, "u2")

    def test_interviewer_words_cannot_be_used_as_candidate_evidence(self):
        value = ledger()
        value.observe(TranscriptTurn(id="a1", role="assistant", text="你做过订单接口吗？", at=1))
        value.record([AnswerProposal(point="q1.p1", status="answered", summary="订单接口", quotes=["订单接口"])], [])
        self.assertEqual(value.progress.answers, [])

    def test_interrupted_prompt_is_not_marked_asked_and_refusal_is_distinct_from_an_answer(self):
        value = ledger()
        value.observe(TranscriptTurn(id="a1", role="assistant", text="你为什么离职", at=1, interrupted=True))
        value.record([], [AskedProposal(question="q2", quote="为什么离职")])
        self.assertEqual(value.progress.asked, [])
        value.observe(TranscriptTurn(id="u1", role="user", text="不方便说离职原因。", at=2))
        value.record([AnswerProposal(point="q2.p1", status="declined", summary="不便透露", quotes=["不方便说离职原因"])], [])
        self.assertEqual(value.progress.answers[0].status, "declined")
        self.assertEqual(value.missing(), ["q1.p1"])
