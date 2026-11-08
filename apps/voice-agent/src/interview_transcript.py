"""向候选人发布有开口时间的转写，并在重新入房时恢复消息。
Publish speech-timed transcripts and restore messages when the candidate rejoins.
"""
import asyncio
import logging
import uuid

from livekit import rtc
from livekit.agents import llm
from interview_progress import TranscriptTurn

logger = logging.getLogger("interview.transcript")


class InterviewTranscriptPublisher:
    def __init__(self, participant: rtc.LocalParticipant, candidate_identity: str):
        self.participant = participant
        self.candidate_identity = candidate_identity
        self.tasks: set[asyncio.Task] = set()

    def publish_user(self, item: llm.ChatMessage):
        if item.role == "user" and item.text_content:
            self._track(self._send(item.text_content, self.candidate_identity, {
                "lk.segment_id": f"ordered-user-{item.id}",
                "interview.user_turn_started_at_ms": str(round(item.created_at * 1000)),
            }))

    def replay(self, turns: list[TranscriptTurn]):
        self._track(self._replay(list(turns)))

    async def _replay(self, turns: list[TranscriptTurn]):
        batch = uuid.uuid4().hex
        for index, turn in enumerate(sorted(turns, key=lambda turn: (turn.at, turn.id))):
            sender = self.candidate_identity if turn.role == "user" else self.participant.identity
            await self._send(turn.text, sender, {
                "lk.segment_id": f"replay-{batch}-{turn.id}",
                "interview.replay_batch": batch,
                "interview.replay_index": str(index),
                "interview.replay_count": str(len(turns)),
            })

    async def _send(self, text: str, sender: str, attributes: dict[str, str]):
        # RoomIO 的用户转写只有到达时间，额外发布实际开口时间供前端按对话顺序排列。
        # RoomIO user transcripts carry arrival time; publish speech-start metadata for causal ordering.
        writer = await self.participant.stream_text(
            topic="lk.transcription", sender_identity=sender,
            destination_identities=[self.candidate_identity],
            attributes={"lk.transcription_final": "true", **attributes},
        )
        await writer.write(text)
        await writer.aclose()

    def _track(self, coroutine):
        task = asyncio.create_task(coroutine)
        self.tasks.add(task)
        task.add_done_callback(self._done)

    def _done(self, task: asyncio.Task):
        self.tasks.discard(task)
        if not task.cancelled() and task.exception():
            logger.error("Interview transcript publish failed: %s", type(task.exception()).__name__)

    async def close(self):
        if self.tasks:
            await asyncio.gather(*list(self.tasks), return_exceptions=True)
