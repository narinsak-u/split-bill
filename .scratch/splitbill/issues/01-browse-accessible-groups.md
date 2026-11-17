# 01: Browse accessible groups

**What to build:** A requester selects one of the four seeded users, sees only groups they belong to, and opens a group's member list. A fresh database can be migrated and seeded repeatedly; the backend and frontend both start.

**Blocked by:** None (can start immediately).

**Status:** resolved

- [x] PostgreSQL 16 migration and repeatable seed establish alice, bob, carol, dan; Chiang Mai trip belongs to alice, bob, carol; Office lunch belongs to bob, dan.
- [x] Group listing and detail require X-User. Unknown or missing identity returns a consistent 400 error; inaccessible group detail returns 404 without disclosing the group.
- [x] The page selects among the four users, lists only their groups, opens accessible group details, and clears group-specific state and cached results when identity changes.
- [x] Loading, empty groups, and API/network failures have visible states.
- [x] HTTP tests against PostgreSQL verify seeded access and denied access; rendered-page tests cover selection, filtering, and reset. Backend and frontend boot with documented minimal local configuration.
