# SplitBill — Shared Expense Management

Status: ready-for-agent

## Problem Statement

Group members need a reliable way to record shared costs and see who owes whom. Manual splitting loses satang, makes membership and deletion rules hard to enforce, and can duplicate an expense when a submission is retried. A fresh clone also needs to be runnable and verifiable as a full-stack take-home assignment.

## Solution

Provide a single-page application where a requester selects one of the seeded users and an accessible group, records an expense paid by a group member, allocates it equally or by exact shares, and sees stored expenses and zero-sum balances. A payer can soft-delete their expense. The API owns validation, authorization, allocation, persistence, and concurrent-safe idempotency; the UI offers immediate, precise previews and clear feedback.

## User Stories

1. As a requester, I want to select alice, bob, carol, or dan, so that I can use the assignment's identity mechanism without registration.
2. As a requester, I want to see only groups I belong to, so that unrelated groups stay hidden.
3. As a requester, I want to see a group's name and members, so that I can select valid people for an expense.
4. As a requester, I want group data to reset when I switch users, so that another user's data and form state do not leak into my view.
5. As a requester, I want group details, expenses, and balances to load when I select a group, so that I see its current state.
6. As a requester with no accessible groups, I want an empty state, so that I know there is nothing to select.
7. As a requester, I want to enter an expense description and amount, so that I can record what the group spent.
8. As a requester, I want to designate any group member as payer, so that I can record costs on another member's behalf.
9. As a requester, I want the payer to be allowed outside the split, so that the expense matches who consumed it.
10. As a requester, I want to choose at least one group member for an equal split, so that a cost can be shared.
11. As a requester, I want equal splits to allocate leftover satang in my selected member order, so that the result is predictable.
12. As a requester, I want a live equal-split preview, so that I can check each share before submission.
13. As a requester, I want to enter exact non-negative shares, including zero, so that I can record unequal consumption.
14. As a requester, I want to see the unallocated amount in an exact split, so that I can correct an incomplete allocation.
15. As a requester, I want submission disabled until exact shares add up to the expense amount, so that I cannot send a known mismatch.
16. As a requester, I want invalid amounts, excess precision, non-finite values, and database-range overflow rejected, so that money is never silently rounded or lost.
17. As a requester, I want duplicate split members and empty splits rejected, so that an allocation has an unambiguous meaning.
18. As a requester, I want unknown payers and split members rejected, so that only group members appear in an expense.
19. As a requester, I want a matching retry to return the first expense, so that a network failure cannot duplicate the charge.
20. As a requester, I want simultaneous matching submissions to create only one expense, so that double clicks and retries remain safe.
21. As a requester, I want reuse of an idempotency key with changed meaning to fail clearly, so that it cannot silently return an unrelated expense.
22. As a requester, I want equivalent amount spellings to count as the same request, so that harmless decimal formatting does not break retries.
23. As a requester, I want changing equal-split member order to count as a different request, so that allocations remain intentional.
24. As a requester, I want unchanged failed submissions to retry with the same key, so that their outcome remains discoverable.
25. As a requester, I want an edited failed submission to use a new key, so that the revised expense is a new logical request.
26. As a requester, I want my input preserved after failure, so that I can fix or safely retry the submission.
27. As a requester, I want success feedback and a reset form after creation, so that I know the next submission is separate.
28. As a requester, I want expenses listed newest first with a deterministic tie-breaker, so that their order remains stable.
29. As a requester, I want each expense to show its payer, amount, time, and stored shares, so that I can verify what was recorded.
30. As a requester, I want each group member shown in balances, even without activity, so that nobody disappears from the summary.
31. As a requester, I want positive, negative, and zero balances distinguished, so that I understand who is owed or owes money.
32. As a requester, I want balances to total zero to the satang, so that I can trust the accounting.
33. As a requester, I want monetary values displayed with two decimal places and Thai-style grouping, so that amounts are easy to read.
34. As a payer, I want to soft-delete my expense, so that an erroneous expense no longer affects listings or balances.
35. As a non-payer, I want deletion rejected, so that I cannot remove another member's expense.
36. As a requester, I want a repeated deletion to report not found, so that I know the expense is already absent from normal views.
37. As a requester, I want a retry of a deleted expense to return the original deleted record, so that deletion never causes recreation.
38. As a requester outside a group, I want the API to return not found, so that group existence is not disclosed.
39. As a requester, I want invalid or missing identity and idempotency headers explained clearly, so that I can correct the request.
40. As a requester, I want consistent API and UI errors without internal traces, so that failures are understandable and safe.
41. As a requester, I want loading, empty expenses, network failure, mutation progress, and unauthorized states shown, so that the page never fails silently.
42. As a developer, I want migrations and repeatable seed data, so that a fresh database reaches the expected state.
43. As a developer, I want unit and real-PostgreSQL integration tests, so that monetary, transaction, authorization, and concurrency behavior is proven.
44. As a developer, I want UI behavior tests and lint/build checks, so that previews, error handling, and cache refresh stay correct.
45. As a reviewer, I want reproducible setup, API examples, architecture and trade-offs, so that I can run and assess the project.
46. As a reviewer, I want accurate notes on AI assistance and incremental commits, so that the development process is inspectable.

## Implementation Decisions

- Build a lightweight modular monolith: FastAPI routers for HTTP transport, Pydantic v2 for schemas, services for business rules, repositories for database queries, SQLAlchemy 2.x models, and Alembic migrations. Do not add speculative interfaces or move rules into routers or ORM models.
- Use Python 3.12+ and PostgreSQL 16 with a real PostgreSQL database for integration and concurrency tests. Use Ruff, pytest, and HTTPX. The database schema includes users, groups, unique group memberships, expenses, and persisted expense shares.
- Use UUID expense IDs; constrained positive NUMERIC(12,2) expense amounts, non-negative NUMERIC(12,2) shares, unique group-scoped idempotency keys, a request hash, timestamps including nullable deletion time, and ordered shares. Index group expenses by creation time; use the expense ID as a deterministic listing tie-breaker.
- Represent money as JSON strings. Validate with backend Decimal before persistence; reject non-finite, negative, zero expense, excess precision, and values outside database precision. Exact shares may be zero. Convert only validated amounts to integer satang for equal allocation and distribute remainder in supplied member order. Require shares to sum exactly to their expense.
- Seed four users (alice, bob, carol, dan) and two groups: Chiang Mai trip with alice, bob, carol; Office lunch with bob, dan. Seed operations must be repeatable without duplicates.
- Expose six endpoints: list accessible groups; group detail; create, list, and soft-delete group expenses; and group balances. Every endpoint uses the X-User header. Unknown identity returns 400; inaccessible groups return 404 rather than reveal existence. Group members can record an expense with a different group-member payer; only the payer may delete.
- Expense creation requires an Idempotency-Key scoped to the group. Hash the validated canonical request with SHA-256: normalize equivalent monetary strings and exact-share key order while preserving description text and equal-split member order, as recorded in the existing ADR. The same key and canonical request returns the original expense with 200; a changed request returns 409. A new expense returns 201.
- Persist expense and shares within one transaction. Enforce uniqueness in PostgreSQL and use insert-first ON CONFLICT DO NOTHING handling, followed by a separate read after conflict. A rollback must leave neither expense nor shares. Matching retries return stored shares and the original record, including when soft-deleted; they never reactivate it.
- List complete stored expenses excluding deleted ones, newest first by creation time and ID. Soft deletion marks a record without deleting its shares; repeat deletion returns 404. Calculate paid and share totals separately from non-deleted expenses, include inactive members with zero, and require total group balance to be zero.
- Return all monetary JSON values as strings. Apply consistent application-error envelopes and the required error codes for invalid user, inaccessible group, missing expense, invalid amount, invalid split total or member, forbidden deletion, missing idempotency key, idempotency conflict, validation, and unexpected failures. Use 400/403/404/409/422/500 as appropriate; do not expose stack traces or database internals.
- Build one Next.js App Router page using TypeScript, Tailwind, TanStack Query, React Hook Form, Zod, and ESLint. Select from the four seeded users; switching users clears group-specific state and prevents cached data from crossing identities. Fetch selected group details, expenses, and balances. Use integer satang for previews and formatting; never use floating-point money arithmetic.
- Preserve form data and the idempotency key on unchanged retry. Editing the payload starts a new logical submission and key. On success, reset the form, create a new key for the next submission, and invalidate expenses and balances; deletion also refreshes both. Show appropriate loading, success, empty, unauthorized, and network-error states.
- Permit browser-to-API access for the documented local origins. Provide environment examples without secrets, migration/seed/start commands, example requests, test instructions, README engineering decisions and limitations, and factual AI_NOTES with a real discovered AI error rather than an invented one. Keep meaningful incremental Git history when the environment permits.

## Testing Decisions

- Prefer observable behavior over private helper calls, implementation wiring, SQL shape, or source-text assertions. Tests must be deterministic, isolated, and sensitive to consumer-visible errors.
- Primary backend seam: HTTP requests through the FastAPI application backed by PostgreSQL 16. Assert response contracts and persisted effects for group access, membership validation, creation, listing, balances, payer-only deletion, error envelopes, and soft-delete visibility. No SQLite substitute for concurrency.
- Concurrency seam: simultaneous HTTP creates against the same PostgreSQL database, covering same-key same-request behavior, changed payload conflict, first transaction commit or rollback, and absence of partial expense/share writes. Verify retries of soft-deleted expenses preserve the original identity and allocation.
- Pure allocation seam: unit-test decimal validation, precision/range, equal remainder distribution, one-satang inputs, exact totals, duplicate or empty split members, and zero/non-negative exact shares without a database.
- UI seam: test rendered page interactions with mocked HTTP responses at the network boundary. Assert selected-user group filtering, live equal/exact satang preview, unallocated amount, disabled submit, preserved errors, safe key reuse versus edited submission, and refresh of expenses and balances after mutations. Test money conversion independently for edge cases.
- No prior application test patterns exist in this repo; these are proposed seams, confirmed with the user. Run backend pytest and Ruff checks; run frontend tests, ESLint, and a production build before delivery.

## Out of Scope

Full authentication, JWT/OAuth, registration, group editing or creation, expense editing, notifications, WebSockets, microservices, queues, payment integrations, multi-currency support, complex dashboards, and reverse proxies. Settlement suggestions, repayments, and Docker Compose are optional only after required behavior and tests pass. No optional feature may displace required scope.

## Further Notes

The detailed implementation contract is the existing SplitBill implementation specification. Its definition of done mentions seven business rules, but BR-01 through BR-08 define eight; cover all eight. The X-User identity mechanism is for this assignment and does not provide real authentication. Local PostgreSQL tools are absent, but Docker and Compose are available for the required PostgreSQL runtime. No application code or prior tests exist yet.
