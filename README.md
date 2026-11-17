# SplitBill

## Local setup

Run PostgreSQL 16 locally and create database `splitbill`, user `splitbill`, and a password.
Copy `backend/.env.example` to `backend/.env`, then export its values before running the backend:

```sh
cd backend
python -m venv .venv
. .venv/bin/activate
set -a
. .env
set +a
pip install -e '.[test]'
alembic upgrade head
python -m app.scripts.seed
uvicorn app.main:app --reload
```

The seed can run repeatedly. It creates users `alice`, `bob`, `carol`, `dan`; Chiang Mai trip
contains alice, bob, carol; Office lunch contains bob, dan.

In another terminal:

```sh
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

The API listens on `http://localhost:8000`; the page listens on `http://localhost:3000`.
`CORS_ORIGINS` defaults to both localhost and 127.0.0.1 on port 3000.
