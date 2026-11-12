# G08: read-only collaborator Git history

Updated 2026-11-13. Status: implementation deployed to isolated 18082; final dual-window presence acceptance pending. No new delivery ID.

## Confirmed
- Viewer status and immutable history commands use read authorization. The status path does not export collaborative documents into the Git worktree.
- Firefox Viewer opened commit details and main.tex diff. Evidence: gap-08-readonly-details.png, gap-08-readonly-file-diff.png.
- Runtime stage, commit, terminalOpen and configureWebhook refused Viewer access; refs unchanged. Evidence: gap-08-readonly-runtime.log.
- HTTP handler suite: 12 passed, gap-08-readonly-handlers.log.
- Presence position checks: 3 passed. Focused live Redis readOnly serialization check: 1 passed, gap-08-readonly-presence-redis.log. Other skipped Redis cases are not counted as passed.
- Chrome live DOM showed A Editing and B Viewing with two online sessions. Evidence: gap-08-readonly-presence-dom.json. This is DOM observation, not a fresh dual-window screenshot.
- Restored synthetic member B from Viewer to original Editor using Chrome Share controls. Subsequent modal values were [empty invite field, Editor invite role, Editor member role]. Closed modal after verification.

## Pending and invalid evidence
- Final Firefox/Chrome visible presence comparison remains pending.
- gap-08-readonly-presence.png is stale and must NOT be counted as acceptance. Missing display capture did not replace the older output.
- On 2026-11-13, browser access host unavailable and native Chrome/Firefox control returned cgWindowNotFound. Read-only macOS session inspection confirmed CGSSessionScreenIsLocked=Yes. No unlock or authentication bypass attempted.

## Resume
1. Once the existing desktop session is unlocked, inspect the original Chrome/Firefox synthetic project windows.
2. Repeat the bounded Viewer position observation if needed; restore B Editor afterwards.
3. Sign off only when both windows show correct positions and no authorization errors.
4. Then proceed to G08 shared remote management permission matrix (changeRemote). No unrelated feature expansion.

Only isolated project 30d83b036221e05b54505eb8 and 18082 participated. Formal papers, external repositories, 18080 and 18081 were not changed by this check.

## Final resumed acceptance — 2026-11-13 00:21
Passed in the original Firefox/Chrome windows. Firefox Viewer displayed read-only history; both windows displayed A Editing and B Viewing on gap02/plain with matching online sessions. Fresh evidence: gap-08-readonly-presence-live.png. Role change invalidated the old session; Firefox refresh rejoined successfully. B was restored to Editor, confirmed through Share, then Firefox refreshed. This supersedes the pending visible-presence check above. Proceed to the existing G08 remote-management matrix.
