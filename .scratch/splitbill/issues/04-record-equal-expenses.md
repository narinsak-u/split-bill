# 04: Record equal-share expenses

**What to build:** A requester chooses distinct group members for an equal split and sees an immediate satang-accurate preview before recording the expense through the existing safe submission flow.

**Blocked by:** 03 — Record exact-share expenses safely.

**Status:** ready-for-agent

- [ ] The API rejects empty or duplicate split members and nonmembers; the payer need not be a split member.
- [ ] Equal allocation divides integer satang and distributes leftover satang in supplied split-member order. Finalized shares are stored, not recomputed from the request.
- [ ] The page previews equal shares without floating-point arithmetic and prevents invalid submission; it uses the existing success, error, and safe retry behavior.
- [ ] Reusing a key with changed equal-member order returns 409; a matching retry returns the original allocation.
- [ ] Pure tests cover three-way rounding, remainder order, one satang over multiple members, duplicate/empty selections, and exact totals. PostgreSQL HTTP and rendered-page tests verify persisted shares match the preview.
