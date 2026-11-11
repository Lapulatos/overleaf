# Implementation notes

2026-11-07: attachment read in full. Existing audit remains evidence baseline. Current worktree contains extensive unrelated modified/untracked files; preserve them. Prior audit selection reproduction passes by asserting the bug; new implementation tests must assert intended behavior instead.

## First implementation checkpoint
- Baseline archive: /tmp/overleaf-git-before-improvements-20261107.tar.gz (untracked source existed before this work).
- Changed source: frontend git-sync-panel.tsx, local-changes.tsx, push-controls.tsx, git-sync.css; added repository-header.tsx. Backend GitPushPreparation.mjs changes only local-read behavior, not prepare/execute head validation.
- Tests updated: local-changes.test.tsx, git-sync-panel.test.tsx, push-controls.test.tsx, git-push-preparation.test.mjs; added docs/git-improvements/selection-regression.cjs.
- Full frontend run: 89 passing. Backend preparation fixture passed with assertions that local reads use old baseline after remote advance while push preparation is blocked.
- tsc --noEmit reports unrelated pre-existing errors across other features (e.g. workbench missing module); no lines matching git-sync or git-improvements. This is not a clean repository-wide type-check pass.
- No build deployed or actual remote mutation performed. Production UI still shows prior deployed version until a later verified build.
- Existing audit selection-reproduction.cjs intentionally asserts the old defect; kept as historical evidence, not included in new regression suite.

## Second checkpoint details
- New endpoints: GET /git-sync/history (read authorized, bounded filters/pagination); POST /git-sync/restore/previews (write authorized preview only). Existing commit/detail file GET accepts optional full commit ID `from` for comparison.
- History reader uses literal pathspec and fixed-string message search; pinned head avoids pagination drift. Existing all-branch graph remains separate.
- File restoration creates a `file-restore` operation with current web checkpoint as base and only chosen historical file replaced. Apply plan and settlement validate restore intent; baseline stays at current head. User must still apply explicitly.
- New branchOnly preparation retains source commit instead of writing an empty commit, and existing new-branch push machinery performs dispatch. Branches action explicitly creates and switches.
- New files: history-browser.tsx, history-browser.test.tsx, git-file-restore.test.mjs. Existing Git reader/controller/router/preview/apply-plan/binding-settlement and related front-end/tests extended.
- Recovery controls continue using the same endpoints and explicit server capabilities; no automatic replay was introduced.
- Two command invocations were initially run from repository root instead of services/web (Mocha and tsc); rerun from correct working directory. Not counted as successful validations.

Fourth checkpoint: changes confined to GitSync preparation/journal/response/runtime/controller/router, new GitPartialCommit module, LocalChanges/PushControls/new PendingCommits UI, targeted tests and these task records. No project data, credentials, remote branches, repository commits or unrelated product files changed. Pending-commit listing is actor scoped; push execution preserves original author and all prior guards. The server's project structure version guard can reject a delayed push after structural edits; a revalidation path remains necessary.

Fifth checkpoint: GitSync-only changes in file review payload, media preview component and its consumers; new ignore rule service/UI wired through GitSync runtime/controller/router/preparation/automatic sync. New focused tests and task logs. Existing unrelated product code and user project contents untouched. PDF.js helper reused without editing it. Full project type errors persist outside this feature. Initial root-directory Mocha invocation failed before tests; corrected services/web invocation yielded 108 passing.

Sixth checkpoint: scoped GitSync changes in saved-work service, preview/apply intent/settlement, runtime/controller/router, SavedWork UI and panel, local refresh invalidation, delayed push transactional admission. Tests/logs added. No user project writes or real remote push occurred. Existing unrelated work remains untouched. Saved snapshots persist before metadata acknowledgement; failed acknowledgement leaves data retained and UI directs user to refresh rather than blindly retry.

Seventh checkpoint: real native acceptance exposed an unsupported .aux deletion after admission. Error stack in candidate web.log at 2026-11-06T20:04:26.026Z points to validateDeletionBinding before executeDeletion, operation 54b16f08-6eec-4fc3-9edf-aa9bcacdcd7d. runtime-recovery-diagnostic.log shows empty reservations/receipts, unchanged tree version 2 and main.tex/build.aux still present. Do not call saved-work application accepted yet. Latest edits: GitDocumentDeletionAdapter.mjs and git-deletion-adapter.test.mjs; preflight uses the same shared validator without broadening allowed paths. Four-column tabs and late-status navigation fix were built into r3 (sha256:4a41c7397b50493e340b485aa1a350f69298f51bde5e545f70621916efc0b1ab), not deployed; adapter fix is newer. No external repository push.

Final checkpoint: widened only Git deletion path policy to native project rules (new GitProjectPath.mjs; Git adapter and shared reservation conditional), preserving assistant restrictions. Repaired isolated failed admission under native project lock with unchanged fingerprint, empty reservation and deterministic pre-dispatch rejection proofs; no file write. r4 full native shelve/restore passed. Real branch/history/conflict test exposed the missing review pointer; new review-pointer.ts and GitSyncView bootstrap restore it via reads, enabling browser-local conflict drafts after reload. r5 verified, deployed and real browser tests all passed. See acceptance.md and final readback artifacts. No remote hosted writes or workspace commits.
