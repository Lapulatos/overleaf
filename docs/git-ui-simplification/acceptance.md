# Source Control workspace acceptance

Deployed to http://127.0.0.1:18081, image `overleaf-agent-acceptance:20261107-git-ui-r6`.

## Behavior
- Unbound project: binding form and credentials only.
- Bound project: Repositories, Changes, Graph shown together as collapsible sections; no top-level view tabs.
- Settings, branches, incoming review, local diff, commit review, history search, Graph, saved work and ignore settings open in the right editor workspace.
- Original document remains mounted. Closing the workspace returns to the document; collapsing sidebar sections retains the commit message and selection.
- Repository binding, credentials, automatic sync and backend safeguards preserved.

## Verification
114 frontend tests passed. Production build passed; 95 image source files hash-verified. Browser checks cover simultaneous sections, collapse retention, settings/local diff/Graph/saved work/ignore settings in the editor, first-sync layout, and an intercepted unbound status showing binding only. Authenticated API mutations blocked during browser checks; no remote push or manuscript edits.

Project-wide TypeScript check still reports existing errors outside Git; no Git or editor-panel diagnostics.

## Changed production files
- `services/web/frontend/js/features/git-sync/git-sync-panel.tsx`
- `services/web/frontend/js/features/git-sync/git-sync.css`
- `services/web/frontend/js/features/git-sync/ignore-settings.tsx`
- `services/web/frontend/js/features/git-sync/local-changes.tsx`
- `services/web/frontend/js/features/git-sync/push-controls.tsx`
- `services/web/frontend/js/features/git-sync/repository-header.tsx`
- `services/web/frontend/js/features/git-sync/saved-work.tsx`
- `services/web/frontend/js/features/ide-react/components/editor/editor-panel.tsx`
- `services/web/frontend/js/features/git-sync/editor-workspace.tsx`

Git backend, Venues and manuscript files unchanged. No git commit or push performed.

## Overleaf style integration
CSS-only follow-up in `services/web/frontend/js/features/git-sync/git-sync.css`. White theme-based headers, line chevrons, green accent/focus/checkboxes, flat settings forms and consistent type sizes. Production build and 95-file image verification passed. Deployed browser style assertions and all existing section/workspace browser checks passed. Existing 114-test behavior result belongs to the preceding functional change; no new unit tests were needed for this CSS-only pass.

## r8 follow-up verification
Candidate: `overleaf-agent-acceptance:20261107-git-ui-r8`, image `sha256:34f2c00c912895996b3747424e34579c82f288b5f849fd10c73ad79d4f96b578`.
Browser checks: see [followup-report.json](followup-report.json). Rail icon sizing, mouse/keyboard resize, full graph scrolling, and isolated venue workspace POST/GET passed. S&P public snapshots refreshed with four linked calls; evaluator form remains unavailable. AI prompt/evidence changed but no new model run was executed.

## r9 connection form
Deployed candidate image `overleaf-agent-acceptance:20261107-git-ui-r9` (`sha256:ca331fa461663ab037885f0b6d1f1544c4d3ee7eea044be9e04e3b61d38dcdca`), 102 source hashes checked. 114 frontend tests passed. Browser connection-report.json confirms 16px side padding and uniform 38px controls at 320px and 520px widths; saved mask and Replace/Cancel work with mocked credential status. No actual credential or repository writes. First browser attempt preceded server startup and timed out on login; rerun after HTTP 200 passed.

## r11 official conference cycles and Git settings
Deployed `overleaf-agent-acceptance:20261107-git-ui-r11`, image `sha256:4240163aac4dcd78edfaff329cdb5d72b5327839b88cbae6da78ed3e33ee916a`; verified 108 source hashes. 136 frontend / 14 backend tests pass. Full TypeScript remains affected by existing unrelated diagnostics; no diagnostics in changed Git/round timeline files.
Both public S&P 2027 round snapshots refreshed: Papers has 10 events per cycle, Artifacts 5 per cycle. Browser cycles-report.json verifies one conference card, default Cycle 2, independent cycle nodes, and no automatic Git sidebar/editor on reload despite a persisted Git rail selection. Explicit Repository settings still opens correctly.
Original round IDs retained for planning. No user manuscript edits, credentials changes or Git pushes. Evaluator recruitment form still unavailable. Source dates retain date-only precision when no exact cutoff was extracted.

## r12 Settings scope
Deployed image `overleaf-agent-acceptance:20261107-git-ui-r12` (`sha256:6a299917698b6e7bea7743b54e75d68b7247c0c6f80451f01d8101e4fe15bfd5`). 108 source hashes verified; 114 frontend tests pass. Browser settings-scope-report.json confirms no Open Changes, Sync now, Resume automatic sync or initial-sync prompt in Settings; configuration controls remain, and project reload does not open Git. Sync operations/progress moved into Changes while enabled. Actual user settings and repository contents untouched.

## Repository actions r14 — 2026-11-09
- Changed production files: repository-header.tsx, git-sync-panel.tsx, push-controls.tsx, pending-commits.tsx, git-sync.css.
- 118 Git frontend tests passed; browser-repository-actions.py and browser-settings-scope.py passed.
- Existing remote-bound model preserved. Cloud action opens saved commits for explicit push; new branch publishing uses existing branch creation flow. Unsupported desktop Git operations are not advertised.
- Manuscripts, credentials and external repositories untouched.

## r17 direct branch operations
- Three-command inline picker and direct checkout: passed in real browser.
- Three local fixture refs created and listed; source selection and detached checkout: passed.
- Restore original branch, manuscript fingerprint unchanged: passed.
- No default Git workspace, no first-sync prerequisite or Incoming & merge navigation: passed.
- Backend: 217 passing; frontend: 116 passing.
- Build: r17, 109 verified source files; localhost:18081 activated.
- Evidence: direct-branches-report.json, direct-branch-picker.png, direct-branches-result.png.
- Retained-commit architecture and detached-commit limitation are recorded in notes.md.

## r18 compact composer and branch information
119 frontend and 219 backend tests pass; no Git-specific TypeScript diagnostics (existing unrelated errors remain). Real configured AI generated a message from selected main.tex and populated the input without any Git mutation. Browser verified author, relative date, exact timestamp tooltip and commit subject on branch rows. Unselected-file and selected-hunk evidence, stale-selection/manual-message protection covered by tests. Build hash verification: 110 files; localhost:18081 activated.

## r21 actual Commit
- Browser: two consecutive selected-file commits advance the branch and Graph without reload; committed paths leave Changes; no review or push.
- Actual commits: d53983cd6154204f675b5903887c725827492f76 -> 5addc48f8fd4c0df6906420f927826ae0c209e81.
- Unselected changes and complete project byte fingerprint preserved. Isolated fixture only.
- Local ref/database crash recovery and stale-ref rejection tested; remote push lease/local-tip guards tested without external push.
- 120 frontend / 221 backend tests passed. Final ref/cache targeted suite: 8 passing. TypeScript has no Git-specific diagnostics.
- Evidence: local-commit-report.json, local-commit-graph.png; input alignment report and screenshot.
