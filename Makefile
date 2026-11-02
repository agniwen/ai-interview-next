.DEFAULT_GOAL := help

.PHONY: help install dev build preview test test-watch coverage typecheck check fix deploy db-migrate db-migrate-remote

help:
	@printf '%s\n' \
	  'make install     安装依赖' \
	  'make dev         启动开发服务（http://localhost:3000）' \
	  'make build       构建生产产物' \
	  'make preview     构建并预览生产版本' \
	  'make test        运行测试' \
	  'make test-watch  监听并运行测试' \
	  'make coverage    生成测试覆盖率报告' \
	  'make typecheck   检查 TypeScript 类型' \
	  'make check       检查代码格式和 lint' \
	  'make fix         自动修复代码格式和 lint' \
	  'make deploy      构建并部署到 Cloudflare' \
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

db-migrate:
	bun run --filter @ai-interview/web db:migrate

db-migrate-remote:
	bun run --filter @ai-interview/web db:migrate:remote
