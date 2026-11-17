# 01: Run browser tests against an isolated SplitBill stack

**What to build:** A developer runs `npm run test:e2e` and Chromium browses SplitBill backed by the real API and a fresh PostgreSQL 16 database. Tests switch between seeded users and confirm their group options match membership. The command removes its own temporary services and database without affecting the normal app.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] `npm run test:e2e` installs Chromium when needed, starts a distinct Compose project, waits for healthy services, and runs Playwright.
- [x] The project uses its own database volume and host ports; the persistent application database is never used.
- [x] Browser test switches users and verifies accessible groups update correctly.
- [x] E2E services and database volume are removed after success and test failure.
- [x] Browser locators are accessible and assertions wait for conditions, not fixed delays.
