# SplitBill

Track shared expenses, split costs, and calculate group balances to the satang.

## Technology

- Frontend: Next.js 15, React 18, TypeScript, Tailwind CSS, TanStack Query.
- Backend: Python 3.12+, FastAPI, Pydantic, SQLAlchemy, Alembic, psycopg.
- Database and runtime: PostgreSQL 16, Docker Compose.

## Architecture

Next.js frontend calls FastAPI. Routes use services and repositories; SQLAlchemy accesses PostgreSQL. Alembic manages migrations; an idempotent script seeds demo data.

```mermaid
flowchart LR
    User --> Frontend["Next.js"]
    Frontend --> API["FastAPI routes"]
    API --> Services --> Repositories
    Repositories --> ORM["SQLAlchemy"]
    ORM --> DB["PostgreSQL"]
    Migrations["Alembic"] --> DB
    Seed["Demo seed"] --> DB
```

## Project structure

```text
backend/
  app/api/          HTTP routes
  app/core/         shared dependencies
  app/db/           database session and models
  app/repositories/ data access
  app/schemas/      request and response models
  app/services/     business logic
  app/scripts/      demo seed
  alembic/          migrations
  tests/            API and unit tests
frontend/
  src/app/          Next.js pages, selection/query hook, app setup
  src/features/     group balances, expense form/validation, feature APIs
  src/lib/          shared utilities
compose.yaml        local service and database setup
```

## Setup

Requires Docker Engine and Compose. Start from the repository root:

```sh
docker compose up --build
```

Open http://localhost:3000; API runs at http://localhost:8000. Compose starts PostgreSQL, migrates and seeds it, then starts both apps. Only ports 3000 and 8000 are exposed on localhost.

Demo users: `alice`, `bob`, `carol`, `dan`. To rerun setup tasks:

```sh
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.scripts.seed
```

Stop services; add `-v` to erase saved data:

```sh
docker compose down
docker compose down -v
```

### Checks

Frontend checks require Node.js 22 and npm:

```sh
cd frontend
npm ci
npm test && npm run lint && npm run build
```

### End-to-end browser test

Requires Docker Compose and Node.js 22/npm. From the repository root:

```sh
cd frontend
npm ci
npm run test:e2e
```

The command installs Chromium if needed and runs against a fresh, dedicated Compose project on ports 3001 and 8001. A lock prevents concurrent E2E runs; startup and teardown remove only this project's containers and database volume. Playwright results and failure traces remain under `frontend/test-results/<run-id>/`; remove `frontend/test-results/` to clear them.

Backend tests require Python 3.12+. Install dependencies once:

```sh
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[test]' ruff
```

Run the 30 allocation unit tests without PostgreSQL:

```sh
pytest tests/unit
```

The 26 API integration tests require a separate PostgreSQL 16 database. Create a local test database:

```sh
docker run --detach --name splitbill-test-db \
  --publish 127.0.0.1:5433:5432 \
  --env POSTGRES_USER=splitbill_test \
  --env POSTGRES_PASSWORD=local-only-change-me \
  --env POSTGRES_DB=splitbill_test \
  postgres:16
```

If the container already exists, start it with `docker start splitbill-test-db`. Wait until this check reports `accepting connections`:

```sh
docker exec splitbill-test-db pg_isready -U splitbill_test -d splitbill_test
```

Set `TEST_DATABASE_URL`; tests never use `DATABASE_URL`. Run integration tests and code checks:

```sh
export TEST_DATABASE_URL='postgresql+psycopg://splitbill_test:local-only-change-me@127.0.0.1:5433/splitbill_test'
pytest tests/test_balances.py tests/test_delete_expenses.py tests/test_expenses.py tests/test_groups.py
ruff check . && ruff format --check .
```

Run all 56 backend tests with `pytest` while the test database is available. Remove the temporary database with `docker rm -f splitbill-test-db`.

## Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Backend database URL; Compose sets it. |
| `TEST_DATABASE_URL` | Separate database URL required for backend tests. |
| `CORS_ORIGINS` | Comma-separated allowed origins; defaults to localhost ports 3000. |
| `NEXT_PUBLIC_API_URL` | API base URL; defaults to `http://localhost:8000`. |

Examples: `backend/.env.example`, `frontend/.env.example`. Compose credentials are for local use only.

## API endpoints

Base URL: http://localhost:8000. Every request needs `X-User` (`alice`, `bob`, `carol`, or `dan`).

| Method | Path | Description |
|---|---|---|
| `GET` | `/groups` | List groups |
| `GET` | `/groups/{id}` | Group and members |
| `GET` | `/groups/{id}/expenses` | Active expenses |
| `GET` | `/groups/{id}/balances` | Member balances |
| `POST` | `/groups/{id}/expenses` | Create expense; needs `Idempotency-Key` |
| `DELETE` | `/groups/{id}/expenses/{expense_id}` | Soft-delete as payer |

Requester, payer, and split members must belong to the group. Amounts range from `0.01` to `9999999999.99`, with two decimals max. Exact shares must equal the total; equal splits distribute leftover satang in member order. Positive balance means owed; negative means owing.

Idempotency keys are group-scoped; changed content with a reused key returns 409. Deleted expenses leave lists and balances. Errors use `{"error":{"code":"...","message":"...","details":null}}`.

## Design decisions

- **Group access returns 404:** hiding inaccessible groups prevents callers from discovering whether a group exists. Deleting another member's expense returns 403 because the caller can access the group but lacks permission.
- **Money uses `NUMERIC(12,2)` and `Decimal`:** exact decimal storage and arithmetic avoid binary floating-point rounding. The frontend uses integer satang for previews.
- **Equal splits distribute remainder in member order:** deterministic allocation makes every share predictable while preserving the exact total.
- **Idempotency is group-scoped:** a unique group/key constraint prevents duplicate expenses on retry. Canonical hashing normalizes equivalent amount strings and exact-share order while preserving equal-split member order. Matching retries return the original expense; changed content returns 409.

## Limitations

- Demo users and groups are fixed; `X-User` is not authentication.
- The app has no expense editing, settlements, repayments, group management, or multiple currencies.
- Amounts support two decimal places only.

See `AI_NOTES.md` for AI workflow and review findings.
