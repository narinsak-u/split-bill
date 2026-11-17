# SplitBill — Implementation Specification

**Project:** SplitBill — Shared Expense Management  
**Type:** Full Stack Take-Home Assignment  
**Company:** Chowpa  
**Version:** 1.0  
**Status:** Ready for Implementation

---

# 1. Project Overview

## 1.1 Objective

Build a full-stack shared-expense management application that allows users to:

- View groups they belong to.
- Record shared expenses within a group.
- Split expenses equally or by exact amounts.
- Calculate each member's net balance accurately to the satang.
- View group expenses and balances.
- Soft-delete expenses with payer-only authorization.
- Prevent duplicate expense creation using idempotency keys.

The application must prioritize:

1. Correct business logic.
2. Monetary precision.
3. Database consistency.
4. Authorization.
5. Concurrent-safe idempotency.
6. Automated tests.
7. Clean and maintainable code.
8. Clear engineering documentation.

Do not prioritize visual polish or optional features over correctness.

## 1.2 Mandatory Technology Stack

| Component | Technology |
|---|---|
| Backend | Python 3.12+, FastAPI |
| Database | PostgreSQL 16 |
| Database ORM | SQLAlchemy 2.x |
| Database Migration | Alembic |
| Validation | Pydantic v2 |
| Backend Testing | pytest, HTTPX |
| Python Linting | Ruff |
| Frontend | Next.js App Router |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Server State | TanStack Query |
| Forms | React Hook Form |
| Frontend Validation | Zod |
| Frontend Linting | ESLint |

The ORM, frontend state management, and form libraries are implementation choices. The primary framework requirements come from the assignment.

Use compatible stable versions. Avoid experimental dependencies.

## 1.3 Scope

### Required

- User selection through `X-User`.
- Group listing.
- Group detail.
- Create expense.
- List expenses.
- Delete expense (soft delete).
- Calculate group balances.
- Equal split.
- Exact split.
- Monetary validation.
- Group membership validation.
- Payer-only deletion.
- Concurrent-safe idempotency.
- Next.js single-page interface.
- Live split preview.
- Error handling.
- Automated backend tests.
- Database migrations.
- Seed data.
- README.
- AI_NOTES.
- Incremental Git history.

### Optional

Only implement these after the required scope is complete and tested:

- Settlement suggestions.
- Repayments.
- Docker Compose.

Docker Compose is preferred if sufficient time remains.

### Out of Scope

Do not implement:

- Full authentication.
- JWT or OAuth.
- User registration.
- Group creation or modification.
- Expense editing.
- Notifications.
- Real-time WebSockets.
- Microservices.
- Message queues.
- Payment gateway integrations.
- Multi-currency support.
- Complex dashboards.
- Nginx or Caddy reverse proxy.

---

# 2. Architecture

## 2.1 Architectural Style

Use a **Modular Monolith** with lightweight layered separation.

Backend layers:

1. **API/Routers** — HTTP transport and request handling.
2. **Schemas** — Input/output validation and serialization.
3. **Services** — Business logic and use-case orchestration.
4. **Repositories** — Database access.
5. **Models** — SQLAlchemy database entities.
6. **Core** — Configuration, error handling, and dependencies.

Avoid unnecessary abstractions.

Do not create interfaces for every service or repository unless they solve a concrete testing or dependency problem.

Business rules must not live directly inside routers or ORM models.

## 2.2 High-Level Data Flow

```text
Browser
   |
   v
Next.js Application
   |
   | HTTP + JSON
   | X-User Header
   v
FastAPI
   |
   +-- API Router
   |      |
   |      v
   +-- Request Validation
   |      |
   |      v
   +-- Application Services
   |      |
   |      +-- Authorization
   |      +-- Money Allocation
   |      +-- Idempotency
   |      +-- Balance Calculation
   |      |
   |      v
   +-- Repositories
          |
          v
     SQLAlchemy
          |
          v
     PostgreSQL 16
```

FastAPI is the source of truth for all business rules.

Frontend validation improves usability but must never replace backend validation.

---

# 3. Repository Structure

Use the following structure:

```text
splitbill/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── dependencies.py
│   │   │   └── exceptions.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   ├── session.py
│   │   │   └── models.py
│   │   ├── api/
│   │   │   ├── groups.py
│   │   │   └── expenses.py
│   │   ├── schemas/
│   │   │   ├── group.py
│   │   │   ├── expense.py
│   │   │   └── error.py
│   │   ├── services/
│   │   │   ├── allocation.py
│   │   │   ├── group_service.py
│   │   │   ├── expense_service.py
│   │   │   └── balance_service.py
│   │   └── repositories/
│   │       ├── group_repository.py
│   │       └── expense_repository.py
│   ├── alembic/
│   │   └── versions/
│   ├── scripts/
│   │   └── seed.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── unit/
│   │   │   └── test_allocation.py
│   │   └── integration/
│   │       ├── test_groups.py
│   │       ├── test_expenses.py
│   │       ├── test_balances.py
│   │       └── test_idempotency.py
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── providers.tsx
│   │   │   └── globals.css
│   │   ├── features/
│   │   │   ├── groups/
│   │   │   │   ├── api.ts
│   │   │   │   ├── hooks/
│   │   │   │   └── components/
│   │   │   └── expenses/
│   │   │       ├── api.ts
│   │   │       ├── hooks/
│   │   │       ├── components/
│   │   │       └── schemas/
│   │   ├── components/
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   ├── api-client.ts
│   │   │   └── money.ts
│   │   └── types/
│   │       └── api.ts
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── compose.yaml
├── README.md
├── AI_NOTES.md
└── .gitignore
```

Keep the implementation focused.

Do not introduce a full domain/application/infrastructure/presentation hierarchy for this small assessment.

---

# 4. Database Design

Use PostgreSQL 16 and manage the schema using Alembic migrations.

## 4.1 Users

Table: `users`

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | Primary key |
| username | VARCHAR(50) | Unique, not null |

## 4.2 Groups

Table: `groups`

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT | Primary key |
| name | VARCHAR(150) | Not null |

## 4.3 Group Members

Table: `group_members`

| Column | Type | Constraints |
|---|---|---|
| group_id | BIGINT | FK → groups.id |
| user_id | BIGINT | FK → users.id |

Primary key:

`(group_id, user_id)`

## 4.4 Expenses

Table: `expenses`

| Column | Type | Constraints |
|---|---|---|
| id | UUID | Primary key |
| group_id | BIGINT | FK → groups.id |
| paid_by_user_id | BIGINT | FK → users.id |
| description | TEXT | Not null |
| amount | NUMERIC(12,2) | Not null, positive |
| split_type | VARCHAR(10) | equal / exact |
| idempotency_key | VARCHAR(255) | Not null |
| request_hash | CHAR(64) | Not null |
| created_at | TIMESTAMPTZ | Not null |
| deleted_at | TIMESTAMPTZ | Nullable |

Constraints:

- `CHECK (amount > 0)`
- `CHECK (split_type IN ('equal', 'exact'))`
- `UNIQUE (group_id, idempotency_key)`

Create an index on `(group_id, created_at DESC)` to support expense listing.

## 4.5 Expense Shares

Table: `expense_shares`

| Column | Type | Constraints |
|---|---|---|
| expense_id | UUID | FK → expenses.id |
| user_id | BIGINT | FK → users.id |
| amount | NUMERIC(12,2) | Not null, non-negative |
| allocation_order | INTEGER | Not null |

Constraints:

- Primary key: `(expense_id, user_id)`
- Unique: `(expense_id, allocation_order)`
- `CHECK (amount >= 0)`
- `CHECK (allocation_order >= 0)`

Store finalized shares rather than recalculating allocations from the original request.

The service must enforce the invariant:

`SUM(expense_shares.amount) = expenses.amount`

Database check constraints alone do not enforce this cross-row invariant.

## 4.6 Seed Data

Create an idempotent seed script.

Users:

- alice
- bob
- carol
- dan

Groups:

| ID | Name | Members |
|---|---|---|
| 1 | Chiang Mai trip | alice, bob, carol |
| 2 | Office lunch | bob, dan |

Running the seed script multiple times must not create duplicates.

---

# 5. Business Rules

## BR-01: Monetary Precision

All monetary input must be represented as decimal strings.

Examples:

Valid:

- `"1000.00"`
- `"10.5"`
- `"10"`

Invalid:

- `"10.005"`
- `"0"`
- `"-10.00"`
- Non-numeric values.

Rules:

- Use `Decimal` on the backend.
- Use `NUMERIC(12,2)` in PostgreSQL.
- Never use `float` for monetary calculations.
- Reject non-finite values.
- Reject values exceeding database precision.
- Reject amounts less than or equal to zero.
- Validate precision before persistence.
- Never silently round invalid input.

For individual exact shares, zero is allowed, but negative amounts are prohibited.

## BR-02: Equal Split

Input:

```json
{
  "type": "equal",
  "members": ["alice", "bob", "carol"]
}
```

Algorithm:

1. Validate at least one member.
2. Reject duplicate members.
3. Convert the amount into integer satang.
4. Divide by the number of members using integer division.
5. Calculate the remainder.
6. Distribute one additional satang to each member in the supplied order until the remainder is exhausted.
7. Return Decimal shares.

Example:

```text
Amount: 100.00 THB
Members: alice, bob, carol

alice: 33.34
bob:   33.33
carol: 33.33

Total: 100.00
```

Member order must be preserved.

## BR-03: Exact Split

Input:

```json
{
  "type": "exact",
  "shares": {
    "alice": "500.00",
    "bob": "300.00",
    "carol": "200.00"
  }
}
```

Rules:

- At least one share is required.
- All share amounts must have valid precision.
- Negative share amounts are prohibited.
- Every member must belong to the group.
- Sum of shares must equal the expense amount exactly.
- Reject mismatches with a descriptive validation error.

## BR-04: Zero-Sum Balances

For each group member:

`balance = total_paid - total_share`

Rules:

- Positive balance means the member is owed money.
- Negative balance means the member owes money.
- All group member balances must sum to exactly `0.00`.
- Deleted expenses must not affect balances.
- Members with no expense activity must still appear with `0.00`.

Calculate paid totals and share totals separately to avoid duplicated aggregation caused by joins.

## BR-05: Group Authorization

Every group-specific endpoint must verify that the requesting user belongs to the group.

Requests use:

`X-User: <username>`

Full authentication is out of scope.

For unauthorized group access, return `404 GROUP_NOT_FOUND`.

This prevents disclosure of group existence.

## BR-06: Membership Validation

Before creating an expense:

- Requesting user must belong to the group.
- Payer must belong to the group.
- Every split member must belong to the group.
- Duplicate split members are prohibited.

The payer does not need to be included in the expense split.

## BR-07: Idempotency

Each expense creation request requires an `Idempotency-Key`.

Scope:

`(group_id, idempotency_key)`

Requirements:

- The first successful request creates an expense.
- Repeating the same request returns the original expense.
- The same request must not create duplicates.
- The guarantee must hold under concurrent requests.
- Reusing a key with a different payload returns HTTP 409.

Use a PostgreSQL unique constraint, transaction, and conflict handling.

Do not implement idempotency using only an application-level SELECT-before-INSERT check.

Compute a canonical request hash using SHA-256.

Canonicalization must preserve semantically important information, including equal-split member ordering.

Implement insert-first conflict handling using PostgreSQL `ON CONFLICT DO NOTHING`, followed by a separate read statement when a conflict occurs.

Do not use exception-driven session rollback without correctly restoring the transaction state.

When a retry matches an existing expense:

- Return the original expense ID.
- Return the original allocation.
- Do not modify the existing record.
- Do not create new shares.
- Do not reactivate a soft-deleted expense.

## BR-08: Expense Immutability

Expenses cannot be updated.

Do not implement PUT or PATCH expense endpoints.

Deletion is implemented using `deleted_at`.

Rules:

- Only the payer can delete an expense.
- The record remains in the database.
- Deleted expenses are excluded from normal expense listings and balances.
- Repeated DELETE returns 404.
- Idempotency records remain valid after deletion.

---

# 6. REST API Contracts

All endpoints require `X-User`.

All monetary amounts in JSON must be strings.

## 6.1 GET /groups

Returns groups of the current user.

Response: 200

```json
{
  "groups": [
    {
      "id": 1,
      "name": "Chiang Mai trip"
    }
  ]
}
```

## 6.2 GET /groups/{group_id}

Returns group details and members.

Response: 200

```json
{
  "id": 1,
  "name": "Chiang Mai trip",
  "members": [
    { "username": "alice" },
    { "username": "bob" },
    { "username": "carol" }
  ]
}
```

## 6.3 POST /groups/{group_id}/expenses

Headers:

```http
X-User: alice
Idempotency-Key: unique-request-key
```

Equal split request:

```json
{
  "description": "Dinner",
  "paid_by": "alice",
  "amount": "1000.00",
  "split": {
    "type": "equal",
    "members": ["alice", "bob", "carol"]
  }
}
```

Exact split request:

```json
{
  "description": "Dinner",
  "paid_by": "alice",
  "amount": "1000.00",
  "split": {
    "type": "exact",
    "shares": {
      "alice": "500.00",
      "bob": "300.00",
      "carol": "200.00"
    }
  }
}
```

Successful creation: HTTP 201.

Response:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "group_id": 1,
  "description": "Dinner",
  "paid_by": "alice",
  "amount": "1000.00",
  "split": {
    "type": "equal",
    "shares": [
      {
        "username": "alice",
        "amount": "333.34"
      },
      {
        "username": "bob",
        "amount": "333.33"
      },
      {
        "username": "carol",
        "amount": "333.33"
      }
    ]
  },
  "created_at": "2026-11-17T04:00:00Z",
  "deleted_at": null
}
```

Repeated matching request: HTTP 200 with the original resource.

## 6.4 GET /groups/{group_id}/expenses

Response: 200

```json
{
  "expenses": []
}
```

Return complete expense objects, including their stored shares.

Order by:

1. `created_at DESC`
2. `id DESC`

Exclude soft-deleted expenses.

## 6.5 DELETE /groups/{group_id}/expenses/{expense_id}

Response: 204 No Content.

Only the payer may delete.

Use a database update that sets `deleted_at`.

Do not physically delete the expense or its shares.

## 6.6 GET /groups/{group_id}/balances

Response: 200

```json
{
  "group_id": 1,
  "balances": [
    {
      "username": "alice",
      "paid": "1000.00",
      "share": "333.34",
      "balance": "666.66"
    },
    {
      "username": "bob",
      "paid": "0.00",
      "share": "333.33",
      "balance": "-333.33"
    },
    {
      "username": "carol",
      "paid": "0.00",
      "share": "333.33",
      "balance": "-333.33"
    }
  ],
  "total_balance": "0.00"
}
```

## 6.7 Error Format

All application errors must use:

```json
{
  "error": {
    "code": "INVALID_SPLIT_TOTAL",
    "message": "The shares do not add up to the total.",
    "details": {
      "expected": "1000.00",
      "actual": "999.99"
    }
  }
}
```

Required error codes:

- `INVALID_USER`
- `GROUP_NOT_FOUND`
- `EXPENSE_NOT_FOUND`
- `INVALID_AMOUNT`
- `INVALID_SPLIT_TOTAL`
- `INVALID_SPLIT_MEMBER`
- `EXPENSE_DELETE_FORBIDDEN`
- `MISSING_IDEMPOTENCY_KEY`
- `IDEMPOTENCY_CONFLICT`
- `VALIDATION_ERROR`
- `INTERNAL_SERVER_ERROR`

Use appropriate HTTP statuses:

- 400 — Invalid identity/header.
- 403 — Payer-only deletion violation.
- 404 — Inaccessible group or nonexistent expense.
- 409 — Idempotency conflict.
- 422 — Request validation errors.
- 500 — Unexpected server errors.

Implement consistent exception handling.

Do not expose stack traces or internal database details in API responses.

---

# 7. Backend Implementation

## 7.1 Dependency Injection

Use FastAPI `Depends` for:

- Database session.
- Current user.
- Application services.

Avoid creating database sessions directly inside router functions.

## 7.2 Service Responsibilities

**GroupService**

- List accessible groups.
- Retrieve group detail.
- Enforce group membership.

**ExpenseService**

- Validate expense creation.
- Enforce payer/split membership.
- Calculate allocation.
- Handle idempotency.
- Create expense and shares atomically.
- List expenses.
- Soft-delete expenses.

**BalanceService**

- Aggregate member paid amounts.
- Aggregate member share amounts.
- Calculate net balances.
- Ensure zero-sum results.

**Allocation Module**

- Validate monetary precision.
- Calculate equal splits.
- Validate exact splits.
- Convert between Decimal and satang.

Allocation functions should be pure and independent of FastAPI or SQLAlchemy.

## 7.3 Database Transactions

Creating an expense and its shares must be atomic.

Use a single transaction for persistence.

Do not commit an expense before all its shares are successfully stored.

On failure, roll back the entire operation.

## 7.4 Concurrency Safety

Use PostgreSQL to enforce idempotency uniqueness.

Test multiple simultaneous requests against the real database.

Ensure transaction behavior is correct when:

- The first request commits.
- The first request rolls back.
- Two requests use the same key.
- A retry uses the same key but different payload.

---

# 8. Frontend Specification

Build one Next.js page.

## 8.1 Required Components

```text
SplitBillPage
├── UserSelector
├── GroupSelector
├── ExpenseForm
│   ├── DescriptionInput
│   ├── AmountInput
│   ├── PayerSelector
│   ├── SplitTypeSelector
│   ├── MemberSelector
│   ├── ExactShareInputs
│   └── SplitPreview
├── BalanceSummary
└── ExpenseList
```

## 8.2 User Selection

Provide a selector for:

- alice
- bob
- carol
- dan

When the user changes:

1. Update the current `X-User`.
2. Clear selected group.
3. Clear group-specific expense form state.
4. Fetch groups accessible to the selected user.
5. Invalidate user-dependent cached data.

Do not display groups that the selected user cannot access.

## 8.3 Group Selection

Display groups returned by GET `/groups`.

When a group is selected:

- Fetch group details.
- Fetch expenses.
- Fetch balances.
- Populate payer and split-member options.

## 8.4 Expense Form

Required fields:

- Description.
- Amount.
- Payer.
- Split type.
- Members or exact shares.

Validation:

- Description cannot be empty.
- Amount must be positive.
- Amount precision cannot exceed two decimals.
- Payer must be a group member.
- At least one split member is required.
- Duplicate members are prohibited.
- Exact shares must sum to the total.

## 8.5 Live Split Preview

Update allocation immediately as inputs change.

Equal split example:

```text
Amount: 100.00

alice: 33.34
bob:   33.33
carol: 33.33
```

Exact split must display the unallocated amount:

`unallocated = expense_amount - sum(shares)`

Disable submission unless:

`unallocated === 0`

Do not use floating-point arithmetic for money.

Implement shared frontend money utilities using integer satang.

## 8.6 Submission

Generate an idempotency key for each new logical submission.

Use the same key when retrying that submission.

Do not generate a new key automatically on network retry.

On successful submission:

1. Show success feedback.
2. Clear or reset the form.
3. Generate a new key for the next submission.
4. Invalidate expenses query.
5. Invalidate balances query.

On failure:

- Preserve user input.
- Display an understandable error.
- Allow safe retry.

## 8.7 Balances

Display every member.

Clearly distinguish:

- Positive balance — money owed to the member.
- Negative balance — money the member owes.
- Zero balance — settled.

Use Thai-style number formatting:

`1,000.00`

## 8.8 Expense List

Display:

- Description.
- Amount.
- Payer.
- Creation time.
- Split shares.
- Delete action when the selected user is the payer.

Show newest expenses first.

After deletion, refresh expenses and balances.

## 8.9 Loading and Error States

Handle:

- Initial loading.
- Empty groups.
- Empty expenses.
- API errors.
- Network failures.
- Mutation in progress.
- Submission success.
- Unauthorized group access.

Avoid silent failures.

---

# 9. Testing Specification

## 9.1 Backend Unit Tests

Test allocation logic without connecting to the database.

Required cases:

1. Equal split of 100.00 among three members.
2. Correct remaining satang distribution.
3. Exact split with correct total.
4. Exact split with incorrect total.
5. Three-decimal-place amount rejection.
6. Zero and negative amount rejection.
7. Duplicate members rejection.
8. Empty split rejection.
9. One-satang allocation across multiple members.

## 9.2 Backend Integration Tests

Use PostgreSQL 16.

Required cases:

1. Seed users and groups are accessible.
2. GET `/groups` returns only accessible groups.
3. Alice cannot read group 2.
4. Alice cannot create an expense in group 2.
5. Payer must belong to the group.
6. Split members must belong to the group.
7. Creating an expense persists correct shares.
8. Repeating an idempotency key creates one expense.
9. Concurrent same-key requests create one expense.
10. Same key with different payload returns 409.
11. Only the payer can delete an expense.
12. Soft-deleted expenses are excluded from balances.
13. Zero-sum balances hold after multiple expenses.
14. Failed transactions do not persist partial data.

## 9.3 Frontend Tests

Test:

- Money conversion.
- Equal split preview.
- Exact split validation.
- Unallocated amount.
- Group filtering by selected user.
- Form submission disabled state.
- Error message mapping.
- Query invalidation after mutation.

## 9.4 Test Commands

Backend:

```bash
pytest
ruff check .
ruff format --check .
```

Frontend:

```bash
npm run lint
npm run build
```

All commands must pass before submission.

---

# 10. Environment and Deployment

## 10.1 Configuration

Provide `.env.example` files.

Backend variables:

```env
DATABASE_URL=postgresql+psycopg://splitbill:password@localhost:5432/splitbill
```

Frontend variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Do not commit actual secrets.

## 10.2 Docker Compose

Optional but recommended.

Services:

- PostgreSQL.
- FastAPI.
- Next.js.

Expose:

- Frontend: localhost:3000.
- Backend: localhost:8000.
- Database: internal networking; host exposure only if necessary for local development.

Do not introduce a reverse proxy.

Provide database health checks and documented migration/seed commands.

## 10.3 Reproducible Setup

The project must be runnable from a fresh clone.

README must include:

1. Prerequisites.
2. Environment setup.
3. Database startup.
4. Migration execution.
5. Seed execution.
6. Backend startup.
7. Frontend startup.
8. Test execution.
9. Example API requests.

---

# 11. Documentation

## 11.1 README.md

Must contain:

- Project overview.
- Technology stack.
- Architecture overview.
- Repository structure.
- Setup instructions.
- API endpoints.
- Test instructions.
- Monetary precision strategy.
- Equal split algorithm.
- Idempotency design.
- Authorization design.
- Soft-delete behavior.
- Design decisions and trade-offs.
- Assumptions.
- Known limitations.
- Proposed next steps.
- Approximate development time.

Explicitly explain why 404 was chosen for inaccessible groups.

## 11.2 AI_NOTES.md

Must contain:

- AI tools used.
- Areas assisted by AI.
- One or two effective prompts.
- At least one real example of incorrect or unsafe AI-generated output.
- How that issue was detected.
- How it was corrected.
- Code review process before commits.

Do not invent AI mistakes.

Record actual examples encountered during implementation.

The developer remains responsible for all submitted code.

## 11.3 Git Commit History

Use incremental commits.

Suggested commits:

```text
chore: initialize project structure
feat(db): add models and migrations
feat(db): implement seed data
feat(api): implement group endpoints
feat(expenses): implement allocation logic
feat(expenses): implement creation and listing
feat(expenses): add authorization and soft delete
feat(expenses): implement idempotency
test: cover allocation business rules
test: add API integration tests
feat(frontend): implement expense form
feat(frontend): add preview and balances
docs: add setup and architecture decisions
docs: document AI-assisted development
```

Do not submit a single bulk commit.

---

# 12. Implementation Phases

## Phase 1 — Foundation

Tasks:

- Initialize repository.
- Configure FastAPI.
- Configure Next.js.
- Configure PostgreSQL.
- Configure SQLAlchemy.
- Configure Alembic.
- Create models.
- Create migrations.
- Create seed script.
- Configure Ruff and ESLint.

Acceptance:

- Backend starts successfully.
- Database migrations apply successfully.
- Seed data is correct.
- Frontend starts successfully.

## Phase 2 — Business Logic

Tasks:

- Implement Decimal validation.
- Implement equal split.
- Implement exact split.
- Implement balance calculation.
- Add pure unit tests.

Acceptance:

- Allocation is exact to the satang.
- No floating-point arithmetic.
- Invalid amounts are rejected.
- Zero-sum invariants hold.

## Phase 3 — REST API

Tasks:

- Implement group endpoints.
- Implement expense creation.
- Implement expense listing.
- Implement balances.
- Implement soft deletion.
- Implement authorization.
- Implement idempotency.
- Implement consistent API errors.

Acceptance:

- All six endpoints work.
- Authorization is enforced.
- Duplicate expenses are prevented.
- Database consistency is maintained.

## Phase 4 — Testing

Tasks:

- Add API integration tests.
- Add authorization tests.
- Add soft-delete tests.
- Add PostgreSQL concurrency tests.
- Run formatting and linting.

Acceptance:

- All mandatory pytest cases pass.
- Concurrent idempotency is verified.
- No partial expense records remain after failures.

## Phase 5 — Frontend

Tasks:

- Implement user selector.
- Implement group selector.
- Implement expense form.
- Implement equal/exact split preview.
- Implement balances.
- Implement expenses list.
- Implement delete action.
- Implement loading/error states.

Acceptance:

- All required UI functionality works.
- Frontend preview matches backend.
- API errors are understandable.
- Mutations refresh relevant data.

## Phase 6 — Delivery

Tasks:

- Review source code.
- Run all tests.
- Verify linting.
- Verify fresh-clone setup.
- Complete README.
- Complete AI_NOTES.
- Verify incremental Git history.
- Check for secrets.
- Prepare for technical interview.

Acceptance:

- Repository is reproducible.
- Required scope is complete.
- Documentation is accurate.
- Code can be explained and modified during live coding.

---

# 13. Design Decisions and Assumptions

The following decisions must be documented in README.

| Topic | Decision |
|---|---|
| Unknown X-User | HTTP 400 |
| Inaccessible group | HTTP 404 |
| Duplicate split members | Reject |
| Empty split | Reject |
| Payer included in split | Optional |
| Money storage | NUMERIC(12,2) |
| Backend calculations | Decimal |
| Frontend calculations | Integer satang |
| Equal split remainder | Allocate in supplied order |
| Exact share amount | Non-negative |
| Idempotency scope | Per group |
| Reused key, different payload | HTTP 409 |
| Repeated same request | Return original expense |
| Expense update | Not supported |
| Expense deletion | Soft delete |
| Repeated deletion | HTTP 404 |
| Deleted expense retry | Return original resource |
| Expense ordering | Newest first, deterministic tie-breaker |
| Architecture | Lightweight layered modular monolith |

Do not silently make additional assumptions.

Record new decisions with their rationale.

---

# 14. Non-Functional Requirements

## Correctness

- All calculations must be deterministic.
- No monetary precision loss.
- Zero-sum balances must always hold for committed valid data.

## Data Integrity

- Use foreign keys.
- Use appropriate unique constraints.
- Use transactions for multi-row writes.
- Prevent concurrent duplicate expense creation.

## Maintainability

- Keep functions small and focused.
- Use descriptive names.
- Separate transport logic from business logic.
- Avoid unnecessary dependencies.
- Avoid speculative abstractions.

## Security

- Validate all inputs.
- Enforce authorization on the backend.
- Use parameterized ORM queries.
- Do not expose database internals.
- Do not commit credentials.
- Treat `X-User` as an assignment-only identity mechanism.

## Developer Experience

- Include `.env.example`.
- Provide clear startup commands.
- Keep local development simple.
- Make tests reproducible.
- Document required services.

---

# 15. Definition of Done

The project is complete only when:

- [ ] All six required REST endpoints are implemented.
- [ ] All seven mandatory business rules are satisfied.
- [ ] Monetary precision is correct to the satang.
- [ ] Equal and exact splits behave correctly.
- [ ] Group authorization is enforced.
- [ ] Payer-only soft deletion works.
- [ ] Idempotency survives concurrent requests.
- [ ] All group balances sum to exactly zero.
- [ ] Required pytest cases pass.
- [ ] PostgreSQL migrations and seed data work.
- [ ] Frontend contains all required features.
- [ ] Frontend split preview matches backend.
- [ ] API errors are displayed clearly.
- [ ] Ruff and ESLint pass.
- [ ] README is complete.
- [ ] AI_NOTES is accurate.
- [ ] Git history contains incremental commits.
- [ ] No secrets are committed.
- [ ] Project can be run from a fresh clone.

---

# 16. Instructions for AI Coding Agent

Implement this specification as a working full-stack application.

## Development Rules

1. Follow the mandatory stack and requirements.
2. Prefer simple, readable solutions.
3. Do not overengineer the architecture.
4. Keep business logic out of API routers.
5. Use Decimal for backend monetary calculations.
6. Use integer satang for frontend monetary calculations.
7. Ensure every database write preserves consistency.
8. Do not weaken validation to make tests pass.
9. Do not substitute SQLite for PostgreSQL concurrency tests.
10. Do not implement optional features until required features are complete and tested.
11. Keep documentation synchronized with the implementation.
12. Create meaningful incremental commits when the environment permits.

## Workflow

For each phase:

1. Review the relevant specification.
2. Implement the smallest coherent set of changes.
3. Add or update tests.
4. Run the relevant tests and linters.
5. Review the changes for correctness and maintainability.
6. Fix failures before proceeding.
7. Document significant decisions and actual AI-assisted work.
8. Commit the completed unit of work.

Do not claim tests passed unless they were actually executed successfully.

If a command cannot run, explain the blocker and distinguish unverified work from verified work.

## Priority

When trade-offs are required, prioritize:

**Correctness > Tests > Maintainability > Frontend Completeness > Documentation Polish > Optional Features**

All mandatory submission documentation must still be completed before delivery.

## Final Deliverables

Provide:

- Working `backend/`.
- Working `frontend/`.
- PostgreSQL migrations.
- Seed data.
- Backend automated tests.
- Frontend functionality.
- Environment examples.
- README.md.
- AI_NOTES.md.
- Incremental Git history.
- Optional Docker Compose if completed.

**End of Specification.**