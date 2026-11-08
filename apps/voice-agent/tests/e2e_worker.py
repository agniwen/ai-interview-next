"""保留正式 Agent 入口，只给真实 Session 添加测试用量旁路记录。
Keep the production agent entrypoint and attach an observational usage recorder to real sessions.
"""
import json
import os
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
import agent
from livekit.agents import AgentSession, cli


class MeasuredSession(AgentSession):
    async def start(self, *args, **kwargs):
        interviewer = kwargs["agent"]
        path = Path(os.environ["E2E_USAGE_DIR"]) / f"{interviewer.context.interviewId}-worker.json"
        data = {"version": 1, "roundId": interviewer.context.interviewId, "startedAt": time.time(), "metrics": [], "usage": None}

        def save():
            path.write_text(json.dumps(data, ensure_ascii=False, indent=2))

        @self.on("session_usage_updated")
        def usage(event):
            data["usage"] = event.model_dump(mode="json")
            save()

        @self.on("metrics_collected")
        def metrics(event):
            data["metrics"].append(event.metrics.model_dump(mode="json"))
            save()

        @self.on("close")
        def closed(event):
            data["closedAt"] = time.time()
            data["closeReason"] = event.reason.value
            save()

        save()
        return await super().start(*args, **kwargs)


agent.AgentSession = MeasuredSession

if __name__ == "__main__":
    cli.run_app(agent.server)
