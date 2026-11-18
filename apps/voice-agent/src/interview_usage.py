import asyncio
import logging

import aiohttp

from interview_context import InterviewSessionClient

logger = logging.getLogger("interview.usage")


class InterviewUsageReporter:
    def __init__(self, client: InterviewSessionClient) -> None:
        self._client = client
        self._tasks: set[asyncio.Task] = set()

    def emit(self, measurement: dict) -> None:
        task = asyncio.create_task(self._send({"version": 1, **measurement}))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    async def _send(self, measurement: dict) -> None:
        for attempt in range(2):
            try:
                await self._client.post("usage", measurement)
                return
            except (aiohttp.ClientError, TimeoutError) as error:
                retriable = not isinstance(error, aiohttp.ClientResponseError) or error.status >= 500
                if attempt == 0 and retriable:
                    continue
                logger.error("Interview usage write failed (%s, %s)", measurement["stage"], type(error).__name__)
                return

    async def close(self) -> None:
        if self._tasks:
            await asyncio.gather(*self._tasks)
