# Rebuild Git plugin using mature Git implementation

## Objective
Reuse mature native Git implementation and an existing maintained backend library. Adapt Overleaf frontend/project storage only. Match VS Code Git / Git Graph operations; no custom commit/review/synchronization model.

## Actions
- [x] P0 Inspect upstream implementation, pin dependency/license, document exact native command mapping.
- [x] P0 Implement thin backend adapter to native Git via maintained library; real repository/index/commits/refs/worktrees.
- [x] P0 Verify regression (native isolated fixtures): commit selected files on B, switch to older A/repo-test, restore branch-specific edits, graph/ref correctness, no duplicate local/remote labels.
- [x] P0 Adapt Overleaf project storage with preservation of unsaved content and collaboration; validate isolated fixtures before user project.
- [x] P1 Connect authenticated API, credentials, clone/init, branch create/from/detached, status/stage/unstage/commit/diff/graph.
- [x] P1 Complete fetch/pull/push/publish, remotes, tags, stash, worktrees, merge/rebase/cherry-pick/revert/reset and conflict continuation/abort through native Git.
- [x] P1 Implement compact Overleaf UI, AI commit message from selected diff, branch author/date/message, graph refresh; no automatic opening on project load.
- [x] P1 Test full operation matrix against real Git, frontend interactions, and existing non-Git plugins.
- [x] P1 Build/deploy isolated candidate; reuse dedicated test tab only; validate real project flow without altering user work.

## Invariants
- Commit creates a real local Git commit immediately, advances current branch and graph. Push is separate.
- Changes = native working tree/index vs current HEAD. Never substitute another branch's snapshot.
- Branch-specific uncommitted edits must survive switching away and back; native worktrees are preferred.
- Existing repository/credentials/manuscripts stay intact. No force push, destructive reset or deletion without user-selected action.
- Git failures and conflicts are native Git state surfaced inline, not mandatory custom review workflows.
- No status/feature completeness claim based only on mocks.

## Historical checkpoint (superseded by final r29 verification)
- Live candidate: r15 at port 18081. Native Git is executed via simple-git; custom GitSync directories remain absent from verified image.
- r11: 201-file image verification and 47 Linux backend tests passed. Fresh live API/document-service acceptance proves commit/graph, old-branch contents, per-branch unfinished edits, and source-to-target merge editor bytes.
- Amend source: native stale branch/head guard and full-message UI implemented. Existing frontend 43 plus new UI test, native amendment regression, and 20 adapter/workspace tests pass. r12 production build and 201-file verification passed; live-amend-test.py verifies exact staged bytes, retained unstaged editor content, full message and changed graph tip.
- Restart authorized by user. Connected editors alone no longer block an explicitly authorized deployment; active Git/project write locks still block it.
- Browser access host unavailable; no new or user-active browser tabs touched. Browser typing, rendering, unsaved buffer behavior, real AI/remote integration and remaining advanced UI remain unverified or incomplete.

## Remaining execution order
1. Completed: verify/deploy r12 and isolated live amendment acceptance.
2. Completed reset/ignored-file controls; audit remaining remote/tag/graph action coverage.
3. Reuse an existing dedicated test tab when browser access returns; verify actual editor events and UI flows.
4. Update acceptance matrix with requirement-specific evidence; full goal remains incomplete.

## Validation limits
API/document-service tests do not prove browser auto-refresh or unsaved buffer behavior. Full frontend typecheck previously failed outside source-control; targeted tests and production builds provide bounded evidence.

## Historical checkpoints
The entries below record earlier versions; current state above and deployment.json take precedence.

## Latest operation UI checkpoint
- Added repository actions for branch rename/delete, create-from, cherry-pick, revert and local tag create/delete. All dispatch existing native Git adapters.
- Status now reads worktree-specific native merge/rebase/cherry-pick/revert markers. UI offers continue/abort/skip only for the actual active operation, with continue disabled until native conflicts are resolved.
- Native regression verifies abort restores HEAD and clean files for rebase/cherry-pick/revert, and a different worktree never inherits the active operation. Frontend verifies conflict controls and rename dispatch. No deployment or real project modifications.

## Remote authentication checkpoint
- Added account/project/repository-scoped credential adapter using existing @overleaf/access-token-encryptor; storage requires persistent OVERLEAF_NATIVE_GIT_CREDENTIAL_KEY. No new Git state model.
- Authenticated command API now supports addRemote/fetch/pull/push and credential status/save/remove. Pull uses existing exclusive editor transfer path; push remains separate from commit.
- UI provides remote operation dialogs and a separate credentials settings modal with password mask, replacement/removal and no operational buttons.
- Real isolated HTTPS smart-HTTP fixture verifies unauthorized rejection, authenticated push/fetch/pull and actual remote/local refs. Secrets remain outside Git config/arguments and are redacted from errors. Frontend 15 passed; runtime import passed. Real external remote/account and Overleaf server end-to-end validation still pending.

## Connect and production build checkpoint
- Connect clones real Git history into server-owned storage, preserves existing project files as uncommitted differences, and supports interrupted clone-install recovery. No first-sync review or automatic manuscript replacement. Native connect/API tests and frontend connection tests pass.
- Scoped build context records 42 source hashes. Candidate base has 125 layers: amd64 build failed at layer limit before compilation. A temporary-container export/import is flattening the base with original runtime metadata, without changing existing services or volumes. Continue from the live build/flatten handle; do not treat source tests as deployment evidence.

## Live integration checkpoint
Production candidate r4 is deployed at 18081 after 195-file source verification. Core authenticated API branch/commit/graph regression passes against real Overleaf document services; independent dirty edits survive switching B/main/B/main. Concurrent document writes and realtime queue admission are rejected during the live exclusive transfer, leaving bytes/version intact. Two live-only adapter defects were fixed and recorded. Browser access host remains unavailable; no user page changed. Do not mark the full plugin complete: remaining advanced UI, browser behavior, full remote/AI integration and regressions are still pending.

## Current priority
User Gitee authentication failure diagnosed as remote 401 for provided credentials. Candidate r5 has clear credential error text; valid replacement credentials still required in UI. Resume hunk-selection UI afterward; native hunk adapter is implemented/tested, not a completed UI feature.

## Repository menu and separators (current request)
- [x] Move repository action menu to body portal so scrolling sections cannot clip it.
- [x] Replace filled resize bars with a thin rule and hover/drag feedback.
- [x] Replace ambiguous file-history glyph with a clock-arrow SVG and tooltip.
- [x] Frontend regression: 17 passing, including portal placement and final-item selection.
- [x] Production UI build and 195-file verification passed; candidate r6 deployed. Health check recorded in notes.
The newest user screenshot shows a connected repository; the earlier rejected-credential diagnosis is historical, not a current blocker.

## Partial staging UI
- [x] Show native diff hunks with Stage change / Unstage change actions.
- [x] Refresh index, graph and remaining hunks after a successful action; expose stale-diff errors inside the diff.
- [x] Test both directions, stale rejection and whole-file-only fallback; rerun native hunk tests.
- [x] Build/deploy verified r7 candidate; login health 200 and authenticated isolated-project hunk response passed. Browser visual validation remains unavailable.

## Stash management
- [x] Add native stash preview and expected-hash checks so index renumbering cannot target another saved change.
- [x] Add stash list with message/author/date, preview, apply, pop and explicit delete confirmation.
- [x] Native stale-index and UI tests passed; r8 deployed; authenticated stash-list endpoint passed.


## User-reported outage after r8
- [x] Inspect live logs: user-project native-git GET repeatedly timed out acquiring RedisWebLocker (500).
- [x] Observe lock expiry without deleting locks or editing files; actual project GET recovers in 0.46 seconds.
- [x] Verify actual commit 19e133fe exists and models/conversations endpoints return valid JSON.
- [x] Guard candidate restarts against connected editors and active project/Git write locks; four unit tests pass and current live guard refuses restart.
- Do not deploy/restart while user editor remains connected. No browser tab manipulation or duplicate commit.

## Lock contention and interruption feedback
- [x] Convert only lock-acquisition timeout to a retryable JSON 503; preserve operation errors.
- [x] Show safe status refresh for interrupted requests without repeating commits/pushes.
- [x] Eight backend lock/handler tests and 28 frontend tests pass. Leave live r8 unchanged while editor is connected.

## Editing does not refresh Changes
- Root cause: SourceControlView fetched status only on mount and explicit operations; editor doc:changed/doc:saved events were not subscribed.
- [x] Add debounced background status refresh for editor changes/saves, focus and visibility restoration.
- [x] Keep background reads separate from write operations; discard stale responses when a newer Git operation starts.
- [x] 28 frontend tests and 8 backend tests passed; production r9 build and 197-file verification passed.
- [ ] Deploy r9 after connected editor exits or user explicitly accepts interruption; live r8 retained.

## Blame presentation
- [x] Parse native line-porcelain output for display only; preserve line text and actual commit metadata.
- [x] Add line-author view from file history with navigation to the real commit diff.
- [x] 32 frontend tests passed, including full history → blame → commit diff navigation; live service unchanged pending update timing.

## Merge direction clarification
- [x] Inspect actual refs, merge parents and Related Work diff without executing a new merge.
- [x] Make source → target explicit in merge dialog/button; check expected target in native adapter.
- [x] Frontend/native regressions pass (33/17).
- [ ] Build/deploy accumulated source after update timing is resolved. Conflict UI work remains pending.

## Conflict resolution adapter and UI
- [x] Read native unmerged index stages and current file with fingerprint; refuse stale resolution.
- [x] Resolve using native checkout/add/rm or explicit edited text, through existing exclusive editor transfer.
- [x] Conflict editor and Merge Changes section added; native tests 20 passed, workspace 15 passed; frontend integration included in 39 passing tests.


## Searchable merge sources
- [x] Replace free-text merge action with searchable branch list, metadata and explicit source → target.
- [x] Exclude current branch; require explicit selection; clear selection when filtering; preserve error state.
- [x] 39 frontend tests pass. Full typecheck still fails on unrelated files, no source-control diagnostics.
- [x] Production r10 build and 200-file verification passed; Linux regression result retained in r10-linux-tests.log. Deployment still awaits update timing.

## Worktree management
- [x] Expose native worktree inventory without accepting filesystem paths from HTTP.
- [x] Refuse cleanup of current/main/locked/dirty worktrees, ignored files, unreferenced detached commits and unfinished operations.
- [x] Add worktree list/confirmation; frontend 41 and native macOS 22 passed. Linux 22 passed with current source mounted into isolated r10 image; live service unchanged.

## Discard unstaged changes
- [x] Add raw-content/index/branch fingerprint for discard preview, including binary file edits.
- [x] Expose per-file preview and explicit discard confirmation; use native restore from index.
- [x] Host native 24 and frontend 43 tests pass: staged content survives, stale binary/index changes refused, untracked preview refused. Linux 24 passed with current source mounted into isolated r10 image.

## r11 delivery checkpoint
- [x] Full production build includes accumulated source (50 staged files); 201-file image verification passed.
- [x] Run repository, workspace, lock and HTTP handler suites inside r11: 47 passed, 0 failed (49.8 seconds).
- [x] Inspect running candidate: still r8. Restart guard rejects connected editor; no restart attempted.
- [ ] Deploy when editor exits or explicit interruption approval arrives; pending timing question is unanswered.
- [ ] Reuse existing test tab for UI acceptance. Browser access host currently unavailable; no new tabs created.

## r11 deployed 2026-11-10
- User explicitly authorized restart while editor connected. Added explicit environment override for editor connection guard only; active Git/project write locks still block restart.
- Candidate replaced with verified r11; login HTTP 200 and authenticated isolated fixture native Git status succeeded. Existing volumes retained; no browser tab manipulation.
- Browser interaction acceptance remains unverified. Full feature goal remains incomplete.

## r11 live core acceptance
- [x] Fresh live branch run in isolated fixture: edits via document updater, stage/commit via authenticated public API, graph and distinct branch tips checked; old main contents restored; both branches retain uncommitted bytes.
- [x] Fresh source-to-main merge via public API: exact merged editor document bytes, clean status and updated graph verified.
- Evidence: native-git-r11-live-acceptance.log and native-git-r11-live-merge.log. Dedicated fixture only; no user project modifications or external pushes.
- [ ] Browser typing/menu/render acceptance: browser access host still unavailable. API checks do not prove DOM auto-refresh.

## Amend latest commit
- [x] Expose existing native commit --amend through explicit repository action; load full native message.
- [x] Capture HEAD and branch and reject stale/switch targets before rewriting; unstaged bytes stay intact.
- [x] Native amendment test passes, existing frontend 43 tests pass, new amendment UI test passes, adapter/workspace 20 tests pass.
- [ ] Include in next production build and live isolated acceptance. Live r11 remains deployed.

## r12 deployment and live amendment acceptance
- Built and verified 201 files; amendment regression passes inside final Linux image.
- Restarted candidate under existing explicit user authorization, preserving volumes. Login HTTP 200, authenticated fixture succeeds.
- Actual amendment replaces the selected tip, updates graph, includes exactly staged bytes, preserves unstaged document bytes and full message body.
- No external pushes or user-project writes; browser interaction remains unverified.

## Reset UI implementation
1. Read target commit and current native state; fingerprint branch, HEAD, index and worktree bytes before confirmation.
2. Add searchable commit chooser and explicit soft/mixed/hard modes; hard mode requires a deliberate discard acknowledgement.
3. Refuse changed preview; execute native reset via existing exclusive editor transfer.
4. Verify native mode semantics and UI selection/confirmation, then build/deploy with other completed controls.

## Reset source validation
- Searchable target history and explicit soft/mixed/hard modes implemented. Hard mode requires explicit acknowledgement; no automatic reset or push.
- Native preview binds exact resolved target, current branch/HEAD, index and all project file bytes. Changed target or binary file invalidates confirmation.
- Native mode regression passes: soft preserves index/files, mixed unstages while retaining files, hard restores tracked files and preserves unrelated untracked content. Frontend suite: 45 passed.
- Not deployed yet; live remains r12. Include reset source in next production build and isolated live acceptance.

## Ignored file controls
1. List ignored paths using native ls-files --others --ignored --exclude-standard.
2. Add searchable list and explicit Stage anyway per file, delegated to native git add --force.
3. Verify ignored files stay out of ordinary Changes until explicitly staged; no file deletion or custom ignore matching.
4. Build/deploy together with Reset and validate on isolated fixture.

## r13 deployed and validated
- Added native ignored-file list and explicit per-file force staging; ignore rules unchanged. Native tests prove normal Changes excludes ignored files, explicit staging includes selected bytes.
- 46 frontend tests pass; production build and 203-file verification pass. Reset and ignored-file regressions pass inside final Linux image.
- Deployed candidate r13 under existing user authorization, login HTTP 200. Live isolated reset test verifies soft index retention, mixed unstaging with editor unchanged, hard restoring exact baseline editor bytes and clean status.
- No user-project mutation or external push. UI/browser behavior and broader remote/model integration remain unverified.

## Real AI acceptance
1. Stage a small synthetic title change in the isolated fixture, leaving a distinct unstaged edit.
2. Call deployed generateMessage with existing test-account model configuration.
3. Verify a valid generated subject; restore fixture worktree/index without touching user projects or publishing anything.
4. Record returned outcome and distinguish live model verification from earlier injected-model scope tests.

## Real model acceptance passed
- Deployed r13 generateMessage called the configured agent model with synthetic staged LaTeX macro addition. Returned subject: Add LaTeX macro for native Git integration check title.
- A distinct unstaged bibliography note remained outside the staged snapshot. Earlier injected-model tests prove prompt scoping; this live result proves provider connectivity and valid generation, not model secrecy guarantees.
- Restored fixture index and document bytes; confirmed clean status. No commit, push or user manuscript sent.
- Browser access host still unavailable at latest inventory; no tabs manipulated.

## Live conflict acceptance
1. Create two isolated fixture branches with different edits to the same line.
2. Merge and inspect native conflict state plus editor markers.
3. Read native index versions, choose incoming explicitly, continue merge, verify two-parent commit and exact editor bytes.
4. Record failures as product defects if error responses/UI state are misleading.

## Live conflict defect fixed in r14
- r13 live fixture proved markers/versions/resolution/two-parent continuation correct, but native merge conflict returned generic HTML 500.
- ProjectWorkspace now classifies native conflicted state after importing markers; handler returns actionable JSON 409 GIT_CONFLICT. Existing file-transfer errors retain original handling.
- Workspace/handler regression passes; new handler test passes; final r14 Linux targeted tests 3/3 and 203-file image verification pass. Backend-only image inherits verified r13 frontend.
- r14 first conflict fixture auto-merged repeated prefix text; retained as inconclusive, not a failed product test. New fixture replaces same first line and confirms JSON409, editor markers, exact native versions, selected incoming content and real two-parent merge.
- Candidate r14 deployed under existing restart authorization. No user-project mutations or external pushes.

## Browser read-only inspection after r14
- Native Chrome accessibility inspection showed the user project tab displaying a 502 Bad Gateway document. No browser action was executed.
- Authenticated GET of that exact project route returned HTTP 200 with editor HTML (31,482 bytes); running candidate is r14. The currently displayed browser document has not refreshed to the recovered service response.
- Current visible Chrome window has no isolated acceptance project tab. Browser host API remains unavailable; do not reuse the user's active project tab for fixture testing.
- Browser acceptance remains unproven, despite API health and core live validation.

## Remote settings completion
1. Expose native removeRemote from settings with exact name/address confirmation.
2. Bind confirmation to expected URL, refusing removal if configuration changed.
3. Preserve local branch commits and files; refresh sidebar status after settings close.
4. Verify native configuration/ref semantics and frontend confirmation behavior.

## Remote removal source completed
- Settings now explicitly confirms name/address and explains remote-tracking ref removal while local branches/commits/files remain. No remote was removed from a user project.
- Expected-address guard rejects configuration changes; native regression verifies local HEAD and unfinished bytes preserved, remote refs removed.
- Closing settings refreshes sidebar state. Frontend suite 47 passed; native targeted test passed. Pending next build; live r14 unchanged.

## Tag checkout parity
1. Expose native lightweight/annotated tag commit metadata in repository snapshot.
2. Include tags in searchable checkout chooser, clearly marked as detached checkout.
3. Use fully qualified tag refs to avoid same-name branch ambiguity; preserve existing worktree handling.
4. Test native target/metadata and picker routing before next combined deployment.

## Tag chooser source validation and combined build
- Native for-each-ref supplies lightweight and annotated tag target commit metadata, separate from branch list. Picker searches tags and routes fully qualified tag refs to existing detached worktree checkout.
- Native regression checks both tag forms and same-name branch ambiguity. Frontend suite 48 passed; workspace suite 15 passed.
- Combined remote-removal/tag release r15 build started, session 30917, log /tmp/native-git-r15-build.log. Resume this handle; live remains r14 until verification/deploy.

## r15 live acceptance completed
- Full production build, 203-file verification, final Linux native tag/removal regressions passed; candidate r15 deployed, login HTTP 200.
- Live API/document acceptance: same-name branch at newer HEAD does not affect qualified tag checkout at older commit; detached state and exact old bytes verified; return to original branch restores bytes.
- Configuration-only remote add/remove verified local HEAD and document unchanged. No network fetch/push. Test tag and unused same-name branch removed.
- Remaining evidence gaps: browser UI/unsaved edits, full authenticated remote path, live stash/worktree recovery and other-plugin regression. Continue acceptance rather than claiming completion.

## Live stash/worktree acceptance
1. In isolated fixture, save distinct staged and unstaged edits with native stash; verify clean editor, preview and exact restoration using pop --index.
2. Create only a disposable fixture worktree, leave edits, switch away and verify cleanup is rejected with 409.
3. Restore that fixture's baseline, clean its inactive worktree, and verify its branch ref and active editor remain unchanged.

## Live stash/worktree acceptance passed on r15
- Native stash cleans editor; stash preview includes synthetic staged/unstaged changes; pop --index restores exact editor bytes and distinct index/worktree state. Staged diff excludes later unstaged line.
- Dirty disposable worktree removal returns 409, reopening restores unfinished bytes. Clean inactive worktree removal succeeds while branch ref and active editor remain intact.
- Only isolated fixture was modified. Test stash popped, disposable worktree/ref cleaned, fixture ends clean. No deployment/restart, external push or user-project mutation.

## Consolidated r15 regression
- Executed all eight native-git test files inside deployed image r15 against disposable isolated Redis: 70 pass, zero failures/skips. Internal validation network and Redis removed afterward; no live service state used.
- Includes authenticated native HTTPS smart-HTTP transport, encrypted credentials, clone recovery, write lease/admission, workspace transfers and native command semantics. This is final-image fixture evidence, not browser or deployed HTTP remote validation.
- Platform DocumentUpdaterHandler + ProjectEntityHandler regression: 94 pass, 2 fail. Both missing readDocumentDeletionSnapshot tests were already documented in the earlier continuation checkpoint. Preserve failure log; do not alter unrelated plugin code or claim full platform green.

## Deployed public HTTPS remote acceptance
1. Create/reuse a dedicated remote-acceptance project and read its initial document bytes.
2. Connect public octocat/Hello-World through deployed authenticated API, preserving project files.
3. Fetch through deployed credential-aware path, verify actual remote refs/history and unchanged editor bytes.
4. No external push, token use or user-project writes; record network failures separately.

## Public remote and browser session progress
- Deployed authenticated API cloned and fetched public octocat/Hello-World over HTTPS in a separate named fixture project; exact original editor document preserved. No-op pull also preserves bytes; not a remote-update merge test. No token or external push used.
- Browser-host tool remains unavailable. Started one invisible isolated Chromium headless session via webapp-testing, Python REPL exec session 66548; reuse this handle and page. No existing Chrome window/tab operated.
- Existing test account logged in via UI without printing credentials. Isolated project rendered Code Editor and File tree, no automatic Git panel. Continue DOM/screenshot interaction acceptance in this same headless page.

## Current browser acceptance
- Actual editor input automatically appears in Changes; UI staging, commit, graph advance and clean status passed on isolated project. No review dialog opened.
- Repository dropdown portal extends below Repositories without being clipped; inspected menu bounds 220x560 within viewport. Merge dialog lists branch authors, commit IDs, dates and subjects with search.
- Continue uncommitted-edit branch roundtrip; fix missing accessible name on Git rail icon; verify and deploy the scoped correction.

## r17 browser-driven fixes and deployment
- Restored Git rail accessible name with hidden title. Native document write-back now uses the established git-bridge source understood by editor external-update handling. No write/CAS protections relaxed.
- Full production build passed; 203 source files verified; frontend suite48 and adapter suite5 passed. r17 deployed and login200.
- Browser checkout main and return: exact unfinished bytes restored, old branch excludes later content, zero external-update dialogs in both directions.
- Found container replacement invalidates login because generated CRYPTO_RANDOM changes. Candidate deploy now reads current signing secret privately and passes OVERLEAF_SESSION_SECRET through compose. Second same-image replacement session75944 tests cookie continuity.

- Second replacement verified in same headless browser: existing session remained logged in, persisted Git selection reset to File tree, unfinished editor bytes survived unchanged. No user Chrome tab changed.
- Remaining: browser advanced conflict/hunk/settings/connect acceptance and deployed authenticated remote push/update-pull. Goal remains active.

## Browser hunk acceptance race
- Two independent hunks correctly split staged vs unstaged native state. Closing diff during asynchronous apply/refetch reopened it unexpectedly.
- Added request-generation invalidation on close and branch/reset; responses for closed views cannot reopen them. Added delayed apply and delayed refresh regression cases. Run frontend suite, then deploy combined browser fixes.

## Current r18 browser acceptance
1. Verify immediate diff-close after hunk apply remains closed after request completion.
2. Prepare divergent source/target branches only in isolated fixture, preserving original dirty branch worktree.
3. Merge through searchable browser picker, resolve conflict in browser, continue merge, verify editor bytes and native parents.
4. Record deployed evidence without restarting services.

## P0 VS Code source control presentation and editor integration
- Changes: reusable file icons, basename + muted directory, colored status badges, compact hover actions.
- Graph: colored parent lanes, highlighted hover/selection, expandable native commit file lists, metadata/statistics hover card with copy hash.
- Editor: replace raw diff modals with editor-region side-by-side comparison, line numbers, add/remove highlighting; retain hunk actions and preserve underlying document.
- Native Git supplies commit file/name-status/stat and scoped patches including root, rename, delete and merge first-parent cases. No custom Git history semantics.
- Test these integrations and inspect rendered browser before combined deployment. Existing pending merge-conflict chooser fix included.

## r21 deployed UI validation
- Production image verified against 206 files and deployed to candidate 18081; existing headless browser session reused and authenticated project/Git state loaded.
- All three section chevrons tested collapsed and expanded: 16x16, stroke 1.6, x=50 in both states; same SVG rotated around center.
- Working-file diff opens one side-by-side table inside editor, zero dialogs; Close diff removes region. Final screenshot /tmp/native-git-r21-final.png.
- Build disk pressure caused candidate Mongo ENOSPC; candidate Mongo recovered and ping=1 verified. Removed only unused r16/r20 image tags; cache still retains layers, no claimed disk reclamation. Docker remains low on space (1.3G available); no further build started. Separate mongo container reports kernel-version incompatibility, not handled as part of Git UI.
- Broader authenticated remote push/update-pull acceptance remains unfinished.

## Deployed authenticated remote acceptance
- Previous goal turn classified progress: r21 deployed and browser chevrons/diff verified.
- Added deployed-https-fixture.mjs and live-authenticated-remote-test.py. Native git-http-backend handles HTTPS; certificate trusted only by isolated repository.
- Project 6af22b1d8fefc23efb026e31: unauthenticated push refused, credential save/status, publish main, native bare ref equality, fetch preserves editor, independent remote file change pulled to exact editor bytes, graph hash and clean status verified. Credential removed afterward.
- Initial fixture attempt hit native Git dubious ownership under root; fixed harness with per-invocation safe.directory for exact fixture path. No global Git settings changed. No product fix needed.
- Actual external provider writes and several advanced browser interactions remain unverified; full goal remains active.
- Same headless browser verified pulled commit appears once in Graph and exact incoming marker in editor. Repository settings UI saved and removed fixture credentials; token field type=password and cleared after save. Script Python/Node syntax checks passed.

## Browser branch lifecycle and adapter fixes
- Previous turn was progress: deployed authenticated HTTPS transfer and settings UI acceptance.
- Browser project 6af22b1d8fefc23efb026e31 created acceptance-r21-ui-new at current tip, acceptance-r21-ui-old at a47a0c5, detached checkout at 6a51be6. Exact editor bytes verified on current/old/detached versions. Renamed new branch successfully.
- Found detached status exposes simple-git current=HEAD as branch; adapter now reports null when detached.
- Found retained-worktree branch delete returns generic HTML500, shown as service outage. Adapter now returns actionable JSON409, preserving branch/files. Current-branch refusal also explicit.
- Native repository suite30 passed; r22 backend-only image layers on r21, no webpack rebuild. Verified206 files, deployment started. Browser final verification pending.
- r22 deployed. Same browser verified actionable retained-worktree error; cleaned only isolated clean renamed branch workspace, deleted branch via UI; native branch list confirms only main and isolated old branch remain. Temporary HTTPS server ended with replacement; credential already removed.

## Stash browser acceptance and remaining preview fix
- Previous goal turn was progress: r22 adapter fixes deployed and branch lifecycle browser verified.
- Same headless browser, isolated project 6af22b1d8fefc23efb026e31/main: save stash restores exact original; Apply and Pop restore exact edited bytes. Native status MM and index contains staged marker but excludes unstaged marker.
- r22 defect reproduced: closing immediately after Apply can be undone by late stash refresh. Source reload now preserves closed state, component ignores pending results after unmount.
- Stash View changes now closes manager and routes native patch to existing editor-region side-by-side renderer, replacing raw pre text.
- Source-control frontend suite55 passed, including editor-region stash integration and late preview response after close. Changes NOT built/deployed yet; live remains r22. Disk headroom remains limited; avoid full Docker dependency rebuild.
- Fixture main retains staged and unstaged synthetic edits plus original stash for further verification; user projects unchanged.

## r23 build and pending deployment
- Previous turn progress: browser Stash index/worktree roundtrips and source preview/close fixes,55 frontend tests.
- Exact project Yarn cache kxht9cqlr4g5tfzk77y6g5ty4 removed (1.398GB), Docker availability increased1.4G to2.7G. No images/volumes or manuscript files deleted.
- r23 production build started; log /tmp/native-git-r23-build.log. Verify source manifest, deploy candidate, reuse headless browser for stash preview and closed-response acceptance.
- First r23 build handle65129 explicitly cancelled (exit130) after confirmed VM memory PSI full avg60=60.63 and prolonged dependency fetch. No service stopped. Build retry handle54205 uses Yarn network concurrency4 and install heap768MB; webpack remains1536MB. Prior attempt log retained.
- Reduced-concurrency attempt54205 completed download/link, but disk reached0 during webpack; explicitly cancelled exit130. Removed only regenerated Yarn cache nh1lg3j3mpezb6ueiukhcdu24 (1.41GB), available2.7G and Mongo ping1. Yarn global-cache default had overridden cacheFolder; disabled global cache and mirror so archives stay in existing /tmp tmpfs. Third attempt log /tmp/native-git-r23-build-tmpfs.log.

## Remaining completion audit after r23
- P0: finish live build53429 and validate stash editor diff/closed-list behavior in same browser.
- P1: browser connect/init, advanced operation recovery (rebase/cherry-pick/revert), discard and ignored-file flows, beyond native-only tests.
- P1: Graph UI inspection shows no provider commit link and no branch filter control despite native graph(ref) support; prior screenshot requires provider navigation action and VS Code reference shows branch filtering. These are implementation gaps, not completed by existing graph tests.
- P1: Graph is bounded to100 native commits in snapshot; history search currently filters loaded entries. Audit older-history access rather than claim complete history search.
- P1: other native refusal errors may still become generic HTML500, as previously seen for occupied branch deletion; verify expected error mappings.
- r23 temporary-cache build succeeded,206 files verified, candidate deployed. Docker2.6G free and Mongo ping1. Same browser login retained, exact staged/unstaged manuscript preserved, Stash View changes opens one side-by-side editor table with zero dialogs; close returns exact editor bytes. Screenshot /tmp/native-git-r23-stash-editor-diff.png visually inspected.
- r23 browser Apply then immediate Close leaves Stashes dialog open because onHide explicitly ignores close when busy (not proof of late-response reopening). Source now allows closing while operation continues; mounted-response guard and closed-list reload guard remain. Added busy-close regression;56 frontend tests pass. This final one-line behavior fix is not yet built/deployed. After operation completes, live dialog closes normally and exact bytes remain.

## Graph navigation implementation
- Previous goal turn progress: r23 deployed and stash side-by-side editor diff/browser preservation verified; immediate busy close source fix pending.
- Added GraphHistory UI: native branch ancestry selector,100-row pages with Load earlier commits, stale-result generation guard. Read-only graph queries bypass editor save barrier.
- Native graph accepts validated nonnegative skip, passed directly to git log.30 native repository tests and58 frontend tests passed.
- Search label now truthfully says Search loaded history; complete-repository search still remains an explicit gap.
- Staged56 source files and started r24 production build /tmp/native-git-r24-build.log with bounded network concurrency and tmpfs-only archives. Docker2.6G free before build.

## Advanced browser operations during r24 build
- Existing live build57642 polled, still dependency fetch with2.6G free; no duplicate build.
- Isolated branch acceptance-r21-ui-old rebased onto main through UI; exact incoming editor bytes matched. Revert6a51be6 restored exact old text, cherry-pick6a51be6 restored incoming text. Native log confirms a6b7c08 ->30d7fb5 ->6a51be6. No user project writes.
- Build57642 caused high memory PSI(full avg60~47%) during dependency linking and web Mongo timeouts/502. Explicitly cancelled exit130, not an expired-observation restart. Added Yarn taskPoolConcurrency2 per official settings; not yet retried.
- Initial main return comparison false was a failed checkout: UI still old branch with connection error. Native main worktree remains MM with both markers. Service login returned200 after resource pressure dropped; browser recovery verification follows.
- After service recovery, same authenticated browser successfully switched old test branch to main; exact staged+unstaged editor text equals pre-test stash_both. Recovery verified beyond login health.

## r24 bounded build and connect UI acceptance
- Previous turn progress: advanced browser operations verified; memory-pressure build cancelled and service recovered with exact dirty main bytes.
- Build61069 started with Yarn taskPoolConcurrency2/networkConcurrency4; log /tmp/native-git-r24-bounded-build.log.
- Same headless browser connected new isolated project6af23a72ba38c0bc017cbf73 to public octocat/Hello-World over HTTPS; branch master and5 graph commits render, exact pre-connect document preserved. No push.
- r24 bounded build61069 succeeded,207 files verified, candidate deployed. Same browser main branch filter returned2 commits; isolated native acceptance-pagination ref with105 additional unchanged-tree commits returned100 then107 rows, load-more disappeared at end. Working tree main bytes preserved. These refs exist only in isolated project6af22b1d8fefc23efb026e31.
- r24 browser Apply-immediate-Close passed: zero dialogs after completion, exact stash_both editor text restored.
- Browser graph filtering exposed stale hover card anchored to removed row, blocking Repository actions. Reproduced even after moving mouse away. Added effect dismissing hover on hash-list identity change;59 frontend tests pass including replacement-row hover regression. This supplement not built/deployed.

## r25 disclosure and hover correction
- Previous goal turn: progress; centered disclosure geometry and fixed SVG size, focused29 tests passed.
- r25 stages56 integration files and builds with bounded Yarn task pool and webpack heap; live r24 remains available.
- Build handle19585, /tmp/native-git-r25-build.log. Verify image before deployment; preserve session keys and reuse headless browser.
- Remaining full-goal gaps include provider commit links, full-history search and advanced operation recovery acceptance.
- Same headless browser session66548 confirmed deployed r24 still uses old path on all three headings. Temporary DOM preview of new centered SVG measures16x16 and stroke1.6 for all three; this is preview evidence only, not deployed acceptance.
- Build19585 confirmed live after dependency install completed in3m20s; now webpack production. Existing login endpoint remainsHTTP200.
- r25 build19585 exited0; verified207 files and simple-git adapter, deployed candidate successfully. Brief startup502 resolved toHTTP200 before browser reload.
- Existing headless session66548 retained authentication. All three deployed SVGs have centered pathM6 4l4 4-4 4, round caps and16x16 bounds in collapsed/expanded states. Graph heading moves with panel layout, as expected.
- Browser hover then branch-filter main removes Copy commit ID popover; exact staged+unstaged fixture editor text equals stash_both after restart. Full goal still incomplete per acceptance matrix.

## Provider commit navigation
- Prior turn progress: r25 deployed, disclosure and hover regression browser verified.
- Add sanitized provider metadata from native remote configuration to snapshot; render per-remote commit links in hover. Raw URLs/authentication never included in this new snapshot field.
- Verify URL normalization, native workspace propagation and hover href tests before next build. GitHub public fixture full hash URL resolved successfully; Gitee official git-osc wiki documents /commit/<hash>, direct page inaccessible via browser tool.
- Native helper and workspace tests19 passed.

## Whole-history search
- Prior turn progress: remote commit links source and60 frontend/19 backend tests passed.
- Replace loaded-only filtering with debounced native history search; traverse native500-commit pages with bounded memory, preserve subject/author/email/hash/ref literal matching and branch scope. Results paginate by matches. No custom commit store or traversal topology.
- Verify old commits beyond first100, matching-result offsets, branch scope, clear-search restoration before building together with provider links.
- Whole-history frontend61 and native repository31 tests passed; expanded fixture506 commits crossed native500-row batch and focused test passed.
- r26 stages57 files, includes provider links and whole-history search. Build1383 running, log /tmp/native-git-r26-build.log; live r25 preserved until verified deployment.
- While r26 builds, r25 browser discard acceptance on isolated main.tex: preview shows only unstaged delta; Cancel preserves text; confirmed Discard removes unstaged marker while retaining staged marker. Restored fixture through editor afterward. CodeMirror inner_text duplicates blank-line separators; corrected the temporary test restoration input before equality check. Rendered text matches saved stash_both again.
- r26 build1383 exited0. Provider host lookup hardened using Object.hasOwn and3 helper tests passed. Backend-only final layer added after compilation; first FROM image-id attempt failed without modifying image, then explicit local compiled tag succeeded. Final208-file source/native-adapter verification passed before deploy.
- Deployed r26 via59951; HTTP200 and existing browser authentication retained. Initial100-row graph searched Authenticated remote fixture initial successfully; main scope excludes pagination query. Editor rendered text exactly stash_both after replacement.
- Same headless tab navigated isolated public clone project6af23a72ba38c0bc017cbf73; hover link equals https://github.com/octocat/Hello-World/commit/7fd1a60b01f91b314f59955a4e4d4e80d8edf11d. No external write or user Chrome action.
- Remaining acceptance: advanced conflict recovery browser flows, ignored files, private connection UI/init, and audit generic native-error mapping. Full goal remains active.

## Native command refusal handling
- Prior turn progress: r26 deployed; whole-history search and provider link browser acceptance passed.
- Handler audit found unclassified native GitError propagated to genericHTML500. Added narrow native-refusal mapping for duplicate/missing refs, unmerged deletion, dirty blockers and empty commits; validation inputs now carry400. Unexpected storage failures still propagate.
- Actual native repository plus handler suite39 passed, including duplicate main, missing ref and invalid branch name. Backend-only r27 layers on verified r26; frontend unchanged.
- r27 backend-only image verified209 source files, deployed successfully. Existing browser session retained. Actual duplicate master creation shows canonical already-exists refusal; no ref created or checkout occurred. Initial automation exact accessible-name mismatch corrected using observed listbox button.
- r27 ignored-file browser test in isolated public-clone project: temporary /main.tex info/exclude rule, ignored list contains main.tex, Stage anyway removes ignored entry, Unstage restores ignored state. Original exclude bytes restored with concurrent-change guard; native status returns exact pre-test D README and ?? main.tex. No commit or remote write.
- Remaining full acceptance includes advanced conflicting rebase/cherry-pick/revert recovery, init/private-connect UI and final end-to-end audit.

## Advanced operation recovery browser acceptance
- Prior turn progress: duplicate-branch refusal and ignored-file flow browser verified on r27.
- New named isolated project6af2cf744b782c4ad5c040aa initialized through existing headless browser. prepare-operation-recovery.py creates divergent source/target refs and independent continue/abort/skip branches for rebase/cherry-pick/revert, guarded by project name and owner.
- Prepare conflicting histories using deployed API/document service, then execute/recover via UI and compare native refs/editor bytes. No user project or external remote writes.
- Fixture prepared successfully. Browser rebase-continue onto source produced actual conflict; rebase Current/Incoming explanation visible. Edited merged result, staged and continued via UI. Native rewritten tip d0923885345a4dcc3d944e43c464e9dafd729704 parent is source dfa5a5fec6abf4801da24096b87ae1f69f3b7818; editor .cm-line exact bytes equal resolved result, operation controls disappear.
- Found original launch modal remains after native conflict, requiring manual Cancel before Resolve. Generalized existing merge dismissal to action dialogs for all operations;64 frontend tests pass including rebase/cherry-pick/revert conflict dismissal. Source not deployed yet.
- Continue remaining abort/skip and cherry-pick/revert conflict paths in this same fixture; browser currently rebase-continue, clean resolved content.
- r28 build64096 started from58 staged integration files; log /tmp/native-git-r28-build.log. Live r27 retained.
- Added reusable browser-operation-recovery.py for the existing headless REPL, scoped to exact isolated project. Native ref/parent and editor line-byte checks after each operation; results /tmp/native-git-operation-recovery-browser.json.
- Browser rebase-abort and rebase-skip passed: original ref/text restored on abort, source ref/text on skip.
- Cherry-pick continue/abort/skip and revert continue/abort/skip all passed through UI; native ref/parent and editor text assertions passed. Together with previous rebase continue and this-turn abort/skip, all9 recovery paths verified. Evidence operation-recovery-browser.json has8 automated entries; previous rebase-continue evidence above.
- All r27 conflict paths retain launch dialog until manually Cancel; r28 compiled change must still prove automatic dismissal live. Reuse abort branches after deployment (their refs unchanged) for that verification. Browser currently revert-skip with clean target text.
- Original r28 build64096 cancelled explicitly exit130 after TLS fetch failures and VM full-memory PSI~48%; live recovered toHTTP200. Failed log retained.
- prepare-build.py now separates dependency manifests/install from source compilation. Dependency target67698 running with task pool1/network2/heap512; future UI changes reuse installed dependencies. Disk2.5G available.
- Authenticated clone UI passed against localhost native git-http-backend in project6af2eb45344343aa697a0809: anonymous refusal, masked token, successful main branch and native commit listing, exact editor lines preserved. Trust scoped to exact fixture URL via system Git sslCAInfo, then removed; credential removed; fixture server signaledTERM. No external provider writes.
- Final backend suite:75 passed,3 Redis-dependent skipped locally; all4 write-gate tests then passed in deployed Linux container against candidate Redis DB15 with unique fixture keys and cleanup. Logs /tmp/native-git-final-backend-regression.log and /tmp/native-git-final-write-gate.log. Frontend64 passing remains current.
- Dependency target67698 verified running; no new TLS errors, memory PSI near0, liveHTTP200. Registry request from candidate returned200 in1.7s. Do not restart merely because fetch output is quiet.
- Local HTTPS fixture process confirmed absent after cleanup. Remaining release gate: dependency target, r28 compile/verify/deploy, three conflict launch-modal auto-dismiss browser checks, final source/image audit.
- Dependency process67698 remains live. Targeted read-only inspection of its /tmp/.yarn-cache showed1119 archives/792200781 bytes, then1455 archives/871034840 bytes after waiting. This is active download progress, not a hung process. No restart; retain cached work.
- Dependency download progressed to2038 archives/1053067477 bytes. Build67698 remains live.
- Final Docker stage now reuses verified r27 runtime dependency tree and copies newly compiled public assets/source, avoiding another production dependency download. All5 production dependency declarations match running r27; runtime-dependency-baseline.json guards manifests/lock against future incompatible reuse. Frontend build target still uses stable dependency layer.

## r28 build recovery
- Previous turn only reported build state. Re-polled67698 confirmed live, then log showed socket timeout at1797s. Candidate login returned502 and Docker VM reported OOM tracking. Explicitly cancelled build viaSIGINT; exit130 confirmed. Candidate recoveredHTTP200; Mongo healthy. No application replacement performed.
- Dependency cache was under build tmpfs, so cancellation does not retain that fetch cache. Do not repeat this download path.
- Exported running r27 source (excluding node_modules/public/test/cache) to /tmp/native-git-r28-local-build, overlaid current58-file integration manifest, symlinked existing host node_modules. Compile using existing dependencies with minifier parallel:false and3GB heap, outside8GB Docker VM. Log /tmp/native-git-r28-local-webpack.log, session89305. Initial launch used wrong cwd and exited2 before compilation; corrected to isolated services/web directory.
- Local compilation reached Webpack in56s, failed only because isolated export omitted public/img stylesheet inputs (14 errors). Restored public/img from running r27 without copying prior bundles; retry86073 using same installed dependencies. Original failure log retained at /tmp/native-git-r28-local-webpack-missing-static.log.
- Local Webpack retry passed45s (39 warnings,0 errors). Final r28 image built from r27+scoped source+compiled assets in seconds,209-file native-adapter verification passed. Candidate replaced using existing session/encryption keys and volumes; HTTP200 confirmed. Browser final verification in original66548 pending.
- r28 browser startup failed: ES Modules may not assign module.exports, module58874=OError. Immediately restored immutable previously verified r27 image c78571d; HTTP200 and original test tab editor shell restored. Source hash verifier correctly refuses oldr27 vsnewmanifest; rollback used exact recorded imageID rather than changing expectedsource.
- Root cause: isolated node_modules root symlink resolved @overleaf/o-error outside isolatedroot, bypassing Babel CommonJS override. Replaced only temporary build dependency links so workspace packages resolve inside snapshot; external installed dependencies reused. r29 assets compilation passed. Testing new assets through a Playwright route in existing fixture tab before any replacement; production staysr27. First preview lacked CSP nonce and was blocked; preserve original nonce on rewritten scripts.
- Isolated preview caught remaining external non-scoped workspace link overleaf-editor-core (scoped @overleaf links alone were insufficient). Corrected that temporary link too; rebuilding1017. Production remainsr27 andHTTP200. Preview automation changes only test-tab responses, never user browser or server assets.
- Correcting non-scoped overleaf-editor-core link removed all54 external workspace-source references. Latest local compilation43s,2 warnings,0 errors. Isolated preview no longer throws ESM error, but still remainsLoading (socket.io loaded, no further handshake observed). Do NOT deploy r29. Removed test-tab route and restored normal r27 page; productionr27 unchanged since rollback. Next diagnose independent preview initialization before any service replacement.

## Current user corrections: responsiveness, typography and visual files
- Historical file click ran full project export plus repository snapshot refresh; changed commitFiles/commitDiff/commitFileDiff to native readHistory under lock, no editor export or full inspect. Immediate diff title/loading, latest-request-wins and10-entry immutable history cache.65 frontend/17 workspace tests passed before visual preview addition.
- Hover card inherits body16px outside13px sidebar; explicitly match13px text,12px actions, compact padding/line height.
- Add native historical image/PDF blob preview with exact parent/current commit bytes (32MB per-file bound). Reuse existing PDF.js utility, cancellable page rendering and object URL cleanup. Source/tests in progress; live remainsr27.
- Historical read/new binary preview18 native workspace tests and65 frontend tests passed. Temporary asset-preview Loading was a test interceptor bug: original template places socket.io script AFTER </body>; injecting replacement bundles before </body> ran the socket shim before io existed. Moving only the test injection after original socket.io script restored editor startup. This is not a product code change. Final59-file source compilation23983 running; no package downloads.

## Final r29 completion audit (2026-11-10)
- All top-level requirements are covered in acceptance.md by native fixtures plus deployed API/browser evidence; current Git state comes from native refs/index/worktrees through simple-git, not the removed GitSync implementation.
- Latest user corrections deployed: historical diff immediate selection/read-only native path/cache; compact hover typography; actual image/PDF historical previews. Browser metrics/artifacts and65 frontend/80 unique backend coverage recorded above.
- Three advanced launch-dialog auto-dismiss checks passed on live r29; exact native refs/editor contents retained after abort. Image210-source verification, authenticated page startup andHTTP200 passed.
- The unchecked entries in earlier dated checkpoints are historical blockers superseded by the later recorded releases; they are retained as execution history, not outstanding release gates.
- No user manuscripts, credentials, branch refs or user browser tabs were used for acceptance mutations. Named isolated projects contain test branches; no external push or source-repository commit performed.
- Local build reused installed dependencies; original dependency-download/OOM and bad r28 asset attempts remain documented. For future UI builds preserve workspace dependency links inside the isolated source root; preview must retain original socket.io script order. Do not repeat the discarded tmpfs dependency install approach.

## Follow-up: working/staged previews and native toolbar styling
- User reported Changes PDF still used text-only path. Add filePreview using native HEAD/index/worktree bytes and route both list entries to shared FilePreview. Preserve staged/unstaged distinction; no cached working contents.
- Replace browser-default preview buttons with Overleaf btn classes, compact segmented version switch and centered pagination toolbar. Test untracked/staged/working version bytes and actual browser PDF in Changes.
- Follow-up tests:19 native workspace cases and67 frontend cases pass. Test-only jsdom atob recursion required an isolated decoder stub (browser decoder unchanged). r30 compiled without package installation,210-source image verification and isolated asset startup passed; deployed preserving existing session/volumes. Browser working/staged PDF checks pending.
- r30 deployed after210-source verification. Same headless test tab uploaded a synthetic PDF to named isolated project (first request missing root folder returned422; corrected root metadata and upload200). Changes preview rendered473x260 canvas with ink; staged same file through UI and preview rendered again; unstaged fixture afterward. Screenshot visually inspected: 12px compact segmented Before/After and Overleaf rounded pagination buttons.19 workspace and67 frontend tests passed; no user project/window changes.

## Follow-up: diff navigation and open file
- Add line +/- gutters and word-level highlights, clickable right overview measured against rendered scroll content, full repository-relative breadcrumbs and native revision labels.
- Add separate Open file actions in Graph/Changes using existing file-tree lookup and editor openDocWithId/openFileWithId. Historical missing paths report an error without overwriting current files.
- r31 frontend69 cases passed; focused overview-click test passed. Word highlight markup required updating existing text assertions to inspect complete code cell text. Build reused installed dependencies,210-source image verification and isolated startup passed. Browser displayed exact native parent/current hashes and +/- gutters; overview target click checked. Open-file browser path verification in progress.

- r31 isolated asset browser acceptance passed: Graph Open file returns to Source Editor with exact original line contents; native revision labels, +/- gutters and overview target verified. Deployed verified r31; login HTTP200. Existing test browser refresh hit startup502; interrupted Playwright wait stalled automation, so no post-deployment browser acceptance is claimed. Same compiled assets were browser-verified before deployment. No user window/project edits.

## Follow-up r32: diff cursor position
- [ ] Reduce comparison version labels to12px.
- [ ] Track DOM text selection/caret inside either diff side; highlight active cell and display precise wrapped-line position in overview. Keep comparison read-only.
- [ ] Test cursor movement/reset, build existing dependency snapshot, deploy and health-check.

- r32 implementation and tests complete:66tsx+4ts tests passed, compilation passed,210 image source checks passed. Native selection focus tracks current side/line and overview position;12px version labels. Build initially omitted platform and attempted remote resolution; explicit linux/amd64 fixes it. Deployed r32; fresh visual browser acceptance remains unverified.

## Follow-up r33: Graph toolbar and text cursor
- Implement searchable multi-ref All/Auto selection using native log union; retain pagination/search.
- Wire current-HEAD location, all-remotes fetch, existing Pull/Publish flows, refresh, list/tree changed files.
- Set diff content text cursor. Add targeted tests, reuse dependency build and deploy with explicit amd64.

- r33 complete implementation/build/deploy: Graph header toolbar with searchable native refs union, All/Auto, current-tip location, sequential authenticated fetch per remote, existing Pull/Publish dialogs, refresh and list/tree toggle. Default nested folders; diff text cursor.70 suite tests plus2 added toolbar/location tests pass (72 unique);32 native tests pass.210-source image check passed. No live remote mutation or fresh visual browser acceptance claimed.
- Deployment recovery: Docker volume filesystem exhausted (Mongo WiredTiger error28), candidate startup failed resolving restarting Mongo. Removed obsolete native Git candidate image tags r2-r30 (retained r31/r32/r33) and unused Overleaf build cache records; no volume removal. Freed about3GB; candidate Mongo healthy, r33 web restarted and login HTTP200. Host/Docker space remains limited; check space before another build. No post-deploy browser visual claim.

## r34 toolbar spacing/icons
- Remove reference button and toolbar-host flex growth; keep long ref ellipsis. Fetch uses circular sync arrows, Pull uses single downward arrow. Reuse existing build; check space before deployment.

- r34 expanded by user: replace table-only diff with actual read-only CodeMirror panes using installed Overleaf editor packages; real caret/keymap/selection, native line numbers/signs, line/word decorations, cursor overview events. Remove cell border simulation. Keep hunk staging and metadata. Long lines horizontal-scroll for alignment.

- r34 complete:72 frontend tests pass. Isolated headless browser confirms actual visible CodeMirror caret, arrow navigation, readonly typing/Enter and cursor event After/line27. Added transaction filter after command-level test showed readOnly facet alone did not prevent programmatic newline.211-source image verified; built with1.6GB Docker space remaining. Source edits scoped to diff component/new comparison-editor, CSS, toolbar icons and associated tests.

## r35 Fetch icon semantic correction
- Replace circular sync symbol with cloud_download, retaining exact Fetch From All Remotes label/callback. Existing bundled font contains cloud_download; no font/package dependency added. Targeted diff check passed.

## r36 Changes toolbar
- Add section Commit/Refresh/Graph/More and file-group Open Changes/Discard All/Stage All/count.
- Reuse repository actions, offer tree/list and sorting; preserve file open/discard/stage actions.
- Native batch discard preview fingerprints before mutation, preserves index and rejects stale work; support untracked removal only after preview confirmation.
- Verify frontend and native behavior, then space-check/build/deploy.

- r36 Changes tools built and deployed:74 frontend tests and34 native repository tests pass;211-source image verified. Native batch discard preflights all selected paths and checks fingerprint before restore/clean; single untracked deletion now preview-confirmed. Open Changes offers file selector; section toolbar and reused actions, tree/sort and native status output implemented. Screenshot Clone entry is NOT implemented: current connect rejects existing repositories; clone must target a separate project. No destructive action against user project performed. Removed obsolete generated r32/r34 image tags/cache to maintain1.6GB Docker free.

## r37 Full editor Git Graph
- Open editor-region graph from Changes action, keeping sidebar and editor document intact.
- Native commit metadata includes full hash/all parents/author/committer/dates/message and per-file numstat against first parent.
- Click row for details; parent navigation; tree/list file display; file click reuses existing diff and returns to graph on close.
- Test native metadata/root/rename/binary stats and frontend selection/race handling, compile/deploy with disk check.
- User extended r37: five-column graph heading; remote visibility; search/terminal/settings/fetch/refresh. Implement persisted per-user/project graph preferences, native traversal options, identity overrides, remote URL editing, issue/PR URL templates and export. Terminal binds native current worktree and permits documented Git commands through existing adapters, not arbitrary OS shell/pipelines.

- r37 follow-up: dismiss portalled commit hover cards on ancestor scroll/resize/window blur; use timeline icon for Changes View Git Graph, distinct from reference selector. Verify regression and ship with full graph.

- r37 verified:78 frontend tests and37 native repository/settings tests pass;215 image source hashes verified. Full graph five columns, metadata/files, settings, server worktree Git terminal implemented. Hover cards dismissed on scroll/resize/blur; Changes Graph action uses timeline icon. Headless component fixture verified metadata/tree-list/diff callback/terminal path; authenticated post-deployment interaction not claimed. No package downloads.
- r37 deployed to dedicated18081 candidate; login HTTP200 confirmed after startup. User browser and document content untouched.

## r38 Inline commit details
- Move existing detail content directly below selected graph row; continue branch lanes through expanded area.
- Preserve tree/list, file diff, close and selection race behavior; test DOM ordering then build/deploy.

- r38 expanded: inline searchable branch selector (selected-tip ancestry), compact settings grid, full branch badges with double-click existing checkout flow, all-sections collapse spacer, real xterm PTY backed by Python standard library. Shell access explicitly allowlisted to current server-owner account; input/poll ownership checked per project/user. Vendored MIT xterm5.5.0 only, no dependency reinstall.

- r38 final:80 frontend tests passed; targeted native ancestry test passed; actual PTY test on macOS and Linux/www-data passed (persistent cwd/env, Python/pipes, interrupt, session owner isolation). Actual browser fixtures verified inline details, settings 2-column grid, xterm keyboard/Ctrl+C, and all sections collapse/reopen using extracted unchanged Section and layout code. jsdom uses node/SSR panel build with0registered panels, so collapse verification moved to actual browser.220 source hashes verified. Compiled with existing two webpack warnings. Full branch checkout reuses save-barrier/native refusal flow. Shell permissions explicitly enabled only for deployment owner user6ae57d2fa2564a345a7efb9f; all other accounts denied by default. No document edits or remote Git mutations performed for tests.

## r39 layout and terminal regression
- Let detailed rows grow with full branch labels; scale graph lanes to row height, normalize text size.
- Toggle selected commit details on repeated click, cancel pending responses.
- Load vendored UMD terminal as explicit CommonJS (.cjs) under package type module; validate webpack import in browser.
- Add pointer/keyboard terminal height control; regression tests then build and deploy.

- r39 security scope extended by user: immediately disabled unisolated shell through deployment env and restarted candidate. Add isolated Docker terminal runner on47292; mount only repository/common Git data, read-only image, no network/capabilities, www-data, pids/memory/CPU limits. Modes chosen centrally in Paper Assistant footer; native Git mutations and AI proposal application obey shared per-user/project policy. Extra directory approval single-use/exact scope,30min expiry/close revocation. Future AI shell-tool integration is not yet enabled; no sandbox-bypass route exposed to AI.

- r39 verified:80 unique frontend cases passed (one5s timeout under concurrent production compilation, targeted retry passed427ms);25 backend handlers/policy/conversation tests passed, plus actual PTY tests. Docker fixture proves outside symlink refusal, repository write, read-only refusal, protected .git metadata, approved extra directory access. Webpack production dynamic import browser probe validates xterm constructor; browser fixtures validate no overlap with multiline refs, same-row collapse, terminal pointer drag and Ctrl+C. Scope of mode is project/user; Paper Assistant footer is sole UI selector, Git/terminal/AI proposal application enforce backend policy. Direct AI terminal tools remain future work. Current unrestricted shell was stopped before sandbox implementation.

## r40 narrow sidebar headers
- Keep headings at their intrinsic width; move Graph actions into More below340px and Changes actions below240px. Preserve every action via menus.
- CSS/toolbar changes only; no permission or repository-content changes. Validate narrow/wide browser geometry and menu actions, then build/deploy.

- r40 user additions: Codex-style mode labels and terminal scrolling. Ask for approval and Read Only retain backend-enforced existing boundaries; Approve for me and Full Access are visibly unavailable, not simulated. Full Access scope question is pending user response; no broader grant enabled. Explicit extra-directory approvals remain available.
- Verified 76 existing frontend JSX tests plus 2 terminal tests (one new scrollback/follow case), production webpack with 2 existing warnings, 224 image source checks. Independent real-browser fixture confirms screen bottom235 <= host bottom239 and scrollTop1638=max1638 after100lines, typed input reaches API. Graph header geometry checked at170/240/340/420px, no overlap. Initial browser fixture invalid due JSX compilation setup; rerun with automatic JSX and explicit React alias passed.

## r41 remove directory-grant mode
- Remove Approved directories and its path editor; retain four mode entries. Retire extra-directory grant endpoint and normalize legacy grants to repository-only. Full Access scope confirmed Docker-only, implementation remains disabled. Verify frontend/build and policy migration, deploy candidate.
- r41 validation: 10 backend tests and2 terminal tests pass; production build passes with2 existing warnings;224 source image verification passes. No manuscript or macOS access permissions changed.

## r42 graph navigation and icon
- Close editor Git Graph when leaving Source Control; returning does not reopen it.
- Share a colored SVG branch-node icon between Changes launcher and Git Graph title.
- Verify switch-away/back and shared icon, build and deploy candidate.
- r42 source-control suite:39 passed, including switch-away/back graph closure and identical SVG markup in launcher/title. No permissions, manuscript files, or Git history changed.
- r42 production build passed with2 existing warnings;225 image source checks passed. Updated dedicated18081 candidate, preserving project volumes.

## r43 toolbar icon color
- Changes launcher graph SVG paths/circles inherit currentColor; editor tab retains colored graph mark. Only source-control.css changed in product code. Independent browser computed-style check confirms all7 toolbar shapes use button color, title retains3colors.
- r43 production build passed with2 existing warnings;225 image source checks passed. Updated dedicated18081 candidate. No behavior/permission/manuscript changes.

## r44 repository row and hierarchical actions
- Show actual project name with title and repository icon; add Publish Branch launcher.
- Group existing repository actions in eight portal-based submenus with hover/click/keyboard navigation and viewport flipping. Preserve confirmation dialogs.
- Verify dispatch/menu closing and name/icon, build and deploy. Missing Clone/signed-off/new backend variants are not represented as working actions.
- r44 validation:39 existing SourceControl tests pass; new project-name/publish/submenu test passes after correcting expected dialog title. Independent browser fixture verifies submenu flips left within500px viewport, selection closes menus, ArrowRight opens and Escape returns focus to category. Fixed Escape capture to avoid closing parent. No remote operations or user file changes performed.
- r44 final production build passed with2 existing warnings;226 source image checks passed. Deployed dedicated18081 candidate, preserving project data.

## r45 Changes menu and implementation audit
- Replace flat View & Sort header with radio-checked submenu; remove duplicated commit/stage/discard items from root. Reuse repository groups and preserve Graph access for narrow toolbar.
- Audit confirms not all reference functions exist: no Clone, commit-all/signoff variants, Sync, remote branch/tag delete, push-tags, stash-staged/drop-all, explicit create-worktree. Fetch currently always prunes/tags and Stash always includes untracked. Existing stash manager implements apply/pop/drop/view and remote settings implements removal.

## r46 full functional completion (active)
1. Audit every visible action in Repositories, Changes, Graph; maintain function-audit.md.
2. Implement missing backend semantics and destructive-operation preflights.
3. Connect both shared menus and Graph affordances to real operations.
4. Clone URL into a new, independent paper project only; preserve Git history/origin and provide an Open project link. User confirmed this destination; no standalone server-directory option.
5. Run isolated native and frontend/browser acceptance, then build/deploy with truthful remaining limits.

- User clarified Clone must create a new paper project from URL. Removed directory destination in UI/backend; preserved history/origin and idempotent import, added existing root-document detection. Isolated clone test checks recovery and source preservation.
- User reported Graph shrink/blank-space regression and requested entire header blank area to toggle. Cause: collapse sent space to fourth spacer while expand only restored minimum panel size. Added section-layout redistribution/restoration; spacer now used only when all sections collapsed. Versioned persisted layout to v3, fixed header shrink, expanded heading hit area and handled header padding clicks without invoking action buttons.
- Verification:86 frontend tests passed;51 distinct backend tests passed. Real browser fixture with actual Section source passed three full collapse/reopen cycles, Graph fills available height, blank header clicks, toolbar isolation, drag resizing. No user files changed by tests. Production rebuild pending.

- r46 production build passed with two existing warnings;230 source image checks passed. Candidate18081 replaced with r46, preserving volumes and existing terminal runner. User editor restart allowed for this requested UI update; active Git/write operations and AI jobs were still checked by deployment guard.

## r47 Git timestamps and column headings
- Center Date and Author column headers without changing data alignment.
- Share local-time DD-MM-YYYY HH:mm:ss formatting across graph, details, branch pickers, history, blame, reset and stash; retain ISO datetime attributes.
- Verify formatting/headers and source-control regression tests, then build/deploy candidate.
- Clarification: previous audit covered handlers and isolated behavior, not every real authenticated remote operation; do not claim exhaustive correctness.

- r47 validation:88 frontend tests passed. Actual CommitGraph browser fixture in Asia/Shanghai confirms both headers center, date 02-01-2026 08:04:05, original ISO datetime retained, right-aligned data and tabular numerals preserved. Production build pending.

- r47 production build passed with two existing warnings;231 source image checks passed. Updated dedicated18081 candidate, retaining project volumes and terminal runner.

## r48 exhaustive action audit (completed)
- [x] Inventory every interactive control in Source Control and Git Graph, including dialogs/settings/terminal; map shared menu aliases.
- [x] Trace each handler to local state, native operation or external service; identify empty/incorrect paths and parameter mismatches.
- [x] Run isolated real-Git tests for operation families, fill missing semantic/dispatch tests, repair failures.
- [x] Re-run frontend/browser checks and record per-item evidence plus remaining environmental limits.
- [x] Build/deploy fixes only after gates; preserve user manuscript/remotes and report exact findings.

- r48 found/fixed five defects: rename unstage, rename diff, root Undo, distinct push credentials, image preview side navigation.134 frontend cases pass;105 unique native cases pass using isolated Docker with authenticated HTTPS fixture and a dedicated Redis recheck. Browser export/clipboard/PDF paging/override passed. Two globally disabled permission modes remain explicitly unavailable. Detailed control mapping:action-audit-r48.md + control-inventory.json.

- r48 deployed to dedicated18081 candidate;232 image source checks passed, login HTTP200. Production build retains two existing warnings. See action-audit-r48.md for evidence limits and exact changed product files.

## r49 permission modes and commands
- [x] Implement supported auto-review and full-access modes in shared policy/schema/UI.
- [x] Enforce Docker-only full filesystem scope, no host mounts/socket/network; protect app credentials.
- [x] Add reviewed-command execution with server-side single-use approval and no raw-input bypass.
- [x] Test mode changes, approval replay/mismatch, container isolation and frontend behavior.
- [x] Build/deploy dedicated candidate and record remaining integration evidence.
Decision: Full Access means dedicated shell container root filesystem plus this project worktree, never host OS or other project volumes. Network remains disabled. Auto reviewer is deterministic and conservative, not an LLM safety guarantee.
- User added Paper Assistant `/git <operation> [arguments]`: implement parsed commands, per-command help, shared native API/editor-save semantics, confirmation previews, and result/error display. Continue permission modes work.

- Added48 documented /git forms and shared API/save/confirmation handling;139 frontend regressions +5 execution-panel cases passed. Graph alignment verified in3 browser widths, author title/ellipsis present. Collaboration proposal contains14 numbered items; implementation awaits user approval.

- r49 deployed to dedicated18081;237 source checks and login HTTP200. Dedicated terminal runner restarted; general AI service and project volumes preserved. Collaboration additions remain proposals only.
