# 02: View group expense history

**What to build:** A requester opens a group and sees its stored expenses, including payer, amount, time, split type, and each split member's share. A group with no expenses shows a clear empty state.

**Blocked by:** 01 — Browse accessible groups.

**Status:** resolved

- [x] The migrated expense and share records have foreign keys, ordered shares, constrained monetary amounts, creation and deletion timestamps, and a group-scoped idempotency-key constraint ready for creation.
- [x] The group expense endpoint returns complete stored allocations as monetary strings, excludes soft-deleted rows, and orders by creation time descending then expense ID descending.
- [x] Inaccessible groups return 404 without disclosing their expense history.
- [x] The page renders stored expenses and shares, plus loading, empty, API-error, and network-error states.
- [x] PostgreSQL-backed HTTP tests cover empty and populated histories, deterministic tie-breaking, stored share order, and deleted-row exclusion; rendered-page tests cover the visible states.
