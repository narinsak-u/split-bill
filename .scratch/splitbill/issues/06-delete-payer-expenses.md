# 06: Delete payer-owned expenses

**What to build:** A payer removes their expense from normal history and balances without destroying its stored record or letting another group member delete it.

**Blocked by:** 05 — See zero-sum group balances.

**Status:** ready-for-agent

- [ ] The page shows deletion only to the selected payer and displays mutation progress, success, and failures; history and balances refresh after deletion.
- [ ] The API marks the expense deleted with a database update, returns 204 for the payer, 403 for a different group-member requester, and 404 for nonexistent, inaccessible, or already-deleted expenses as specified.
- [ ] Deleted expenses and shares remain stored but are excluded from normal history and balances; repeated DELETE returns 404.
- [ ] Repeating a matching creation request after deletion returns the original deleted expense and stored allocation without restoring it or creating shares.
- [ ] PostgreSQL HTTP tests cover payer-only authorization, repeated deletion, balance changes, and deleted-expense idempotency; rendered-page tests cover action visibility and query refresh.
