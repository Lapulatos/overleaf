# Git improvements — active goal, 2026-11-07

Source: /Users/sujie/.codex/attachments/9d542e92-430d-4d92-8669-f5f50bde68b4/pasted-text-1.txt and docs/git-review/audit.md.
Scope: implement the requested Git improvements, not just the first UX pass. Preserve existing work, immutable snapshot/head checks, durable operation recovery and authorization. No actual remote writes or Git repository commits without a relevant explicit instruction. Isolated fixtures allowed.

## Requirements and acceptance gates
- [x] R1 Background refresh and tab switches preserve selection, commit message and inspected diff; real changes produce explicit stale handling.
- [x] R2 Persistent repository/branch/status header; connected projects default to Changes; file/diff layout, bottom commit area, settings secondary.
- [x] R3 Continuous commit/push flow without redundant generic review; immutable snapshot and head checks retained; failures retain inputs.
- [x] R4 Local changes remain readable when remote updates exist; mutations blocked appropriately.
- [x] R5 History search/pagination, file history, version comparison, restore as new changes with reviewed write path.
- [x] R6 Independent branch list/create/switch/merge; branch creation without file edits.
- [x] R7 Structured per-conflict resolution, version comparison, draft protection and remaining-conflict state.
- [x] R8 Unified recoverable operation status; context-appropriate action, no blind retry of unknown writes.
- [x] R9 Commit-only and pending-push workflow.
- [x] R10 Partial-code/hunk selection with server-side validation.
- [x] R11 Save/restore unfinished work (named drafts/stash) with safe validation.
- [x] R12 Ignore generated files with explicit configurable behavior.
- [x] R13 Image/PDF previews and binary metadata.
- [x] R14 Explain whole-project automatic sync, browser lifetime, permissions/errors and uncertain outcomes; preserve safety invariants.
- [x] R15 Focused tests, broader regression, build, isolated browser acceptance; requirement-by-requirement completion audit.

## Execution
1. Capture baseline and implement/test R1.
2. Refactor status/navigation/local work area and submission workflow (R2–R4, R8).
3. Add backend-backed history/restore and branch operations (R5–R6).
4. Implement conflict workspace and draft protection (R7).
5. Add local commits, hunk selection, saved work, ignore rules, rich previews (R9–R13).
6. Validate all states and render runtime; document limitations accurately (R14–R15).

Status: completed for the requested R1–R15 scope; final acceptance and limitations are recorded in acceptance.md. Historical checkpoints below retain their original state.

2026-11-07 checkpoint:
- R1 implemented; regression suite proves unchanged remote checks and view switches preserve selected files/diff. Explicit refresh invalidates genuinely changed snapshot. Needs rendered acceptance in final gate.
- R2 implemented persistent header/default Changes/bottom commit area/independent Branches tab. File tree/search and final visual layout still pending.
- R3 implemented continuous Commit and push plus optional Review snapshot. Tests cover selected snapshot, failed preparation retaining input and uncertain push without replay. Backend safety checks unchanged.
- R4 implemented baseline-relative local read even after remote advance and initial-review read; preparation still rejects blocked state. Backend test passed. Initial sync comparison falls back to current remote tree and UI explains review is required.
- R6 only navigation changed; independent branch creation not implemented yet.
- R14 automatic sync now explicitly mentions collaborators' unfinished edits.
- Current checks: 89 frontend tests passing (including selection regression); modified backend preparation test passing. Full tsc has existing errors outside GitSync, no GitSync errors reported. Full build and rendered acceptance remain pending.

Next: finish local work area/read-only separation, unified recovery controls; then implement R5 history search/pagination/file restore and R6 independent creation. Continue through R7 and R9–R13; do not declare completion at this checkpoint.


## Second implementation checkpoint
- R5 code implemented: branch-scoped history message search, exact file filter, pinned-head pagination, arbitrary two-commit comparison, file-history navigation, and historical file restore preview. Restore uses existing checkpoints and reviewed apply guards, only changes one chosen file, leaves other edits and the branch baseline intact. Pending merges/incoming updates must finish before restoration. Browser/runtime API acceptance remains pending.
- R6 code implemented: independent create-and-switch action in Branches. Creates branch from existing commit (no artificial commit), excludes uncommitted edits, reuses existing journal/lease/unknown-result handling. No real remote branch created in this work.
- R8 code implemented: one primary recovery action based on confirmed server capability; unknown outcomes offer status lookup, file details collapsed, stop explains retained/skipped files. Regression verification underway/completed in logs.
- Frontend: 95 passing after history/restore/branch/recovery changes. Reader/restore/branch/preparation/guarded-push: 8 passing. Additional apply/preview/executor regressions: 47 passing (one restore test overlaps; do not sum as unique tests).
- Type-check found and corrected one new action-union typing error in ApplicationControls; full-project existing unrelated errors remain. Final recheck recorded separately.
- Next: R7 structured conflict editing and durable draft protection, then R9–R13. R1–R6 still require final browser/build checks and local file layout refinements. Do not mark goal complete yet.

## Third implementation checkpoint
- R7: added diff3 block comparison and Web/repository/both choices, preserving clean auto-merged sections. Remaining generated markers block manual save in both UI and server. CRLF and empty-side parsing verified.
- Conflict drafts persist in browser storage isolated by user/project/operation/path/revision; failed saves retain drafts, confirmed saves and discard clear them. Storage failure warns; dirty drafts request browser unload confirmation. This is browser-local draft recovery, not the server-backed named saved work required by R11.
- Truncated merge result cannot be submitted as complete manual text. Parent now propagates failed resolution requests instead of swallowing them.
- Verification: 99 frontend tests passing; 4 backend conflict-resolution tests passing. Full tsc still has pre-existing non-GitSync errors, no GitSync diagnostics. Not built/deployed or browser-accepted yet.
- Remaining: R9–R13, local file layout, stale local cache after apply, final browser/build acceptance.

## Fourth implementation checkpoint
- R9: explicit Commit only creates the existing immutable retained Git commit without executing transport. Added actor/project-scoped database listing and paginated Saved commits awaiting push UI; reopening fetches the exact retained review and never auto-pushes. Commit messages now persist in journal metadata and public response. Keep for later preserves the record. Branch/binding/version guards remain intact. Further work: multiple sequential local commits and stale pending-commit reconciliation need an explicit workflow; do not call R9 fully complete yet.
- R10: server-generated bounded text change blocks, selectable in file diff. Commit request carries only block IDs plus full project fingerprint; server recomputes blocks and rejects forged/stale IDs, duplicates, partial merge commits and absent/binary/oversized inputs. Unselected lines remain at baseline in the commit and project buffers remain untouched. File additions/deletions require whole-file selection. Diff computation bounded by time/edit distance.
- Verification: 102 frontend tests passing, 10 backend tests passing including real retained commit verification and guarded transport regressions. Full tsc has existing unrelated errors, no GitSync diagnostics. No deployed/browser acceptance yet.
- Remaining: finish R9 lifecycle and R11 named work preservation, R12 ignore rules, R13 previews, local file layout/invalidation and full R15 acceptance.

## Fifth implementation checkpoint
- R12 implemented configurable server-persisted user/project ignore patterns, explicit LaTeX build-file preset, hidden-but-revealable new files and manual inclusion. No default exclusion; tracked files and merge commits are never filtered. Automatic sync excludes ignored new files. Rules are application settings, not edits to repository .gitignore. Source/PDF/bibliography are not part of preset. Authorization and majority-acknowledged settings writes tested.
- R13 implemented typed image/PDF payloads identified by magic bytes with 2 MiB/version bound. Integrated into local changes, retained commit diff, history, and merge source previews. Images render inline; PDF pages use existing PDF.js canvas renderer with explicit open, previous/next, password/error handling, cancellation, no scripting/interactive PDF actions. SVG/HTML are not embedded. Larger/unsupported files retain metadata. Actual PDF worker/canvas rendering still requires build/browser acceptance; do not equate component tests with it.
- Verification: 108 frontend tests and 6 targeted backend tests passed; additional 2 ignore validation tests passed after whitespace-path hardening. Full tsc retains existing non-GitSync errors; no GitSync diagnostics. Backend syntax checks passed. No deployment or external writes performed.
- Next: R11 named saved-work/restore workflow, finish R9 retained commits lifecycle, local cache invalidation and file layout, final build/browser and scope audit.

## Sixth implementation checkpoint
- R11 code implemented: named server-owned saved-work snapshots store complete project and baseline bytes in durable recovery storage, metadata in Mongo scoped to user/project, paginated list. Save leaves current project untouched. Restore merges saved delta onto current files; shelve reverses saved delta, both through existing review/apply/recovery. Later edits are preserved or conflict explicitly; saved copy remains. No branch baseline rewind. Rules explain collaborative edits, ignored files, and source-only scope (not comments/editor history).
- Saved-work intent validated in apply plan and binding settlement. Tests reopen actual filesystem checkpoints; verify actor isolation, restore/shelve semantics, conflicts, apply stale detection and baseline preservation.
- R9 delayed push now admits against current project structure within the same transaction; immutable commit/binding/remote guards unchanged. Later structural edits stay outside the retained commit rather than spuriously blocking push. Tested exclusion and actor checks. Remaining R9 concern: interaction of saved commits with automatic sync and stale binding/pending commit handling requires final review. Multiple sequential local commits were raised as a possible enhancement, not explicit wording in the attachment; assess against actual requested commit-only workflow rather than silently broadening acceptance scope.
- R1 cache invalidates after apply progress and automatic synchronization; test proves newly applied files replace stale selection/diffs.
- Verification: 111 frontend tests, 46 backend apply/push/saved-work regression tests passing. Full tsc retains unrelated errors, no GitSync diagnostics. No build/deploy/browser acceptance yet.
- Next: finish pending-commit lifecycle interactions, final layout audit, build and isolated browser acceptance, requirement-by-requirement completion audit.

## Seventh checkpoint: real browser acceptance and deletion preflight
- Candidate r1 deployed only to 18081; 18080 and user projects unchanged. New isolated project 6aee30c179c897758e370d23 only. Browser confirms selection/message preservation, retained commit/archive, server ignore settings, named saved work, history pagination 50+5, actual image decoding and PDF.js canvas rendering.
- Frontend navigation race fixed: a late connected-status response no longer resets a chosen tab. Tab grid uses four columns. 113 frontend tests pass. Full typecheck still has unrelated errors, none in GitSync. r3 image built successfully but NOT deployed.
- Actual saved-work shelve failed at first build.aux deletion: native shared path validation rejects .aux only after Git application admission. No deletion reservation, receipt or tree mutation exists; project remains version 2 with both original documents. Operation 54b16f08-6eec-4fc3-9edf-aa9bcacdcd7d remains recovery-required with project admission retained. Do not replay apply or restart candidate.
- Added matching path validation to GitDocumentDeletionAdapter.supports so unsupported deletions fail during whole-plan preflight before any project admission or preceding file write. 24 deletion/executor tests pass. This latest source fix is not in r3 image.
- Next: safely resolve the exact isolated operation using evidence of no dispatch; finish supported saved-work shelve/restore runtime acceptance and explicitly handle unsupported files. Build/deploy latest source only after all active admissions are settled. Final scope audit remains pending; goal NOT complete.

## Final checkpoint: 2026-11-07
- Completed R1–R15 against acceptance.md. Latest r5 image sha256:3d73b5ee90c03cac7110be80c69d7e9dbd8ba90f5241bce3228e8972a58e9726 deployed only to 18081; 93 product files hash-verified and source manifest rechecked. 18080 unchanged.
- Fixed source policy mismatch: Git deletion uses native safe path rules for full-project files, while Paper Assistant retains manuscript-extension restrictions. 215 Git backend tests and 80 shared document-deletion tests pass.
- Closed actual conflict refresh gap: remember the reviewed operation per user/project; reopen it with read-only requests, preserving file/revision-scoped drafts. Explicit close clears pointer; active native operations take precedence. 114 frontend tests pass, including remount regression.
- Latest real browser acceptance passes: history/file restore, branch switch out/back preserving edits, two-block conflict resolution and refresh recovery; actual PNG/PDF rendering; save/shelve/restore including text and assets. Final authenticated readback verifies exact original saved bytes, saved record retention and no active operation. Database verifies baseline unchanged.
- Full tsc retains pre-existing unrelated diagnostics; none in GitSync. Actual private GitHub/Gitee push was deliberately not performed; real Git transport/lease/unknown-outcome behavior tested with temporary local bare repository.
- Original isolated preflight incident is retained as evidence, cancelled only after project-lock-protected proof of no dispatch; no user manuscript was modified. No workspace Git commit/push or external publication performed.
