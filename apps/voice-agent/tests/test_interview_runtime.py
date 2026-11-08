"""本地 WebSocket 驱动 Qwen 适配器，验证协议转换、恢复和失败传播。
Drive the Qwen adapter with a local WebSocket provider to verify protocol, recovery and failures.
"""
import asyncio
import base64
import json
import sys
import unittest
from pathlib import Path

from aiohttp import ClientSession, web
from livekit import rtc
from livekit.agents import llm

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from interview_runtime import ObservedRealtimeModel
from qwen_realtime import RealtimeModel


class LocalProvider:
    """将真实 HTTP 传输指向脚本化的本地供应商；适配器逻辑不替换。
    Redirect real HTTP transport to the scripted local provider without replacing adapter logic.
    """
    def __init__(self, http, url):
        self.http, self.url = http, url

    def ws_connect(self, url, **kwargs):
        return self.http.ws_connect(self.url, **kwargs)


class RealtimeRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.sockets = []
        self.messages = []
        self.reject_connections = False
        self.events = []

        async def websocket(request):
            ws = web.WebSocketResponse()
            await ws.prepare(request)
            if self.reject_connections:
                await ws.close(code=1011)
                return ws
            self.sockets.append(ws)
            self.messages.append([])
            messages = self.messages[-1]
            await ws.send_json({"type": "session.created", "session": {"id": "test-session"}})
            async for raw in ws:
                event = raw.json()
                messages.append(event)
                if event["type"] == "session.update":
                    await ws.send_json({"type": "session.updated", "session": event["session"]})
                elif event["type"] == "conversation.item.create":
                    await ws.send_json({"type": "conversation.item.created", "previous_item_id": event.get("previous_item_id"), "item": event["item"]})
                elif event["type"] == "conversation.item.delete":
                    await ws.send_json({"type": "conversation.item.deleted", "item_id": event["item_id"]})
            return ws

        app = web.Application()
        app.router.add_get("/realtime", websocket)
        self.runner = web.AppRunner(app)
        await self.runner.setup()
        await web.TCPSite(self.runner, "127.0.0.1", 0).start()
        self.http = ClientSession()
        self.provider = LocalProvider(self.http, f"http://127.0.0.1:{self.runner.addresses[0][1]}/realtime")
        self.model = ObservedRealtimeModel(
            api_key="synthetic-test-key", http_session=self.provider, request_timeout=1,
            on_connection_event=lambda kind, **details: self.events.append((kind, details)),
        )
        self.session = self.model.session()
        await self.session.update_instructions("Continue the same interview using confirmed facts.")

    async def asyncTearDown(self):
        await self.model.aclose()
        for ws in self.sockets:
            await ws.close()
        await self.http.close()
        await self.runner.cleanup()

    async def wait_for(self, predicate):
        async with asyncio.timeout(5):
            while not predicate():
                await asyncio.sleep(0.01)

    async def feed(self, kind, **payload):
        await self.sockets[-1].send_json({"type": kind, **payload})

    async def response(self, response_id="r1"):
        future = self.session.generate_reply()
        await self.wait_for(lambda: any(e["type"] == "response.create" for e in self.messages[-1]))
        await self.feed("response.created", response={"id": response_id})
        return await future

    async def test_qwen_config_and_text_only_mode(self):
        config = self.messages[0][0]["session"]
        self.assertEqual(config["voice"], "longanlingxin")
        self.assertEqual(config["turn_detection"], {"type": "smart_turn"})
        self.assertEqual(config["modalities"], ["text", "audio"])
        self.assertFalse(config["enable_speech_emotion"])
        model = RealtimeModel(api_key="test", http_session=self.provider, text_only=True)
        try:
            await model.session().update_instructions("Text test")
            self.assertEqual(self.messages[-1][0]["session"]["modalities"], ["text"])
            self.assertFalse(model.capabilities.audio_output)
        finally:
            await model.aclose()

    async def test_reconnect_restores_confirmed_context_without_replaying_a_tool(self):
        chat = llm.ChatContext()
        chat.add_message(role="user", content="I built the order API.")
        chat.items.extend([
            llm.FunctionCall(id="call", call_id="call", name="save", arguments='{"version":1}'),
            llm.FunctionCallOutput(id="result", call_id="call", name="save", output='{"version":1,"saved":true}', is_error=False),
        ])
        await self.session.update_chat_ctx(chat)
        await self.sockets[0].close(code=1011)
        await self.wait_for(lambda: any(kind == "realtime_reconnected" for kind, _ in self.events))
        self.assertEqual([kind for kind, _ in self.events], ["realtime_reconnecting", "realtime_reconnected"])
        self.assertEqual(self.events[0][1]["attempt"], 1)
        restored = [e["item"] for e in self.messages[1] if e["type"] == "conversation.item.create"]
        self.assertEqual([item["id"] for item in restored], [item.id for item in chat.items])
        self.assertEqual(restored[0]["content"][0]["text"], "I built the order API.")
        self.assertFalse(any(e["type"] == "response.create" for e in self.messages[1]))

    async def test_retry_exhaustion_is_a_failure_not_successful_completion(self):
        self.reject_connections = True
        await self.sockets[0].close(code=1011)
        await self.wait_for(lambda: any(kind == "realtime_failed" for kind, _ in self.events))
        self.assertEqual([kind for kind, _ in self.events], ["realtime_reconnecting"] * 3 + ["realtime_failed"])
        self.assertEqual(self.events[-1][1]["attempt"], 3)
        self.assertFalse(self.events[-1][1]["recoverable"])
        self.assertNotIn("interview_ended", [kind for kind, _ in self.events])

    async def test_disconnect_does_not_replay_an_unconfirmed_tool(self):
        chat = llm.ChatContext()
        chat.items.append(llm.FunctionCall(id="call", call_id="call", name="save", arguments='{"version":1}'))
        await self.session.update_chat_ctx(chat)
        await self.sockets[0].close(code=1011)
        await self.wait_for(lambda: any(kind == "realtime_failed" for kind, _ in self.events))
        self.assertEqual(len(self.sockets), 1)
        self.assertEqual([kind for kind, _ in self.events], ["realtime_failed"])

    async def test_audio_transcripts_and_audio_reply_keep_their_roles(self):
        transcripts = []
        self.session.on("input_audio_transcription_completed", transcripts.append)
        self.session.push_audio(rtc.AudioFrame(bytes(640), 16000, 1, 320))
        await self.wait_for(lambda: self.messages[0][-1]["type"] == "input_audio_buffer.append")
        self.assertEqual(len(base64.b64decode(self.messages[0][-1]["audio"])), 640)
        await self.feed("input_audio_buffer.committed", item_id="u1")
        await self.feed("conversation.item.input_audio_transcription.delta", item_id="u1", text="负责", stash="订单")
        await self.feed("conversation.item.input_audio_transcription.completed", item_id="u1", transcript="负责订单接口。")
        await self.wait_for(lambda: len(transcripts) == 2)
        self.assertEqual([e.transcript for e in transcripts], ["负责订单", "负责订单接口。"])
        self.assertTrue(transcripts[-1].is_final)
        self.assertEqual(self.session.chat_ctx.get_by_id("u1").role, "user")
        generation = await self.response()
        await self.feed("response.output_item.added", response_id="r1", item={"id": "a1", "type": "message", "role": "assistant"})
        message = await anext(generation.message_stream.__aiter__())
        await self.feed("response.audio_transcript.delta", response_id="r1", item_id="a1", delta="请介绍一下设计取舍。")
        await self.feed("response.audio.delta", response_id="r1", item_id="a1", delta=base64.b64encode(bytes(960)).decode())
        await self.feed("response.done", response={"id": "r1", "status": "completed", "output": []})
        self.assertEqual(await message.modalities, ["text", "audio"])
        self.assertEqual("".join([part async for part in message.text_stream]), "请介绍一下设计取舍。")
        frames = [frame async for frame in message.audio_stream]
        self.assertEqual(sum(frame.samples_per_channel for frame in frames), 480)
        self.assertTrue(all(frame.sample_rate == 24000 for frame in frames))
        self.assertEqual(self.session.chat_ctx.get_by_id("a1").role, "assistant")

    async def test_nested_tool_schema_and_duplicate_provider_events(self):
        from pydantic import BaseModel
        class Answer(BaseModel):
            summary: str

        @llm.function_tool
        async def save(updates: list[Answer], version: int = 1):
            """保存采集结果。 / Save collected answers."""
            return {"version": 1, "saved": len(updates)}

        await self.session.update_tools([save])
        schema = self.messages[0][-1]["session"]["tools"][0]["function"]
        self.assertIn("summary", schema["parameters"]["properties"]["updates"]["items"]["properties"])
        self.assertNotIn("$ref", json.dumps(schema))
        generation = await self.response()
        call = {"id": "f1", "type": "function_call", "call_id": "c1", "name": "save", "arguments": json.dumps({"version": 1, "updates": '[{"summary":"订单接口"}]'})}
        await self.feed("response.function_call_arguments.done", response_id="r1", item_id="f1", **{k: v for k, v in call.items() if k not in ("id", "type")})
        await self.feed("response.output_item.done", response_id="r1", item=call)
        await self.feed("response.done", response={"id": "r1", "status": "completed", "output": [call]})
        calls = [item async for item in generation.function_stream]
        self.assertEqual(len(calls), 1)
        self.assertEqual(json.loads(calls[0].arguments), {"version": 1, "updates": [{"summary": "订单接口"}]})
        chat = self.session.chat_ctx
        chat.items.append(llm.FunctionCallOutput(call_id="c1", name="save", output='{"version":1,"saved":1}', is_error=False))
        await self.session.update_chat_ctx(chat)
        outputs = [event["item"] for event in self.messages[0] if event["type"] == "conversation.item.create" and event["item"]["type"] == "function_call_output"]
        self.assertEqual(len(outputs), 1)
        self.assertEqual(outputs[0]["call_id"], "c1")
