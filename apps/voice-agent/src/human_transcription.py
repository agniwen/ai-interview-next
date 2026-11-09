"""分别转录真人参会者的麦克风。
Transcribe each human participant's microphone separately.
"""

import asyncio
import logging
import time
from uuid import uuid4

import aiohttp
from livekit import rtc
from livekit.agents import AutoSubscribe, JobContext, inference, stt

from interview_context import InterviewSessionClient

logger = logging.getLogger(__name__)


class HumanTranscript:
    def __init__(self, room: rtc.Room, client: InterviewSessionClient):
        self.room = room
        self.client = client
        self.pending: list[dict] = []
        self.save_lock = asyncio.Lock()

    async def publish(self, text: str, at: int, participant: rtc.RemoteParticipant) -> None:
        turn = {
            "at": at,
            "id": uuid4().hex,
            "interrupted": False,
            "role": "user" if participant.attributes["role"] == "candidate" else "assistant",
            "speakerName": participant.name or participant.identity,
            "text": text,
        }
        self.pending.append(turn)
        await asyncio.gather(self.send(turn, participant.identity), self.save())

    async def send(self, turn: dict, identity: str) -> None:
        try:
            writer = await self.room.local_participant.stream_text(
                topic="lk.transcription",
                sender_identity=identity,
                stream_id=turn["id"],
                attributes={
                    "lk.segment_id": turn["id"],
                    "lk.transcription_final": "true",
                    "interview.speaker_name": turn["speakerName"],
                    "interview.spoken_at_ms": str(turn["at"]),
                },
            )
            await writer.write(turn["text"])
            await writer.aclose()
        except Exception as error:
            logger.warning("Human transcript delivery failed: %s", type(error).__name__)

    async def save(self) -> None:
        async with self.save_lock:
            while self.pending:
                batch = self.pending[:100]
                try:
                    await self.client.post("turns", {"turns": batch, "version": 1})
                except (aiohttp.ClientError, TimeoutError) as error:
                    logger.warning("Human transcript write failed: %s", type(error).__name__)
                    return
                del self.pending[:len(batch)]


async def transcribe(audio, model, participant, transcript) -> None:
    origin = time.time()
    async with model.stream() as speech:
        async def feed():
            async for event in audio:
                speech.push_frame(event.frame)
            speech.end_input()

        async def receive():
            async for event in speech:
                if event.type == stt.SpeechEventType.FINAL_TRANSCRIPT:
                    sentence = event.alternatives[0]
                    if text := sentence.text.strip():
                        await transcript.publish(text, round((origin + sentence.start_time) * 1000), participant)

        async with asyncio.TaskGroup() as tasks:
            tasks.create_task(feed())
            tasks.create_task(receive())


async def run_human_transcription(ctx: JobContext, client: InterviewSessionClient) -> None:
    try:
        await client.read_context()
    except aiohttp.ClientResponseError as error:
        if error.status != 404:
            raise
        ctx.shutdown(reason="human interview unavailable")
        return
    room = ctx.room
    model = inference.STT.from_model_string("deepgram/nova-3:multi")
    transcript = HumanTranscript(room, client)
    active: dict[str, rtc.AudioStream] = {}
    tasks: set[asyncio.Task] = set()

    def run(coro):
        task = asyncio.create_task(coro)
        tasks.add(task)
        task.add_done_callback(tasks.discard)

    async def capture(sid, audio, participant):
        try:
            await transcribe(audio, model, participant, transcript)
        except Exception as error:
            logger.warning("Human microphone transcription failed: %s", type(error).__name__)
        finally:
            active.pop(sid, None)
            await audio.aclose()

    @room.on("track_subscribed")
    def subscribed(track, publication, participant):
        if publication.source != rtc.TrackSource.SOURCE_MICROPHONE:
            return
        if participant.attributes.get("role") not in {"candidate", "interviewer"}:
            return
        audio = rtc.AudioStream(track, sample_rate=16000, num_channels=1, capacity=250)
        active[publication.sid] = audio
        run(capture(publication.sid, audio, participant))

    @room.on("track_unsubscribed")
    def unsubscribed(_track, publication, _participant):
        if audio := active.get(publication.sid):
            run(audio.aclose())

    async def close():
        await asyncio.gather(*(audio.aclose() for audio in list(active.values())))
        if tasks:
            await asyncio.gather(*list(tasks))
        await transcript.save()
        await model.aclose()

    ctx.add_shutdown_callback(close)
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)
