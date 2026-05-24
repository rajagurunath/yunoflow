.PHONY: help up down logs dev migrate seed test lint fmt build frontend
.DEFAULT_GOAL := help

help: ## Show this help
	@echo "Orchestra — AI Agent Orchestration Platform"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

frontend: ## Build the frontend on the host (npm install + build)
	cd frontend && npm install && npm run build

up: frontend ## One command: build UI, run db + backend + frontend (UI :5173, API :8000)
	docker compose up --build -d

down: ## Stop everything and wipe volumes
	docker compose down -v

logs: ## Tail backend logs
	docker compose logs -f backend

dev: ## Fast native iteration: Postgres in docker, backend via uv (reload)
	docker compose up -d db
	cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate: ## Apply database migrations
	cd backend && uv run alembic upgrade head

seed: ## Load the prebuilt workflow templates
	cd backend && uv run python -m app.templates.seed

test: ## Run backend (pytest) + frontend (vitest) tests
	cd backend && uv run --extra dev pytest -q
	cd frontend && npm test

lint: ## Lint the backend with ruff
	cd backend && uv run --extra dev ruff check .

fmt: ## Format the backend with ruff
	cd backend && uv run --extra dev ruff format .

build: ## Build all docker images
	docker compose build
