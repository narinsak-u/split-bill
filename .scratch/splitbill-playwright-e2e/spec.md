# SplitBill — Playwright E2E

Status: ready-for-agent

## Problem Statement

Developers cannot verify a complete user journey through the actual SplitBill frontend, API, and PostgreSQL database with one repeatable command. Existing frontend tests stub API responses, so they do not prove the browser-visible result matches persisted expenses and balances.

## Solution

Add a Playwright Chromium suite that drives the real Next.js interface against FastAPI and an isolated PostgreSQL 16 database. `npm run test:e2e` starts a fresh, separately named Compose project, waits for its services, runs the browser scenarios, and removes only the E2E project and database volume afterward.

## User Stories

1. As a developer, I want one E2E command to provision all test services, so that I can verify the full application without starting each service manually.
2. As a developer, I want E2E tests to use a separate PostgreSQL database, so that test setup and cleanup never alter my application expenses.
3. As a developer, I want every run to start from deterministic seeded users and groups, so that scenarios do not depend on previous test data.
4. As a requester, I want the browser test to switch between users and see only their accessible groups, so that identity and membership behavior work through the real interface.
5. As a requester, I want to record a $10.00 equal expense and see the exact ordered $3.34, $3.33, and $3.33 live preview, so that remainder satang are allocated correctly before submission.
6. As a group member, I want the created expense, stored shares, and resulting balances to appear after submission, so that the browser proves the database and API agree with the preview.
7. As a non-payer requester, I want payer-only deletion to remain unavailable for another member's expense, so that I cannot delete an expense I did not pay.
8. As a payer, I want deleting my expense to remove it from active history and refresh group balances, so that the browser proves soft deletion works end to end.
9. As a requester, I want an invalid exact-share total to keep submission disabled, so that the browser confirms the form prevents a known mismatch.
10. As a developer, I want the test command to remove its own temporary services and database after success or failure, so that repeated runs do not need manual cleanup.
11. As a developer, I want the browser suite to wait for observable readiness and UI outcomes, so that tests do not depend on arbitrary sleep delays.
12. As a reviewer, I want the suite to use accessible roles and labels, so that tests exercise the same user-facing controls as assistive technology.

## Implementation Decisions

- Use Playwright with Chromium to drive the real Next.js page and its accessible controls.
- Run the frontend, FastAPI backend, and PostgreSQL 16 in a separate Compose project with distinct host ports and its own database volume. Never connect tests to the normal application database or reuse its Compose project.
- Start the test stack and wait for service health as part of `npm run test:e2e`; after the run, tear down the E2E project and remove its volume, including after a failed test run. The ordinary application Compose project and volume remain untouched.
- Use the existing idempotent demo seed: alice, bob, carol, and dan; “Chiang Mai trip” and “Office lunch.” Start from a fresh database for each command.
- Exercise user/group selection and group membership through the page. Verify a requester who is not the payer cannot access the delete control; then delete as the payer through the page.
- Create the equal expense through the UI, assert ordered live shares, then assert persisted expense history and balances from the UI.
- Exercise exact-share validation with a mismatched total and assert that submission remains disabled.
- Use only the real backend API; do not mock API responses. Assert visible behavior rather than implementation details. Use Playwright assertions and condition-based waits, never fixed sleeps.
- Ensure Chromium is installed by the E2E command when needed. Docker, Node/npm, and network access for initial image and browser downloads are prerequisites.
- No domain-model, glossary, database-schema, or API-contract changes are required.

## Testing Decisions

- Good E2E tests drive the real browser across the complete user-facing seam and assert behavior observable to a requester. They must fail for incorrect group access, preview allocation, persisted shares, balances, or payer deletion.
- The sole new seam is Chromium → Next.js UI → FastAPI → isolated PostgreSQL 16. Tests use accessible locators and Playwright assertions, deterministic seeded membership, a fresh database per run, and no arbitrary sleeps or mocked backend responses.
- Cover selected-user group filtering; equal-share live preview and persisted history/balances; non-payer deletion unavailability and payer soft deletion with refreshed balances; exact-share mismatch validation; and automatic test-resource cleanup.
- Existing prior art: frontend Vitest tests cover user/group changes, equal and exact split validation, history, deletion controls, and balance refresh with mocked HTTP. Backend pytest integration tests use a real PostgreSQL database for group access, persisted allocations, balances, and payer authorization. E2E complements these tests rather than replacing them.

## Out of Scope

- Replacing or expanding existing backend integration or frontend unit/component tests.
- Mock services, API response fixtures, production database access, a reverse proxy, settlement or repayment features, and application behavior changes.
- Broad accessibility auditing beyond selecting and operating the relevant controls by accessible role and label.

## Further Notes

The normal Compose stack uses persistent application data. E2E uses a separate Compose project, database volume, and host ports; cleanup must target only the E2E project. The project glossary distinguishes the requester (the member making a request) from the payer (the member who paid), and the deletion scenario must preserve that distinction.
