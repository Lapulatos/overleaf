# Submission deadlines

Built-in plugin for Paper Assistant. Open Plugins → Submission deadlines → Open submission planner, or use `/submission-deadlines` in the composer. The button opens a Submissions workspace alongside Code Editor and Visual Editor. Calendar, timeline and list views share filters; switching back keeps the editor mounted and preserves planner state. A selected venue can prepare a manuscript-check request, with current catalog/official-source evidence attached as `deadline-context.json`.

The planner uses the CCFDDL live conference catalog and six initial journal author-guide entry points. Conference rounds and registration/abstract/paper dates remain separate. The month grid groups events by local date and expands crowded days. The chronological timeline shows exact dates and source timezones; undated journals stay separate. Passed registration or abstract milestones warn that new submissions may be closed. An abstract deadline is not assumed to be mandatory registration; official registration passages are highlighted in venue requirements. No source opening countdown is interpreted as submission opening. Unknown dates/timezones have no countdown; ambiguous PT DST instants are not converted. Rolling journal submissions are distinct from special-issue calls. This initial directory does not aggregate all journal special issues.

Tracking is browser-local. Refresh/open the planner for fresh data; it does not send background/email notifications. Source cache TTL is one hour; catalog failures return a visibly stale previous snapshot if available. Requirements are attributed excerpts, not automatic proof that a rule applies to a particular track. AI must verify applicability before proposing changes. Source HTML is never executed and templates are linked, not installed.

## Integration API (authenticated)

- `GET /writing-assist/submission-deadlines[?refresh=1]` → `{venues, fetched, sourceUrl, stale, error?}`. Each venue has stable round ID, type, year, area, optional CCF rank, official URL and separate `{label, original, timezone, utc}` events.
- `GET /writing-assist/submission-deadlines/detail?id=<encoded venue ID>[&refresh=1]` → `{venue, fetched, sources, requirements, templates, styleFiles, submission, catalogStale}`. Missing rules remain empty; each excerpt carries its source URL. ZIP links are read from official pages or resolved through a linked repository's API metadata; file presence does not establish the required style.
- Existing Skill invocation API: `POST /writing-assist/project/:projectId/plugins/invoke` with `{command:'submission-deadlines',input:'venue=<ID> Check this paper…',model?,effort?}`. Authorization, snapshots, scope and proposal review remain in the existing task system.
- Workspace event: `paper-open-submissions` opens the editor-area planner.
- UI integration event: `paper-plugin-command`, `{command:'submission-deadlines', input:'venue=<ID> …'}` prepares a composer draft without submitting it.

The server provider interface is `createDeadlineService({fetcher,now})` with `list(force)` and `detail(id,force)`. Future journal CFP feeds can normalize into the same venue/event schema. Keep source provenance and edition/track distinctions; do not infer opening or cutoff times.

## Security and constraints

Guide requests use public IPv4 addresses pinned during each request, revalidate redirects, reject credentials/private endpoints, cap response bytes and time, and limit concurrent guide reads. Fixed upstream JSON requests cannot take a user-controlled destination. Web pages and Skill evidence are untrusted data. Installation does not replace manuscript classes/BST files or download/execute template scripts.

## Independent style conversion

In a venue's editor-area detail view, **Convert to new LaTeX ZIP** starts an export-only AI task using Paper Assistant's selected model. The original project is never a write target: the agent edits an isolated snapshot, and the generic proposal-application endpoint rejects export-only tasks. Page/word limits are deliberately not enforced. The final report distinguishes Converted, Not converted and Needs your decision, with package diffs and execution activity.

The server packages frozen source text, original binary assets, supported text-file changes, and `CONVERSION-REPORT.md`. Existing report filenames are preserved. New binary template assets are not exported by the current agent diff protocol; the conversion instructions require reporting that limitation. Unsupported source documents stop conversion rather than silently disappearing. Compiler settings and original root path are retained on import; verify target-specific compiler requirements in the report.

**Automatically import as a new project** defaults on and can be disabled. With the planner open, completed tasks with changes generate a ZIP and import it as a new Overleaf project; reopening resumes status checks. This is a draft import, not a guarantee that all submission requirements are satisfied. Imported projects have distinct IDs. Repeating import returns the existing project; an uncertain interrupted import requires inspection instead of an automatic duplicate. ZIP export requires a completed task with changes. Failed/no-change conversions are not automatically imported.

Authenticated project API:
- `POST /writing-assist/project/:projectId/submission-conversions` with `{venueId, model?, effort?}` → `{task}`.
- `GET .../submission-conversions/:taskId` → `{task,newProjectId,importState}`.
- `GET .../submission-conversions/:taskId/download` → generated ZIP.
- `POST .../submission-conversions/:taskId/import` → `{projectId}` for the new project.

Task and download access require the requesting owner and current source-project authorization. Snapshots and ZIPs live on the persistent application volume under `/var/lib/overleaf/submission-conversions`; task access follows the existing seven-day task lifetime. Automatic archive retention cleanup is not yet implemented.

## Planner filters and conversion layout

Research areas use full-name multi-select chips. CCF, CORE and THCPL filters are multi-select; explicit N is shown as Non-CCF/CORE/THCPL while absent data is shown as not provided. Window filters by the next submission deadline in all three views, while individual timelines retain all known milestones. Stars follow the venue across rounds and years and persist in this browser.

Only the Convert to new LaTeX ZIP workflow uses [the package layout convention](package-layout.md): root section/input structure, tex chapter files, separate figures/tables/codes/algorithms/lists and original images in figures/src. Validated submission-layout.json relocates original bytes in the derivative ZIP only. The import preserves this layout.

## Manuscript-based venue recommendations

**Recommend venues** starts a read-only agent task using the current manuscript and a frozen catalog snapshot, with Paper Assistant's model selection. The agent searches catalog candidates and, when accessible, their official aims/scope and calls. It returns up to 20 exact catalog IDs, manuscript-specific reasons, source links and subjective relevance scores. Unknown IDs, invalid scores and duplicates are excluded; source classifications and dates are retained rather than generated by the model. Recommendations do not estimate acceptance probability or alter manuscript files.

Results use existing Calendar/List/Timeline views, area/rank/type/Window/favorite filters and a recommended-only toggle. Sort options: manuscript relevance, CCF, CORE, THCPL, venue type, next submission deadline and research area. Missing ratings sort after explicitly non-listed entries. Within each rank, ties use venue names. Sources are bounded by the current catalog (including six initial journal directories), not an exhaustive journal search; limitations must be reported. The task snapshot lets completed recommendations load even when the live catalog is temporarily unavailable.

Authenticated API: `POST /writing-assist/project/:projectId/venue-recommendations` with optional `{model,effort}` starts the read-only task; `GET .../:taskId` returns activity/status plus validated recommendations on completion. Polling resumes from the saved task ID in this browser. No new editor or duplicated filter system is introduced.

### Recommendation display and publication metrics
Recommendation activity appears below the toolbar. The button carries its running state. Overview venue names scroll to detailed cards, where fit reasons span the full card. Closed paper rounds and elapsed abstract/registration gates are labelled separately from later decision/rebuttal events.

`venue-metrics.tsx` holds dated, reviewed publisher observations. Initial coverage: CSUR 2025 JIF and JCR rank; TOSEM JCR rank, from the ACM 2026 release. This is not a live metrics subscription. Unknown SCI/SCIE/EI/CPCI status, JCR quartile and CAS division are explicitly unverified. Conferences do not inherit journal metrics or prior-volume indexing. Source links and checked dates are shown. New records require exact venue identity, year, category and evidence; do not let AI relevance scores populate bibliometrics.
