"""通过真实 LiveKit 房间和正式 worker 发送合成语音，核对落库结果。
Send synthetic speech through a real LiveKit room and production worker, then inspect persisted results.
"""
import argparse
import asyncio
import json
import os
from pathlib import Path
import time
import wave

import aiohttp
from livekit import api, rtc
from e2e_interview import AcceptanceRun, ALL_FACTS, CORRECTION, END


async def wait_for(predicate, timeout=90):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        await asyncio.sleep(.25)
    raise TimeoutError("Audio acceptance condition not reached")


async def synthesize(text, path):
    aiff = path.with_suffix(".aiff")
    process = await asyncio.create_subprocess_exec("say", "-v", "Tingting", "-r", "215", "-o", str(aiff), text)
    assert await process.wait() == 0
    process = await asyncio.create_subprocess_exec("ffmpeg", "-loglevel", "error", "-y", "-i", str(aiff), "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", str(path))
    assert await process.wait() == 0


async def main(args):
    run = AcceptanceRun(args, "audio-room-interruption" if args.interrupt else "audio-room-reconnect")
    run.result["mode"] = "synthetic-audio-real-livekit-production-worker-api-d1"
    run.result["audioSeconds"] = 0
    run.result["spokenInputs"] = []
    candidate = None
    room_name = f'e2e-{run.ids["round"]}'
    async with aiohttp.ClientSession(proxy=os.getenv("https_proxy") or os.getenv("HTTPS_PROXY")) as http:
        cloud = api.LiveKitAPI(session=http)
        async def join():
            room = rtc.Room()
            token = api.AccessToken().with_identity(f'candidate-{run.ids["round"]}').with_name("E2E 合成候选人").with_grants(api.VideoGrants(room_join=True, room=room_name)).to_jwt()
            await room.connect(os.environ["LIVEKIT_URL"], token)
            source = rtc.AudioSource(48000, 1)
            track = rtc.LocalAudioTrack.create_audio_track("e2e-synthetic-mic", source)
            await room.local_participant.publish_track(track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
            return room, source

        def transcripts():
            return [dict(row) for row in run.db.execute("SELECT id,role,text,at,interrupted FROM interview_transcript WHERE interviewRoundId=? ORDER BY at,id", (run.ids["round"],))]

        def listening():
            return any(p.attributes.get("lk.agent.state") == "listening" for p in candidate.remote_participants.values())

        async def speak(text, label):
            started = time.monotonic()
            prior = len(transcripts())
            path = Path(args.output) / f'{run.ids["round"]}-{label}.wav'
            await synthesize(text, path)
            with wave.open(str(path)) as audio:
                duration = audio.getnframes() / audio.getframerate()
                while data := audio.readframes(480):
                    await source.capture_frame(rtc.AudioFrame(data, 48000, 1, len(data) // 2))
                await source.wait_for_playout()
            run.result["audioSeconds"] += duration
            run.result["spokenInputs"].append({"text": text, "durationSeconds": duration, "audioFile": str(path)})
            run.save()
            if label == "facts" and args.interrupt:
                await wait_for(lambda: any(p.attributes.get("lk.agent.state") == "speaking" for p in candidate.remote_participants.values()))
            elif label != "end":
                await wait_for(lambda: len(transcripts()) >= prior + 2 and listening())
            else:
                await wait_for(lambda: run.status() == "completed", 90)
            run.result["spokenInputs"][-1]["elapsedSeconds"] = round(time.monotonic() - started, 3)
            run.result["spokenInputs"][-1]["transcripts"] = transcripts()[prior:]
            run.save()
            print(f'AUDIO {label}: {duration:.1f}s input', flush=True)

        try:
            await cloud.room.create_room(api.CreateRoomRequest(name=room_name, empty_timeout=120))
            await cloud.agent_dispatch.create_dispatch(api.CreateAgentDispatchRequest(room=room_name, agent_name=args.agent_name, metadata=json.dumps(run.dispatch)))
            candidate, source = await join()
            await wait_for(lambda: listening() and bool(transcripts()), 120)
            await speak(ALL_FACTS, "facts")
            if not args.interrupt:
                before = run.saved()
                await candidate.disconnect()
                await source.aclose()
                await asyncio.sleep(3)
                run.check("audio departure keeps interview active", run.status() == "in_progress")
                candidate, source = await join()
                await wait_for(listening, 30)
                run.check("audio reconnect keeps saved plan", before["plan"] == run.saved()["plan"])
            await speak("我回来了。" + CORRECTION, "correction")
            run.check("audio correction does not end interview", run.status() == "in_progress")
            await speak(END, "end")
            await wait_for(lambda: run.saved()["progress"]["finalized"], 120)
            saved = run.verify_storage()
            run.check("all audio inputs produced candidate transcripts", all(any(t["role"] == "user" for t in item["transcripts"]) for item in run.result["spokenInputs"]))
            combined = " ".join(a["summary"] for a in saved["progress"]["answers"])
            for fact in ("MySQL", "杭州"):
                run.check(f"audio report retains {fact}", fact.lower() in combined.lower())
            run.check("audio report retains 3200 QPS", "3200" in combined or "三千两百" in combined or "三千二百" in combined)
            run.check("audio report retains corrected joining time", "四周" in combined or "4周" in combined or "4 周" in combined)
            run.check("audio report retains rollback", "回滚" in combined and "重试" in combined)
            run.result["runtimeEvents"] = [json.loads(row[0]) for row in run.db.execute("SELECT content FROM interview_event WHERE interviewRoundId=? ORDER BY at,id", (run.ids["round"],))]
            if args.interrupt:
                run.check("barge-in interrupts an assistant utterance", any(t["role"] == "assistant" and t["interrupted"] for t in transcripts()))
            else:
                run.check("audio reconnection events persisted", sum(e["kind"] == "candidate_connected" for e in run.result["runtimeEvents"]) >= 2 and any(e["kind"] == "candidate_disconnected" for e in run.result["runtimeEvents"]))
        except Exception as error:
            run.result["errors"].append(f"{type(error).__name__}: {error}")
            run.check("audio scenario completes", False, type(error).__name__)
        finally:
            if candidate:
                await candidate.disconnect()
            rooms = await cloud.room.list_rooms(api.ListRoomsRequest(names=[room_name]))
            if rooms.rooms:
                await cloud.room.delete_room(api.DeleteRoomRequest(room=room_name))
            await asyncio.sleep(2)
            telemetry = Path(args.output) / f'{run.ids["round"]}-worker.json'
            if telemetry.exists():
                observed = json.loads(telemetry.read_text())
                run.result["workerUsage"] = observed
                run.result["metrics"] = [m for m in observed["metrics"] if m["type"] == "realtime_model_metrics"]
                saved = run.saved()
                if saved:
                    usage = saved["progress"]["usage"]
                    run.result["reconciliationUsage"] = [{"inputTokens": usage["inputTokens"] - sum(m["input_tokens"] for m in run.result["metrics"]), "cachedInputTokens": usage["cachedInputTokens"] - sum(m["input_token_details"]["cached_tokens"] for m in run.result["metrics"]), "outputTokens": usage["outputTokens"] - sum(m["output_tokens"] for m in run.result["metrics"])}]
            run.save()
            stt = [m for m in run.result.get("workerUsage", {}).get("metrics", []) if m["type"] == "stt_metrics"]
            run.result["transcriptionSeconds"] = sum(m["audio_duration"] for m in stt)
            run.result["cost"]["transcription"] = None
            run.result["cost"]["livekit"] = None
            run.result["cost"]["livekitNote"] = "Transport/bandwidth depends on plan and remaining included usage; invoice not available. Local worker has no hosted-agent charge."
            run.result["cost"]["total"] = None
            run.path.write_text(json.dumps(run.result, ensure_ascii=False, indent=2))
            run.db.close()
            print(f'ARTIFACT {run.path} MODEL_COST {run.result["cost"]["total"]} USD', flush=True)
    return bool(run.result["errors"]) or any(not c["passed"] for c in run.result["checks"])


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--api", default="http://127.0.0.1:8787")
    parser.add_argument("--database", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--agent-name", required=True)
    parser.add_argument("--interrupt", action="store_true")
    raise SystemExit(asyncio.run(main(parser.parse_args())))
