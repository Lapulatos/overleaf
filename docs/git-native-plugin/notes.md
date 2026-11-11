# Evidence and decisions

- Current source has custom GitSync implementation removed; deployed candidate 18081 is without-git image. Other plugins preserved.
- VS Code built-in Git extension license MIT; uses VS Code extension APIs, so cannot load directly as an Overleaf component.
- Git Graph current LICENSE forbids distributing derivatives. Use interaction reference only.
- Backend candidate: simple-git (MIT), executes installed native Git; native refs/index/worktrees remain authoritative.
- Dedicated Git worktrees allow per-branch unfinished edits to persist without copying commits or carrying B's worktree into A.

Sources checked 2026-11-09:
https://raw.githubusercontent.com/microsoft/vscode/main/extensions/git/package.json
https://raw.githubusercontent.com/steveukx/git-js/main/simple-git/package.json
https://raw.githubusercontent.com/mhutchie/vscode-git-graph/master/LICENSE

## Implementation checkpoint

- Pinned `simple-git@4.0.2`; only new web dependency this turn. Lockfile delta against pre-turn snapshot is 76 lines, not the unrelated existing large dirty lock diff.
- Native repository adapter at services/web/app/src/Features/NativeGit/GitRepository.mjs.
- Native branch worktrees preserve each branch's working files/index. No serialized fake commits; graph uses Git log parents, branch metadata uses for-each-ref.
- Explicitly verified that separate branches initially can share the SAME commit ID: this is valid native Git, not a bug. They diverge after different commits.
- Tracking remote ref stays metadata on its local checkout option; unmatched remote branches remain separate options.
- Existing project data and current no-Git deployment untouched in this checkpoint.

## Findings / corrected attempts

- Yarn native rebuild of pre-existing mmmagic failed on macOS. Dependency resolution completed; immutable install with build scripts disabled passed. Production native build still needed later.
- simple-git 4 guards require explicit allow-list for our fixed /dev/null hooks, protocol restrictions and non-interactive editor; caller-supplied command/config is not exposed.
- Passing refs/heads/B to worktree add creates detached HEAD; use checked branch NAME B. Regression caught this before project integration.
- Global GIT_LITERAL_PATHSPECS makes native Git stash leave untracked files behind on this Git version. Removed global override; use explicit :(literal) pathspecs only for file operations. Verified with direct native Git reproduction.
- graph({from}) would mean a Git revision range; branch-filtered graph uses a resolved revision argument instead. Regression now checks old-branch ancestry.

## Current evidence

- 13 native repository scenarios pass on host Git 2.50.1 and isolated Linux Git 2.43.0 (actual candidate base image, network disabled). No mocked Git commands.
- Four branch-picker model/interaction tests pass: metadata, tracking-ref deduplication, author search, selection and Escape focus return.
- Project file bridge now has isolated evidence; production collaborative write exclusion, authenticated routes, credentials, command toolbar, commit composer/AI, full graph/diff/conflict UI, live browser and integrated deployment remain incomplete. Goal remains active.

## File bridge and native worktree mutation checkpoint

- WorktreeFiles mirrors editor bytes without changing the native index/refs; refuses symlinks and .git paths. OverleafProject uses existing document CAS and editor create/delete APIs, but production exclusive write scope is still required before exposure.
- ProjectWorkspace.mutate performs native stash/pop, merge/abort/reset and imports resulting worktree bytes, including conflict markers on a failed merge. A pending transfer blocks stale editor export; recovery does not rerun Git commands.
- WorkspaceStore atomically persists only editor binding/pending-transfer metadata (0600, file fsync, rename, directory fsync). Before-images are file-transfer recovery material, not a replacement Git commit/index store.
- 28 host tests passed: 13 native repository, 10 workspace, 5 mocked Overleaf API contracts. 15 adapter tests passed in isolated Linux with actual Git and network disabled. Logs: adapter-tests.log, adapter-linux-tests.log.
- Regression includes re-instantiating the durable store/workspace after an interrupted native stash, recovering the editor, then popping the original stash; one stash is created, no command replay. This is restart-state simulation, not a killed live Overleaf process.
- No user data, browser tabs, remote refs, deployed services or other plugin code modified in this checkpoint.

## Authenticated command/runtime checkpoint

- GitCommands uses strict schemas and a fixed native method dispatch. No raw commands, config, environment, repository directory or caller-controlled identity accepted. It distinguishes index/ref actions from worktree-changing commands that require editor back-import.
- NativeGitHandlers checks feature enablement, login, project ID and canUserWriteProjectContent before invoking runtime. Responses use no-store; the existing webRouter CSRF middleware protects POST routes. Four handler tests cover denied access and injection-shaped requests.
- NativeGitRuntime composes actual ProjectEntityHandler, DocumentUpdaterHandler, HistoryManager, EditorController, FileTypeManager and User account author with the new native workspace. Initialize creates a real unborn repository without fake baseline commits; status exports editor bytes; stage/commit operate the native index.
- NativeGitRouter registered via only a new import and apply call in app/src/router.mjs; all prior unrelated router edits preserved. Settings.nativeGit.enabled remains unset/disabled. No deployment or user-project actions.
- Production exclusive collaborative write scope remains missing: text CAS and sequentialProjectStructureUpdateLock alone cannot prevent concurrent text writes during structural deletion. Runtime rejects editor-changing actions before invoking Git when no exclusive scope is installed. This is a temporary integration boundary, not completion.
- 33 host tests pass (13 repository + 11 workspace + 5 Overleaf mock-service contract + 4 handler tests); 20 adapter/handler tests pass in isolated Linux. NativeGitRouter actual import on host with existing platform dependencies succeeds. These are not an HTTP-server/browser/live collaboration acceptance run.

## Source Control panel and AI message checkpoint

- Added source-control-panel.tsx/api.ts/commit-graph.tsx. Uses existing react-resizable-panels and Bootstrap components; section bodies scroll with min-height:0, collapsed header size measured against container height. Commit composer is a single-line input with centered AI icon. No saved-commit review or synchronization modal.
- Stage/unstage invokes native index operations. Commit success consumes returned status/graph immediately, clears message; failure retains message and refreshes conflict state. Branch create/from/detached and basic merge/rebase/stash menus call fixed authenticated commands. Complete remote and advanced menus remain pending.
- Graph draws real Git parent hashes, including merge lanes; selecting a commit opens native commitDiff. Native fileDiff includes untracked additions via dedicated diff --no-index invocation that accepts exit 1 only for nonempty diff output with no stderr. Root commit diff uses git show without a fabricated parent.
- CommitMessage captures Git write-tree hash, HEAD, staged diff and staged blob excerpts. It reuses existing WritingAssistLLMProvider agent transport, outside project lock, and rejects stale staged trees. Tests prove exclusion of unselected and later unstaged content; no live AI generation performed.
- Rail / ProjectController / editor meta / meta type / rail-context have small integration additions. Feature is still disabled in settings; persisted native-git selection reloads as file-tree. Other preexisting dirty edits preserved. No active browser tab or user project touched.
- Fixed initialize path construction: simple-git requires its base directory to exist before constructing a repository adapter. Runtime context now creates its project-owned directory first. Initialize response explicitly sets connected:true so the UI leaves the connect screen.
- 36 native/adapter/handler scenarios pass on host and isolated Linux (actual Git), 9 frontend tests pass. Full tsc still fails on preexisting unrelated modules, with no source-control/native-git/modified rail errors. Logs retained beside plan. No full production integration, real browser visual or deployment evidence yet.

## Continuation: native file history and write-gate verification
- Prior status-only turn did not implement work; resumed from actual failing Web log. Fixed test assertion API mismatch (Chai-as-promised versus Vitest), preserving the expected expired-lease rejection. Targeted Web suite: 209 passed, 2 explicitly excluded legacy readDocumentDeletionSnapshot cases; not a full green Web suite. Document updater: 95 passed; real-time latest log retained separately.
- Native fileHistory uses Git log --follow on the explicitly resolved commit with literal pathspecs. blame uses native line-porcelain at the chosen ref. No secondary history database. Added authenticated command dispatch and compact file-history UI with author, time, short hash and subject.
- Real native regression creates B, renames and edits a file, checks rename ancestry and authors, and queries repo-test history/blame from B to prove ref scoping. Backend 41/41 on macOS with isolated Redis; frontend 12/12. Full typecheck still exits 2 on unrelated existing errors; no source-control or modified ide-react-context diagnostics.
- No deployment, live editor, browser, real AI or HTTPS credential validation in this checkpoint. Full objective remains active.

## Native operation controls checkpoint
- Git status reads --absolute-git-dir for the selected worktree, then native rebase/merge/cherry-pick/revert state markers. It does not infer operations from generic conflict files or another worktree.
- UI exposes continue/abort/skip and additional branch/tag/cherry-pick/revert menu actions. No custom review workflow introduced. Native Git still refuses unsafe merged-branch deletion.
- macOS repository 15 passed; repository/workspace 28 passed before the new recovery test; frontend 14 passed. Existing full typecheck failures remain outside source-control. Linux native suite recorded separately.
- Full objective remains incomplete: HTTPS remote integration, remaining advanced UI, live cross-service/editor/browser acceptance, build/deployment and non-Git regression.

## Remote credentials implementation evidence
- RemoteCredentials.mjs reuses existing token encryption library; separate project/user directories and URL-hash filenames, atomic 0600 encrypted records. Settings requires OVERLEAF_NATIVE_GIT_CREDENTIAL_KEY; no fallback plaintext storage or ephemeral production key.
- GitRepository network wrapper uses fixed process-local GIT_CONFIG_COUNT values for empty credential.helper, disabled redirects and URL-scoped Basic header. simple-git 4 required explicit allowUnsafeConfigEnvCount/allowUnsafeCredentialHelper plus named environment allowlist; these flags permit only service-generated values, never HTTP-supplied config. Errors strip token and encoded authorization. Multiple push URLs are rejected to avoid ambiguous credential routing.
- Dedicated fixture generates one-day localhost TLS certificate and launches native git-http-backend against a disposable bare repository. No user remote or credentials used. Checks unauthorized fetch rejection, authenticated push/fetch/pull, real ref advancement, no secret in .git/config. macOS credentials+handler suite 7 passed. Linux results retained separately.
- Settings UI test verifies masked configured state and replacement disabled until new token provided. Frontend 15 passed; full tsc retains unrelated existing errors and no source-control diagnostics. Runtime module import passed. No deployment or user browser activity.
- Still pending: clone/import flow, alternate push-URL credential selection, live HTTP runtime + exclusive editor transfer integration, remaining full command matrix, actual browser and deployment acceptance.

## Connect/build preparation
- ConnectRepository clones native history while preserving editor bytes as working changes. It supports retry after failed clone and after atomic install/binding acknowledgement failure. No first-sync review, implicit commit or editor overwrite. Connect/API 7 passed; frontend 16 passed; runtime imports.
- Production build uses scoped prepare-build.py manifest. Initial build failed because amd64 platform was not specified; corrected. Existing removal image had 125 layers and hit maximum depth. Flattened a temporary container export into native-git-base and verified all original Env/Entrypoint/Cmd/WorkingDir/User/ports/volumes/stop-signal metadata; only temporary container removed. Running services and their volumes unchanged.
- Immutable install initially found missing services/agent and server-ce/test workspace manifests in base image. Added those manifests to scoped context (44 files), rather than modifying lockfile. Subsequent immutable resolution and fetch passed. Build continues in session 89268, /tmp/native-git-build-current.log. No deployment yet.

## First live candidate acceptance
- Production webpack build passed with existing warnings; scoped image verification checks 195 source files including protected non-Git plugin files. Dedicated candidate 18081 deployed; 18080 and daily-use instance unchanged. Existing Redis/session/database/app volume retained.
- Real service inspection caught two previously missed adapter defects: AccessTokenEncryptor label parser requires nativegit-v3 (native-git-v3 parsed incorrectly), and getDocument requires fromVersion=-1 for current snapshot. Fixed both and strengthened corresponding tests. Live gate busy errors now return specific 409 PROJECT_WRITE_BUSY rather than generic 500. Current image: 20261109-native-git-candidate-r4.
- Authenticated HTTP fixture logs into the existing candidate test account automatically and creates only Native Git isolated acceptance 20261109. Live public API stages/commits initial document, creates/checks out B, commits a B edit, observes updated branch hash/graph, leaves B dirty, checks out old main with original content and clean Changes, leaves main dirty, returns to each branch and verifies exact independent bytes. All steps passed using actual document-updater + Git + HTTP routes. Document edits use existing version-conditional server API; this is not browser typing validation.
- Live exclusive gate test verifies privileged document reads, ordinary conditional write rejected with 409, real-time queueChange rejected without increasing pending queue, unchanged document bytes/version, and normal reads after release. It uses only the newly created fixture project.
- Browser inventory reports browser access host unavailable. No new window/tab opened and no user browser page changed. Browser unsaved-buffer/visual behavior remains unverified. Full task still active: advanced UI/hunks/worktrees/blame, live remote API and AI, browser acceptance, remaining regressions.

## User-reported Gitee connection failure
- Interrupted hunk UI work to diagnose actual submitted credentials. Stored credential existed, username matched repository owner case-insensitively, token had no surrounding whitespace. Read-only authenticated Git ls-remote and HTTPS smart-HTTP info/refs requests received 401; both URL suffix forms and original/lowercase login returned rejection. Gitee response explicitly said Incorrect username or password (access token). No token or encoded authorization was printed; no remote writes or project files changed.
- Changed authentication errors to actionable missing/rejected credential messages, removing terminal-prompt instructions and internal clone paths. Existing connect form retains entered fields on failure. Credentials tests 5 passed. Candidate r5 deployed with 195-file source verification. Connection itself still needs valid remote credentials; do not claim successful Gitee connection.
- Before interruption, added native git apply --cached hunk methods/command API using existing diff parser and stale-diff fingerprint checks. Native 16-scenario suite passed; hunk selection UI is not yet implemented. Full goal remains active.

## r6: repository menu, resize bars, history icon
- Repository actions are portalled to document.body, with viewport-bounded scrolling; no section clipping. Regression checks last-item selection and close.
- Resize handles retain 6px pointer area but render only a 1px rule; hover/active rule 2px.
- File-history button uses 16px clock-arrow SVG and View file history tooltip.
- Changed UI files: source-control-panel.tsx, source-control.css; added regression in source-control-panel.test.tsx. Deployment scripts/artifacts updated only for candidate r6. Other plugin sources unchanged by this fix and included in 195-file verification.
- Frontend 17 passed. Full typecheck still fails outside source-control; zero source-control diagnostics. Production webpack succeeded. Candidate 18081 login health returned 200 after deployment; existing volumes and sessions preserved. No browser tab/window manipulated. Browser visual verification remains unavailable.

## r7 partial staging UI
- Working-tree and staged file diff now use native fileHunks. Each hunk exposes Stage change or Unstage change, passing the native fingerprint and hunk index to applyHunks.
- Successful changes refresh repository snapshot and remaining diff. Stale rejection stays visible inside the dialog with explicit Refresh diff; no automatic retry.
- Structural/binary changes retain native whole-file diff and existing whole-file staging.
- Modified source-control-panel.tsx, source-control.css and source-control-panel.test.tsx; deployment allowlist and tracking artifacts updated. No other plugin logic changed.
- Frontend 21 passed; native repository 16 passed on macOS and all 16 passed in the production Linux image. Production build and 195-source verification passed. Full typecheck still has unrelated failures, zero source-control diagnostics. Browser visual interaction not verified.

- After restart login endpoint returned 200. Authenticated existing isolated fixture project fileHunks response validated (one hunk). First diagnostic request used erroneous singular /command and returned 404 without mutation; corrected to actual /commands route and passed. No hunk was staged on a user project by this probe.

## Stash management implementation
- Uses existing native stashList/apply/pop/drop; adds stash show --patch --include-untracked preview. Expected commit hash guards UI actions against stale positional stash indices.
- New stash-manager.tsx lists message, author, date, hash with preview/apply/pop/delete. Delete requires an explicit entry-specific confirmation. Errors retain selection and offer refresh.
- Existing stash menu now permits a message and opens the complete list rather than only popping index zero.
- Host native repository tests: 17 passed. Workspace/handler regressions: 18 passed, including editor/index preservation and interrupted-transfer recovery. Frontend: 25 passed. Full typecheck has existing unrelated failures and zero source-control diagnostics.

## r8 verification and outage follow-up
- Linux native 17 passed; image 196 source hashes verified. Candidate r8 deployed; login 200; authenticated isolated-project stashes response returned an empty list.
- User then reported Git JSON/500 and assistant/realtime disconnection. Candidate web logs show repeated 10-second RedisWebLocker Timeout errors on actual user-project GET, after candidate restart. Lock key was observed, then expired naturally before its owner could be captured; restart orphaning is plausible but owner evidence is unavailable. No lock was force-deleted.
- Read-only authenticated actual-project status recovered in 0.46s; later request shows actual commit 19e133fe, subject docs: clarify distinction between internal decodability and output classification. No duplicate commit performed.
- Actual-project models and conversations endpoints both return JSON. User changed branch during checks; no checkout was performed by this investigation.
- Added deployment_safety.py to deploy.py immediately before compose replacement: refuses any connected editor set or native/project write lock. Four unit tests pass; live preflight rejected restart due to connected editor. No further restart executed.
- Other daily-use mongo container was observed restarting; separate candidate uses healthy acceptance mongo. No unrelated services modified.

## Pending r9: editor-driven status refresh and lock feedback
- Confirmed user-reported stale Changes issue: SourceControlView only loaded status initially or after explicit Git actions. DocumentContainer already emits doc:changed/doc:saved, but Git did not subscribe.
- Added 750ms debounced status-only refresh on those events, focus and visible restoration. Coalesces events, does not freeze editor or issue Git mutation, waits behind foreground commands, ignores outdated responses, and aborts on unmount.
- Actual user project read-only status confirms branch test/ui-20261109-a and tex/01_introduction.tex workingTree M, index blank. This is stale display, not lost editing.
- Lock wrapper translates acquisition Timeout only into JSON 503/GIT_PROJECT_BUSY and Retry-After. A timeout within a command remains the original error. Frontend offers status refresh without replaying a failed commit.
- Eight lock/handler tests and 28 frontend tests passed. Full tsc still has unrelated errors, zero source-control diagnostics. Live restart preflight currently rejects connected editors. r9 is being built but r8 remains deployed.

## Pending source: blame presentation
- Added blame-view.tsx: parse native line-porcelain output only, render final line numbers, exact code indentation/empty lines, author, time, full commit identity and subject.
- File history opens line authors; selecting a commit loads its actual commitDiff. Menu now allows opening history by path for clean files too.
- 32 frontend tests pass, covering SHA-1/SHA-256, source text not confused with metadata, and full history-to-blame-to-diff navigation. Existing full typecheck failures remain unrelated; no source-control diagnostics.
- Changed source-control-panel.tsx, source-control.css; new blame-view.tsx and blame-view.test.tsx; expanded panel test. Other plugin logic unchanged.
- Not deployed or production-built yet. Existing verified r9 image contains auto-refresh/lock fixes only; this additional source needs a subsequent build. Live service remains r8, pending user update timing. Latest restart guard sees an active Git/project lock and rejects restart. No user files or refs changed.

## Actual Related Work merge investigation
- User expected C changes in repo-test. Actual refs: repo-test=19e133fe; C=ccdc7b1d, parents 12b82e05 and 19e133fe. Merge subject explicitly says merge 19e133fe into test/ui-20261109-c. C's parent 12b82e05 added literal c test before Related Work.
- Native git diff repo-test test/ui-20261109-c -- tex/02_related_work.tex confirms +c test at line 5. Actual project status is repo-test; Related Work has no local diff. This is the opposite merge direction, not dropped file content.
- Direct root-owned inspection first hit Git ownership protection (diff rendered generic not-a-repository usage); reran read-only as www-data, no safe.directory/config changes.
- No merge/checkout/commit/reset or project content edits were performed during investigation.
- UI now says Merge into current branch, title/button names target, source field identifies source, summary shows source → target. Backend optional expectedBranch rejects target changes before native merge.
- 33 frontend and 17 native tests pass. UI/source changes remain undeployed; live r8 retained. Previously verified r9 contains only auto-refresh/lock fixes, not blame/merge-direction additions.

## Pending r10: conflicts and merge branch selection
- Conflict details read native unmerged index stages. Fingerprint includes HEAD/index/current file bytes, and resolution refuses a changed file. Native checkout/add/rm selects sides/deletion; explicitly edited result passes through byte-preserving worktree adapter and git add.
- UI separates Merge Changes, exposes Base/Current/Incoming and text result; rebase side meanings are explicit. Resolving stages only; merge continuation remains a separate native action.
- Native 20 tests and workspace 15 tests passed, including stale rejection, exact incoming bytes, manually edited result, modify/delete and import into editor.
- User requested searchable merge sources. New merge-branch-picker.tsx uses existing branch choices/filter; lists metadata, excludes target and does not execute until explicit selection + named merge button. Source filter changes clear selection to prevent merging a hidden choice.
- 39 frontend tests passed, including conflict request dispatch and searchable merge selection with expected target guard. Production r10 build running; live remains r8. No real user Git mutation or browser manipulation.

- r10 production build succeeded; 200 source files verified. Includes all pending auto-refresh, lock feedback, blame, explicit/searchable merge selection and conflict resolution changes. Linux native/workspace/lock/handler suite completed; result in r10-linux-tests.log. Live r8 unchanged; no deployment attempted while awaiting user's update timing.

## Pending source: managed worktrees
- Added native worktree inventory with opaque server-mapped IDs, branch/HEAD/current status and cleanup restrictions. HTTP never accepts a filesystem path for removal.
- Cleanup revalidates expected HEAD/current state, then uses native worktree remove without force. Current/main/locked/dirty/ignored-file worktrees, unfinished operations, and detached commits not retained by a branch/tag/remote are refused.
- Two initial test failures revealed real integration issues: macOS canonical path comparison and simple-git ignored[] being separate from files[]. Both fixed; failures not reported as passing evidence.
- New WorktreeManager lists status/reasons and requires specific cleanup confirmation. Existing checkout creates/reuses worktrees; cleanup leaves refs/commits intact.
- Host native 22 and frontend 41 tests pass. Linux initial 21 passed before adding unfinished-clean-merge protection; final 22-case rerun in progress. No user worktree removed, no restart or deployment.

- Final Linux rerun: all 22 native repository tests passed using current GitRepository source mounted read-only into isolated r10 image. This verifies native behavior, not a new production build. Full typecheck has existing unrelated failures and no source-control diagnostics. Worktree feature remains source-only; verified r10 lacks it, live r8 unchanged.

## Pending source: discard unstaged changes
- Adds native discardDetails with branch, index entry and raw worktree bytes fingerprint. Binary changes are not compared using only Git's generic binary-difference text.
- Native restore --worktree restores from the index; staged changes remain intact. Confirmed requests refuse stale file/index snapshots. Untracked and conflicted files have no discard-preview endpoint.
- Per-file Discard entry opens exact path/diff and explains staged-vs-unstaged behavior. Mutation requires explicit confirmation; failure remains visible with Refresh preview and never retries automatically.
- Host native 24 and frontend 43 tests passed, including staged-content preservation, binary changes, stale index and confirmation/non-replay. Linux rerun in progress. No real project file discarded or service restarted.

- Final Linux native suite 24/24 passed with read-only source overlay on isolated r10 image; not a new production artifact. Full frontend typecheck retains unrelated failures and no source-control diagnostics.
- Files changed this pass: GitRepository.mjs, GitCommands.mjs, source-control-panel.tsx; native-git-repository.test.mjs and source-control-panel.test.tsx plus task records. Live r8 and user project data untouched. Current source includes undeployed worktree/discard additions beyond verified r10.

## Browser acceptance 2026-11-10
- Reused headless session 66548, isolated project 6af1bc2a0a5b55d96038512e. DOM editor input appeared automatically in Changes; stage+commit advanced graph with message `test: verify browser edit stage commit graph`; clean status, zero dialogs.
- Checkout main removed both newer committed marker and unfinished marker from editor. Returning restored exact unfinished editor string.
- Found checkout generated Document Updated Externally modal. Cause: adapter setDocument source `git`, while existing editor suppression explicitly recognizes external source `git-bridge`. Adapter now uses established git-bridge source; version CAS and write gate unchanged. Five adapter tests pass including exact origin assertion. Browser revalidation pending r17.
- Git rail custom icon had no accessible name. Added visually-hidden title consistent with named rail tabs.
- r16 built but not deployed; r17 combines accessibility and external-update source fix. Build session88151, /tmp/native-git-r17-build.log.

## Browser hunk and credential acceptance
- Real editor changes at first and last lines produced two native hunks. Staging only first created distinct staged and unstaged file rows; staged diff showed only the first-line marker. Unstage hunk restored both working-tree changes.
- Identified delayed apply/refetch reopening a closed diff modal. Generation guards now invalidate closed diff requests; delayed-apply and delayed-refetch frontend regressions pass. Full frontend50 pass.
- Added configuration-only example.invalid remote through UI, saved synthetic (not real) token, verified password-type masked placeholder and no actual token DOM value. Closing/reopening retained masked configured state. Removed token and remote through UI; no network transport used.
- r18 production build running session25353; r17 remains live until source verification/deployment.

## VS Code presentation implementation
- Reused existing MaterialIcon/file extension mapping and installed jsdiff parsePatch; Git native name-status, shortstat and first-parent patches provide commit file data.
- Root/rename/delete/merge-first-parent fixture passes; 36 backend/interface tests and 53 frontend tests pass.
- EditorPanel keeps its existing Editor mounted; Git comparison mounts in a bounded overlay host in the editor area. Closing comparison restores existing editor without reload.
- Commit click expands files, individual file click requests scoped patch. Hover metadata and statistics are nonmodal; branch lanes have distinct inherited first-parent colors.
- Production r19 build session60767 is live. Do not replace/restart it because polling is slow. Live r18 untouched until verified build.
- Previous real-browser conflict resolved incoming & stage then Continue merge; editor exact incoming first line, clean native state. Pending source fix auto-dismisses source picker after confirmed merge conflict.

## r19 rendered browser verification
- Source Control expanded commit displays native changed file; file click opens side-by-side editor region with line numbers and no dialog. Closing retains exact editor text.
- Branch lanes render blue/purple/green; file row icon, amber M, hover-only actions verified.
- Two visual layering issues found by screenshot: existing CodeMirror panels z-index300 covered diff header at10; changed host to400. Bootstrap popover body forced light text on white; body now inherits custom popover text color. These CSS fixes require combined next image; r20 intermediate build is not to deploy.
- Clipboard action verified after granting clipboard permission only in headless test context. User Chrome permissions unchanged.

R32: version headers inherited16px body font; now12px explicit. Cursor tracks native DOM selection focus/offset, uses collapsed Range rectangle for wrapped text and projects into the same scrollHeight coordinate system as overview change marks. Selection outside diff ignored; patch effect cleans listeners/highlight. No contentEditable or document writes.

R33: multi-ref history resolves each selected revision natively before git log; search/pagination preserve the union. Toolbar is portaled into Graph heading to avoid nested buttons. File tree groups full paths recursively, retains diff/open actions, hides redundant parent path labels in tree only. Go-current clears search/filter, fetches native current ancestry and focuses tip.

- r37 verified:78 frontend tests and37 native repository/settings tests pass;215 image source hashes verified. Full graph five columns, metadata/files, settings, server worktree Git terminal implemented. Hover cards dismissed on scroll/resize/blur; Changes Graph action uses timeline icon. Headless component fixture verified metadata/tree-list/diff callback/terminal path; authenticated post-deployment interaction not claimed. No package downloads.

- r38 final:80 frontend tests passed; targeted native ancestry test passed; actual PTY test on macOS and Linux/www-data passed (persistent cwd/env, Python/pipes, interrupt, session owner isolation). Actual browser fixtures verified inline details, settings 2-column grid, xterm keyboard/Ctrl+C, and all sections collapse/reopen using extracted unchanged Section and layout code. jsdom uses node/SSR panel build with0registered panels, so collapse verification moved to actual browser.220 source hashes verified. Compiled with existing two webpack warnings. Full branch checkout reuses save-barrier/native refusal flow. Shell permissions explicitly enabled only for deployment owner user6ae57d2fa2564a345a7efb9f; all other accounts denied by default. No document edits or remote Git mutations performed for tests.

- r39 verified:80 unique frontend cases passed (one5s timeout under concurrent production compilation, targeted retry passed427ms);25 backend handlers/policy/conversation tests passed, plus actual PTY tests. Docker fixture proves outside symlink refusal, repository write, read-only refusal, protected .git metadata, approved extra directory access. Webpack production dynamic import browser probe validates xterm constructor; browser fixtures validate no overlap with multiline refs, same-row collapse, terminal pointer drag and Ctrl+C. Scope of mode is project/user; Paper Assistant footer is sole UI selector, Git/terminal/AI proposal application enforce backend policy. Direct AI terminal tools remain future work. Current unrestricted shell was stopped before sandbox implementation.

## r47 display change scope
- Inputs: Source Control components and user screenshot showing left-aligned Date/Author headings.
- Product files changed under frontend/js/features/source-control: format-date.ts (new), commit-graph.tsx, editor-graph.tsx, branch-picker.tsx, merge-branch-picker.tsx, blame-view.tsx, reset-dialog.tsx, stash-manager.tsx, source-control-panel.tsx, source-control.css.
- Test added: test/frontend/features/source-control/format-date.test.tsx. Planning/deployment records updated under docs/git-native-plugin.
- Unchanged: backend Git behavior, user manuscript files, repository objects/history, source timestamp values and time zone interpretation. Commit message text is not rewritten.
- Validation:88 frontend cases; real browser local-time conversion, heading centering and body alignment verified. Existing two production build warnings tracked separately.
