from pathlib import Path

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    TurnHandlingOptions,
    cli,
    inference,
    room_io,
)
from livekit.plugins import ai_coustics

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local")


class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            llm=inference.LLM(model="google/gemma-4-31b-it"),
            instructions=(
                "You are Sainoa, a friendly voice assistant helping people talk "
                "about their experience and talents. Respond in the user's language. "
                "Keep replies brief and natural for speech, and ask one question "
                "at a time. Use plain text without markdown, emojis, or code. "
                "This is a conversation demo, not a hiring assessment."
            ),
        )


server = AgentServer()


@server.rtc_session(agent_name="sainoa-voice-agent")
async def voice_agent(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name}

    session = AgentSession(
        stt=inference.STT(model="assemblyai/universal-3-6-pro", language="en"),
        tts=inference.TTS(
            model="fishaudio/s2.1-pro", voice="fa4c9eb3dccc4806b382b40d61c6b10a"
        ),
        turn_handling=TurnHandlingOptions(
            turn_detection=inference.TurnDetector(),
            preemptive_generation={"enabled": True},
        ),
        expressive=True,
    )

    await session.start(
        agent=Assistant(),
        room=ctx.room,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=ai_coustics.audio_enhancement(
                    model=ai_coustics.EnhancerModel.QUAIL_VF_S
                ),
            ),
        ),
    )
    await ctx.connect()
    session.generate_reply(
        instructions="Greet the user as Sainoa and ask how you can help."
    )


if __name__ == "__main__":
    cli.run_app(server)
