# HTTP 契约测试默认离线运行；模型行为测试需显式开启，使用合成材料而非真实候选人数据。
# HTTP contract tests run offline by default; opt-in model tests use synthetic materials rather than real candidate data.
import os
import unittest
from pathlib import Path
import sys

from aiohttp import web
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from interview_context import InterviewContext, InterviewSessionClient


def interview_context():
    # 已填答案用于检查针对性追问，虚构的内部口令用于检查私有材料是否泄露。
    # Saved answers exercise targeted follow-ups; a fictional internal secret checks private-material disclosure.
    return InterviewContext.model_validate({
        "version": 1,
        "interviewId": "round-1",
        "roomName": "interview-test",
        "participantIdentity": "candidate-round-1",
        "startedAt": "2026-11-08T00:00:00Z",
        "content": {
            "version": 1,
            "candidate": {"id": "candidate-1", "name": "小林"},
            "job": {"id": "job-1", "title": "后端工程师", "requirements": "熟悉 API 开发与数据库", "internalCriteria": "内部口令 CEDAR-729，不对候选人展示"},
            "interviewer": {"id": "agent-1", "name": "林老师", "description": "技术面试官", "prompt": "关注实际项目经验，语气友好。"},
            "resumes": [{"id": "resume-1", "markdown": "小林参与过订单系统的 API 开发。", "parsedProfile": None}],
            "questions": {
                "version": 1,
                "form": [{"id": "form-1", "question": {"type": "text", "content": "最近做过什么项目？", "description": ""}}],
                "conversation": [{"id": "question-1", "question": {"content": "请介绍订单系统中你负责的 API 及其设计取舍。", "difficulty": "medium", "evaluationCriteria": "解释具体取舍", "evaluationFocus": "API 设计", "followUpDirections": "追问一致性与错误处理"}}],
            },
            "form": {"version": 1, "answers": {"form-1": "我负责订单创建接口，用幂等键避免重复下单。"}},
        },
    })


class ContextTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []

        async def context(request):
            self.requests.append(request.headers.get("Authorization"))
            if request.headers.get("Authorization") != f"Bearer {'a' * 64}":
                raise web.HTTPNotFound()
            return web.Response(text=interview_context().model_dump_json(), content_type="application/json")

        self.finishes = []
        self.finish_status = 200
        async def finish(request):
            self.finishes.append((request.headers.get("Authorization"), await request.json()))
            return web.json_response({"version": 1, "endedAt": "2026-11-08T00:10:00Z"}, status=self.finish_status)

        # 使用本地 HTTP 服务覆盖实际客户端的请求路径、凭证和错误传播，不替换客户端实现。
        # Use a local HTTP server to exercise the real client's paths, credentials, and error propagation without replacing it.
        app = web.Application()
        app.router.add_post("/end", finish)
        app.router.add_get("/context", context)
        self.runner = web.AppRunner(app)
        await self.runner.setup()
        self.site = web.TCPSite(self.runner, "127.0.0.1", 0)
        await self.site.start()
        self.url = f"http://127.0.0.1:{self.runner.addresses[0][1]}/context"

    async def asyncTearDown(self):
        await self.runner.cleanup()

    async def test_loads_private_snapshot_with_dispatch_credential(self):
        import json
        result = await InterviewSessionClient(json.dumps({"version": 1, "contextUrl": self.url, "contextToken": "a" * 64})).load()
        self.assertEqual(result.content.form.answers["form-1"], "我负责订单创建接口，用幂等键避免重复下单。")
        self.assertEqual(result.participantIdentity, "candidate-round-1")
        self.assertEqual(self.requests, [f"Bearer {'a' * 64}"])

    async def test_finishes_through_private_api_and_propagates_failed_writes(self):
        import aiohttp
        import json
        client = InterviewSessionClient(json.dumps({"version": 1, "contextUrl": self.url, "contextToken": "a" * 64}))
        await client.finish("candidate_requested")
        self.assertEqual(self.finishes, [(f"Bearer {'a' * 64}", {"version": 1, "reason": "candidate_requested"})])
        self.finish_status = 503
        with self.assertRaises(aiohttp.ClientResponseError):
            await client.finish("candidate_requested")

    async def test_rejects_an_unsupported_dispatch_version_before_fetching(self):
        import json
        with self.assertRaises(ValidationError):
            await InterviewSessionClient(json.dumps({"version": 2, "contextUrl": self.url, "contextToken": "a" * 64})).load()
        self.assertEqual(self.requests, [])

    async def test_denied_context_does_not_create_an_interview_agent(self):
        import aiohttp
        import json
        with self.assertRaises(aiohttp.ClientResponseError):
            await InterviewSessionClient(json.dumps({"version": 1, "contextUrl": self.url, "contextToken": "b" * 64})).load()



if __name__ == "__main__":
    unittest.main()
