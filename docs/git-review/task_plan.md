# Git UX and capability audit — 2026-11-07

Scope: read-only production/source review; write audit artifacts only. Venues is the UX reference, not Vimium. No remote writes, project mutations, feature edits or commits.

- [x] Trace connection, status, changes, commit/push, incoming/conflict, branches, history and recovery flows.
- [x] Inspect current UI against implementation; record grounded usability and capability findings with source lines.
- [x] Run focused isolated existing tests where useful; distinguish actual defects, intentional limits and unverified risks.
- [x] Deliver prioritized audit, proposed information architecture and phased improvements.

Completed: audit.md, read-only browser evidence, 83 frontend + 5 backend fixture passes; one additional test reproduces the selection-loss defect. Production source unchanged.
