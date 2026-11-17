# AI-Assisted Development

## Workflow

ChatGPT supported early ideation and requirements gathering. Pi (Oh My Pi) orchestrated AI coding sessions using GPT-6 Sol and Luna. Agent skills guided requirements review, specification writing, ticket breakdown, TDD implementation, and retrospectives. The agents contributed to backend APIs, allocation and idempotency, tests, frontend forms and behavior, and integration debugging. Managed Chromium supported browser verification.

The workflow used these agent skills:

1. `grill-me-with-docs` challenged unclear requirements and surfaced trade-offs.
2. `to-spec` produced technical specifications with architecture, module boundaries, and acceptance criteria.
3. `to-tickets` split specifications into ordered issues in `.scratch/`.
4. `implement-spec` with `orchestrate` assigned tickets to subagents for TDD on an integration branch.
5. Specification review, tests, and `to-retro` informed case-by-case refactoring.

The project specifications live in `docs/my-spec.md` and `.scratch/splitbill/spec.md`.

## Review findings

- Ticket 01 omitted `psycopg` despite using a `postgresql+psycopg` URL. Its tests also fell back from `TEST_DATABASE_URL` to `DATABASE_URL`, risking migrations or seed data against the application database. Review caught both before final checks. The fix added `psycopg[binary]>=3.2,<4` and required a separate `TEST_DATABASE_URL`.
- Ticket 02 missed a group-router import and a SQLAlchemy reverse relationship.
- Ticket 03 included an invalid allocation test that expected a valid zero share to fail. The initial run had 1 failure and 22 passes. After correcting the fixture and removing a duplicate test, 24 passed.
- Ticket 04's rendered tests missed a click-order mismatch between the equal-split preview and persisted shares. Chromium and PostgreSQL history/balances exposed it. The checkbox registration was corrected and an order assertion added; the fix was checked in Chromium and tests.

## Recorded verification

Before each ticket integration commit, review agents and the main agent inspected the complete worktree diff against the specification and checked relevant test and gate results. Findings blocked integration until corrected. Gate failures and browser findings led to fixes before ticket resolution.

- Ticket 01: backend pytest 5 passed; frontend tests 2 passed; Ruff, ESLint, and Next.js build passed. PostgreSQL 16.15 migrations and seed ran twice; counts remained 4 users, 2 groups, and 5 memberships.
- Ticket 02: backend pytest 8 passed; frontend tests 6 passed; Ruff, ESLint, and Next.js build passed.
- Ticket 03: backend pytest 43 passed; frontend Vitest 31 passed; ESLint and Next.js build passed.
- Tickets 04/05: backend pytest 53 passed; frontend Vitest 40 passed; Ruff, ESLint, and Next.js build passed. Chromium verified preview order against persisted shares and balances.
- Ticket 06: backend pytest 56 passed; frontend Vitest 42 passed; Ruff, ESLint, and Next.js build passed. Chromium checked payer-only deletion and updated history and balances.

These are historical results, not a substitute for current checks. Final integration checks passed 56 backend tests and 45 frontend tests, Ruff, ESLint, and the Next.js build. A later Docker Compose smoke check covered migrations, seeding, browser expense creation, and persistence across `down`/`up`.
