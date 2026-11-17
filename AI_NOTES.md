# AI-assisted development notes

AI tools helped implement and review the app in task-agent sessions using isolated Git worktrees. Assistance covered backend APIs, allocation and idempotency, tests, frontend forms and behavior, and debugging integration issues. Managed Chromium was used for real-browser checks; PostgreSQL 16, pytest/HTTPX, Ruff, Vitest, ESLint, and the Next.js production build were used in verification.

## Effective prompt

> Use PostgreSQL ON CONFLICT DO NOTHING with a separate read under READ COMMITTED; preserve equal-member order and return stored shares on matching retry.

The resulting PostgreSQL commit/rollback race tests and real-browser equal-allocation check passed.

## Incorrect or unsafe output

Ticket 01's generated backend configuration omitted `psycopg`, although the database URL used `postgresql+psycopg`. Its test setup also fell back from `TEST_DATABASE_URL` to `DATABASE_URL`, which could run migrations or seed data against a developer's application database. Read-only code review caught both before the final gate. The fix added `psycopg[binary]>=3.2,<4` and required an explicit `TEST_DATABASE_URL`; HTTP tests then ran against a separate PostgreSQL 16 test database.

Other review and test feedback caught a missing group-router import and SQLAlchemy reverse relationship (ticket 02), and an invalid allocation test expecting a valid zero share to fail (ticket 03). The failing allocation run reported 1 failed and 22 passed; after correcting the mismatch fixture and removing a duplicate test, 24 passed. In ticket 04, rendered tests missed a click-order mismatch between the equal-split preview and persisted shares. A managed Chromium run and PostgreSQL history/balances exposed it; the checkbox registration was corrected and an order assertion added. The correction was checked in Chromium and tests.

## Review and recorded verification

Review agents and the parent reviewed changes and test results before commits. Recorded phase checks:

- Ticket 01: backend pytest 5 passed; frontend tests 2 passed; Ruff, ESLint, and Next.js build passed. PostgreSQL 16.15 migrations and seed were run twice; counts remained 4 users, 2 groups, and 5 memberships.
- Ticket 02: backend pytest 8 passed; frontend tests 6 passed; Ruff, ESLint, and Next.js build passed.
- Ticket 03: backend pytest 43 passed; frontend Vitest 31 passed; ESLint and Next.js build passed.
- Tickets 04/05: backend pytest 53 passed; frontend Vitest 40 passed; Ruff, ESLint, and Next.js build passed. Chromium verified preview order against persisted shares and balances.
- Ticket 06: backend pytest 56 passed; frontend Vitest 42 passed; Ruff, ESLint, and Next.js build passed. Chromium checked payer-only deletion and updated history and balances.

These are recorded results from implementation phases, not checks of this documentation branch. The parent will run final checks after merge. Tool summaries did not record Ruff, ESLint, or build counts.

## Limitations

The app uses `X-User` selection, not full authentication. Settlements, repayments, and Docker Compose were excluded as optional scope. The developer remains responsible for reviewing all generated code and results.
