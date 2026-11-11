# r49 notes

Authorized implementation: enable auto-review and Docker-only full-access; Paper Assistant /git commands; all Git Graph headings centered with date/author/hash cells. Collaboration additions are analysis-only pending user's item-by-item approval.

Validation so far:139 frontend tests passed;6 policy/review/container-argument tests passed; actual isolated named-volume Docker fixture passed for four modes (full root writes only in full-access, metadata read-only, no other-project/host/socket mounts, network none). Initial fixture mistakenly expected only loopback in sysfs; Docker Desktop exposes inactive tunnel interface names too. Corrected assertion to exclude Ethernet interfaces; Docker launch explicitly uses network none. Original failed log retained.

Risks found by collaboration source audit: project binding and index shared across editors; snapshot reads are per-document not a cross-document version fence; write gate exists, but no all-client buffered-edit acknowledgement or project epoch on reconnect. Raw terminal writes bypass project.apply and can be overwritten by inspect/synchronize. No automatic commit/push scheduler found in native Git source. Do not implement collaboration features until approval.

Paper Assistant now supports 48 documented /git operation forms (catalog is authoritative); deterministic parser, no shell expansion, shared native API and editor buffer save, mode-aware confirmation, guarded undo/reset/discard/amend/stash. Results are shown in the current panel, not claimed as persistent conversation history. Five execution-panel tests verify modes/save/help; total unique frontend cases144. Scope-change guard prevents confirming a command for a previous project.

Graph browser fixture passed at800/1100/1500px: headers center/left/center/center/center; date/author/hash cell centers match headings with0px delta. Author has ellipsis plus native title tooltip. Date remains DD-MM-YYYY HH:mm:ss.

Fixture/tool errors: first frontend test creation used services/web working directory with root-relative paths; corrected before adding tests. One targeted Mocha launch from repo root failed alias resolution; reran from services/web and all5 passed. First graph bundle omitted automatic JSX runtime; rebuilt fixture with jsx automatic; browser assertions passed. No product regressions inferred from these harness errors.

## Exact product files changed (in-place unless marked new)
- services/web/app/src/Features/NativeGit/AccessPolicy.mjs
- services/web/app/src/Features/NativeGit/GitCommands.mjs
- services/web/app/src/Features/NativeGit/NativeGitRuntime.mjs
- services/web/app/src/Features/NativeGit/RepositoryTerminal.mjs
- services/web/app/src/Features/NativeGit/TerminalReview.mjs (new)
- services/web/app/src/Features/NativeGit/TerminalContainer.mjs (new)
- services/agent/src/repository-terminal-runner.mjs
- services/web/frontend/js/features/source-control/access-mode.tsx
- services/web/frontend/js/features/source-control/git-terminal.tsx
- services/web/frontend/js/features/source-control/source-control-panel.tsx
- services/web/frontend/js/features/source-control/commit-graph.tsx
- services/web/frontend/js/features/source-control/source-control.css
- services/web/frontend/js/features/source-control/git-slash-command.ts (new)
- services/web/frontend/js/features/source-control/git-command-panel.tsx (new)
- services/web/frontend/js/features/source-editor/extensions/writing-assist/conversation-panel.tsx
- services/web/frontend/js/features/source-editor/extensions/writing-assist/composer-context.tsx

Inputs: existing product code, user screenshots and requested modes/command syntax. Outputs: edits above, policy/command tests, this note, collaboration-review-r49.md, verification scripts/logs and deployment records in docs/git-native-plugin. User manuscripts, remote repositories and unrelated working-tree edits were not changed by tests. The collaboration review is a proposal only.

Deployment complete: overleaf-agent-acceptance:20261111-native-git-candidate-r49 at18081,237 source checks, HTTP200. Existing two webpack warnings retained. No commit/push/publication performed.
