# SplitBill

SplitBill records group expenses, splits them equally or by exact shares, and calculates member balances. This assessment app focuses on precise money handling, authorization, and safe retries; it is not a production identity system.

## Stack and design

- Backend: Python 3.12+, FastAPI, Pydantic 2, SQLAlchemy 2, Alembic, PostgreSQL 16.
- Frontend: Next.js App Router, React, TypeScript, Tailwind CSS, TanStack Query, React Hook Form, Zod.
- Tests: pytest and HTTPX, Ruff, Vitest, ESLint.

This is a layered monolith, not a set of services. FastAPI routers handle HTTP; schemas validate input/output; services hold business rules; repositories query PostgreSQL through SQLAlchemy models. The browser calls this API over JSON. The API is authoritative; frontend validation is for usability.

## Run locally

Prerequisites: Git, Python 3.12+, Node.js/npm, and PostgreSQL 16. You can use a local PostgreSQL install or run only the database in Docker; the application services run directly on the host. These local example passwords are placeholders, not production secrets.

Start PostgreSQL locally, or start a disposable Docker database:

```sh
docker run --name splitbill-postgres \
  -e POSTGRES_PASSWORD=local-only-change-me \
  -p 5432:5432 -d postgres:16
```

Wait for PostgreSQL to finish starting, then create separate application and test roles and databases. For Docker:

```sh
docker exec -i splitbill-postgres psql -U postgres <<'SQL'
CREATE ROLE splitbill LOGIN PASSWORD 'local-only-change-me';
CREATE DATABASE splitbill OWNER splitbill;
CREATE ROLE splitbill_test LOGIN PASSWORD 'local-only-change-me';
CREATE DATABASE splitbill_test OWNER splitbill_test;
SQL
```

For a local PostgreSQL install, run the same SQL as a PostgreSQL administrator. Use different strong passwords outside a disposable local setup, and update the corresponding URLs below.

Copy the backend environment example, then export its values before running backend commands:

```sh
cd backend
cp .env.example .env
python3 -m venv .venv
. .venv/bin/activate
set -a
. .env
set +a
python -m pip install -e '.[test]' ruff
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload
```

The seed is safe to rerun; it inserts missing demo users and memberships without resetting existing data. Demo users: `alice`, `bob`, `carol`, and `dan`. Group 1, “Chiang Mai trip,” contains alice, bob, and carol; group 2, “Office lunch,” contains bob and dan.

In another terminal, install and start the frontend:

```sh
cd frontend
cp .env.example .env.local
npm ci
npm run dev
```

The API is at `http://localhost:8000`; the frontend is at `http://localhost:3000`. The frontend environment variable `NEXT_PUBLIC_API_URL` defaults to the local API URL. Backend CORS allows localhost and 127.0.0.1 on port 3000 by default.

## API examples

All routes use `http://localhost:8000`. Use a demo username in `X-User`.

```sh
curl -H 'X-User: alice' http://localhost:8000/groups
curl -H 'X-User: alice' http://localhost:8000/groups/1
```

Create an equal-share expense. Keep the returned `id` for the delete example below.

```sh
curl -i -X POST http://localhost:8000/groups/1/expenses \
  -H 'Content-Type: application/json' \
  -H 'X-User: alice' \
  -H 'Idempotency-Key: lunch-equal-001' \
  -d '{"description":"Lunch","paid_by":"alice","amount":"10.00","split":{"type":"equal","members":["alice","bob","carol"]}}'
```

Create an exact-share expense with a different idempotency key:

```sh
curl -i -X POST http://localhost:8000/groups/1/expenses \
  -H 'Content-Type: application/json' \
  -H 'X-User: bob' \
  -H 'Idempotency-Key: lunch-exact-001' \
  -d '{"description":"Exact lunch","paid_by":"bob","amount":"10.00","split":{"type":"exact","shares":{"alice":"4.25","bob":"5.75"}}}'
```

List active expenses and balances:

```sh
curl -H 'X-User: alice' http://localhost:8000/groups/1/expenses
curl -H 'X-User: alice' http://localhost:8000/groups/1/balances
```

Delete an expense using the UUID in a create response. Only its payer can delete it:

```sh
curl -i -X DELETE http://localhost:8000/groups/1/expenses/REPLACE_WITH_RETURNED_UUID \
  -H 'X-User: alice'
```

Errors use a consistent envelope, for example: `{"error":{"code":"IDEMPOTENCY_CONFLICT","message":"Idempotency key was already used for a different request.","details":null}}`. Validation errors may include structured `details`.

## Behavior and decisions

- Money is decimal text with at most two fractional digits (satang). Amounts must be positive and no greater than `9999999999.99`; invalid precision, format, or range is rejected. Exact shares may include zero, but must sum exactly to the total.
- Equal splits convert the total to integer satang, divide by member count, and give one extra satang to each of the first members in request order until the remainder is used. Member order is therefore part of the allocation.
- Balances aggregate each member's paid totals and shares separately, then subtract shares from paid totals. Positive means owed money; negative means owing money.
- `X-User` selects the requester, but is a demo-only identity header, not authentication. The requester must belong to the group; payer and split members must also be group members. An inaccessible or missing group returns 404 rather than revealing whether it exists. Only the payer may delete an expense.
- Every create request requires an `Idempotency-Key`, unique within its group. A canonical SHA-256 hash normalizes money and exact-share key order while preserving description and equal-split member order. Same key and same request returns the original expense; same key with different content returns 409. Database uniqueness makes concurrent attempts safe. Soft-deleted expenses retain their idempotency record, so a retry replays the deleted expense rather than creating another.
- Delete sets `deleted_at`; it does not erase expense history. Deleted expenses no longer appear in active expense lists or balances. Repeated deletion returns 404.

These choices favor a small, inspectable implementation over broad infrastructure: one API, a PostgreSQL database, seeded users, and no service orchestration. The seed only adds missing records; it is not a database reset. Authentication is deliberately absent, and users/groups are fixed demo data.

## Checks

Backend checks run from `backend/`. Set `TEST_DATABASE_URL` to a separate PostgreSQL 16 database and user before pytest; tests migrate and seed that database. They never use `DATABASE_URL` as a fallback.

```sh
cd backend
. .venv/bin/activate
export TEST_DATABASE_URL='postgresql+psycopg://splitbill_test:local-only-change-me@localhost:5432/splitbill_test'
pytest
ruff check .
ruff format --check .
```

Frontend checks run from `frontend/` after `npm ci`:

```sh
npm test
npm run lint
npm run build
```

Do not point `TEST_DATABASE_URL` at the application database: pytest runs migrations and writes seed data.

## Scope and next steps

Not included: settlements, repayments, Compose, user registration, real authentication, group editing, expense editing, notifications, multiple currencies, and payment integrations. If extending this beyond an assessment, add real authentication and authorization first, then operational deployment/secrets management and broader integration coverage. Keep settlement and repayment features out until the core accounting rules are reviewed.

Estimated implementation effort: roughly 2–4 focused engineering days for the required backend, frontend, migrations, tests, and documentation, excluding optional features and review time. This is a planning estimate, not a measured time log.
