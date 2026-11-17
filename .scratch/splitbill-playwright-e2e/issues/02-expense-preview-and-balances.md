# 02: Verify expense previews and persisted balances in Chromium

**What to build:** A requester records a $10.00 equal expense for the Chiang Mai trip group, sees the ordered $3.34/$3.33/$3.33 live shares, then sees the stored expense and corresponding member balances. An invalid exact-share total cannot be submitted.

**Blocked by:** 01: Run browser tests against an isolated SplitBill stack.

**Status:** ready-for-agent

- [ ] Create the expense through accessible browser controls against the real API and isolated PostgreSQL 16 database.
- [ ] Assert equal preview order and amounts: alice $3.34, bob $3.33, carol $3.33.
- [ ] Assert expense history shows persisted shares and balances show alice +$6.66, bob -$3.33, carol -$3.33.
- [ ] Enter exact shares that do not total the expense and assert the submit control stays disabled; make them total correctly and assert it enables.
- [ ] Do not mock API responses or rely on arbitrary sleeps.
