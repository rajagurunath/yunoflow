.PHONY: up down logs dev migrate seed test lint fmt build

# One-command demo: build + run db + backend (+ frontend once it exists), detached.
up:
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
