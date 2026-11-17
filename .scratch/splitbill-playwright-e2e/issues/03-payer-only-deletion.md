# 03: Verify payer-only expense deletion in Chromium

**What to build:** A requester who did not pay an expense cannot access its delete control. The payer can soft-delete it; active history removes it and group balances return to their prior state.

**Blocked by:** 01: Run browser tests against an isolated SplitBill stack.

**Status:** ready-for-agent

- [ ] Create an expense through the real browser UI and verify it appears in history with changed balances.
- [ ] Switch to another group member who is not the payer; verify that member cannot access the delete control.
- [ ] Switch back to the payer, delete the expense, and verify history and balances refresh.
- [ ] Use accessible browser controls and Playwright assertions; do not mock API responses or use fixed sleeps.
