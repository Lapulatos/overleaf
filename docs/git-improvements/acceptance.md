# Git improvements: requirement-by-requirement acceptance

Source: the requested changes in `pasted-text-1.txt`, as tracked in `task_plan.md`. This is an implementation acceptance record, not a claim that all possible Git features are implemented. Force push/rebase, SSH/LFS/submodules, repository migration and server-scheduled background sync remain outside this change.

## Current acceptance evidence

| Requirement | Implementation | Evidence and remaining gate |
|---|---|---|
| R1 Preserve selections/message/diff | LocalChanges caches the exact source fingerprint; remote checks no longer replace the work area; actual file changes invalidate explicitly | `runtime-browser-report.json`, `selection-regression.cjs`, local-changes frontend tests. Real tab switching preserves message and selected block. |
| R2 Clear default workspace | Persistent repository/branch/status header; Changes default; four tabs; inline per-file diffs and commit form below files | `runtime-restored-local-changes.png`; late-status navigation regression. Settings is secondary. |
| R3 Continuous commit/push | Single action internally prepares an immutable commit and dispatches it; optional snapshot review remains | push-controls frontend tests; real retained-commit browser test; guarded-push backend test uses actual temporary bare Git remote. External user remote was not mutated. |
| R4 Local reading during remote advance | Local diffs use the reviewed baseline; commit guards independently refuse stale remote | git-push-preparation test explicitly advances the remote and still reads local changes; UI initial/incoming tests. |
| R5 History operations | Message/file/branch filtering, pinned-head pagination, chosen comparison base, single-file restore as new edit | Real browser: 50+5 pagination, file-filtered history, historical main.tex restore; reader/file-restore backend and history-browser tests verify comparison and guards. |
| R6 Branch operations | Independent Branches tab; create from current commit without edits; reviewed switch and merge | Real browser switches to review-alternative and back, preserving uncommitted text. Backend real-Git branch tests verify switch/merge parents and branch-only creation without artificial commit. No real hosted branch created. |
| R7 Conflict resolution | Per-block Web/repository/both, remaining marker guard, manual result, browser-scoped draft persistence | Real r5 browser verifies two-block choice, refresh, reopening the same review, restored unfinished decision, and saving the final conflict resolution. Remount regression also passes. |
| R8 Recovery | Contextual primary action, explicit confirmed file count, details collapsed; status/reconcile never auto-replays writes | Frontend application tests plus backend journal/executor/atomic lifecycle tests. Unsupported paths checked before admission. Real preflight failure repaired only in isolated fixture after proof of no dispatch; retained historical evidence. |
| R9 Commit only | Retained commits with messages, server list, reopen, later push or archive; automatic sync pauses while a manual saved commit is pending | Real browser save/reopen/archive; pending-commits tests; delayed-push admission tests prove later project edits are excluded. Retained commits are independent snapshots, not a new local branch commit chain. |
| R10 Partial code | Select server-generated text hunks; recompute under exact project fingerprint | Real browser block selection and retained commit; partial-commit backend verifies actual commit bytes and rejects stale/forged IDs. Add/delete/binary operations remain whole-file. |
| R11 Unfinished work | Named durable full-project snapshot; separate reviewed clear/restore; branch baseline unchanged | Actual native shelve including generated file, text, PNG/PDF succeeded; `runtime-restore-existing-report.json` verifies restore and reload. Saved-work backend tests verify later edits preserved/conflicted and actor isolation. |
| R12 Generated files | Explicit persisted user/project ignore patterns; preset, reveal and manual inclusion | Real browser settings persist; backend verifies tracked files retained and ignored new files excluded from commits. Does not edit .gitignore. |
| R13 Rich previews | Bounded typed image and PDF data, actual PDF.js canvas, binary metadata fallback | Real PNG decode/PDF rendering: `runtime-apply-media-report.json`, `runtime-pdf-canvas.png`; media frontend and payload backend tests. |
| R14 Safety and explanations | Immutable commits, remote-head lease, durable journals, actor authorization retained; automatic sync wording states collaborators/browser lifetime | 215 Git backend tests, including real local remote transport and lost-response reconciliation; automatic-sync frontend tests and UI text. No external GitHub/Gitee E2E claim. |
| R15 Delivery/validation | Scoped frozen image manifest, candidate deployment guard, tests and browser evidence | r5 deployed to 18081; 93 product files hash-verified against frozen source. 114 frontend, 215 Git backend and 80 shared document-deletion tests pass. Final real browser workflows and authenticated byte readback pass. 18080 unchanged. Global tsc has unrelated existing errors; no GitSync errors. |

## Validation boundaries

- Product tests use an isolated acceptance project, not the user's manuscript. The fake hosted remote is never contacted: browser fetch is stubbed and push execution is blocked. Native project writes, Mongo persistence, recovery storage, PDF rendering and history reads are real.
- Remote push safety is verified with a real temporary local bare repository. Credentials and private GitHub/Gitee hosting behavior were not end-to-end exercised.
- Named saved work contains source files and assets, not editor comments/history. Native guards continue to reject unsafe annotated-document deletion.
- Full-project TypeScript compilation is not green because of pre-existing errors outside GitSync; feature-specific diagnostics were checked.
- Browser conflict drafts are account/project/review/file/revision scoped in this browser. Named saved work and retained commits are server-backed.

## Change scope

Product changes are in `services/web/app/src/Features/GitSync/`, `services/web/frontend/js/features/git-sync/`, plus the Git-only path-validation branch in `WritingAssist/DocumentDeletionReservations.mjs`. Tests and acceptance artifacts are in the corresponding Git test folders and this directory. Existing unrelated changes were preserved. No workspace git add/commit/push was performed.

`changed-files.json` compares the scoped baseline archive with the working tree. Files absent from that archive are explicitly distinguished from proven baseline modifications; existing backend tests were not all included in the archive and must not be claimed as newly authored merely because they appear there.

## Final result

All R1–R15 requirements above are accepted within the stated isolated validation scope. Latest image: `overleaf-agent-acceptance:20261107-git-ux-r5`, SHA256 `3d73b5ee90c03cac7110be80c69d7e9dbd8ba90f5241bce3228e8972a58e9726`, running at `http://127.0.0.1:18081`.

Final readback: `runtime-final-readback.json` confirms saved source/generated-file bytes, retained saved work, main branch and no active application. `final-baseline.log` confirms the repository baseline was not rewound. A direct CLI asset read without the web request JWT was an invalid verification attempt; the authenticated browser API readback supersedes it. Unsupported native text extensions are restored as byte-identical native assets, consistently with the normal Git import policy; editor entity identity/history are not restored.
