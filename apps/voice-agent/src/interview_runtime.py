"""记录运行事件并发布恢复状态；连接重试和历史恢复由 Qwen 适配器负责。
Record runtime events and publish recovery status while the Qwen adapter owns connection recovery.
"""
import asyncio
import logging
import time
import uuid
from collections.abc import Callable

from livekit import rtc
from livekit.agents import llm
from qwen_realtime import RealtimeModel

from interview_context import InterviewSessionClient

logger = logging.getLogger("interview.runtime")


class ObservedRealtimeModel(RealtimeModel):
    def __init__(self, *, on_connection_event: Callable[..., None] = lambda *args, **kwargs: None, **kwargs):
        super().__init__(**kwargs)
        self.on_connection_event = on_connection_event

    def session(self, *, turn_detection_disabled: bool = False):
        session = super().session(turn_detection_disabled=turn_detection_disabled)
        attempts = 0

        @session.on("error")
        def on_error(event: llm.RealtimeModelError):
            nonlocal attempts
            if event.recoverable:
                attempts += 1
            self.on_connection_event(
                "realtime_reconnecting" if event.recoverable else "realtime_failed",
                reason=type(event.error).__name__, attempt=attempts, recoverable=event.recoverable,
            )

        @session.on("session_reconnected")
        def on_reconnected(_):
            nonlocal attempts
            # 原生定期换连接也触发此事件，不能误算成网络故障。
            # Native session rotation emits this event too; do not count it as a network failure.
            self.on_connection_event("realtime_reconnected" if attempts else "realtime_rotated", attempt=attempts, recoverable=True)
            attempts = 0

        return session


class InterviewRuntime:
    def __init__(self, client: InterviewSessionClient, run_id: str, participant: rtc.LocalParticipant):
        self.client = client
        self.run_id = run_id
        self.participant = participant
        self.pending = []
        self.tasks: set[asyncio.Task] = set()
        self.lock = asyncio.Lock()

    def record(self, kind: str, *, reason: str | None = None, attempt: int | None = None, recoverable: bool | None = None):
        self.pending.append({
            "id": str(uuid.uuid4()), "runId": self.run_id, "at": round(time.time() * 1000),
            "content": {"version": 1, "kind": kind, "reason": reason, "attempt": attempt, "recoverable": recoverable},
        })
        self._track(asyncio.create_task(self.flush()))
        states = {"realtime_reconnecting": "reconnecting", "realtime_reconnected": "ready", "realtime_failed": "failed", "agent_ready": "ready"}
        if kind in states:
            self._track(asyncio.create_task(self.participant.set_attributes({"interview.connection": states[kind]})))

    def _track(self, task: asyncio.Task):
        self.tasks.add(task)
        task.add_done_callback(self._done)

    def _done(self, task: asyncio.Task):
        self.tasks.discard(task)
        if not task.cancelled() and task.exception():
            # 只记录错误类别，避免把供应商载荷或凭证写入运行记录。
            # Log error classes only, keeping provider payloads and credentials out of runtime records.
            logger.error("Interview runtime write failed: %s", type(task.exception()).__name__)

    async def flush(self):
        async with self.lock:
            while self.pending:
                batch = self.pending[:50]
                await self.client.post("events", {"version": 1, "events": batch})
                del self.pending[:len(batch)]

    async def close(self):
        if self.tasks:
            await asyncio.gather(*list(self.tasks), return_exceptions=True)
        await self.flush()
