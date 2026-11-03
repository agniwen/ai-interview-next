.DEFAULT_GOAL := help

.PHONY: api-dev api-build voice-install voice-download voice-console voice-dev voice-start voice-deploy voice-status voice-logs help install dev build preview test test-watch coverage typecheck check fix deploy db-generate db-migrate db-migrate-remote

help:
	@printf '%s\n' \
	  'make voice-install / voice-download  安装语音依赖 / 下载模型' \
	  'make voice-console / voice-dev / voice-start  语音终端 / 开发 / 生产' \
	  'make voice-deploy / voice-status / voice-logs  发布语音服务 / 状态 / 日志' \
	  'make api-dev / api-build  单独启动 API / 验证 API 构建' \
	  'make install     安装依赖' \
	  'make dev         启动 Web（3000）和 API（8787）' \
	  'make build       构建生产产物' \
	  'make preview     构建并预览生产版本' \
	  'make test        运行测试' \
	  'make test-watch  监听并运行测试' \
	  'make coverage    生成测试覆盖率报告' \
	  'make typecheck   检查 TypeScript 类型' \
	  'make check       检查代码格式和 lint' \
	  'make fix         自动修复代码格式和 lint' \
	  'make deploy      构建并部署到 Cloudflare' \
	  'make db-generate  生成共享 Drizzle schema 的增量迁移' \
	  'make db-migrate  应用本地 D1 迁移' \
	  'make db-migrate-remote  应用远端 D1 迁移'

install:
	bun install

dev:
	bun run dev

build:
	bun run build

preview:
	bun run preview

test:
	bun run test

test-watch:
	bun run test:watch

coverage:
	bun run test:coverage

typecheck:
	bun run typecheck

check:
	bun run check

fix:
	bun run fix

deploy:
	bun run deploy

db-generate:
	bun run --filter @ai-interview/db db:generate

db-migrate:
	bun run --filter @ai-interview/api db:migrate

db-migrate-remote:
	bun run --filter @ai-interview/api db:migrate:remote

voice-install:
	cd apps/voice-agent && uv sync --locked

voice-download:
	cd apps/voice-agent && uv run --locked --module livekit.agents download-files

voice-console:
	cd apps/voice-agent && uv run --locked src/agent.py console

voice-dev:
	cd apps/voice-agent && uv run --locked src/agent.py dev

voice-start:
	cd apps/voice-agent && uv run --locked src/agent.py start

voice-deploy:
	cd apps/voice-agent && lk agent deploy

voice-status:
	cd apps/voice-agent && lk agent status

voice-logs:
	cd apps/voice-agent && lk agent logs

api-dev:
	bun run dev --filter=@ai-interview/api

api-build:
	bun run build --filter=@ai-interview/api
