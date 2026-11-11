# Git action-by-action audit — r48

Scope: Repositories, Changes, Graph, the full Git Graph view, and their dialogs, previews, settings and terminal. Current source inventory: **287 interactive declarations across 21 components**. Dynamic rows share the same handler; duplicate Repository/Changes menu entries share the same implementation. This number is not a count of independent end-to-end tests.

## Findings and fixes

| Finding | Before | Fix / verification |
|---|---|---|
| Unstage renamed file | Old path deletion remained staged after unstaging the new path | Include both rename paths; real native regression reproduced failure and now passes |
| Rename diff | Staged rename displayed as a new file | Diff both source and destination paths; native rename headers verified |
| Undo first commit | HEAD^ failed because root commit has no parent | Guarded undo preview; delete current branch ref only for root commit, preserve index/worktree; normal/stale/root cases tested |
| Distinct push URL credentials | Settings could only configure fetch URL credentials | Explicit Fetch/Pull vs Push/Publish selector, exact-URL credential dispatch; UI and native service tests |
| File preview navigation | After-view remained selected when next file only had Before | Select existing side on version change; added-to-deleted preview test |

## Per-action review and evidence

Legend: **S** = handler and backend semantics read; **U** = component/UI dispatch or interaction test; **G** = actual native Git / project adapter test; **B** = isolated real-browser test. Tests use synthetic projects/remotes. Provider websites and user manuscripts are not modified.

| Action / controls | Implemented path and result | Evidence |
|---|---|---|
| Initialize repository | Native init plus workspace binding; existing editor bytes exported on status | S/G: repository, workspace; U: source-control-panel |
| Connect existing repository | Clone history into current project binding; retain existing editor bytes | S/G: connect; U: source-control-panel |
| Clone | URL → independent owner project; preserve history/origin; stable retry ID and Open link | S/G: clone; U: source-control-panel; real Mongo/project creation not exercised by clone fixture |
| Repository branch picker / filter / keyboard / close | Local, remote-tracking and tag selection; excludes duplicate tracked ref | S/U: branch-picker, branch-choices |
| Checkout local branch | Managed worktree switch, preserve per-branch unfinished files | S/G: repository/workspace; U: source-control-panel |
| Checkout remote branch | Track native remote ref then switch local branch | S/G: repository; U: source-control-panel |
| Checkout tag / detached | Resolve immutable commit; preserve branch refs | S/G: repository/workspace; U: branch-picker/source-control-panel |
| Create branch / Create from | Create at HEAD or selected ref, then switch | S/G: repository/workspace; U: source-control-panel |
| Rename branch | Native branch -m; validation and occupied-worktree restrictions native | S/G: repository; U: menu-action-audit |
| Delete local branch | Native merged-only deletion; refuses current/retained worktree branch | S/G: repository; U: menu-action-audit |
| Publish branch launcher/menu | Native push --set-upstream to chosen remote | S/G: repository/action-audit; U: source-control-panel/menu-action-audit |
| More Actions submenus | Shared groups, portal placement, keyboard focus, select-to-close | S/U: source-control-panel; B: submenu fixture |
| Main Commit / header check | Commit staged files; refuses empty message/conflicts | S/G: repository/workspace; U: source-control-panel |
| Commit / Commit Staged / Commit All | Auto selects staged if present; all stages tracked and untracked changes | S/G: repository; U: menu-action-audit for both menus |
| Three Amend variants / Amend latest | Captured HEAD/branch guard; explicit confirmation; scoped index handling | S/G: repository; U: menu-action-audit/source-control-panel |
| Three Signed Off variants | Native --signoff with configured Git identity | S/G: repository; U: menu-action-audit for both menus |
| Undo Last Commit | Guarded soft undo including initial branch commit; detached root refused explicitly | S/G: action-audit; U: source-control-panel |
| Abort Rebase | Native --abort, then import restored files | S/G: repository/workspace; U: operation recovery/source-control-panel |
| Cherry-pick | Native cherry-pick, preserve/import conflict state | S/G: repository/workspace; U: menu-action-audit/source-control-panel |
| Revert commit | Native revert creates reversal commit, no history deletion | S/G: repository; U: menu-action-audit |
| AI commit message | Read staged bytes only, bounded prompt; reject stale index/provider failure | S/G: workspace provider fixture; U: source-control-panel; live LLM generation not invoked |
| Changes Refresh / Retry | Fetch fresh status, serialize with mutations, report failure | S/U: source-control-panel |
| View as List / Tree | Actual grouping state and file rendering | S/U: source-control-panel/graph-history |
| Sort by Name / Path / Status | Actual comparator plus checked menu state | S/U: source-control-panel |
| Open Changes / next / previous / file selector | Scoped diffs, race cancellation and cached historical objects | S/U: source-control-panel |
| Open file in editor | Existing editor file selection; deleted path errors shown | S/U: source-control-panel |
| Stage file / Stage All | Literal-path native add, selected content only | S/G: repository/workspace; U: source-control-panel |
| Unstage file / Unstage All | Restore index only; rename handles both paths, unborn repo supported | S/G: repository/action-audit; U: source-control-panel |
| Discard file / Discard All / preview / cancel | Captured byte fingerprint and explicit confirmation, preserve staged version | S/G: repository/workspace; U: source-control-panel |
| Stage / Unstage hunk | Native patch apply, fingerprint and selected-hunk validation | S/G: repository; U: source-control-panel |
| Ignored files / filter / refresh / Stage anyway | Native ignore rules, explicit force stage, no ignore-rule rewrite | S/G: repository; U: ignored-files/source-control-panel |
| File History | Native rename-following history scoped to current repository | S/G: repository; U: source-control-panel |
| Blame / commit link | Native porcelain line authors; selected commit opens scoped diff | S/G: repository; U: blame-view/source-control-panel |
| Merge branch / select source / confirm | Source → captured current target; refuse changed target; native conflict import | S/G: repository/workspace; U: merge-branch-picker/source-control-panel |
| Rebase | Native parent rewrite onto selected ref; native conflict recovery | S/G: repository; U: menu-action-audit/source-control-panel |
| Continue / Abort / Skip operation | Native operation commands; only show Skip for supported operation types | S/G: repository/workspace; U: source-control-panel |
| Resolve current / incoming / edited / deletion | Fingerprint guard, preserve binary bytes, stage selected result | S/G: repository; U: conflict-editor/source-control-panel |
| Reset preview / search / modes / confirm | Soft/mixed/hard semantics, captured fingerprint, hard confirmation | S/G: repository/workspace; U: reset-dialog/source-control-panel |
| Pull / Pull from | Native non-rebase pull to current workspace, import resulting files/conflicts | S/G: repository/workspace; U: menu-action-audit |
| Pull (Rebase) | Native --rebase dispatch | S/G: repository native operation path; U: menu-action-audit |
| Push / Push to | Native selected branch push; no forced overwrite | S/G: repository/credentials/action-audit; U: menu-action-audit |
| Sync | Pull then push; no push on failed pull; exact fetch/push URL credentials | S/G: action-audit; U: menu-action-audit |
| Fetch / Fetch (Prune) | Plain vs explicit --prune; no editor file change | S/G: repository/credentials; U: menu-action-audit/source-control-panel |
| Fetch From All Remotes / Graph fetch | Enumerate configured remotes, fetch each, refresh | S/U: source-control-panel/graph-history/editor-graph; G: native fetch path |
| Delete Remote Branch / Tag | Preview exact remote object ID; delete with force-with-lease; local refs preserved | S/G: repository/action-audit; U: source-control-panel |
| Add / Edit / Remove Remote | Native config, validate URL, expected fetch URL before removal/change | S/G: repository; U: graph-settings-audit/remote-settings/menu-action-audit |
| Credential destination / save / replace / remove | Per-user encrypted store, exact URL, token never returned to UI | S/G: credentials/action-audit; U: remote-settings |
| Stash tracked / Include Untracked / Staged | Native mode-specific stash, import resulting editor files | S/G: repository/workspace; U: menu-action-audit |
| Apply / Pop Latest | Read latest hash, native guarded apply; pop deletes only on success | S/G: repository/workspace; U: shared stash handler review |
| Apply / Pop specific stash | Index plus expected hash prevents stale list restoring another stash | S/G: repository/workspace; U: stash-manager/source-control-panel |
| View Stash | Native patch including untracked third-parent content | S/G: repository; U: stash-manager/source-control-panel |
| Drop Stash / Drop All | Explicit confirmation; exact hash/list guard | S/G: repository; U: stash-manager/shared dialog handler |
| Stash refresh / cancel / close | Reload list; do not reopen preview after unmount | S/U: stash-manager |
| Create Tag / Delete Tag | Native validated local tag operation | S/G: repository; U: menu-action-audit |
| Push Tags | Native non-force --tags push | S/G: repository/action-audit; U: menu-action-audit |
| Create Worktree | New branch in server-generated path; current editor unchanged | S/G: repository; U: menu-action-audit |
| Worktrees refresh / cleanup / confirm / cancel | Native inventory, protect dirty/ignored/current/locked/detached data | S/G: repository; U: worktree-manager/source-control-panel |
| Show Git Output | Real native output recorder, bounded per repo, secret redaction | S/G: output; U: handler wiring reviewed |
| Three section headings / blank space / drag | All-collapse supported; restore content height; buttons do not toggle parent | S/U: section-layout; B: repeated collapse/resize fixture |
| Open / Close Git Graph / switch rail away | Portal lifecycle, close on leaving Source Control | S/U: source-control-panel |
| Graph references / filter / All / Auto / selected | Native ancestor selection, multiple refs, state follows current branch | S/G: repository; U: graph-history |
| Search history / load earlier | Native paginated search beyond first page; stale request guard | S/G: repository; U: graph-history |
| Go to Current History Item | Reset filters to current ref, focus matching row | S/U: graph-history |
| Graph tree/list | Actual commit-file grouping | S/U: graph-history/editor-graph |
| Click commit / click again / details Close | Expand/collapse, cancel obsolete response, keep selected data scoped | S/U: source-control-panel/editor-graph |
| Branch badge double-click | Existing guarded checkout path | S/U: editor-graph/source-control-panel |
| Copy commit ID / hover card | Clipboard API, explicit failure state, dismiss on scroll/blur | S: commit-graph; B: actual clipboard copy/read on isolated localhost fixture; permission remains browser-controlled |
| Commit parents / file diff / Open file | Native immutable commit metadata and parent traversal | S/G: repository; U: editor-graph/source-control-panel |
| Image Before/After | Native blobs, object URL lifecycle, removed-side selection recovery | S/G: repository; U: file-preview/source-control-panel |
| PDF Previous/Next | pdf.js bounded page navigation, render cancellation; no native PDF host embedding | S: file-preview; B: real pdf.js two-page fixture; Next and Previous verified |
| Diff overview / cursor / close | Read-only CodeMirror, change navigation, restore editor | S/U: editor-diff/source-control-panel |
| Show Remote Branches | Graph filtering plus persisted setting | S/G: graph-settings/repository; U: editor-graph |
| Graph settings Name / initial refs / visibility / first-parent / reflog | Shared schema, per-user persistence, graph traversal options | S/G: graph-settings/repository; U: graph-settings-audit/editor-graph |
| User override / Remove override | Set explicit author or fall back to account identity | S/G: author path; U: graph-settings-audit |
| Issue / compare links | Template opens provider form; never submits a PR | S/G: graph-settings URL validation; U: editor-graph; provider page not opened |
| Export configuration | Build JSON Blob, download, revoke URL; excludes effective account identity | S/B: real JSON download parsed, effectiveUser excluded |
| Terminal open / input / poll / close | Owned session, runner Docker scope, expired-session refusal | S/G: PTY in isolated Docker and policy tests; U: git-terminal |
| Terminal resize / Back to bottom | Pointer/keyboard sizing, preserve scrollback vs follow output | S/U: git-terminal; B: previous terminal fixture |
| Permissions Read Only / Ask for approval / Apply / Cancel | Persist supported mode, enforce writes, revoke terminal | S/G: access-policy; U: handler/state review |
| Approve for me / Full Access | Explicitly disabled with unavailable explanation | **Unavailable**, not counted as working functionality; no automatic reviewer / container-wide policy enabled |

## Explicit evidence boundaries

- Source review covers every declaration in `control-inventory.json`; five buttons intentionally delegate to form submission rather than carrying their own onClick. They are Clone, Connect, Save/Replace token, main Commit and generic action confirmation.
- Native operation tests use actual repositories, separate bare remotes and an authenticated HTTPS fixture. They do not use the user's provider account or mutate the user's remote.
- Clone project import uses the real workspace adapter with a synthetic project object; real production Mongo project creation is source-reviewed, not end-to-end exercised here.
- Live LLM provider output, production Mongo clone creation and provider-hosted pages remain external integration evidence limits. Clipboard, PDF paging and JSON download were additionally verified in a real isolated browser.
- Initial native run retained in `r48-native-docker.log`:101 pass,1 old stash expectation failure,3 Redis tests skipped. Follow-up explicitly selects include-untracked for that stash test and supplies a separate Redis container; do not erase the initial result.

Final gates:134 frontend cases passed. The full Docker run plus targeted workspace/Redis follow-up provides passing evidence for all105 unique native cases (no remaining skips). Browser controls configuration export, clear author override, copy commit ID and PDF Next/Previous all passed.

## Changed files in this pass

Product input/output paths (targeted edits in place):
- services/web/app/src/Features/NativeGit/GitRepository.mjs
- services/web/app/src/Features/NativeGit/GitCommands.mjs
- services/web/app/src/Features/NativeGit/NativeGitRuntime.mjs
- services/web/app/src/Features/NativeGit/RemoteOperations.mjs (new)
- services/web/frontend/js/features/source-control/source-control-panel.tsx
- services/web/frontend/js/features/source-control/remote-settings.tsx
- services/web/frontend/js/features/source-control/file-preview.tsx

Tests: native-git-action-audit.test.mjs (new), native-git-workspace.test.mjs; frontend file-preview.test.tsx, menu-action-audit.test.tsx, graph-settings-audit.test.tsx (new), remote-settings.test.tsx, source-control-panel.test.tsx.

Audit outputs: this report, control-inventory.json/.md, inventory-controls.cjs, r48-frontend.log, r48-native-docker.log, r48-native-recheck.log and r48-rename-before.log. Updated task_plan.md, function-audit.md, checkpoint.json and deployment/build manifests.

Untouched by audit tests: user manuscript content, user Git history/index/remotes, external provider repositories. Existing unrelated dirty workspace changes were preserved.

Deployment: r48 on dedicated http://127.0.0.1:18081;232 source image checks passed, login HTTP200. Production webpack completed with two existing warnings. Project volumes and existing terminal runner preserved.
