# Canonicalize equivalent expense requests for idempotency

Expense requests with equivalent valid monetary strings (such as `10.5` and `10.50`) share an idempotency hash. Normalize amounts and exact-share key order before hashing, but preserve description text and equal-split member order because those change the recorded expense or allocation. This favors semantic retries over raw JSON equality; the rule must stay stable because existing expense hashes remain valid after soft deletion.
