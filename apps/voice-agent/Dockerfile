# syntax=docker/dockerfile:1
FROM ghcr.io/astral-sh/uv:python3.14-bookworm-slim AS build
ENV UV_COMPILE_BYTECODE=1 \
    HF_HOME=/app/.cache/huggingface \
    TORCH_HOME=/app/.cache/torch
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev
RUN uv run --locked --no-dev --module livekit.agents download-files
COPY src ./src

FROM python:3.14-slim-bookworm
ENV PYTHONUNBUFFERED=1 \
    HF_HOME=/app/.cache/huggingface \
    TORCH_HOME=/app/.cache/torch
RUN useradd --create-home --uid 10001 appuser
WORKDIR /app
COPY --from=build --chown=appuser:appuser /app /app
USER appuser
EXPOSE 8081
CMD ["/app/.venv/bin/python", "src/agent.py", "start"]
