# G08 / W19 ambiguous file paths

Implemented and accepted on isolated18082, 2026-11-13.

WorktreeFiles.validateFiles now rejects names differing only by letter case or Unicode NFC normalization, including directory prefixes, before document/worktree writes. Error names both paths. BranchWorkspaces validates imported files before allocating a new collaborative workspace. Overleaf ProjectLocator defaults to case-insensitive lookup, so accepting both names could select an unintended entity.

Checks: 6 focused path tests passed, including unchanged existing worktree bytes after rejection. Existing 5 branch tests passed; new Linux-container preallocation test passed separately with zero skip. Ordinary distinct files and validation of a single case-only rename remain allowed; this does not claim end-to-end rename acceptance.

Original Chrome and Firefox each selected g08-case-collision in the branch picker. Both visibly refused Main.tex/main.tex, retained gap02/plain and current main.tex collaborator edits. Fresh screenshot gap-08-path-dual-refusal.png. Database query confirmed zero collaborative workspace records for the rejected branch. Fixture commit ffdf6beff4a41a44c0ef9ad54cd1e2cd9b8fc06c remains local for reproduction, never pushed.

Changed source: WorktreeFiles.mjs, BranchWorkspaces.mjs. Tests: native-git-path-collision.test.mjs, native-git-branch-workspaces.test.mjs. Backend modules deployed only to18082. No frontend rebuild needed. Formal papers and external repositories unchanged.

Invalid attempt: first fixture commit lacked author identity; retained gap-08-path-fixture-first-attempt.log. Retry used per-command fixture identity, without changing global or shared author configuration. Initial test invocation found no copied container test file; copied exact file then reran successfully.

Remaining W19 binary conflict UI acceptance is separate within the existing G08 queue.
