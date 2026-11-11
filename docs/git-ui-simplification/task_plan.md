# Git daily workflow simplification

Goal: compact VS Code-inspired commit, changes and history interface, retaining repository binding and advanced operations.

- [x] Inspect current components and preserve existing dirty workspace.
- [x] Move commit composer above changes; simplify file rows and commit actions.
- [x] Add recent history to daily view; compact navigation and repository settings.
- [x] Run frontend regression checks and browser layout verification.

Scope: Git frontend only; no remote push, no user manuscript changes. Existing conflict/recovery and credential behavior retained.

## Revision: three simultaneous Source Control sections
- [x] Replace page tabs with Repositories, Changes and Graph, each collapsible.
- [x] Keep settings and branch forms inside Repositories; keep Changes visible during repository operations.
- [x] Verify initial synchronization and bound project layouts in browser, then deploy.

## Editor workspace extension
- [x] Keep binding first, then three persistent collapsible sidebar sections.
- [x] Open settings, branches, incoming merge, local diff and Graph in right editor workspace via portals; retain mounted document.
- [x] Verify frontend behavior (114 tests).
- [x] Build final candidate, hash verify and run browser checks including bound/unbound/first-sync views and editor placement.

## Overleaf visual integration
- [x] Replace heavy gray section/workspace headers with Overleaf theme surfaces and subtle dividers.
- [x] Unify settings typography, form controls and green focus/selection accents.
- [x] Check actual browser appearance, build and deploy the CSS-only update.

## Follow-up layout and persistence bugs
- [x] Make Graph use remaining sidebar height; remove fixed viewport cap.
- [x] Add draggable separators between collapsible sidebar regions.
- [x] Diagnose Venues browser-plan synchronization failure without replacing existing saved data.
- [x] Verify and deploy targeted fixes.

## Official call discovery and rail sizing
- [x] Recognize all S&P call entries, preserve separate sources and submission categories.
- [x] Expand AI source evidence beyond recognized dates and requirements.
- [x] Match extension rail icons to native icon dimensions and verify in browser.

## Initial connection form
- [x] Restore form padding; unify input/select/button sizing; place branch refresh beside selector.
- [x] Build and verify unbound sidebar at narrow and wide widths; saved-token mask, Replace and Cancel.

## Venue acronym search
- [x] Prevent one/two-letter query tokens from matching arbitrary word prefixes.
- [x] Prioritize exact venue names above the selected secondary sort.
- [x] Test S&P variants, build and verify Card/Timeline results (three variants, both views).

## Explicit review / Settings / conference cycles
- [x] Preserve official cycle headings and retain all dated milestones by cycle.
- [x] Merge annual conference cards; retain original round IDs for planning.
- [x] Add a cycle switch, default to the next paper submission cycle; use official cycle events instead of catalog duplicates.
- [x] Keep restored Git previews dormant until explicit user navigation; avoid restoring the Git sidebar on project entry.
- [x] Compact Settings text and credential layout with icons.
- [x] Verify browser behavior, refresh public S&P snapshots and deploy.

## Settings scope
- [x] Remove Open Changes and first-sync workflow notice from Settings.
- [x] Move automatic sync progress, last run and run/resume operations into Changes.
- [x] Verify settings-only content and deploy.

## Settings disclosure cleanup
- [x] Default credentials open and show an explicit disclosure chevron.
- [x] Show short automatic-sync help directly; retain disclosures for long file lists, source versions and optional forms.
- [x] Run frontend/browser checks and deploy r13 (114 tests; browser disclosure and settings checks passed).

## Repository actions (2026-11-09)
- [x] Add searchable branch popover with current branch and create/manage actions.
- [x] Add cloud push entry backed by retained commits; support create-and-publish through existing branch operation.
- [x] Add repository action menu connected to real review, fetch, branch, history and settings workflows.
- [x] Test keyboard/outside dismissal, action routing and blocked states; build/deploy and browser verify.

## Branch management correction
- [x] Separate branch list from create form; show current/selected branches and search.
- [x] Create multiple explicitly named test branches on authorized overleaf-repo-test without changing repo-test or manuscript files.
- [x] Verify remote refs and UI picker/management list; test and deploy.

## Commit flow correction
- [x] Replace dead commit form during first sync with a direct actionable prerequisite.
- [x] Keep Changes visible while incoming review uses the editor; remove redundant Local changes tab.
- [x] Support explicit Commit all and push for unselected non-ignored files, with clear scope and disabled reasons.
- [x] Verify guards, selected-file/all-file behavior, first-sync routing and deploy.

## VS Code direct operation replacement
- [x] Replace branch management page with three quick-picker commands and direct branch checkout.
- [x] Add real local branch creation from current/ref and detached checkout using existing native apply journal.
- [x] Treat bound remote commit as working-tree base on explicit user operation; remove first-sync prerequisite UI.
- [x] Default Changes to Commit; retain conflict handling only when an operation requires it.
- [x] Verify backend invariants, frontend flow, build and browser acceptance.

## Compact Changes and AI commit message / branch metadata
- [x] Remove commit hint and inline pending commits; add input-integrated AI action.
- [x] Generate from authorized, fingerprint-checked selected file contents and staged diffs, with stale-response protection.
- [x] Show branch tip author, date, subject and hash from real Git objects.
- [x] Test backend/frontend, build, deploy and browser verify.

## Real local Commit (replaces retained-review workflow)
- [x] Advance current local branch and baseline with recoverable ref/database settlement.
- [x] Commit selected changes directly, refresh Changes/Graph, remove normal review portal.
- [x] Push current branch tip independently using existing remote lease safeguards.
- [x] Validate consecutive commits, partial selection, recovery and actual browser graph updates without user-project file edits.

## Branch identity and working changes (2026-11-09)
- [x] Distinguish local and origin references in the picker.
- [x] Reset Changes and diff state across checkout and show the actual comparison baseline.
- [x] Verify baseline-specific results, preserved uncommitted edits and stale-request handling; deploy candidate.

## Native Git operation correction
- [x] Use native checkout to decide whether working edits can move safely; reject overwrite, preserve recovery snapshots.
- [x] Present each logical branch once, with local tip preferred and origin state inside that row.
- [x] Verify real Git round trips and conflicting edits, production-image tests and local deployment without touching the user browser.
- Standard Git preservation selected following user requirement that edits must never disappear. Do not silently force, reset or drop edits.

## Git Graph reuse requested
- [ ] Inspect and pin upstream Git Graph code, license and VS Code dependencies.
- [ ] Choose a concrete browser/host adapter and reuse upstream graph code rather than new Git semantics.
- [ ] Validate port in isolated test surface; do not replace live integration until verified.
