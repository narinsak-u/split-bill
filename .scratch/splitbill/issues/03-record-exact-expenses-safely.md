# 03: Record exact-share expenses safely

**What to build:** A requester records an expense paid by any group member, assigns exact non-negative shares to split members, sees the unallocated amount, and can retry safely without creating duplicates.

**Blocked by:** 02 — View group expense history.

**Status:** resolved

- [x] The form validates description, payer, at least one split member, valid positive expense amount, valid non-negative shares, and an exact total. It previews the unallocated amount in integer satang and disables invalid submission.
- [x] The API checks requester, payer, and split-member group membership; validates decimal-string money without rounding, non-finite values, excess precision, or database-range overflow; and returns consistent application errors.
- [x] Creation stores expense and finalized ordered shares atomically, returns 201, and refreshes visible history. Failed writes leave no partial expense or shares.
- [x] Idempotency keys are unique per group. Valid canonical requests normalize equivalent monetary strings and exact-share key order while preserving description text. Matching retries return the original ID and allocation with 200; changed requests return 409.
- [x] Concurrent same-key HTTP requests against PostgreSQL create one expense. Tests cover first-write commit and rollback, changed payload, membership failures, invalid amounts, and transaction rollback; pure allocation tests cover exact sums and invalid inputs.
- [x] An unchanged failed form resubmits the same payload and key; editing starts a new logical request and key. The UI preserves inputs on failure, shows errors/success/progress, and refreshes history after success; rendered-page tests cover these behaviors.
