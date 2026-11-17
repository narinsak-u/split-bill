# 07: Reproduce and verify the complete app

**What to build:** A reviewer can start the full application from a fresh clone, inspect its behavior and engineering decisions, and run every required check.

**Blocked by:** 04 — Record equal-share expenses; 06 — Delete payer-owned expenses.

**Status:** ready-for-agent

- [ ] Environment examples contain no secrets. Setup instructions cover prerequisites, PostgreSQL startup, migrations, repeatable seed, backend/frontend launch, example API requests, and tests.
- [ ] README documents the stack, architecture, endpoints, monetary and equal-split rules, group authorization and 404 rationale, idempotency, soft deletion, trade-offs, assumptions, limitations, proposed next steps, and approximate development time.
- [ ] AI_NOTES identifies actual tools and assisted areas, effective prompts, a real unsafe or incorrect AI output encountered, its detection and correction, and review before commits; no invented incidents.
- [ ] Required PostgreSQL-backed pytest cases, Ruff checks, frontend behavior tests, ESLint, and production build pass; fresh-start steps are exercised and no secrets are committed.
- [ ] Incremental commit history is reviewed for meaningful units rather than one bulk commit. Optional settlements, repayments, and Docker Compose remain excluded unless required scope is complete and tested.
