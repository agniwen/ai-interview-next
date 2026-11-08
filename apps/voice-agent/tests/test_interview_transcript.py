"""验证正式消息发布器的开口时间与重连快照。
Verify speech-start timing and reconnect snapshots through the production publisher.
"""
import sys
import unittest
from pathlib import Path
from unittest.mock import AsyncMock
from livekit.agents import llm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from interview_transcript import InterviewTranscriptPublisher
from interview_progress import TranscriptTurn


class TranscriptTests(unittest.IsolatedAsyncioTestCase):
    async def test_publishes_original_speech_time_and_candidate_identity(self):
        participant = AsyncMock()
        publisher = InterviewTranscriptPublisher(participant, "candidate")
        publisher.publish_user(llm.ChatMessage(id="user-1", role="user", content=["我的回答"], created_at=1000.125))
        await publisher.close()
        kwargs = participant.stream_text.call_args.kwargs
        self.assertEqual(kwargs["sender_identity"], "candidate")
        self.assertEqual(kwargs["destination_identities"], ["candidate"])
        self.assertEqual(kwargs["attributes"]["interview.user_turn_started_at_ms"], "1000125")
        participant.stream_text.return_value.write.assert_awaited_once_with("我的回答")
        participant.stream_text.return_value.aclose.assert_awaited_once()

    async def test_replay_keeps_causal_order_and_repeated_answers(self):
        participant = AsyncMock()
        participant.identity = "interviewer"
        publisher = InterviewTranscriptPublisher(participant, "candidate")
        publisher.replay([
            TranscriptTurn(id="reply", role="assistant", text="继续", at=3000, interrupted=False),
            TranscriptTurn(id="answer", role="user", text="可以", at=2000, interrupted=False),
            TranscriptTurn(id="repeat", role="user", text="可以", at=4000, interrupted=False),
        ])
        await publisher.close()
        self.assertEqual([call.args[0] for call in participant.stream_text.return_value.write.await_args_list], ["可以", "继续", "可以"])
        calls = participant.stream_text.await_args_list
        self.assertEqual([call.kwargs["sender_identity"] for call in calls], ["candidate", "interviewer", "candidate"])
        self.assertEqual([call.kwargs["attributes"]["interview.replay_index"] for call in calls], ["0", "1", "2"])
        self.assertEqual(len({call.kwargs["attributes"]["interview.replay_batch"] for call in calls}), 1)
        self.assertTrue(all(call.kwargs["attributes"]["interview.replay_count"] == "3" for call in calls))
