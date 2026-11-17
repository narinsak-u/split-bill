# SplitBill

SplitBill tracks shared group expenses, exact or equal shares, and member balances to the satang. It uses a Next.js frontend, FastAPI backend, and PostgreSQL 16 database.

## Start

Requires Docker Engine and Docker Compose. From the repository root:

```sh
docker compose up --build
```

Open http://localhost:3000. The API is at http://localhost:8000. Compose waits for PostgreSQL, migrates the schema, seeds demo data, and then starts the frontend. No reverse proxy is required; PostgreSQL stays on the private Compose network. Ports 3000 and 8000 bind only to your machine.

Migrations and seeding run automatically. To rerun either manually:

```sh
docker compose run --rm backend alembic upgrade head
docker compose run --rm backend python -m app.scripts.seed
```

Select a demo user (`alice`, `bob`, `carol`, or `dan`), then a group. “Chiang Mai trip” contains alice, bob, and carol; “Office lunch” contains bob and dan. Record an expense, inspect the live split preview and balances, or delete an expense as its payer. `X-User` selects a demo requester; it is **not authentication**. The database password in `compose.yaml` is for local development only.

```sh
docker compose down       # Stop services; keep expenses and demo data
docker compose down -v    # Erase the database volume and ALL saved expenses
```

## Rules and API

The frontend uses the same JSON API available directly on port 8000:

| Method | Path | Action |
|---|---|---|
| GET | `/groups`, `/groups/{id}` | List accessible groups; view members |
| GET | `/groups/{id}/expenses`, `/groups/{id}/balances` | View active expenses and member balances |
| POST | `/groups/{id}/expenses` | Record an expense; requires `Idempotency-Key` |
| DELETE | `/groups/{id}/expenses/{expense_id}` | Soft-delete an expense as its payer |

All requests require `X-User`: unknown users get 400; inaccessible groups get 404 so callers cannot discover their existence. The requester, payer, and split members must belong to the group, but the payer need not share the expense. Empty splits, duplicate members, and negative exact shares are rejected.

Money is stored as PostgreSQL `NUMERIC(12,2)` and calculated with Python `Decimal`; the frontend uses integer satang for split previews. Amounts are decimal strings from `0.01` to `9999999999.99` with at most two fractional digits. Exact shares must total the expense; equal splits assign leftover satang in supplied member order. Balance is total paid minus total shares: positive means owed, negative means owing.

For example:

```sh
curl -X POST http://localhost:8000/groups/1/expenses \
  -H 'Content-Type: application/json' -H 'X-User: alice' \
  -H 'Idempotency-Key: lunch-001' \
  -d '{"description":"Lunch","paid_by":"alice","amount":"10.00","split":{"type":"equal","members":["alice","bob","carol"]}}'
```

Idempotency keys are scoped to a group. Equivalent monetary inputs share a canonical request hash; a repeat returns the original expense, even after deletion. Reusing a key with different content returns 409. Expenses appear newest first with a deterministic tie-breaker. Only the payer may soft-delete an expense; deleted expenses leave balances and active lists, and repeating a delete returns 404. Errors use `{"error":{"code":"...","message":"...","details":null}}`.

## Checks

Frontend checks (Node.js/npm):

```sh
cd frontend
npm ci
npm test && npm run lint && npm run build
```

Backend checks (Python 3.12+): provision a **separate**, host-reachable PostgreSQL 16 test database first. Tests migrate and seed it; do not use the application database. Compose does not publish its database port.

```sh
cd backend
python3 -m venv .venv
. .venv/bin/activate
python -m pip install -e '.[test]' ruff
export TEST_DATABASE_URL='postgresql+psycopg://USER:PASSWORD@localhost:5432/splitbill_test'
pytest && ruff check . && ruff format --check .
```

The repository separates `backend/app/` (routers, schemas, services, repositories, SQLAlchemy models), `backend/alembic/` (schema changes), and `frontend/src/` (UI and API calls). This is one layered monolith, not microservices; Alembic owns migrations and seed data is idempotent. The fixed demo identities are not authentication. Expense editing, settlements, repayments, group editing, and multiple currencies are out of scope; add real authentication before deployment. Estimated implementation effort: 2–4 focused engineering days (planning estimate, not a time log). See `AI_NOTES.md` for trade-offs.
