# 05: See zero-sum group balances

**What to build:** A requester sees how much each group member paid, owes in shares, and is owed or owes overall, including members without expense activity.

**Blocked by:** 03 — Record exact-share expenses safely.

**Status:** resolved

- [x] The group balance endpoint enforces requester membership and returns paid, share, balance, and group total as two-decimal monetary strings.
- [x] Paid totals and share totals aggregate separately from non-deleted expenses; each member's balance is paid minus shares and the group total is exactly zero.
- [x] Members with no expense activity remain visible with zero amounts; positive, negative, and zero balances are clearly distinguished in the UI.
- [x] The page shows grouped thousands and two decimals, refreshes balances after a successful creation, and displays loading and failure states.
- [x] PostgreSQL HTTP tests cover multiple expenses, a payer outside the split, inactive members, inaccessible groups, deleted-row exclusion, and zero sum; rendered-page tests cover signs, formatting, and refresh.
