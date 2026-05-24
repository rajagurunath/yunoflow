.PHONY: up down logs dev migrate seed test lint fmt build frontend

# Build the frontend (on the host — robust across local Docker setups).
frontend:
	cd frontend && npm install && npm run build

# One-command demo: build the UI, then run db + backend + frontend, detached.
# UI at http://localhost:5173, API at http://localhost:8000.
up: frontend
	docker compose up --build -d

down:
	docker compose down -v

logs:
	docker compose logs -f backend

# Fast native iteration: Postgres in docker, backend via uv (reload).
dev:
	docker compose up -d db
	cd backend && uv run alembic upgrade head && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

migrate:
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run python -m app.templates.seed

test:
	cd backend && uv run --extra dev pytest -q

lint:
	cd backend && uv run --extra dev ruff check .

fmt:
	cd backend && uv run --extra dev ruff format .

build:
	docker compose build
