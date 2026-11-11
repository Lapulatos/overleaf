# Repositories / Changes / Graph completion audit

Current deployed baseline: r47 (display-only follow-up to r46). Production build passed with two existing warnings;230 image source checks passed.

| Area | Gap to close | Acceptance |
|---|---|---|
| Commit | Commit/All/Staged, amend variants, sign-off variants, undo | Correct index/worktree scope; captured HEAD guard; native trailers |
| Changes | View & Sort submenu, all batch actions | Selected checks; no duplicate root items; stale discard refusal |
| Pull/Push | Sync, from/to, plain vs prune fetch | Authenticated native commands; no push after pull conflict |
| Branch/Tags | Remote deletions, push tags | Explicit confirmation; remote object-ID lease on deletion |
| Remote | Direct remove entry | Existing expected-URL confirmation reused |
| Stash | tracked/include-untracked/staged, latest/specific apply/pop/drop/view, drop-all | Correct scope; exact stash hashes; destructive confirmation |
| Worktrees | Explicit create | Server-managed path only; no current editor switch |
| Clone | URL creates an independent new paper project; user confirmed | Preserve current project, cloned history/origin, stable retry project ID and Open project link |
| Git Output | Current status-only output is incomplete | Actual operation record, bounded and secret-safe |
| Graph | Audit filters, current item, fetch/pull/publish/refresh, tree/list, details, terminal/settings | No placeholder handlers; isolated UI/backend validation |

No completion claim until relevant isolated tests pass. No user repository mutations for validation.

## r46 implementation evidence

- Both menus share real command dispatch for Commit scopes/amend/sign-off, Sync, fetch/prune/all remotes, remote branch/tag deletion, push tags, stash scopes/latest/specific/drop-all, and create worktree. Remote removal reuses the existing guarded settings dialog.
- Clone accepts an HTTPS URL and project name, preserves native history/origin, imports into a new owner project, and returns an Open cloned project link. Directory-only cloning was removed after the user's clarification. Retrying a partial import reuses the same project ID. Root-document detection uses the existing project service.
- Changes View & Sort updates actual file grouping/sort state with checked selection. All stage/unstage/discard actions retain native execution and stale-content checks.
- Graph reference filters/search/pagination, current item, fetch-all/pull/publish/refresh, tree/list, commit details/file comparisons, branch checkout, settings and terminal dispatch were inspected; existing frontend tests cover them. No empty click handlers found.
- Git Output now captures actual native process commands/output with per-repository bounds and credential redaction. Real Git adapter test passes.
- Verification: 86 source-control frontend cases passed; 51 distinct native repository/handler/clone/output cases passed. No real remote push/delete or user manuscript mutation used for tests.

### Evidence limits
- Isolated clone tests use a local Git remote and in-memory project adapter; authenticated production clone against a private host has not been exercised.
- Resolved in r48: Undo Last Commit uses a guarded preview; ordinary commits soft-reset to the first parent, and an initial branch commit returns to an unborn branch while preserving index/worktree. Detached root commits are explicitly refused. Worktree creation creates a new branch in a server-managed path.
- Global Approve for me / Full Access permission modes remain disabled, as previously reported; this menu-completion pass does not enable them.
- Reference: VS Code Clone workflow, https://code.visualstudio.com/docs/sourcecontrol/repos-remotes (checked 2026-11-11).

- Section geometry: real browser verified all three blank heading areas toggle, all can collapse together, reopened Graph consumes remaining space, headers stay >=28px, action buttons do not collapse, and splitter dragging leaves no orphan spacer.

- Browser submenu fixture also passes viewport flipping, selection closing and keyboard focus return after waiting for its scheduled focus frame. The initial fixture pressed Escape before that frame and timed out; no product success was inferred from that invalid attempt.

- r47: date fields now use DD-MM-YYYY HH:mm:ss locally; Date/Author headings centered.88 frontend cases and real CommitGraph browser formatting/alignment checks passed. No backend behavior changed.
