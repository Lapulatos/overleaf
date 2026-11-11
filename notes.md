# Continuation evidence

## Current checkout
- HEAD `47fe4f4` (2026-06-05): live writing-assist underline style update.
- Initial tracked working tree clean; many pre-existing untracked files, including `plan/`, `WA-FEATURES.md`, WritingAssistServer.mjs and dependency directories.
- Memory registry search for Overleaf/Prism returned no matches.
- Historical `plan/task_plan.md` says A-LA1 complete but explicitly leaves A-LA2/A-LA3/A-LA4 next and reports Codex execution unverified.
- `plan/wa-agent-gap-2026-06-04.md` describes incomplete Agent task UI, protocol and deployment. Its backend claims need verification against actual runtime/source locations.
- Current WritingAssistRouter.mjs only registers check, transform, config, and dismissals. It does not register Agent task routes.

## Official comparison sources (checked 2026-10-30)
- https://openai.com/prism/ : project-aware AI, proofreading, formatting, citations/literature, compile assistance, collaboration, image and voice conversion, Zotero.
- https://openai.com/index/introducing-prism/ : manuscript-wide context and in-place scientific editing.
- Search also surfaced a Prism-to-Codex migration help page; verify it before making claims about current Prism availability.

## Claim limits
Historical test reports are not current verification. Existing unit tests alone cannot establish browser integration, LLM execution, collaborative editing, or deploy reproducibility.

## Recovery and first repairs
- User explicitly chose to finish old tasks before Prism features.
- Archive branch `wip/daemon-archive` at 703c4fb; WIP 1c149b1 and untracked parent df60a04 contain the missing work.
- Restored only services/agent source/package/test files from those snapshots; preserved stash, branch, existing web files, plans and untracked user state.
- Removed execution-time automatic project writes; preserve diff proposals and artifacts for later Web review.
- Fixed terminal-state races, abort propagation, CLI cancellation, duplicate execution and HTTP validation. Real subprocess cancellation and HTTP authentication covered by tests.
- Latest daemon suite: 52 passing. Existing WritingAssist unit suite: 11 passing. No paid model calls or browser/runtime deployment verification yet.
- Official Prism retirement verified from migration guide; capabilities remain the comparison baseline.
- See plan/prism-baseline-audit.md for remaining old-task and Prism requirements.

## Web task integration pass
- Added WritingAssistAgentService.mjs, WritingAssistAgentController.mjs, WritingAssistTask.mjs. Routes are project scoped; every operation rechecks write permission and task ownership. Snapshot documents are fetched server-side from document-updater, not accepted from browser content.
- Mongo stores task/snapshot/proposals for 7 days (TTL); proposal claims are conditional on pending state, preventing double acceptance. Unknown write outcomes are marked uncertain rather than blindly retried.
- Proposed unified diffs require exact snapshot paths, positions and old text; no fuzzy relocation, basename guessing, file creation/deletion/rename. Multi-file proposals are reviewed per file.
- Added expectedVersion to setDocWithLock/setDoc. Check runs under the existing update lock. A new `/conditional` HTTP route ensures older document-updater deployments fail instead of silently ignoring version checks.
- Added Paper Assistant rail entry/UI with instruction, progress polling, per-file diff previews, accept/reject/cancel, errors and session-local task-ID restore. No manuscript text is stored in browser storage.
- Agent prompt now includes captured multi-file documents; status exposes recent progress; daemon refuses startup without an authentication token.
- Existing transform-runner request type now includes rewriteFidelity, matching its existing behavior.
- Tests: 65 node tests (`plan/agent-service-tests.log`); 168 document-updater Mocha tests; 3 UI component tests; 11 existing WA tests. Targeted new-code ESLint and syntax checks pass.
- Webpack build: production config with `--no-cache --no-optimization-minimize --output-path .../plan/agent-build`, exit 0, 2 asset/entry size warnings. Paper Assistant registration is present in `js/pages/ide-4ec95c8539e49e0449c7.js`. This is a compilation check, not a production deployment or browser E2E.
- Full frontend type check still has 13 errors (optional module absence and old nullability issue), no errors in new agent panel/entry. Details: `plan/agent-frontend-typecheck.log`.
- Web DocumentUpdaterHandler Vitest suite blocked at global bootstrap by Sinon/sinon-mongoose incompatibility. New conditional-route tests exist but are NOT counted as passed.
- Docker Desktop application exists. Requested startup; Docker API socket was still absent on first check. No original container or data changed by our commands.
- Follow-up Docker CLI start with a 30-second observation limit reported "still starting: context deadline exceeded". Next continuation must poll current backend/socket state instead of assuming startup stopped. Source and tests remain available for independent work while runtime becomes available.
- Subsequent process-name-only inspection (`ps -axo pid,comm`) found no Docker/vpnkit process, and Docker socket was still absent. No live Docker handle was verified; investigate startup failure before treating this as a verified wait.

## Codex backend protocol repair
- Rechecked local `codex exec --help` and official noninteractive documentation: https://learn.chatgpt.com/docs/non-interactive-mode (redirect from developers.openai.com/codex/noninteractive/).
- Old adapter used legacy message events and parsed each stdout chunk independently, losing split JSON/UTF-8. Added codex-events.mjs with bounded incremental decoding, current item.completed agent_message extraction and required turn.completed; turn.failed/truncated output cannot become successful changes.
- Removed forced o4-mini default. No explicit model now means use the user's existing CLI model configuration. Explicit per-invocation key uses CODEX_API_KEY; CLI no longer substitutes an Anthropic key for Codex.
- Nonzero exit no longer reports partial suggestions as successful. Timeout/parser failure triggers cancellation with escalation; stderr is drained rather than exposed in task errors.
- Added 8 event-parser regression tests and one actual subprocess adapter test using a temporary fake CLI, no paid API. Full daemon/task-service suite: 74 passing, log plan/agent-service-tests.log. Real-model execution remains unverified.
- Docker backend executable can print help, so executable absence is not the cause. Its `--help` invocation unexpectedly retained a monitor process; terminated only that task-owned invocation (PID 35692). Docker API remained unavailable. No license acceptance or configuration/data reset was performed.

## Direct API configuration repair
- Added explicit auto/openai/anthropic protocol selection and unified config resolution. Provider-specific keys/URLs no longer cross-fallback. Direct calls require an explicit model (flag or OVERLEAF_AGENT_MODEL).
- Anthropic SDK base URL strips trailing /v1 to avoid duplicated /v1/messages; OpenAI root URLs normalize to /v1. URLs with embedded credentials/query/hash are rejected.
- Health uses the same daemon config and a non-generating models request; this is connectivity evidence only, not model readiness. No retries in the Anthropic SDK so task cancellation/timeouts stay bounded.
- Empty/truncated replies fail explicitly; OpenAI error responses do not echo upstream body into task output.
- Added nine config/local HTTP tests. Combined daemon and task-service suite: 83 passing; no paid API calls. Added services/agent/README.md with configuration and deployment boundaries.
- Rechecked Web tests: sinon-mongoose .chain is actively used by other suites, so removing its global import would silently break test semantics. Left that compatibility issue open rather than disable the dependency.
- Docker socket still absent. Tried opening the nested Docker Desktop.app directly through LaunchServices; subsequent process/API status needs verification.

## Web test dependency restoration and real-provider smoke
- Found the actual dependency mismatch: services/web/package.json declares Sinon ^7.5.0, but no Web-local Sinon existed and resolution fell through to root Sinon 9.2.4. No test logic or global imports needed changing.
- Installed exact sinon@7.5.0 and sinon-mongoose@2.3.0 under plan/agent-test-deps with scripts disabled, then linked the two previously absent Web node_modules entries. Root packages were not overwritten. The generated package/lock files preserve this local repair; a normal correct workspace install should supply these declared versions directly.
- DocumentUpdaterHandler Vitest suite now executes: 60/60 passed, including the new conditional endpoint/version-conflict tests. ProjectDeleter suite: 34/34 passed, exercising the retained chain mock behavior.
- Real direct Anthropic smoke sent only the synthetic sentence "The results shows a clear trend." and returned provider HTTP 401. Failed provider responses were not persisted, only the status/category. No user manuscript or credentials were logged.
- Added plan/agent-real-smoke.mjs to exercise daemon HTTP submission and terminal-result polling. It uses a random in-memory task token and closes its task-owned server afterward. Codex smoke uses saved CLI auth/model.
- Real Codex smoke completed in 12031 ms and returned one unified diff correcting "results shows" to "results show". Ran the returned diff through the production buildProposals function against the synthetic snapshot; exact expected corrected text verified. Evidence: plan/agent-real-smoke-codex.json, proposalValidated=true. This proves one real model/daemon/proposal path, not browser application, collaboration or compilation.
- Docker startup failure is now localized in the existing backend log: at 08:29:59 UTC, starting com.docker.build failed with "unmarshaling start request: unexpected EOF", followed by explicit engine cancellation and monitor exit status 150 at 08:30:15. No live Docker process/socket remained. This is a failed startup, not a still-running initialization wait. License warnings also appear but are not established as the cause.

## Deployment network preparation
- Added explicit Agent listen IP (`--host` / OVERLEAF_AGENT_HOST), keeping loopback as default and authentication mandatory. Listener errors now reject startup, including Express callback-reported EADDRINUSE.
- Added two regression tests for default binding, occupied-port failure, explicit all-interface binding and unauthenticated rejection. Combined daemon/task-service suite: 85 passing.
- Prepared plan/agent-task-nginx.conf to route /writing-assist/project/ to container Web port 4000, matching server-ce config. Original nginx host rule is untouched. No reload or deployment performed.
- plan/agent-deployment.md records image contents, network settings and runtime gates. Older bake script omits conditional updater/task model and must not be used unchanged.
- Upstream issue https://github.com/docker/desktop-feedback/issues/444 reports similar startup EOF; it is not a verified diagnosis for this machine. Existing build stderr tail is from 2025 and cannot establish current cause. Requested manual GUI launch; Docker socket still absent.

## Daemon restart recovery
- Rechecked Docker API: socket remains missing, no live engine verified.
- Found that daemon restarts lose in-memory tasks while Web retains running records. Added explicit TASK_NOT_FOUND error code on authenticated daemon lookup/cancel/SSE endpoints.
- Web only marks a task failed on that explicit response, with an explanation and no proposals/writes/resubmission. Connection errors and generic upstream 404 remain retryable errors rather than proof of task loss.
- Added HTTP error-code regression plus service tests for get/cancel recovery and transient outage recovery. Combined suite now 89 passing. Runtime Docker/browser acceptance is still outstanding; this is not a replacement for it.

## Resume check
- First resumed turn after blocked status: Docker API still fails with missing socket; worktree modifications preserved.
- Checked common startup environment overrides (presence only): ELECTRON_RUN_AS_NODE, NODE_OPTIONS, DYLD_INSERT_LIBRARIES, DOCKER_HOST, DOCKER_CONTEXT all unset.
- Tried installed computer-use runtime to inspect Docker UI; bootstrap failed: "Computer Use could not load @oai/sky from the cua_node runtime". No UI state or new root cause obtained. No Docker configuration/data modified.

## Docker recovered and image compatibility audit
- Docker server 29.5.2 is available; existing sharelatex (overleaf-wa:p0), mongo:8.0 and redis:6.2 auto-started. Read-only inventory performed, no existing service modified.
- Existing image's ProjectEntityHandler, Validation, package manifests differ from current source; it cannot establish current-code runtime acceptance via a narrow overlay.
- Prepared separate build context from current tracked working-tree source plus five new task/UI source files. Excludes all untracked dependencies, local plans, user settings and credentials. SHA-256 manifest: plan/agent-source-manifest.json.
- Acceptance Dockerfile derives from repository server-ce/Dockerfile, using existing pinned sharelatex OS/TeX image and clearing inherited /overleaf only in a NEW image layer. No container/volume deletion. Build target is a separate overleaf-agent-acceptance image.

## Isolated acceptance prerequisites
- Started only overleaf-agent-acceptance Mongo and Redis with dedicated network/volumes. Mongo primary health check passed. Existing services remained running.
- Runtime build session 51631 is live; 1280 runtime dependencies downloaded, native addon compilation in progress.
- Added agent-host-connectivity.mjs: temporary loopback Agent, random in-memory token, read-only request from existing Web container using token through stdin. Unauthenticated 403, authenticated 200. No real-model call, document write, or container configuration change. Confirms loopback host access works on this Docker Desktop; all-interface binding is unnecessary here.
- Installed Python Playwright in task-owned plan/agent-browser-venv. Headless Chromium launch probe passed, including page title verification and clean browser close. This verifies the browser tooling, not Overleaf UI.

- Image build completed production dependency installation and 62 Pug template compilations. Now fetching frontend/build dependencies in stage 15; session 51631 remains live.

## Acceptance runner prepared while build continues
- Added run-agent-acceptance.mjs: requires the built acceptance image, starts loopback Codex daemon with random in-memory token, starts only the isolated Web service, waits for login readiness, then seeds synthetic users/project. Browser password is stored only in a mode-0600 temporary file outside the repository. No activation email is sent.
- Added agent-acceptance-seed.mjs with a site URL guard and synthetic LaTeX content. Both scripts pass syntax checks but have NOT run against Web yet.
- Build session 51631 remains live in frontend dependency fetch. No duplicate build started, no failed/timeout claim inferred from lack of new output.

- Build session 51631 advanced: frontend fetch completed (1527 packages, 1007.25 MiB), installation completed, production webpack started. Grammar compilation emitted a complexity warning, not a terminal error. Existing build remains active.

## Docker upgrade interrupted build
- Build 51631 exited 1 with transport EOF during webpack. Docker server changed from 29.5.2 to 29.9.2 and running containers restarted; this was not a verified code compilation failure.
- Existing images and acceptance volumes preserved. Original Mongo restart-loop log: kernel 6.19+ incompatibility. Actual kernel is 7.0.14-linuxkit.
- Official source https://www.mongodb.com/docs/manual/release-notes/8.0/ says 7.0.14 fixes kernel issue; 8.0.30 includes SERVER-125742 lifting the startup guard. Latest listed patch 8.0.34 selected ONLY for isolated test database. Original database/config/image tag not modified.
- Preserved interrupted build log as agent-image-build-interrupted.log, resumed build session 56290; current log remains agent-image-build.log. Mongo patch pull in progress.

## Mongo patch runtime verified
- mongo:8.0.34 pull completed; digest sha256:b9924c330a8bbc5800fe9c69f04a84e221eca7b28fd049a0354147d9908fa142.
- Recreated ONLY overleaf-agent-acceptance-mongo-1 on its dedicated test volume. Compose --wait succeeded; primary health check passes on Linux 7.0.14-linuxkit. Acceptance Redis started. Original database untouched.
- Build session 56290 remains live; LaTeX/BibTeX parsers generated, production webpack continues without terminal result. Browser acceptance has not started.

## Build worker lifetime corrected
- Production webpack completed with two size warnings in 187.092 seconds. Process remained alive because derived Dockerfile's NODE_ENV=development selected the explicitly configured 10-minute thread-loader pool timeout (webpack.config.js:210).
- Corrected only derived Dockerfile compile RUN to NODE_ENV=production (upstream already uses production mode). Sent SIGINT only to task-owned docker build PID 49117; session 56290 exited 130. Preserved output in agent-image-build-worker-timeout.log.
- Restarted acceptance build with the corrected environment and existing cache. This is a configuration repair, not a restart inferred from an observation timeout. Source application and original containers unchanged.

- Refined the environment correction to an ENV instruction before the entire compile RUN: an inline assignment on the generator would not propagate to the piped bash. Stopped only the just-started task-owned build PID 50047 (exit 130); final corrected build handle is 80303.

## Acceptance image complete
- Final build 80303 exited 0. Image overleaf-agent-acceptance:20261030 ID sha256:32e46bb5fc4eee3285db02f7562087d02470deb80d80b36a0974dd301bb44791. Production compilation and all 34 Dockerfile steps completed.
- Verified 6614 source files match both manifest and context (agent-source-verification.json).
- Started run-agent-acceptance.mjs to bring up isolated Web and seed synthetic project; runtime results pending.

## First real browser acceptance and runtime fixes
- Isolated Web login, synthetic project creation, editor display and baseline PDF rendering passed. Runtime runner session 53058 remains live and holds the authenticated loopback Codex daemon. Temporary synthetic login state path is in agent-acceptance-runtime.log; do not print credentials.
- First browser submission exposed getDocument called without fromVersion, producing fromVersion=undefined and HTTP 500. Fixed both Agent controller reads to -1, matching existing latest-document callers.
- Next submission returned 201 but GET was 404: WritingAssistRouter was registered below the catch-all GET route. Moved registration beside other feature routers before fallback. Both changed files pass lint/syntax checks. Applied only to isolated Web and restarted that service.
- Third real Codex/browser run displayed a proposal, accepted it (200), persisted status accepted, and observed editor text updated to "The results show a clear trend." Existing Overleaf Document Updated Externally modal blocked the test's compile click. Its warning was inspected, not bypassed silently.
- Reopened the corrected project, verified editor contents, clicked Recompile and observed status success plus output.pdf (agent-compile-result.json). The original monolithic browser-smoke report stays failed due to modal; do not relabel it passing.
- Built reproducible two-file correction image overleaf-agent-acceptance:20261030-v2; manifest agent-runtime-fix-manifest.json. Running container currently has exactly those hotfix files atop v1, but a recreated-v2 acceptance check is still needed. Compose/runner now target v2.
- Remaining old-task gates: reject/cancel, refresh/restart recovery, cross-user/project authorization and actual concurrent-edit conflict. UI warning handling and clean install verification also remain.

- Downloaded compiled PDF via the authenticated browser API (14,016 bytes), saved as plan/agent-accepted-output.pdf. pdftotext confirms exact corrected sentence "The results show a clear trend." This verifies content in the generated PDF, beyond merely HTTP success.
- v2 image ID: sha256:c300b661ddba75c387bcfa5a3ba8c4e68a448fd08b55444b4d260320ba714d55. git diff --check passes.

## Browser control/permission acceptance
- Recreated isolated Web from v2 image; image ID verified. Container regeneration invalidated the default generated session secret, so the test now signs in again when redirected to login (no application bypass).
- agent-browser-controls.json passed all six checks using actual UI, HTTP and Mongo state: refresh restores proposal; rejection preserves document; repeated review returns 409; second user receives 403 on task read/submission; editing in a second browser session causes old proposal conflict and preserves the concurrent edit; browser cancellation reaches cancelled.
- Reviewed assistant edits were previously labelled unconditional external updates and triggered a misleading overwrite modal. HttpController now marks only source=writing-assist + expectedVersion + approving user as collaborative updates. Other sources and missing safeguards retain external warnings. 172 document-updater tests pass, including four added metadata cases.
- Built v3 image with this one-file change, manifest agent-reviewed-edit-manifest.json. Isolated v3 recreation in progress; full accept/compile smoke next. Original installation unchanged.

## Old Agent core acceptance completed
- v3 browser smoke passed end-to-end: real model proposal, accept, editor update, no external-update dialog and compile status success. agent-browser-smoke.json is now passing; prior failures remain separately recorded.
- Real daemon restart: submitted a task, stopped only task-owned runner PID 50638/session 53058 (exit 0), restarted Codex daemon with the same in-memory token recovered privately from isolated Web configuration. New daemon handle 20616. GET of old task becomes failed with explicit restart explanation; synthetic document unchanged (agent-restart-result.json).
- v3 running image matches sha256:608e7c74dc9f5973b090a070188816f6936bb7d208053dcd7c5ca1e6cb89ab0e. No original service or data upgraded.
- Document-updater lint invocation could not find configuration in that subtree; do not count it passing. Syntax, 172 focused tests and diff whitespace check passed. Web controller/router targeted lint passed in the preceding run.
- Core old Agent gates completed locally; full Prism objective remains pending. Existing independent grammar/transform frontend still requires its own API key configuration and is not implied verified by Agent acceptance.

## Prism conversation foundation
- Added WritingAssistConversation model with durable transcript and review metadata, separate from expiring document snapshots. Added authorized service and Mongo store with revision-based single-turn admission and atomic result updates that preserve a newer active turn.
- Context selection keeps complete recent turns within a 32k-character budget, at most 12 turns, and reports omission count. Stored conversation currently capped at 50 turns; storage byte limits and task submission/restart reconciliation remain integration work before exposing routes.
- Five new unit tests pass: ownership/revocation, concurrent admission, follow-up context with rejected proposal awareness and no document snapshots, bounded context, invalid/overlong requests.
- Actual isolated Mongo check passed concurrent admission, literal $ text preservation, late result/new active-turn protection and ownership query isolation. Log: plan/agent-conversation-store-check.log. Only schema/store modules copied for this check; no new route/UI deployed.
- New source lint and syntax/format checks passed. Design/next steps: plan/prism-conversations-plan.md. Main objective remains active and incomplete.

## Conversation implementation checkpoint
- Added conversation controller and lifecycle orchestration; task creation now
  persists preparation/submission states before snapshot/daemon calls.
- Added threaded conversation UI and shared task-result component. Legacy
  AgentTaskView remains exported with its three regression tests.
- 104 backend and 7 frontend tests pass. Source lint passes. Typecheck retains
  13 existing errors. New code is not deployed/browser-accepted.
- Stored summaries and proposal metadata have byte limits; cancellation is
  terminal, unchanged results do not bump revisions, old result reconciliation
  cannot clear a later active turn.
- An initial frontend test creation command used an incorrect cwd-relative path;
  corrected it before the successful seven-test run. No source was overwritten
  by that failed command.
- Next work and exact acceptance gaps are in prism-conversations-plan.md.

## Conversation acceptance preparation
- Added project-expiry cleanup for WritingAssistConversation and WritingAssistTask;
  ProjectDeleter suite passes 36 tests, including active-project preservation.
- Final Mongo check passes six invariants including terminal and revision guards.
- Late stale polls cannot regress accepted/rejected proposal status; backend
  test count is now 105.
- Full v4 image build is live (session 57264), manifest prism-source-manifest.json;
  final ConversationService/Store guards need a small source-recorded layer after
  that build. Browser script prism-browser-conversations.py is ready, not yet run.
- Conversation-capable daemon is live session 34041 PID 57258. Old daemon was
  verified idle before restart. Shared secret remained private throughout.
- Subsequent capability work is specified in prism-next-capabilities-plan.md.

## Conversation phase accepted; literature next
- Real Codex/browser conversation smoke passed six checks on v5. Additional v6
  controls passed prior-reply review, cancellation, and actual daemon restart.
- Same-selection reset defect was found by the first controls run, preserved as
  prism-initial-prism-browser-controls.*, fixed and regression-tested.
- v6 image bee10911d2525266630e8aad3e4461cb07313d68bc6bd8e32bdb04bf61835591
  is deployed only to the isolated acceptance environment; 53 source hashes match.
- Restart left daemon PID 61064 live, log prism-daemon-after-restart.log. Prior
  daemon session 34041 and build 78912/browser 94312 are terminal.
- Final counts: 111 backend tests (105 previous + 6 literature), 7 frontend,
  36 deletion; final lint passes. Full typecheck retains 13 older errors.
- Literature foundation now has authorization, bounded Crossref search/lookup,
  provenance-bearing BibTeX metadata and malformed-response guards. Live DOI
  lookup and exact-title search pass. No literature route/UI/import yet.
- Next steps remain in prism-next-capabilities-plan.md; overall goal incomplete.

## Citation phase accepted
- v7 59537e72452949f308042a91be2d196972f8ae5cc7802f47a7095f2395a4f8e5
  is deployed to isolated 18080 only. 56 runtime source hashes match.
- 120 backend/11 frontend tests, lint and build pass. Typecheck still has 13
  earlier errors. Browser citation workflow passes nine actual checks, including
  two-session conflict protection. Final PDF has two source-backed references.
- Synthetic citation fixture project 6ae49a59c21e21bfd99d4c54; final PDF and report
  are in plan/prism-citation-final-output.pdf and citation acceptance report.
- Initial PDF-case assertion and CSP-blocked automation predicate failures are
  retained separately. Corrected tests; product CSP unchanged.
- Exact DOI search was fixed after live fuzzy search returned unrelated works.
- Next phase: compile diagnostics. Context exposes logEntries.errors/rawLog;
  inject diagnostics into an editable user request, preserve fresh server-side
  project snapshots and reviewed/conflict-protected application.

## Compile assistance preparation
- Added bounded diagnostic-request helper and Discussion prefill action using
  existing compile context. 16 frontend tests pass, including no-auto-submit,
  draft protection, stale diagnostics and a late citation-restore response guard.
- Source lint passes; new test-only TypeScript resolver issue fixed. Full check
  still reports the 13 baseline errors.
- v8 full build live session 73766. Real failing-LaTeX/browser script prepared but
  not run. Do not mark compile assistance accepted until that gate passes.
- Image next-step local inspection confirms installed Codex CLI --image support.

## Compile phase accepted
- v8 001825c2885ee187ec7910834d8c9dc680ec5f80c544dca2443a58bbae4361c9
  is deployed to isolated port 18080; 57 source hashes match.
- 16 frontend tests and lint pass; full typecheck retains 13 prior errors. An
  additional test-only Promise resolver type issue was fixed before this result.
- Real fixture 6ae49dbc518b5de406a98df0: initial compile failure, editable error
  request without submission, exactly one Codex message, proposal-only repair,
  accepted addition of missing end marker, successful final PDF with original text.
- Model result explicitly diagnoses main.tex ending after line 4 without end marker
  and document opened on line 2. Report and repaired PDF are in plan/prism-compile-*.
- Citation late restore guard is included in v8 and regression-tested.
- Next image phase: local Codex --image support verified through installed CLI help;
  no image upload/temporary-file path implemented yet. Voice/reference integration
  and independent grammar/transform provider regression also remain open.

## Independent legacy provider resumed
Added explicit server-configured Agent provider for grammar and selection actions,
with bounded authenticated polling, cancellation cleanup and JSON shape checking.
Provider credentials remain server-only; existing API provider settings preserved.
Real Codex grammar/LaTeX polish passed at service layer. See legacy-provider-plan.md.
Found and fixed stale selection overwrite risk; three regression tests pass.
Image v9 was snapshotted before that fix and is NOT the final acceptance image.
Original runtime v8, original volumes and external repositories are untouched.

## Legacy browser defects and current continuation
The v11 browser verified live grammar underlines, acceptance, a separate correct
grammar PDF, and transform rejection. Overall browser acceptance still fails:
disabled checking left pending work and busy errors surfaced as 500. Source now
waits for saved config, cancels disabled work, and preserves safe provider status
codes. v12 build session 90607 is live; runtime remains isolated v11 with daemon
PID 69957. See the latest checkpoint in legacy-provider-plan.md and preserved
initial-/busy-/sync-/disabled- browser artifacts. No old-work completion claim.

## Legacy acceptance complete in isolated v12
Browser fixture 6ae4aa433fba38574c3c475d passes seven checks, including saved
provider, real grammar apply/PDF, reviewed transform rejection/acceptance, math
preservation and no grammar requests while disabled. Final legacy-accepted.pdf
contains both corrections. See legacy-writing-acceptance-report.md.
Image tests: 148 total backend tests pass; three new image UI tests pass after
adding FileReader to the JSDOM test environment. A metadata test initially checked
a submitting turn; corrected it to complete the turn before history inspection,
matching the intentional policy that only completed turns enter model history.
No real image acceptance yet. All build/browser/test jobs are terminal.

## Image/equation phase accepted for printed input
Browser fixture 6ae4ab6fbe26f9f604afe0b7 passed seven checks with real Codex;
reviewed insertion compiled correctly and rendered PDF was inspected. Mongo audit
verified no raw image bytes in transcript/task snapshot. Temp files removed.
See prism-image-acceptance-report.md. Next voice/library/full compatibility.

## Voice implementation checkpoint
Added voice-input.tsx and ConversationView integration: English/Mandarin, explicit start/stop, editable transcript and explicit insertion, provider disclosure, failure messages, abort and stale-callback guards. Five voice and six conversation tests pass. Source lint passes; full typecheck still reports 13 baseline errors. See plan/prism-voice-plan.md. Real speech recognition and isolated runtime rebuild are pending; deployed v12 remains unchanged. Overall goal incomplete.

## Local speech evidence
Chrome 156 cloud recognition and browser-local model install produced no transcript; do not treat API existence/UI tests as voice acceptance. faster-whisper official usage: https://github.com/SYSTRAN/faster-whisper . New bounded worker limits recording to 60 seconds and 2 MiB, runs CPU int8/two threads with local model only, no runtime model downloads. 162 backend + four decode tests pass. Real model probe session 12045 still running. New speech code is not deployed and no MediaRecorder frontend exists yet.
Zotero source inspection: only refProviders schema/settings plumbing found; app module comment says third-party-references owns actual values. Existing Crossref citation service assumes a DOI; authentic Zotero import must support items without DOI instead of substituting Crossref matches. Zotero v3 docs https://www.zotero.org/support/dev/web_api/v3/basics describe key-header authentication and item BibTeX export. No Zotero user credentials read or changed in this pass.

## Voice phase accepted
2026-10-31: v14 image c501e76a43da14085ad1ce669955fff574bab725cf5bce2eabe0c782aa9b1771; daemon PID 88311. Six actual browser MediaRecorder/local-model/review/PDF checks pass, as do actual microphone denial and database audio-absence checks. Exact English synthetic transcription; Mandarin tiny model has a homophone error. 162 backend, four decoder and 19 frontend tests pass. See prism-voice-acceptance-report.md. All phase sessions terminal. Next Zotero authenticated selection/import plus combined compatibility.

2026-10-31 continuation: deployed Zotero late-status input fix in v16; actual invalid-key browser acceptance 4/4. Immediate navigation test raised beforeunload; cancelling preserved text, second session received it, reload without compile retained it and reverse edits synchronized. This narrows earlier lost-edit observation to unconfirmed loss after automatic acceptance of warning; AI-accept timing still needs targeted coverage. Comment shortcut test initial timeout remains under investigation.

Comment diagnosis: permission comment=true is insufficient because review components mount only with features.trackChangesVisible. ProjectEditorHandler.trackChangesAvailable defaults false and no optional track-changes module exists. Existing ChatApiHandler includes thread/message methods and document-updater already supports range comments. Need native authorized Web integration; do not toggle UI flag alone. History browser run53237 shows actual ordinary edit in rendered diff and all three history endpoints200. All browser sessions terminal.

Native comments uses existing chat thread storage and document-updater ranges; no new data store. Remaining failure risk: range mutation then chat mutation spans services; deletion retry after lost anchor needs reconciliation. Owner feature object now copied before native flags to avoid corrupting cached account features. Unit bootstrap resets module registry, so feature mocks must dynamically import Features within beforeEach. Backend180 and model35 pass; types13baseline. Not deployed.

2026-10-31 harness: actual two-file Codex repair and compile retry passed; PDF extraction/render verified. Empty AppServer environments disables native tools; omitted to use scoped local default. MCP inventory retains disabled entries; verify runtimeStatus and tools. Global AGENTS remains; no absent-instructions claim. Current web v19 unchanged. Evidence and remaining integration in plan/prism-harness-plan.md.

2026-10-31 attachments/catalog: source now supports bounded authorized project assets without persisting binary data in conversation/task storage. Real asset compile passed (25,445-bytePDF). Real model metadata8entries; UI not wired. Initial speech timeout under concurrent Docker compile resolved in isolated and low-concurrency runs; preserve failed log. See prism-harness-plan.md.

2026-10-31 dock: single ConversationView in editor bottom; side rail points to it. Model and effort carried through request/task chain, checked against catalog. Browser gate prepared; v20 build39006 still active. No deployment claim; see harness plan for exact handles and source checks.

2026-10-31 v20 now deployed (daemon4784). Real browser model/effort selected task modifies2files only after explicit review; actual compiler failure/retry/PDF text evidence captured. Expanded history CSS initially clipped composer; current source fix passed injected browser check (sendBottom634 on650viewport, historyscroll815). Source fix not deployed yet. Build/deploy/browser handles terminal; no live build remains.

2026-10-31 new file proposals: raw created content has explicit kind=create, server validates path and fresh native addDoc rejects name collisions. New folders use EditorController.mkdirp.lastFolder._id. Only user acceptance creates. Deletions still fail explicitly. v21build68687 running; no deployment yet. Browser creation+PNG scenario prepared, unrun.


## v21 creation/assets/layout browser gate accepted
Deployment11306 terminal0; host daemon PID7420; 98 container source hashes match. Browser60251 terminal0 and passed five checks in plan/prism-browser-create-harness.json: native PNG upload, bottom composer/real model choices, new chapter preview before creation, expanded review keeps composer visible, accepted changes compile in original project. Fixture6ae4e6eac9560a84e7bb7177 uses gpt-6.1-sol/medium. Native upload uses logged-in request with root folder_id; direct seed addFile lacked request JWT and was replaced by actual Web upload. Final PDF text contains Prism workflow verified, Existing introduction, Discussion and New discussion verified. Review screenshot visually inspected; original project still lacks new chapter until acceptance, controls visible at650px. Evidence prism-create-{before,review,after}.png and prism-create-accepted.pdf/.txt. This accepts new-file and asset browser gates, not deletion or full product completion. Next: legacy history restore compatibility, reviewed deletion, broader comments and harness cancel/permission regression; positive Zotero still awaits credentials.

Deployment24565 terminal0: v22 sha256:a54d6317848d045c0f932ba77feb60b6f0dfc2b37df233d32da8f401cedbd978, three changed runtime hashes match; base verifiedv21 preserved. Daemon7420 unchanged, site18080 ready. Lint3529 terminal0, preparation tests5pass, TS13baseline errors. UI browser20296 LIVE via prism-browser-history-restore.py, must poll same handle before rerun. No full restoration acceptance yet.

Native file-restore UI92903 terminal0 passed4checks (prism-browser-history-restore-already-migrated.json): button visible, confirmation, automatic opening of restored doc, fixture restored back to accepted version4. Screenshot prism-history-restored-browser.png visually inspected; PDF panel displays prior compile (no restored-version PDF claim). Initial UI20296 failed only by selecting hidden duplicate main.tex node; test now asserts selected toolbar pathname. To test automatic preparation, used native backwards resync only on same synthetic fixture (44486 terminal0; true->false in prism-history-legacy-fixture.json). Browser82491 now LIVE, repeat native restore should exercise v22 preparation automatically. Must poll before rerun; then verify persisted ranges flag. Other projects unchanged.

Automatic legacy migration + native restore UI82491 terminal0 passed all4checks. Source fixture had native ranges flagfalse immediately before browser action; read-only probe74239 terminal0 confirms true after. Evidence prism-history-legacy-fixture.json, prism-browser-history-restore.json and prism-history-migration-check.json. No live process handles remain from this turn. This accepts native single-file restore with automatic legacy migration, not whole-project or comment-preservation gates. v22 remains deployed; daemon7420 unchanged. Next independent work: whole-project/comment restore and comment permissions, reviewed deletion, harness cancellation/recovery and combined compatibility; positive Zotero remains pending credentials.

2026-10-31 comment permission inspection: review-panel-resolved-thread.tsx sets canReopen = permissions.comment, while native backend manager() permits owner/editor or reviewer owning thread; readOnly can comment but cannot manage. Thus native read-only UI currently offers a Reopen action that backend rejects. Needs scoped nativeComments UI correction plus permission browser test; do not weaken backend authorization. No source change yet. Resolved thread author metadata may be absent in history-restored ranges; verify against authoritative thread author if changing ownership logic.

v24 deployed75169 terminal0; sha256:4ad36233eff9c1e967cb2cbe993c304b5b1ed2ecb7f8f8260acf6e414a669bf6; two runtime hashes match, daemon7420 unchanged. Browser59334 returned8pass, but visual screenshot caught weak reopen assertion (same comment still visible in pending resolved popup); do not accept reopen yet. Strengthened gate to await reopen204, active unresolved entry visibility and thread resolved=false via API; browser25479 LIVE. Other7checks accepted. Unloaded probe53015 terminal0: previous completed fixture6ae4ebc3ddd31f2eb3b0db79 flushed and unloaded via native DU cache endpoint only; Mongo project still present, live docs0/stored comments1, authenticated /ranges200 returns1. This proves persisted fallback beyond unit tests. First unloaded script stopped before mutation because it picked newly successful report; corrected to fixed prior v23 log fixture.
Screenshot also shows Review panel bottom tabs overlap the assistant dock at1600x1100; investigate layout in next UI pass along with native readOnly Reopen mismatch. No claim of all-layout acceptance. Native ranges changes covered12tests + lint pass. No active build/deployment; only browser25479 pending.

Comment-history browser25479 passed strengthened8checks; reopened thread verified active in UI and unresolved via API. No live handles remain. Runtimev24; frontend footer overlap and readOnly Reopen remain next fixes.

Review layout/permission source fixes ready: footer bounds follow editor scrollDOM; native Reopen uses management permission and thread author. v25 fullbuild2833 live, no deployment yet. Prepared deployment and four-condition browser gate. TS13baseline errors/lintpass. Next poll2833, deploy, run prism-review-layout-acceptance.py.

Native Codex command cancellation, reload persistence and same-conversation recovery passed4browser checks; cancel UI0.24sec, original untouched. See prism-browser-cancel-recovery.json. v25build2833stilllive.

Unshared-project real-account gate passed7requests all403; prism-cross-project-access.json. Current v25build2833 stilllive, no restart or deployment.

v25 deployed and geometry950/650collapsed/expanded accepted. Native invited readonly reply is still blocked by existing viewer permission branch; fix now propagates isInvitedMember server meta and narrows exception to nonanonymous native invited members. v26build77653 live, deployscriptprepared, rerun same browsergate aftersuccess. Seven unshared-project realaccount calls403 alreadyverified.
v26 accepted browser95136: four geometry combinations, invited readonly reply visible/synced, Reopen/Delete controls hidden and direct management403. Screenshot checked. Current runtimev26/daemon14849. v27frontendbuild15744live, no deployment yet. Readonly screenshot also shows legacy grammar checker error badge (six failed checks); investigate in combined compatibility so readonly views do not automatically issue write-authorized grammar requests. Do not count this as a comment permission failure or silently claim all readonly UX clean.

## Readonly legacy checker follow-up
Readonly review acceptance exposed automatic grammar requests without edit permission.
Source now blocks automatic/manual checks when EditorState.readOnly is true, cancels
pending checks on readonly updates, and hides the check control until editable.
Two focused frontend tests pass, including readonly/manual suppression and editable
recovery; source ESLint passes. Evidence: plan/prism-readonly-checker-tests.log and
plan/prism-readonly-checker-lint.log. Changed index.ts, progress.ts and
writing-assist-disabled.test.ts. These changes are NOT in the frozen v27 context;
require a subsequent runtime build/browser check. v27 polling-retry build15744
remains live; deploy and actual daemon-restart gate still pending.

## v27 deployed
Build15744 and deploy38212 both terminal0. Image80dc9736b6b8985987a9e7573898f8f588a26652e0d754f36bb16e5eddf313ae, three runtime hashes match. Browser restart recovery78453 running; log plan/prism-restart-recovery-browser.log. Readonly grammar fix remains source-only.

## v27 restart recovery accepted
Browser78453 terminal0. Four actual-browser checks pass: native tool started, forced daemon restart surfaced terminal failure automatically in4.8s with unchanged source/no proposals, failure persisted after reload, same conversation completed a fresh task. Evidence plan/prism-browser-restart-recovery.json. Daemon now PID16531 (previous14849); harness/speech enabled, running0. Source-only readonly checker fix still awaits deployment/browser check. Overall goal incomplete.

## v28 readonly checker and comment deletion gate
Prepared a two-file frontend layer atop verified v27 for readonly grammar checks.
Initial build67858 failed because BuildKit treated a bare image ID as a registry
name; no runtime changed. Corrected FROM to the verified local v27 tag; immutable
base image ID remains recorded in prism-readonly-checker-source-manifest.json.
Build50499 running (prism-readonly-checker-build.log). Prepared guarded isolated
deploy helper and browser test for enabled readonly config/no requests/hidden
control plus retained owner control. Separate synthetic comment deletion browser
17864 running on current v27: create/sync/persist, UI delete, peer removal, retry
idempotence, stored thread/anchor absence after reload.

Build50499 terminal1: local amd64 base was not selected by default arm64 build. Verified image architecture and restarted with explicit --platform linux/amd64; build48353 now confirmed running dependency installation. No runtime redeployment yet.

## Comment deletion accepted on v27
Browser80760 terminal0; seven checks pass on owned synthetic project
6ae4f571922d207bd7879b1b. Verified creation, peer sync, reload persistence,
cancelling deletion preserves comment, confirmed UI deletion propagates to peer,
retry DELETE204, and both anchor/thread absent after reload. Evidence:
plan/prism-browser-comment-deletion.json and prism-comment-deletion-browser.png.
This is normal/cancel/retry browser coverage, not injected partial-failure coverage.
v28 build48353 still live in dependency linking; no runtime switch yet.

## v28 build checkpoint
Re-polled build48353: live, dependency installation complete and webpack running.
No restart/redeployment while the build is live. Runtime remains v27. Prepared
prism-readonly-checker-deploy.py and prism-readonly-checker-acceptance.py are next.
Reviewed existing native deletion again: Web project lock covers structure but
not live document updates; DU flushAndDeleteDocWithLock only flushes/removes cache,
while Web removes project entity earlier. A version precheck alone cannot safely
implement AI deletion. No unsafe deletion path was added.

## v28 build completed
Build48353 terminal0. Webpack compiled with two warnings in269.823s. Image
sha256:23c1b2d5554410cb3ae68794c7f836d92469bd1f2756152a12ee26bc069e6abe.
Guarded deployment89218 running; browser readonly checker and current-version
save/collaboration tests queued. No daemon restart requested.

Deploy89218 terminal0; v28 readiness and two changed source hashes verified. Readonly browser32537 running; log plan/prism-readonly-checker-browser.log. Daemon unchanged.

## v28 readonly browser accepted
Browser32537 terminal0; three checks pass against enabled config: readonly sends
zero grammar requests, checker/error control hidden, owner check control retained.
Screenshot prism-readonly-checker-browser.png visually inspected. Evidence:
prism-readonly-checker-acceptance.json. Current-version normal-save/collaboration
browser50560 running, with separate prism-v28-save-regression outputs preserving
prior v15 evidence. Runtime remains v28, daemon PID16531 unchanged.

## v28 save/collaboration accepted
Browser50560 terminal0: four checks pass. Immediate refresh raised beforeunload;
cancelling it preserved the edit. Peer received edit; refresh after synchronization
retained it without compiling; reverse-direction editing synchronized. Evidence
prism-v28-save-regression.json. Prepared a separate v28 legacy grammar/selection/
PDF acceptance runner preserving earlier reports and artifacts.

Current v28 legacy grammar/selection/PDF browser28174 is running; log plan/prism-v28-legacy-browser.log. Outputs use prism-v28- prefixes to retain previous evidence. Do not deploy or restart daemon while this actual-model test is active.

## v28 legacy regression timing investigation
Browser28174 terminal1 after four passed checks: provider config, actual grammar
acceptance, verified grammar PDF, transform preview/reject without write. Second
transform preview timed out; failure screenshot already contains accept/reject
preview. This does not establish a product regression or successful acceptance.
Preserved first failure JSON/log. Added explicit POST transform response wait,
status and elapsed-time recording, followed by a bounded UI wait. Browser37424
running; no product source change or restart. Full v28 legacy acceptance pending.
Updated old baseline/harness document headers to clearly separate historical
snapshots from current capability evidence.

## Legacy failure traced to host sleep
Run37424 terminal1: transform POST502 after1.9s, Web error Local agent is unreachable.
Host pmset confirms repeated Maintenance Sleep/Deep Idle intervals (575/908/984s)
matching Web slow event-loop offsets572475/905566/981874ms. Container has zero
restarts and OOMKilled=false. This is confirmed environment interference; not proof
that all transform failures are fixed. Preserved sleep-failure JSON/log. Next run
uses caffeinate -is scoped to test process only, no permanent power configuration.

Scoped awake run28513 is live (caffeinate -is ...prism-v28-legacy-browser-acceptance.py).
pmset confirms PreventSystemSleep and PreventUserIdleSystemSleep assertions owned
by caffeinate PID23330 on behalf of Python23328. Assertions end with this test.
Grammar correction has completed; waiting for PDF and transform checks. Future
unattended local browser/model acceptance should use the same process-scoped
wrapper, retaining bounded network/agent deadlines; never change global pmset.

## v28 legacy combined regression accepted
Awake run28513 terminal0; all seven checks pass on synthetic project
6ae50df39d023540c4f9f902. Actual local-agent grammar suggestion accepted and verified
in PDF; transform preview/reject preserves source; accepted transform preserves
LaTeX math; disabled checker sends no competing requests; final PDF contains both
accepted changes. Transform HTTP200 at6.95s and6.94s. Evidence:
prism-v28-legacy-browser-acceptance.json, prism-v28-legacy-accepted.pdf/.txt,
prism-v28-legacy-final-browser.png. Earlier failures retained and linked to host
sleep interference; no product code altered for these failures. Whole goal still
incomplete: reviewed deletion, positive Zotero authentication and remaining
combined gates/final audit.

## Reviewed deletion lock audit
Inspected native Web deletion, DU update/document/project managers and RedisLocker.
Confirmed independent project/document locks, finite non-renewing Redis lock TTL,
and reentrant-lock hazard if the whole native delete path is invoked from a
DU-held-lock callback. This rules out both precheck-only and long callback-only
implementations. Recorded required durable reservation/fencing/recovery protocol
and crash/race gates in plan/prism-reviewed-deletion-plan.md. No unsafe delete
source or runtime path added. Implementation remains pending; goal incomplete.

## Reviewed deletion reservation storage implemented
Added DocumentDeletionReservations.mjs, DocumentDeletionReservation.mjs and four
focused Node tests. Tests and source lint pass. Real isolated Mongo probe49109
terminal0 verifies concurrent same-intent convergence, conflict/stage enforcement,
cross-process recovery and idempotent transitions. Probe receipt cleaned. Source
hash evidence plan/prism-deletion-reservation-probe.json. No manuscript deletion,
no active Web route or deployment change; durable write fencing, native deletion,
cleanup/reconciliation and review UI remain required. See updated deletion plan.
Previous turn classification: progress (new code and actual database evidence).

## Atomic Redis fence primitive implemented
Added services/document-updater/app/js/DocumentDeletionFence.js. reserve compares
project, exact cached version and serialized content in one Lua call before
setting a non-expiring operation marker. runWrites checks that marker atomically
before executing a bounded internal command batch, with keys restricted to the
requested document's configured key schema. No routes/native writes call it yet.
Six actual isolated Redis tests pass, including30 cross-client edit/delete races,
stale version/content/project rejection, same-operation retry, blocking later
writes, rejecting cross-document commands, and unfenced ops/expiry/NX semantics.
Initial probe found runtime legacy keys omit hash-tag braces; fixed validation
to use exact configured keys, then reran all gates. Test failure preserved.
Source lint uses the Web config explicitly because DU has no discovered local
ESLint config; syntax check passes. Evidence prism-deletion-fence-probe.json/.log.
Synthetic Redis keys cleaned; only /tmp diagnostic copies added to container.
Runtime v28 entrypoints unchanged. NOT a durable deletion implementation: next
wire all write/load paths and prove durable reservation/cache ordering across
failures before exposing native deletion or review acceptance.

## Native write-path integration checkpoint
RedisManager now uses the guarded batch builder for putDocInMemory,
updateDocument, renameDoc and updateCommentState. Scalar/object conversion matches
the prior fixed MULTI calls; read/project/cleanup transactions remain native.
Cache-load error reporting preserves Lua errors instead of assuming previousErrors
is present. Updated RedisManager test dependency seam and rename assertions.
52 RedisManager unit tests and all507 DU unit tests pass. Source lint passes with
explicit Web ESLint config. Ten actual isolated Redis tests pass, including the
modified native methods: ordinary write/cache-load semantics, fenced updates,
fenced reload, rename/comment state rejection, and30 cross-client primitive races.
Evidence prism-deletion-native-fence-probe.json/.log with source hashes. Diagnostic
copies rewrite imports only and expose a test-only client close hook. Initial
probe imported from /tmp without package resolution; corrected. First successful
probe left its client open; old probe processes678/689 stopped deliberately after
all nine tests had run, then corrected cleanup and ten-check run terminated0.
Synthetic keys/history-support memberships cleaned. No live DU code replacement,
no v29 image, no deletion endpoint/UI enabled. Remaining: durable Mongo/Redis
fence ordering/reload/recovery, native commit/cleanup, proposal UI and real deletion
gates. Whole goal remains incomplete; runtime still v28.

## Durable reload guard implemented and verified
DocumentController.getDocument now checks the persisted deletion reservation
before loading docstore and again after loading it. Fenced/committed reservations
return409 DOCUMENT_DELETION_PENDING without JSON/plain manuscript contents;
preparing records remain readable for snapshot validation. Database lookup errors
fail closed through the existing error handler. Private API authentication is
unchanged. Ten original/new controller tests and source/test lint pass.
Actual copied controller + isolated Mongo collection probe12640 terminal0 verifies
normal/preparing reads, JSON/plain rejection, rejection in a fresh Node process,
committed-state rejection, and readable original after test receipt cleanup.
Evidence prism-deletion-reload-probe.json/.log includes source hashes. This did NOT
restart live Redis or deploy Web/DU; copying source for the probe rewrites imports
and uses a separate test model only. No document content changed.

Remaining restart race: a write begun before a Redis restart could reach Lua
after its old marker disappears. The reload guard alone is not enough for that
in-flight write. Verified local Redis permits INFO server inside Lua (read-only
probe returned1); a server run-id captured before a document operation can be
checked atomically inside the write script. Next integrate operation context plus
primary Mongo fence lookup at DU lock entry, with server-generation checks on
writes/load, then exercise a dedicated isolated Redis restart. Native deletion
and review UI remain disabled until the full ordering/recovery protocol passes.

## Redis server-generation context implemented
DocumentDeletionFence now requires an AsyncLocalStorage operation context for all
writes and reservations. withOperation captures the Redis run_id using a key-routed
Lua call before the durable guard/read; Lua verifies the captured run_id atomically
with mutation. Nested same-doc operations cannot replace the captured generation.
RedisManager.withDocumentWriteContext checks the primary Mongo reservation state;
UpdateManager wraps both queued-edit processing and lockUpdatesAndDo in that context.
Added DU Mongo collection binding and a unit gate for guard-denied lock cleanup.
508 full DU unit tests, source lint, and11 actual isolated native Redis/Mongo checks
pass. Diagnostic imports use an isolated reservation collection and close all test
clients. Test records/keys cleaned. No application source replaced in running v28.

Dedicated test Redis real restart probe passed six checks: missing context denied,
old write/reservation rejected after restart despite matching restored snapshot,
nested token refresh denied, new durable guard denial, storage failure fail-closed,
and fresh permitted operation succeeds. Temporary Redis label/image verified and
removed; live Redis was NOT restarted. First probe hit changed auto-assigned port
on restart; preserved failure, corrected test reconnect to inspected new port.
Evidence prism-deletion-epoch-probe.json/.log; native updated hashes in
prism-deletion-native-fence-probe.json. No live handles remain.

Ordering requirement for the next coordinator: persist the durable blocking state
before the final Redis version/content CAS, so a restart cannot leave a window
where new operations bypass the durable lookup. A native delete may run only after
that CAS succeeds in a current generation. Failures after durable blocking must
remain explicitly recoverable/uncertain; do not automatically remove the durable
record while a delayed operation could still commit. Existing markFenced comments
must be updated with the coordinator contract when it is connected; the storage
primitive alone is not commit authorization. Cleanup bypass must be limited to the
verified deletion operation, not a generic ability to write fenced documents.

## Deletion coordinator checkpoint (source only)

Added internal DocumentDeletionCoordinator.mjs. It checks accepted-proposal and
access adapters, validates version/content/path under the document lock, flushes
the snapshot, persists durable denial, runs the Redis fence CAS, then records
`committing` before native commit. `committed` requires authoritative postcondition
inspection. Lost responses retain the same operation; only an exact still-preparing
intent may be released. The committing state is included in DU primary-Mongo and
Web persistence-reload guards. This is an unconnected coordinator, not an enabled
native delete: project/document lock, fence, native cleanup and inspection adapters
still require implementation and integrated crash tests.

Verified: 13 Node coordinator/store tests; 10 DocumentController tests; 508 DU unit
tests; Web lint and explicit-Web-config DU lint. Initial test lint found four
multi-variable declarations, corrected before the passing rerun. Real isolated
Mongo probes re-run with the new committing transition: cross-process recovery and
idempotent stage order pass; copied actual controller rejects JSON/plain reloads
in committing state and allows reads after the synthetic receipt is removed.
Probe records cleaned. Evidence: prism-deletion-coordinator-tests.log,
prism-deletion-coordinator-controller-tests.log, prism-deletion-coordinator-du-tests.log,
prism-deletion-reservation-probe.json and prism-deletion-reload-probe.json.

Runtime verified still v28 (image23c1b2d...), login HTTP200. No production source
replacement, no reviewed deletion endpoint/UI, no real manuscript deletion.
Next: native cleanup/reconciliation adapters, accepted proposal/UI, project/user
cleanup and actual concurrent-editor/restart/history acceptance before enabling.

## Atomic pathname fence checkpoint

Found a gap before wiring preparation: a finite project lock and an earlier path
check cannot prevent a rename between review validation and Redis reservation.
DocumentDeletionFence.reserve now requires expectedPath and atomically compares
cached pathname alongside project, version and serialized content. Existing
same-operation retries remain idempotent; different operations remain blocked.
Coordinator adapter contract now explicitly requires path comparison.

Verified actual isolated Redis/Mongo probe: 12 tests pass, including 30 rename/delete
races where exactly one operation succeeds. Native durable guard is checked for
fenced, committing and committed states with no Redis marker present. Six dedicated
Redis restart checks pass with the new argument; temporary Redis removed, live Redis
not restarted. ESLint and targeted diff checks pass. Reports retain current source
hashes. Added reproducible Python runner prism-deletion-native-fence-probe.py which
copies diagnostic modules to /tmp, uses the separate test collection and cleans
synthetic data; no live service source is replaced.

Changed source: services/document-updater/app/js/DocumentDeletionFence.js and the
coordinator contract comment. Runtime remains v28; native prepare/commit endpoints
and reviewed deletion UI remain unimplemented. Next integration must place the
whole prepare operation inside DU (drain, snapshot, flush, durable denial, Redis
CAS, committing acknowledgement), not attempt to hold a DU lock over a Web callback.
Fenced recovery cannot use normal persistence reload (intentionally blocked); it
needs an exact-operation recovery path and confirmed persisted snapshot. Do not
introduce a general write bypass to solve that restriction.

## DU-native deletion preparation implemented (not exposed)

Added services/document-updater/app/js/DocumentDeletionManager.js. Its internal
prepare(projectId, docId, operationId) reads the exact durable operation on the
Mongo primary under the native document lock and captured Redis generation.
Preparing operations drain queued updates, obtain the actual document snapshot,
check version/path/text hash, flush using native DocumentManager, persist fenced,
atomically reserve exact serialized content/path, and acknowledge committing.
History-OT hashes actual text but compares its original raw representation in Redis.
Fenced retries read cache only: no pending-edit replay, persistence reload or generic
write bypass. Missing cache remains fenced with409 for separate recovery. A stale
preparing snapshot releases only its exact preparing receipt. Lock release runs
on failure too. No route is registered; Web must authorize and create acceptance
before calling this method, then recheck permission before native commit.

Added 11 focused tests under test/unit/js/DocumentDeletionManager. Entire DU suite:
519 passing; source/test ESLint (explicit Web config) and node syntax check pass.
Evidence plan/prism-deletion-preparation-du-tests.log and
plan/prism-deletion-preparation-lint.log. Initial test run exposed VM-realm object
comparison and an invalid history-OT mock; changed to Sinon argument matching and
actual editor-core raw content. Initial suite command used the wrong cwd and did
not execute; rerun from services/document-updater passed. No native-service runtime
acceptance has yet been run for this new module, so do not equate these unit tests
with end-to-end deletion support.

Next: connect a private prepare endpoint plus Web coordinator adapter (one DU call,
not a cross-service lock callback); implement exact-operation persisted-snapshot
recovery for absent cache, idempotent native history/storage cleanup and acceptance
UI; test the whole protocol before deployment. Runtime remains v28, real projects
untouched. Overall goal remains active/incomplete.

## Private preparation transport implemented, disabled by default

Added POST /project/:project_id/doc/:doc_id/deletion/prepare in DU app.js and
HttpController.prepareDocumentDeletion. Unless Settings.documentupdater.reviewedDeletionEnabled
is exactly true, it returns404 without invoking the manager. No runtime configuration
enables it. Enabled calls require the exact existing operation; only project/doc/
operation/state are returned, never the full receipt or manuscript.400/409 return
bounded rejection codes; other failures propagate without success acknowledgement.
DU's existing service boundary is internal networking, not per-user authentication.
Web must authorize explicit acceptance before creating a receipt; this endpoint
cannot create one and is not a public Web route.

DocumentUpdaterHandler.prepareDocumentDeletion sends one bounded-time request with
the existing operation ID and validates the response against project/doc/operation
and committing/committed state. Transport failure remains uncertain; callers must
retry the same operation rather than issue a new reservation.

Verified: full DU suite523 passing (four new controller tests); Web DU-handler63
passing (three new tests, including four mismatched acknowledgement variants).
Source/test lint passes, DU app.js syntax passes. Explicit Web ESLint config cannot
lint the DU app entrypoint because its TypeScript project excludes that file; no
full app-entrypoint lint claim. Initial Web tests used Vitest rejection assertions
that conflict with the installed chai-as-promised plugin; switched those new
assertions to node:assert/strict and reran successfully with no unhandled errors.
Evidence prism-deletion-endpoint-{du,web}-tests.log and lint logs.

Changed: DU app.js, HttpController.js and its tests; Web DocumentUpdaterHandler.mjs
and its tests. Runtime remains v28; no service restart, source replacement or real
document deletion. This transport is not yet wired to accepted-proposal execution.
Next replace the coordinator's local document-lock adapter with this single DU
prepare request, then implement cache-loss recovery and native commit/reconciliation
before review UI or enabling the gate. Overall goal active/incomplete.

## Coordinator now uses service-owned preparation

Replaced the local withDocumentLock/readSnapshot/flushSnapshot/fenceDocument
callbacks in DocumentDeletionCoordinator with prepareDocument(projectId,docId,
operationId), matching DocumentUpdaterHandler's transport signature. DU now owns
all preparation semantics. Web validates response identity/state and rereads the
bound durable receipt before allowing commit. An HTTP response without persisted
committing/committed state is rejected. Preparation failure never causes Web to
remove a possibly advanced receipt. Retry after a lost response can recover the
same persisted committing operation without repeating preparation.

Updated coordinator tests to cover the service boundary; snapshot/hash/path/drain
and flush cases belong to the existing DU manager tests. Thirteen combined
coordinator/storage tests pass, including mismatched identity/state, unpersisted
success, lost preparation/commit acknowledgements and permission revocation.
Source/test ESLint and targeted diff checks pass. Evidence:
prism-deletion-transport-coordinator-tests.log and corresponding lint log.
No task instantiates the coordinator yet; native commit/inspect adapters remain
missing. Source refactor is not evidence of integrated browser deletion support.
Runtime still v28 and all deletion gates remain off.

Native commit investigation: ProjectEntityMongoUpdateHandler.deleteEntity removes
the entity and increments project version before _cleanUpEntity queues structure
history and soft-deletes docstore metadata. A crash in between loses the native
method's returned entity/path/version; simply retrying deleteEntity cannot recover
those values. ProjectManager's delete history operation is rename-doc with empty
newPathname, versioned projectVersion.subversion. Need durable commit metadata
atomically bound to the filetree removal and evidence of history deduplication
before implementing retry. Docstore patchDoc is a soft metadata update; its existence
alone does not prove history or DU cache cleanup. Next implement this native commit
receipt/reconciliation path and exact-operation cleanup, then task/UI wiring.

## Atomic project filetree removal and recovery receipt

Added DocumentDeletionProjectCommit.mjs internal collection adapter. It reads the
fully bound reservation and requires committing/committed plus exact operation UUID.
It locates the actual document inside the project tree, verifies the reviewed path,
and uses one Mongo update guarded by project version and document identity to pull
the document, increment project version, unset matching rootDoc_id and persist the
operation receipt. Receipt retains name/path/history id/project structure version,
user/snapshot identity and removal timestamp, without manuscript contents. A retry
reads the persisted receipt rather than removing again. Missing receipt for a
committed reservation, missing/renamed/ambiguous entity and unsafe project version
are conflicts. Project schema declares deletionReceipts as an internal Map with
select:false. Receipt cleanup/retention remains required before enabling the feature.

Actual isolated Mongo probe passed five checks:20 concurrent retries remove once
and preserve sibling; fresh adapter recovers and rejects wrong operation; concurrent
rename increments structure version and blocks deletion; lost update acknowledgement
recovers without another increment; fenced-only receipt cannot commit. Dedicated
prismdeletioncommitprobes and prismdeletioncommitreservationprobes collections were
used and fixture rows removed in finally. No actual project was modified. Evidence
prism-deletion-project-commit-probe.json/.log includes current source hashes; Python
runner copies diagnostic modules only to /tmp. Initial probe used a nonexistent
Mongo package entrypoint; changed to createRequire with the Web package context.
Source/model lint passes (prism-deletion-project-commit-lint.log).

This is only the filetree commit primitive. No accepted-task/HTTP caller uses it;
runtime v28 and deletion gates unchanged. Native history enqueue, docstore soft
delete, exact-operation DU cleanup, event emission and authoritative reconciliation
remain required. UpdatesProcessor.js rejects repeated incoming project structure
versions as out-of-order: merely retrying the same versioned history event is not
proven idempotent and can fail. Next implement/verify an operation-aware history
outbox/deduplication path before connecting this primitive to actual deletion.

## Reviewed deletion history producer and retry filtering

Verified existing UpdatesProcessor behavior: previously applied structure versions
are discarded, but duplicate versions inside one incoming batch are rejected before
that discard. Added exact-payload deduplication only for UUID-tagged reviewed
deletions. Tag validation requires a document deletion (empty new_pathname), doc ID,
nonempty original path and integer projectVersion.0. Same operation ID with different
payload is rejected. Already-applied tagged deletions are discarded before ordering
so a retry arriving behind a newer operation does not fail that batch. Ordinary
history ordering rejection remains unchanged. This does not fix an unqueued older
event whose newer version was allowed to overtake it; pending-outbox ordering still
must be enforced before enabling deletion.

Added internal ProjectHistoryRedisManager.queueReviewedDeletion. It reads the exact
committing/committed reservation and embedded project receipt on Mongo primary,
verifies doc/path/user/snapshot binding, and constructs the event from receipt data.
Timestamp comes from removedAt, not retry time; payload is byte-identical across
retries. No caller-supplied history version/path is accepted. The method is not yet
called by a task or HTTP route, and enqueue success is not proof of history delivery.

Full DU unit suite526 passing; full project-history suite568 passing, including six
new consumer cases and three producer cases. Source/test ESLint and targeted diff
checks pass. Evidence prism-deletion-history-producer-tests.log,
prism-deletion-history-suite.log and producer/consumer lint logs. Initial focused
consumer run passed38 tests before the final extra ordering case. No live service
source replaced, no history queue of a real project touched, runtime remains v28.

Next: enforce outstanding receipt/outbox ordering against later project structure
mutations, wire reviewed enqueue and verify actual queue-to-history processing;
then native docstore/DU cleanup and authoritative postcondition inspection. Deletion
still disabled and overall Prism goal incomplete.

## Pending history structural barrier and authoritative version response

DocumentDeletionProjectCommit now atomically sets deletionHistoryPending to its
operation ID with filetree removal/receipt and requires no existing pending marker.
All seven ProjectEntityMongoUpdateHandler.findOneAndUpdate call sites now route
through a local helper adding deletionHistoryPending:{$exists:false} to the Mongo
query. This applies even to withoutLock callers. Project schema declares the marker
select:false. No marker is cleared on enqueue acknowledgement; confirmation must
come from persisted history. Native conflict handling currently follows each
caller's existing null-result failure path; user-facing recovery UI is pending.

The native history latestVersion controller now additionally returns
projectStructureVersion from HistoryStoreManager.getMostRecentVersion's persisted
chunk metadata, separately from the ordinary history revision number. It already
processes queued updates first. A test uses history revision99 versus structure14.0
to verify the distinction. The Web acknowledgement/marker-clear adapter still needs
to be connected, and no runtime enables these source changes.

Verified:54 ProjectEntityMongoUpdateHandler tests with17 expected query filters
updated; six actual isolated Mongo checks, including pending marker blocking later
structure writes and a second deletion; full project-history569 unit tests; source/
test lint and targeted diff checks pass. Evidence prism-deletion-structure-guard-tests.log,
prism-deletion-project-commit-probe.json, prism-deletion-structure-version-history-tests.log
and corresponding lint logs. Synthetic probe records removed; original data and
runtime v28 untouched.

Remaining ordering caveat: the barrier prevents writes after the atomic deletion
commit; older structure operations already in flight before that commit still rely
on the existing project lock/history ordering. Need integrated timeout/restart and
concurrent native-structure acceptance before enabling. Next connect queue+history
confirmation to conditional marker clear, then docstore/DU cleanup and end-to-end
accepted-deletion task/UI. Overall goal remains incomplete.

## History persistence confirmation and conditional barrier release

Added DocumentDeletionHistoryConfirmation factory and concrete
DocumentDeletionHistoryService adapter. It verifies the bound committing/committed
reservation and embedded receipt, queues history through DU, then calls the native
history version endpoint. Only exact structureVersion plus matching history ID and
a valid history revision permit one Mongo update to save historyConfirmed and unset
the matching deletionHistoryPending marker. A persisted confirmation is reusable
without requeueing; it never removes a newer operation's marker. Old/new mismatched
versions or history IDs remain uncertain errors, with protection retained.

Added default-disabled DU deletion/history endpoint and Web queue transport with
exact acknowledgement validation. latestVersion now returns projectHistoryId as
well as the persisted structure version, so a reset/replacement history cannot
accidentally satisfy confirmation. No runtime configuration enables the endpoint;
no public task instantiates the full native deletion pipeline yet.

Verified:529 full DU unit tests,65 Web DU-handler tests,569 full project-history
unit tests, source/test lint and DU entrypoint syntax. Seven actual isolated Mongo
probe groups now include mismatched confirmation rejection, lost acknowledgement
recovery and preserving a different operation's marker. The probe's history/queue
callbacks are test doubles: these results verify Mongo confirmation semantics, not
actual queue delivery. Evidence prism-deletion-project-commit-probe.json plus
prism-deletion-history-confirm-{du,web,history}-tests.log and lint logs.

Source files added: WritingAssist/DocumentDeletionHistoryConfirmation.mjs and
DocumentDeletionHistoryService.mjs. Updated DU app/controller and Web DU handler,
history controller and focused tests. Synthetic database records cleaned, no
real manuscript touched, runtime remains v28. Next implement exact-operation
DU/docstore cleanup and authoritative postcondition inspection, assemble native
commit adapter, then real service/browser acceptance before enabling review UI.
Overall goal remains active/incomplete.

## Exact-operation native cache cleanup implemented

DocumentDeletionManager.cleanup now validates the exact committing/committed
reservation, embedded filetree receipt and history confirmation, confirms absence
from the current project tree (including nested folders), and checks docstore Mongo
metadata deleted:true on primary. Under the native doc lock and captured Redis
generation it retains/re-establishes the operation fence, calls native
removeDocFromMemory without flush/load/replay, then verifies cached lines/version
are absent. It returns a scoped cacheCleared acknowledgement only after checks.
No route exposes cleanup yet. No persistence contents are written by cleanup.

DocumentDeletionFence.retainForCleanup atomically refuses mismatched project/operation
and stale Redis generation while preserving a non-expiring fence after eviction.
Actual native Redis probe now passes13 tests, including retained marker after native
eviction and re-establishment when absent. Dedicated Redis restart probe passes six
checks with stale cleanup-marker establishment also rejected; temporary Redis removed.
Source hashes updated in prism-deletion-native-fence-probe.json and epoch report.

Full DU unit suite534 passing (five new cleanup tests); lint passes. Evidence
prism-deletion-cleanup-du-tests.log and prism-deletion-cleanup-lint.log. Initial
cleanup fixture inherited a Mocha context whose snapshot replacement did not affect
the parent read stub; initialized eviction stub before loading and mutated the
shared snapshot fields, then reran successfully. Tests reject restored filetree
entry, unconfirmed history, wrong snapshot, non-deleted storage and incomplete eviction.

Native eviction intentionally retains its existing cache semantics; pending edit
queue/error notification and final collaborator removal event still need explicit
integration. Docstore _tryUpdateDoc already rejects decremented versions and normal
updates do not clear the deleted flag, but full delayed-flush acceptance remains
required. Next connect Web docstore soft deletion, this cleanup route/transport,
authoritative final inspection and native event emission; then task/UI and actual
service/browser acceptance. Runtime v28 unchanged, all deletion gates still off,
no real manuscripts modified. Overall goal incomplete.

## Concrete native commit adapters and cleanup transport

Added DocumentDeletionCommitService.mjs composing atomic filetree removal, persisted
history confirmation, native DocstoreManager.deleteDoc with stable receipt name/time,
and operation-bound DU cleanup. Its final-state adapter requires the bound reservation,
matching receipt/history proof, actual tree absence and actual docstore deleted:true;
it repeats idempotent native cleanup to verify live cache state. Cache/transport errors
propagate, not boolean success. This adapter performs finalization while inspecting;
it is intentionally not a read-only status endpoint.

Added default-disabled DU deletion/cleanup endpoint and Web transport validating
project/doc/operation/cacheCleared acknowledgement. Added native removeEntity notifier.
Coordinator now marks committed before notifying and invokes notification again on
committed retries, so publication failure does not cause repeated document deletion.
A failed/unconfirmed commit never sends the success removal notification.

Verified:537 full DU unit tests;75 Web handler/commit-adapter tests;15 Node coordinator/
reservation tests; source/test lint, entrypoint syntax and targeted diff checks pass.
Evidence prism-deletion-commit-{du,web,coordinator}-tests.log and lint logs. Initial
new test imports used concatenated mock paths rejected by repository lint; replaced
with literal paths and reran. Tests cover ordered native stages, missing history/
soft-delete evidence, restored docs, failed history/cleanup, and notification retries.
These adapter tests use dependency mocks; actual cross-service deletion acceptance
is still outstanding, and no task callsite invokes the complete coordinator yet.

Next: integrate accepted deletion proposals and user/project authorization, wire
project lock and adapters, explicit pending/conflict/recovery outcomes; ensure queued
editor errors, third-party sync hooks and reservation/project cleanup are accounted
for; then isolated real-service/browser acceptance before enabling. Runtime remains
v28, deletion gates off, original installation/real papers untouched. Goal incomplete.

## Accepted-task wiring and explicit deletion review UI

Agent service now supports gated delete-document proposals only when exact removed
file content/path/version match the server snapshot. Codex adapter maps actual
workspace deletion to this typed diff; disabled Web gate still rejects it. No empty
write substitutes for deletion. On explicit acceptance AgentController constructs
the immutable intent, rechecks project write authorization and persisted applying
proposal binding, uses the native project structure lock and wires the coordinator
to preparation, commit/finalization and native notification adapters.

Deletion failure settles uncertain with DELETION_UNCERTAIN and preserves the same
proposal/operation for explicit recovery. Uncertain retries claim back to applying;
already-applying retries may converge under coordinator locking. Both reauthorize.
Reject remains a pending-proposal action only. Existing edit/create retry rules stay
unchanged. Shared AgentTaskResult displays removal content, explicit Delete file
button and Retry deletion for applying/uncertain states; busy disables repeat clicks.
The existing busy-dependent panel polling refreshes persisted status after requests.

Verified:45 Node task/coordinator/store tests;15 agent adapter/workspace/harness tests;
13 frontend deletion/conversation tests; Web source/test/UI lint, adapter syntax and
targeted diff checks pass. Added actual temporary workspace unlink -> Codex diff
mapping -> gated Web review contract test. No paid model call or production deletion
used. Initial frontend test manual cleanup triggered lint; relied on test bootstrap
cleanup instead and reran. Node service tests declare their Node runner lint exception.
Evidence prism-deletion-task-service-tests.log, prism-deletion-daemon-tests.log,
prism-deletion-review-ui-tests.log and prism-deletion-task-lint.log.

Runtime still v28; no feature gate enabled and no new image deployed. Before enabling:
protect pending deletion tasks from the existing seven-day task TTL, handle absent
history/migration prerequisites before fencing, account for native third-party hooks
and pending edit error notification, and project/user reservation cleanup. Fenced
cache-loss recovery and in-flight native structure ordering also need actual-service
gates. Then isolated full-service/browser acceptance including stale collaborator
edits, failed stages/restarts, history restoration and final combined regression.
Overall Prism goal remains active/incomplete.

## Retention for unfinished reviewed deletions

WritingAssistTask schema now declares expiresAt (default seven days) TTL rather
than createdAt TTL; original createdAt remains unchanged. Added
DocumentDeletionTaskRetention with explicit maintenance migration, readiness check,
atomic deletion claim/hold (applying + unset expiresAt + deletionRetention), and
conditional expiry restoration only after no applying/uncertain deletion proposal
remains. Agent acceptance uses retention-aware claim; execution verification holds
applying tasks again; settlement conditionally restores a seven-day retention period.
Concurrent second proposals prevent expiry restoration. No runtime migration runs
automatically on a user request, and old/unexpected TTL indexes reject deletion
before claim. Ordinary edit/create review rules remain unchanged.

Explicit migrateDeletionTaskRetention backfills ordinary expiration from original
createdAt, protects existing retained records, creates expiresAt TTL, drops only the
recognized old seven-day createdAt TTL and verifies readiness. Run with deletion
disabled before enabling the feature. This migration has NOT run on live tasks;
source schema alone is not a completed deployment migration.

Actual dedicated Mongo collection probe passed: legacy TTL blocks claim, migration
is idempotent and preserves timestamps, multiple unresolved proposals remain retained,
real TTL monitor deleted an expired control after43180ms while retaining a task with
old createdAt and unfinished deletion, and completed task expiry was restored.
Temporary collection removed. Evidence prism-deletion-task-retention-probe.json/.log
includes source hash.45 task/coordinator/storage tests and source/model/test lint pass
(prism-deletion-retention-task-tests.log, prism-deletion-retention-lint.log).

Runtime v28 tasks/indexes and real papers untouched; feature gate off. Before enabling,
run explicit retention migration on the isolated acceptance DB, complete history
preflight/native hooks/pending-edit errors/project-user cleanup and cache-loss recovery,
then build/deploy and perform actual-service/browser deletion acceptance. Goal remains
active/incomplete.

## Deletion history preflight implementation — 2026-10-31
Added read-only DocumentDeletionHistoryPreflight and concrete primary-Mongo / bounded
history HTTP adapters. New or preparing operations require history ID, ranges support,
no pending deletion, explicit resyncPending:false and matching valid history revision
before creating/fencing a reservation. Fenced/committing/committed retries skip these
new-operation checks and recover the existing operation; no resync under structure lock.
Reservations.find validates immutable binding and returns null only for absent record.
Coordinator comment now reflects task acceptance behind the disabled gate.

Verification:22 coordinator/reservation/preflight Node tests pass; targeted ESLint
passes (plan/prism-deletion-preflight-tests.log, prism-deletion-preflight-lint.log).
These are source/unit results, not live history delivery or browser deletion evidence.
Legacy projects currently receive a migration-required error; automatic native migration
outside the lock remains outstanding. Fenced cache recovery, native side effects/queues,
cleanup, in-flight structure races and actual service/browser acceptance remain pending.
Live v28, demo credentials and data unchanged. Goal remains active.

## Missing-cache Redis recovery primitive — 2026-10-31
Added DocumentDeletionFence.reserveMissingCache: generation-bound atomic check of
absent version/lines/path, matching optional project ownership and operation marker;
sets only the fence, never reloads content. Caller MUST first validate persisted
snapshot and durable fenced reservation. Not yet invoked by DU prepare.
Temporary Redis restart probe now passes9 checks including partial cache rejection,
conflicting operation, idempotence, blocked writes and old-generation recovery rejection.
Evidence:prism-deletion-epoch-probe.json/.log; targeted source lint passes.
Initial probe failed because its final ordinary-write control reused the newly fenced
document; fixed control to use a separate fresh document, preserving the recovery fence.
Temporary container removed; live Redis/runtime/data untouched.
Next: operation-bound persisted snapshot reader, then connect DU recovery and verify
actual restart/retry end-to-end. This primitive alone does not complete cache recovery.

## Persisted deletion recovery proof connected — 2026-10-31
Added DocumentDeletionRecovery.mjs read-only proof factory and private, authenticated,
feature-gated DocumentDeletionRecoveryController route at
/project/:Project_id/doc/:doc_id/deletion/:operation_id/recovery-snapshot.
Reads primary durable reservation and tree, validates fenced exact operation, path and
native docstore snapshot version/hash, rereads binding/tree after storage read. Returns
proof metadata only, never manuscript. Native getDoc supports archived content and
uses default exclude-deleted behavior; ordinary reload guard remains unchanged.
DU PersistenceManager uses exact private route, existing basic auth and5s timeout.
DocumentDeletionManager invokes proof only for fenced cache with absent lines/version,
checks proof/current reservation, then reserveMissingCache atomic generation+absence
check before advancing committing. No load, flush or pending-edit replay on this path.
Partial cache, changed proof and failed CAS remain fenced.

Verification:5 reader tests pass; fullDU544 tests pass, including4 recovery cases and
3 transport cases. Targeted lint plus router/controller syntax checks pass.
Evidence prism-deletion-recovery-reader-tests.log, prism-deletion-recovery-du-tests.log,
prism-deletion-recovery-lint.log and prism-deletion-recovery-transport-lint.log.
Test corrections: command cwd initially placed transport test under nested services;
moved only newly created file to correct test directory and removed empty mistaken dirs.
SandboxedModule needed explicit AbortSignal global; cross-realm auth object comparison
changed to scalar credential-field assertions. Final full suite passes.

Actual private HTTP+Mongo+docstore+DU/Redis restart recovery remains unverified. Need
native side effects, pending-edit errors, cleanup, legacy-history migration, structure
race gates and final browser acceptance before enable/deploy. Live v28 and fixed demo
account unchanged. Overall goal remains active/incomplete.

## Guard rejection client notification — 2026-10-31
Native deletion audit: cleanup removes root pointer, records history, soft deletes,
evicts DU, sends TPDS deletion and emits removeEntity. Reviewed path covers root/
history/storage/cache/room event; TPDS still outstanding. TpdsUpdateSender.enqueue
swallows errors, so blindly calling it cannot prove delivery or durable recovery.

Fixed UpdateManager.processOutstandingUpdatesWithLock to publish native error when
withDocumentWriteContext fails before callback. Does not pop pending edits; awaits
publication and releases lock on both guard/publication failures. Does not duplicate
errors after processing begins (applyUpdate owns those). Native real-time controller
_processErrorFromDocumentUpdater emits otUpdateError then disconnects document clients.
Browser unsent-text recovery still needs actual acceptance; do not claim it verified.

Full DU547 tests and targeted lint pass (prism-deletion-guard-notification-tests.log,
prism-deletion-guard-notification-lint.log). New tests cover rejected guard, publication
failure and no duplicate application error; queue remains untouched. Live v28 and demo
account unchanged. Pending-queue lifecycle cleanup, TPDS retry behavior and service/
browser acceptance remain outstanding; goal active.

## Actual Mongo/docstore recovery proof verification — 2026-10-31
Added reproducible prism-deletion-recovery-storage-probe.py/.mjs. It runs the current
reader source inside isolated v28 container with native DocstoreManager HTTP and
real primary Mongo fixture collection. Fresh synthetic project/doc IDs are never
inserted into user project list. Five checks pass: matching persisted content proof,
wrong operation, renamed Mongo tree, newer persisted edit, native soft-deleted doc.
Native destroyProject removes only synthetic docstore data; fixture collection dropped.
Report/log:prism-deletion-recovery-storage-probe.json/.log, includes source hashes.

Initial probe errors: native Mongo Db requires collection(name), and docker exec must
use /overleaf/services/web cwd to load web API defaults. Corrected both. Earlier failed
fixture collection prismrecoveryprobe_654fae993e364825b9375044aaae0480 had projectId
6ae5780f35ff78ffca84bdbf, no real project and zero docs; verified then removed exactly
that collection. Prefix inventory now empty. Live runtime/config and demo unaffected.

This verifies reader against actual storage, not the new private HTTP route or DU
restart end-to-end. Source remains undeployed; deletion gate off. Next gates remain
private route/auth integration, DU+Redis restart recovery, pending edit lifecycle,
TPDS retry behavior, legacy migration and browser deletion/history restore acceptance.

## Recovery private HTTP/auth acceptance — 2026-10-31
Added prism-deletion-recovery-http-probe.py/.mjs. Diagnostic loopback server inside
isolated acceptance container runs copied current recovery controller/model/reader,
native AuthenticationController.requirePrivateApiAuth, real Mongo/docstore. Uses
process-local random private credentials and gate; no settings file or live process
configuration changed. Fresh invisible synthetic project/doc/reservation removed after
verification with ownership marker and empty-docstore check. Listener closed.

Five check groups pass: no auth/browser cookie/wrong auth401; valid internal auth and
exact operation200 with metadata only; wrong operation409; disabled gate404; changed
persisted text/version409. Source router registration inspected to confirm same private
middleware ordering. Evidence prism-deletion-recovery-http-probe.json/.log includes
source+router hashes. No production credential printed or replaced.

This verifies actual handler/auth/storage over HTTP on a diagnostic listener, NOT full
new Web image deployment or DU caller after restart. Remaining: full DU+Redis restart
recovery, pending-edit lifecycle/browser text retention, TPDS retry semantics, legacy
history migration, lifecycle cleanup, structure races and final browser acceptance.
Runtime v28 and fixed demo account remain unchanged; goal active/incomplete.

## Native Redis restart recovery and cache-normalization fix — 2026-10-31
Added prism-deletion-recovery-restart-probe.py. Dedicated labelled128MB Redis on
acceptance network is seeded with cache+fence and actually restarted; live Redis is
never restarted. Diagnostic current DU manager/fence/persistence/Mongo plus native
lock/getDoc and authenticated Web recovery handler execute against actual Mongo and
HTTP docstore. Native existing getDoc/cache code is v28; changed modules copied to/tmp,
not a deployed image. Eight checks pass including same-operation committing recovery,
no content reload, retry, auth/error branches and repeatable native cache cleanup.
Cleanup history confirmation is a synthetic prerequisite, not history-service evidence.

Real test found a source bug missed by mocks: native RedisManager.getDoc normalizes
missing version to0, so null-only recovery detection rejected empty cache, and cleanup
would always report incomplete. Fixed DocumentDeletionManager: lines absent+version0
may enter proof verification, but reserveMissingCache atomically requires actual raw
version/lines/path key absence, so a real version0 key still conflicts. Cleanup now
checks raw absence through the same generation-bound primitive after native eviction.
Updated unit fixture to native {lines:null,version:0}. FullDU547 tests and lint pass:
prism-deletion-recovery-native-empty-tests.log / -lint.log.

Probe setup errors: createRequire anchored to web package could not resolve local
copied module, then core dependency was hoisted. Used absolute diagnostic module and
createRequire from DU package for dependency resolution. Failed runs cleaned synthetic
records and temporary Redis; final successful probe also cleaned both. Reports:
prism-deletion-recovery-restart-probe.json/.log, includes current source hashes.
Web source hashes rechecked against HTTP proof before adding to report.

Remaining before release: complete-image deployment/end-to-end browser deletion,
native history delivery/restoration, pending edit lifecycle and unsent text retention,
TPDS retry semantics, legacy migration and reservation/task/project lifecycle cleanup.
Runtime v28, fixed demo credentials and real papers untouched; overall goal active.

## Complete v29 candidate build started — 2026-10-31
Compared current files against full v28 manifest. No missing baseline files;43 changed/
new files copied into plan/prism-deletion-image-context by prism-deletion-build-context.py.
Includes current DU/fence/recovery, project-history processing, Web task/native helpers,
models/private routes and deletion review UI. All43 copied hashes verified against
prism-deletion-source-manifest.json. Delta base is existing local v28 tag, linux/amd64.

Initial build used43 COPY layers and hit Docker max depth; terminal session18582 exit1.
Failure log prism-deletion-image-build-layer-limit.log. Changed to one merged services
COPY, same source hashes, then restarted only after terminal failure confirmed.
Active retry unified exec session3274, caffeinate-wrapped docker build, target
 overleaf-agent-acceptance:20261031-v29, log prism-deletion-image-build.log.
Last observed Yarn dependency link stage; not a completed image or deployment.
Do not restart if observation times out: poll session3274 and inspect same build log.

Next: await build, verify image source hashes and smoke startup, then isolated runtime
acceptance. No compose/image switch performed; current demo v28 and its fixed account
remain unchanged. Reviewed deletion disabled by absent flag; production autoIndex=false,
so source TTL schema alone does not migrate live task indexes. Existing remaining gates
still apply. Goal remains active/incomplete.

## User-requested unified composer deployed — 2026-10-31
Runtime now v30, sha2567373e089c7f7f8b1ce780e105578142906e8ec07706caf55e80aacd666155711.
Based on v28 with ONLY3 frontend source changes: conversation-panel.tsx, model-controls.tsx,
agent-panel.css. Draft and toolbar share one rounded boundary; attachment/mic icons left,
compact model/effort selectors and circular send right, expandable tool panels inside.
Keyboard Escape closes panels, switching preserves draft, accessible names retained.
Updated conversation-panel frontend tests for explicit voice disclosure and draft retention.
11 frontend tests and targeted lint pass. Image source hashes verified before rollout.

Compose image changed v28->v30; existing Mongo/Redis/app volume and agent/Zotero config
preserved. Fixed private demo account successfully logged in. Browser report
prism-composer-browser.json passes4 groups: actual backend model loading, controls inside
composer, toggles/Escape/draft retention, no horizontal overflow at1440/1000/760px.
Screenshots prism-composer-1440.png/-1000.png/-760.png; visual inspection confirms unified
composer. Deployment/source manifests prism-composer-deploy.json and
prism-composer-source-manifest.json. No manuscript edits/model messages sent by UI check.

v29 deletion candidate built separately and verified43 hashes/41syntax checks but remains
undeployed. All deletion/history acceptance work remains active; do NOT replace v30 with
v29 because v29 lacks this user's composer refinement. Future combined candidate must
include current composer files. Demo credentials remain canonical0600 file, unchanged.

## Full candidate runtime initialized — 2026-10-31
Created separate compose project overleaf-deletion-acceptance using verified v29 image,
candidate-web on localhost18081, dedicated candidate Redis and app data volume, Mongo
DB prism_reviewed_deletion in existing isolated Mongo. External acceptance network only;
no user demo volume or sharelatex database reused. Main demo remains v30 at18080.
Files:prism-deletion-runtime.compose.yml, -settings.cjs, -start.py. Settings wrapper
asserts exact site+DB. Gate currently FALSE (turned off/restarted before migration).
Web login HTTP200 verified. Startup took around a minute; no service failure.

Seed script -seed.mjs/.py reused canonical demo email/password (no rotation) in the NEW
DB, creates/finds dedicated test project and explicitly creates task collection then
migrates expiry index while reviewed deletion disabled. Result -seed.json:
project6ae57d2fa2564a345a7efba6, user6ae57d2fa2564a345a7efb9f.
Private browser state ~/.local/share/overleaf-acceptance/deletion-browser-state.json0600.
No credentials in report. Main demo account/db unchanged.

Native HistoryRestorePreparation/HistoryRangesSupportMigration plus actual
preflightDeletionHistory passed against running candidate services; evidence
prism-deletion-runtime-history.json/.log. Script -history.mjs asserts project owner/name.
This proves native history readiness for that fixture, not deletion/history restoration.
Next: enable reviewed deletion ONLY in candidate settings and restart candidate Web,
create a reviewable synthetic completed task or actual model proposal, accept through
authorized Web API/browser, inspect native history and restore. Do not point user to18081
as latest UI: v29 lacks v30 composer; future combined image must include current UI.
Overall goal remains active/incomplete; no current live test handles.

## Native deletion acceptance and partial restore — 2026-10-31
Candidate gate enabled and candidate container restarted ONLY. Synthetic task created
via native addDoc+snapshot+history flush and WritingAssistTask schema, NOT model output.
Fixture task8edbed14-8f7f-4a86-a9c8-e3150c1282e3, proposal8c2a2ac0-c9ce-45f1-bbde-2d4739a91329,
old doc6ae57dc2c4cc75109179de5c, path obsolete-7b78bb02.tex. Files -runtime-task.mjs/.json.
Browser authenticated owner+CSRF accepts via real Web proposal endpoint.

Initial502 retries never fenced/deleted: native cached pathname includes leading slash,
while proposal path is relative; preparing snapshot validation released receipt. Fixed
DocumentDeletionManager to compare one normalized slash but reserve exact raw pathname.
Separate diagnostic discovered buffered Mongoose listIndexes may return Promise cursor;
retention assertReady/migration now await cursor before toArray. New driver tests2 pass,
fullDU548 pass, targeted lint passes. Two source patches copied ONLY to candidate then
appropriate services restarted. Runtime is v29+patches, not immutable release; hashes in
prism-deletion-runtime-patches.json. Removed temporary exported diagnostic controller.

Same original proposal subsequently accepted HTTP200. Authoritative verify passes5:
reservation committed, tree absence, docs.deleted=true, actual history-confirmed revision3
(project structure3.0) with cleared barrier, proposal accepted/task expiry restored.
operation7119d051-a19c-4770-911d-e03427a605de. Evidence -runtime-accept.json and -verify.json.

Native restore_file API using version2 returned200 newdoc6ae57f40216e76100d2e772a.
Actual docstore read confirms lines ['This chapter is obsolete.'],version0. Browser tree
shows restored filename, but CodeMirror remains Loading; -runtime-restore.json passed=false.
Do NOT re-run restore POST blindly (would create duplicate); reuse restored doc for UI
loading diagnosis. Also direct HistoryManager.getContentAtVersion diagnostic failed401
jwt missing at history-v1 (log -history-snapshots.log); this did not prove snapshot deletion.
Need inspect canonical history export/proxy API before altering auth. Native restore uses
supported file export and DID succeed. Current candidate DU logs show an old fenced flush
error during deletion, not evidence of the restored-document load failure.

Next: diagnose restored editor load and prove historical before/after contents via proper
service route, then actual model-generated deletion UI and race/restart regression.
Source fixes require next immutable combined image retaining v30 composer. User demo v30,
fixed credentials and real project data unchanged. Overall goal active/incomplete.

## Restored document browser persistence — 2026-10-31
Native historical paths proof passes: version2 contains obsolete-7b78bb02.tex;
version3 omits it (plan/prism-deletion-history-paths.json). Fresh browser original
content read passes (prism-deletion-restored-editor.json). No repeat restore POST.

Actual two-context persistence test added: plan/prism-deletion-restored-save.py.
Initial run reproduced startup-switch failure: contents visible but Error opening
document modal blocks editing; failure JSON/log/screenshot preserved as
prism-deletion-restored-save-initial-failure.*. No source fix claimed.
After waiting for initial CodeMirror before switching, test passes two checks:
restored file edit reaches independent browser; both retain marker after reload
without compile. Evidence prism-deletion-restored-save.json/.log/.png.
Only synthetic restored document changed (appended percent-comment marker).
No real paper or user demo changed. Candidate remains v29 plus two prior patches,
demo18080 remains v30. Test observed legacy /writing-assist/check HTTP500 and
/changes/users404, so report passed means persistence only, not all service health.

Next: fix stale document-open response handling with focused regression; investigate
candidate legacy checker500; actual model-generated deletion review acceptance;
combined immutable build retaining v30 composer and broader acceptance remain.
Overall goal incomplete. All browser processes from these tests terminal.

## Superseded editor join fix — 2026-10-31
Previous goal turn was progress (real restored-file collaborative persistence proof).
Revalidated callback handling: doOpenNewDocument rejected a join error before checking
its epoch. A superseded join can return JoinLeaveEpochMismatchError and incorrectly
show Error opening document even after a newer document has loaded.
Extracted joinCurrentDocument helper; check current epoch before error reporting;
failed stale join does not issue leave, successful stale join keeps existing cleanup;
current errors remain errors. Context binds events only for current successful join.
Files: services/web/frontend/js/features/ide-react/editor/join-current-document.ts,
context/editor-manager-context.tsx, test/frontend/features/ide-react/join-current-document.test.ts.
Four focused callback-order tests pass; targeted ESLint and diff check pass. Reports:
plan/prism-editor-join-tests.log and prism-editor-join-lint.log. Source only: runtime
browser fast-switch regression still required after next combined frontend build.

Candidate legacy checker500 diagnosed from native Web log as API key not configured,
not deletion corruption. New candidate account used default blank custom provider.
Configure only candidate account through authenticated config API to provider agent,
timeout60000, concurrency1; no client API key and no password changes. Verification
script plan/prism-deletion-checker-config.py uses native204 config response, then
real check request. Initial script incorrectly expected200 on config and stopped;
corrected before the actual check. See resulting JSON/log for final status.
Next: combined immutable image with composer+join fix+deletion changes, browser
rapid-switch regression and actual model-generated deletion review. Overall incomplete.

Candidate checker final verification passed: config PUT204, actual /writing-assist/check200 with one issue via agent provider. Evidence plan/prism-deletion-checker-config.json. This resolves candidate blank-provider configuration only; user demo18080 and fixed credentials unchanged. Join fix remains source-only pending build/browser proof.

## Combined v31 candidate verified — 2026-10-31
Build terminal0: overleaf-agent-acceptance:20261031-v31, image sha256
dd7a74206e9b1cff949955f718dcd8c471ed7e7b09bee473aed5b93331efc1d0.
Frozen48-file delta from v28 includes composer, deletion fixes and editor join fix.
Manifest plan/prism-combined-source-manifest.json; build log prism-combined-build.log.
All48 copied source hashes verified inside image before candidate-only deploy.
Canonical candidate compose now plan/prism-combined-runtime.compose.yml; older
prism-deletion-runtime.compose.yml still names v29 and must not be reused for upgrade.
Candidate volume/database/Redis preserved; no hot patches needed. Demo18080 remainsv30.

15 combined frontend tests pass (prism-combined-frontend-tests.log). Actual v31
rapid-switch browser test passes5 startup rounds and15 rapid-switch pairs, no error
modal or JS errors (prism-editor-switch-browser.json/.png). Screenshot inspected:
unified composer retained. This verifies reproduction scenario; not every possible
socket race. Restored document two-context edits/reloads also pass on v31
(prism-combined-restored-save.json/.log/.png). Only synthetic file comment appended.
No checker500 in that run; two native changes/users404 still observed.

Next: real model-generated deletion review/accept/reject and interrupted-operation
regression on immutable candidate. Host Codex daemon may still load older backend
source; verify/reload safely without interrupting active tasks before model test.
Remaining broader deletion lifecycle/TPDS and final capability audit unchanged.
Overall goal active/incomplete; all build/deploy/browser handles terminal.

## Real Codex deletion review and restore — 2026-10-31
Previous turn progressed: combinedv31 build and browser checks. Live authenticated
daemon health running0/max1 before controlled restart. Restart with source hashes
from combined manifest preserved private token, compiler pin and speech config:
oldPID16531 -> newPID47068, documentHarness/speech true, running0. Evidence
plan/prism-combined-harness-restart.py/.log and prism-harness-restart.json.

Created ONLY two synthetic native docs in candidate project6ae57d2fa2564a345a7efba6:
model-delete-accept-ec29abfb.tex oldID6ae583ce330e26dad857340d and
model-delete-reject-ec29abfb.tex ID6ae583ce330e26dad8573414. Seed creates files only,
NOT tasks/proposals. Browser submitted actual instruction with model catalog selection
and medium effort; real backend generated two delete-document proposals.
Task55b774f3-03cc-434c-8a4e-94766b4466ba, accepted proposal60241ba1-5d78-4dd0-8457-7ac87e8513bc.
Browser proves files intact before review, rejected file retained, accepted file removed
from live tree. Evidence prism-model-deletion-browser.json/.log and review/accepted.png.

Authoritative check passes: committed reservation5f262bbc-9698-4021-aa04-cd12d894aace,
accepted olddoc native softdeleted/tree absent, historyconfirmed version9 structure7.0,
pending barrier cleared, task normal expiry restored. Rejected proposal statusrejected,
filetree/docs retained and no reservation. Evidence prism-model-deletion-verify.json.
Native history paths at8 contain both; at9 omit only accepted file. Evidence
prism-model-deletion-history.json. Initial browser history-path preflight used wrong
service route and stopped BEFORE restorePOST; preserved -restore-preflight-failure.json.
Canonical project-history service route verifies correct historical paths.
Native restore_file POST version8 succeeds200 newdoc6ae5845f1d953cfc28ea16a0; browser
loads original 'Synthetic deletion review fixture: accept.' Evidence
prism-model-deletion-restore.json/.log and -restored.png. Do NOT rerun restorePOST: file
is restored already. Report presence guard prevents accidental duplicate execution.

User demo18080 staysv30 with stablecredentials; candidate18081v31. Host daemon updated
while idle and is shared with both. No real manuscript changed. Overall incomplete.
Next: interrupted-operation and permission/conflict race integration; lifecycle cleanup
and TPDS claim boundary; final combined capability audit before demo rollout.
All foreground test handles terminal; host daemon47068 intentionally persistent.

## Stale deletion conflict integration and v32 — 2026-10-31
Synthetic proposal bcbd7e43-3342-4975-84f2-52f91943b192 /
12fc18bc-6265-4e32-816e-2dad339376f2 for obsolete-4d2cc09c.tex
doc6ae584b8bcfddf40a2457a6c. Native browser edit after snapshot reaches second
session; old acceptance does not delete. Initial v31 returned502 uncertain, misleading
retry despite DU having released preparing reservation on snapshot mismatch. Evidence
prism-deletion-conflict-browser-before-fix.json/.log/.png.

Coordinator now recognizes ONLY explicit DU409 + preparing entry + authoritative
reservation absence under project lock as DELETION_SNAPSHOT_CONFLICT. Does not release
any reservation itself; retained/fenced receipt or transport failure remains uncertain.
Service settles proven abort as conflict409, restoring normal retention via existing
settle hook. Changed DocumentDeletionCoordinator.mjs and WritingAssistAgentService.mjs.
Added coordinator/service regressions;45 tests pass, targeted ESLint passes.

Immutable candidatev32 basedv31, two source hashes verified; image
sha256:441c9bb3cacd7fd7ef2128edb19856b651da55ddb21cd65ffa99744794ced3e3.
Canonical candidate compose plan/prism-conflict-runtime.compose.yml. User demo v30
unchanged. Reports prism-conflict-source-manifest.json/build.log/candidate-deploy.json.
Actual same-proposal retry after another native edit returns409 with regenerate
message, settles conflict, file and latest content survive both browsers reloading.
Evidence prism-deletion-conflict-browser.json/.log/.png; authoritative check
prism-deletion-conflict-verify.json proves no reservation, live file, no history barrier,
conflict status and normal task expiry restored. Only synthetic file comments changed.

Next: permission-change and interrupted-operation integration; deletion lifecycle/
third-party sync boundary and final overall audit. Overall active/incomplete.
All foreground handles terminal. Persistent Codex daemon47068 remains.

## Lost client response and review readback — 2026-10-31
Actual v32 candidate deletion request forwarded using Playwright route.fetch, real
server returned200, then route.abort(connectionreset) intentionally hid successful
response from browser. Same proposal retry returns409 already-reviewed; authoritative
task read saysaccepted. Native receipt/history before and after retry identical,
file stays absent after reload. Evidence prism-deletion-lost-response-browser.json
and .log (includes fixture IDs and beforeRetry/afterRetry native verification).
Synthetic fixture only; this tests lost browser response AFTER complete servercommit,
NOT crash between commit stages. Do not conflate with full interruption coverage.

Found UI gap: act error catch only showed error. Added single read-only task GET after
proposal decision error in conversation-panel.tsx and agent-panel.tsx; refresh task
state and clear error only if matching proposal has expected accepted/rejectedstatus.
Never resend mutation automatically; if readback fails preserve original error.
Added response-loss regression in both panel test files.16 frontend tests pass
(prism-review-readback-tests.log). Full targeted lint reports4 existing violations:
two noninteractive tabindex in agent-panel and manual cleanup imports in both tests.
Focused lint with those two rule exceptions passes (prism-review-readback-focused-lint.log).
These frontend changes are SOURCE ONLY, not yet built/deployed; candidate stillv32,
demo18080v30, stablecredentials unchanged.

Next: build combined frontend preserving composer, native browser conversation UI
response-loss test, permissions and mid-operation restart integration; lifecycle/
third-party sync boundary and final capability audit remain. Overall incomplete.
All test handles terminal; Codex daemon47068 remains persistent.

## v33 browser response-loss readback accepted — 2026-10-31
Immutablev33 image sha256:78413d03d44c15474e912745d433cd5fb8c9c0c5199de5f0c7dab7813483956b.
All49 changed source hashes verified before deploy to candidate18081 only; current
compose plan/prism-readback-runtime.compose.yml. Reports prism-readback-build.log,
prism-readback-source-manifest.json, prism-readback-candidate-deploy.json.

Fresh native model fixtures model-delete-{accept,reject}-144f92aa.tex. First attempt
failed admission with Local agent is busy (no deletion proposals); failure preserved
in prism-readback-browser-busy-failure.json/.log. Candidate realtime checker enabled
was competing for single daemon slot. After verifying actual daemon idle, disabled
checker only for test, started new conversation and ran real model again.
Task ac5f7c15-136a-4f53-b16c-ad0163473b5d. Browser rejects one proposal; accepts other
through actual conversation UI while route.fetch forwards decision then discards200
with connectionreset. Actual UI makes exactly ONE decisionPOST and ONE direct taskGET,
shows accepted, removes error, keeps rejected file. Evidence prism-readback-browser.json
and prism-readback-accepted.png. Native verification confirms committed reservation,
history receipt, task expiry, olddoc softdelete, rejectedfile preserved/noreservation:
prism-readback-verify.json. Candidate prior checker preference restored/verified via
API (prism-readback-config-restored.json).

This proves real conversation UI response loss AFTER servercommit. Mid-stage server
crash and permission revocation integration are separate remaining gates, as are
lifecycle cleanup/third-party-sync claim boundary and final full compatibility audit.
Demo18080 v30 with stablecredentials remains unchanged; candidate18081 v33.
Overall active/incomplete; all foreground handles terminal; daemon47068 persistent.

## Native permission revocation acceptance — 2026-10-31
Previous turn progressed: v33 real conversation response-readback passed. Reused
candidatev33 and synthetic project only. Added fixed isolated reviewer identity
prism-permission-reviewer@acceptance.invalid with private stable credential record
~/.local/share/overleaf-acceptance/permission-reviewer.json (0600); main demo login
unchanged. Native registration/membership methods used, no invitation email sent.
Reviewer user6ae5886dc0a20fb889ab87c1 initially write-authorized. Synthetic pending
taskb890e56f-26dd-420f-af37-15d4e3e2fd80, proposale5a49d64-9798-4cf1-8783-86e3b84b8e96,
doc6ae5886ec0a20fb889ab87cb obsolete-7c558911.tex. This proposal is synthetic, not
an additional model-generation claim (that path was separately verified).

Authenticated browser can read its task before revocation. Native collaborator
privilege changed to readOnly; AuthorizationManager confirms canWritefalse. Same
logged-in browser acceptance returns403. Authoritative Mongo verification confirms
proposalstillpending, no reservation, live doc and no historypending barrier. Browser
reload still shows original content. Finally restores readAndWrite and native
authorization confirms true. Evidence plan/prism-deletion-permission-browser.json/.log;
seed/control/browser scripts retained for reproducibility.

This covers revocation BEFORE acceptance request, not a permission change while a
commit is in flight. Such mid-operation and service-restart integration remain.
Synthetic pending task/file retained for further testing, normal expiration applies.
No source/runtime deployment change; candidate18081v33/demo18080v30 unchanged.
All test handles terminal; host Codex daemon47068 persistent. Overall incomplete.

## Native prepared checkpoint survives application restart — 2026-10-31
Previous turn progressed: before-request permission revocation browser gate passed.
Created synthetic task53614f32-c109-47c3-8548-b51b9a91ada8, proposal
fda74af4-8719-42f5-959c-7c7431e2632f, doc6ae58905778056e3fcb872a8
obsolete-3f0ddae1.tex. Native retention claim -> bound reservation -> actual DU
prepare establishes committing checkpoint. Task remainsapplying, retentiontrue, no
expiry. Operation6bb6d941-f531-4cc3-89b3-880b99bd62ae recorded BEFORE restart.
Evidence prism-deletion-restart-stage.mjs/.json/.log. Synthetic fixture staged directly
using production primitives; not an intercepted live model acceptance request.

Restarted ONLY overleaf-deletion-acceptance-candidate-web-1 v33, restarting Web/DU/
real-time etc. Container StartedAt changed06:15:18 ->06:22:20 UTC; evidence
prism-deletion-restart-container.json. Mongo/Redis/demo untouched. Not SIGKILL and
not random instruction-boundary crash. Real browser authenticates after restart,
reads same applying task and retries originalproposal; firstPOST200. Evidence
prism-deletion-restart-accept.json/.log. Native verification confirms SAME operationID,
committed reservation, olddoc removed/softdeleted, historyconfirmed version21, no
pending barrier and ordinary task expiry restored: prism-deletion-restart-verify.json.
Demo18080 login200 rechecked; fixed credentials unchanged.

This closes application restart recovery at the durably prepared checkpoint.
Redis-loss recovery was separately tested in lower-level probes; integrated staged
permission recheck, commit-boundary fault injection, lifecycle cleanup, third-party
sync boundary and final combined acceptance audit remain. Overall incomplete.
All foreground handles terminal; daemon47068 persistent. Candidate18081v33.

## Authorization recheck for prepared deletion recovery — 2026-10-31
Reused prior reviewer pending taskb890e56f-26dd-420f-af37-15d4e3e2fd80 and
proposale5a49d64-9798-4cf1-8783-86e3b84b8e96 (no new account/password).
Native retention claim and DU prepare advance bound operation
2e4a1043-002d-4f4d-81ab-bb48ee3874d1 to committing for doc6ae5886ec0a20fb889ab87cb
obsolete-7c558911.tex. Source staging assertions verify reviewer role, taskownership
and full proposal binding. Evidence prism-deletion-permission-stage.json/.log.

Native role changed write->readonly AFTER preparation. Authenticated browser
recoveryPOST403; primary state check confirms taskapplying/retentiontrue/noexpiry,
samecommittingreservation, doclive/nohistorybarrier. Original role restored infinally;
sameproposal recoveryPOST200 accepted. Evidence
prism-deletion-permission-prepared-browser.json/.log and -prepared-control.mjs.
Final native verification confirms SAMEoperationID, committed delete, acknowledged
history, pendingbarriercleared and tasknormalexpiry: -prepared-verify.json/.log.

This covers authorization revocation across a durably prepared recovery checkpoint,
not a precisely synchronized revocation during an individual commit RPC.
Original pending synthetic file is now intentionally deleted by resumed acceptance.
Candidatev33/demo v30 and stable credentials unchanged. No source edits/deployment.
All test handles terminal, daemon47068 persistent. Overall goal incomplete.
Next: deletion record/task cleanup through native project/user lifecycle, remaining
commit-boundary fault coverage and final combined capability audit.

## Terminal deletion receipt cleanup on project expiration — 2026-10-31
Audit: native UserDeleter invokes ProjectDeleter.deleteUsersProjects; assistant
tasks/conversations already removed on permanent project expiration. Newly added
DocumentDeletionReservation records were omitted. Updated ProjectDeleter.mjs to
delete ONLY {projectId, state:committed} AFTER all native docstore/history/chat/hooks
expiration promises resolve, BEFORE marking DeletedProject.project null. This keeps
failed cleanup retryable and does not remove active/soft-deleted project records or
unresolved write fences. No account records or existing projects were deleted.

ProjectDeleter.test.mjs mocks new model and verifies project/state scope, active
project no-op, native storage failure retains reservations, and reservation cleanup
failure does not mark expiration complete.39 tests pass, targeted ESLint passes.
Evidence prism-deletion-lifecycle-tests.log and prism-deletion-lifecycle-lint.log.
An initial test assertion used Vitest rejects with existing chai-as-promised setup
and failed; corrected to existing to.be.rejectedWith convention, full suite passes.

SOURCE ONLY, not in candidatev33 or demo v30. This is terminal receipt cleanup, NOT
full unresolved-reservation/project/account teardown. Remaining unresolved records
must keep protection until delayed writes cannot act; do not mass-delete them by
user/project merely to make a cleanup test pass. Next: native isolated expiration
integration and resolve unfinished-operation lifecycle policy before combinedbuild.
Overall incomplete. All test handles terminal; daemon47068 persistent.

## Native terminal-receipt expiration acceptance — 2026-10-31
Modified ProjectDeleter source loaded under isolated diagnostic module alias, not
replacing the running Web module. Created only two disposable projects:
6ae58b09ecba15ecdbd49934 target and6ae58b09ecba15ecdbd4993f control, names
Prism lifecycle fixture c2ebd7c9-a8ee-4f76-b447-3477462539d9 {target,control}.
Inserted synthetic committed/fenced lifecycle rows referring to nonexistent docs,
not real pending deletion tasks. Native active-project expiration preserves all rows.
Native softdelete+permanentexpire then proves target committed removal, unresolved
target retention and controlproject/record preservation. Finally removes exact
fake fence (no doc/task/writer ever existed) and natively expires controlproject.
No fixture reservations remain; deletedproject tombstones have projectnull.
Report plan/prism-deletion-lifecycle-native.json:4 checks pass, sourceSHA256
7954edab22ab0d15a3d6602fa1bdb060150bcc080b46c8deff13c8da2b7326ce.
Scripts -lifecycle-native.mjs and -lifecycle-resume.mjs; successful log
prism-deletion-lifecycle-resume-authenticated.log. Diagnostic module alias removed
from container after completion; running candidate remains immutablev33.

Initial probe failed history-v1 DELETE401 after softdelete; no terminal reservation
cleanup occurred. Preserved -native-without-service-env.json and native/resume logs.
Root cause: dockerexec diagnostic does not inherit PID1-generated service secrets;
/etc/overleaf/env.sh alone does not load STAGING_PASSWORD. Native Web startup does
receive it from /etc/container_environment/STAGING_PASSWORD. Loaded this one private
value into diagnostic process.env without logging it; sameprojects resumed and passed.
Thus no product authentication flaw established. Previous direct history-v1 diagnostic
401 results may share this environment cause; do not weaken auth to make probes pass.

Terminal cleanup implementation still source-only, not deployed. Full unresolved
reservation/account teardown policy remains incomplete and intentionally preserves
fences. Next: design/drain unfinished operations before permanent cleanup and then
combined build/acceptance. Main demo18080v30, candidate18081v33, fixedcredentials
unchanged. All foreground handles terminal; daemon47068 persistent.

## Preserve recovery artifacts before permanent expiration — 2026-10-31
Previous native terminal-only cleanup could retain fence but remove recoverytasks
and projectmetadata. Added primary DocumentDeletionReservation preflight before any
permanent storage/task/history cleanup: any state other thancommitted yields
PENDING_DOCUMENT_DELETION409; lookupfailure also stops all sideeffects.
ProjectDeleter.mjs and ProjectDeleter.test.mjs changed;43 tests and targetedlint pass.
Evidence prism-deletion-lifecycle-guard-tests.log and -guard-lint.log.

Actual native integration loaded source as temporary module alias, with generated
service credential privately loaded. Two new disposableprojects
6ae58c8f2071017fd4c1d4f4 target /6ae58c8f2071017fd4c1d4ff control, names
Prism lifecycle fixture f578ec34-28fd-4ab2-8493-91b05db2a67d {target,control}.
Synthetic fencedrow with retainedtask (no real accepted op or worker) blocks target
expiration after native softdelete. Verified DeletedProject.project retained, task
retentiontrue, native Docstore.getDoc still returns original fixturecontent, all
reservations intact. Then removed ONLY exact syntheticfence whose doc neverexisted;
nativeexpiration succeeds, cleans task/committedrow, control remains intact. Finally
expires control; no fixture reservations remain. Five checks pass in
prism-deletion-lifecycle-guard-native.json/.log; sourceSHA256
2c798c5535844bd7f515a4cd84c0cba25496f20d17c047843b09750ce404894e.
Temporary modulealias removed after run. Main Web not patched; sourceonlychange.

This is recovery-data preservation, NOT automatic drain/reconciliation of actual
unresolved operations. Native guard intentionally leaves such projectsexpirable
only after reconciliation; that mechanism still needs work. Older terminal-only
nativecheckpoint is superseded by stronger guard behavior. Candidate18081v33 and
demo18080v30/fixedcredentials unchanged. Overall incomplete. All tests terminal.
Next: define implementable recovery for interrupted operations in project teardown,
then immutable combined build and full compatibility audit.

## Internal project teardown recovery engine — 2026-10-31
New source DocumentDeletionTeardown.mjs exports dependency-injected orchestrator.
Whole-project authorization + project lock required. Enumerates existing reservations,
checks task ownership/project/completion, accepted applying/uncertain proposal, doc/path/
version/fullcontenthash and operation binding, holds task, reauthorizes teardown,
resumes EXACT existing operation, rereads committed receipt and task settlement.
Never executes pending suggestions or allocates new operation identities. Known
preparing snapshot conflict only settles after reservation absence; later-stage
conflict/transport errors retain recovery state. A committedreceipt with applying
task is revisited so lost commitresponse can still settle the task on retry.

Ten Node tests pass including sameID completion, uncertainclaim, expired terminal
task, mismatched/unreviewed proposal, foreignproject, revoked authority, lostresponse,
wrong committedidentity, preparing/later conflicts and retryclaimfailure. Targeted
ESLint passes. Evidence prism-deletion-teardown-tests.log and -teardown-lint.log.
Files services/web/app/src/Features/WritingAssist/DocumentDeletionTeardown.mjs and
services/web/test/agent/document-deletion-teardown.test.mjs. No runtime effect yet.

NOT WIRED to ProjectDeleter yet. Native adapter must provide existing-only recovery
under same project lock; never nest coordinator lock or allow missing receipt to
create new operation. Native deleteProject currently no project lock and account
deleteUsersProjects passes reason but no deleterUser; integration must preserve
whole-project owner/admin/internal teardown authority, prevent new accepted tasks
entering between drain and project removal, and retain durable guard beyond lockTTL.
Use AuthorizationManager.canUserAdminProject for actor-scoped authorization; current
controller passes options.deleterUser, account path has owner userId. Do not infer
original collaborator write access as whole-project deletion authority.

Candidate18081v33/demo18080v30/fixedcredentials unchanged. Overall incomplete.
Next implement concrete adapters and integration with authorized project lifecycle,
then test interrupted recovery and native teardown end-to-end. All tests terminal.

## Native existing-operation teardown recovery adapter — 2026-10-31
Coordinator now accepts optional existingOperationId; missing or different durable
receipt rejects409 before historypreflight or newreservation creation. Legacy normal
acceptance unchanged. Added two coordinator tests. New
DocumentDeletionTeardownService.mjs implements native adapters for internal recovery:
current canUserAdminProject with accesscache cleared, outer projectstructurelock,
primary task/reservation reads, task retention/retry/settle, exact snapshot validation,
existing-only coordinator with no nested lock, native DU/history/storage/notification.
26 coordinator+teardown tests pass and targetedlint passes; logs
prism-deletion-teardown-adapter-tests.log and -adapter-lint.log.

Native diagnostic aliases loaded source without patching running Web. Synthetic
taskf737e429-89a1-48e3-9bd3-927e4ad2a7e6/proposal32d73003-a567-458c-bf7b-b56b3e22fa3a,
doc6ae58e573a5b9d31592402bc obsolete-2b91a219.tex staged through actual DUprepare.
Write collaborator reviewer rejected403 for whole-project recovery. Owner adapter
resumes and commits SAMEoperation50f0dc68-5f6b-42ca-957e-12bab89a59e4; resultcompleted1.
Task accepted and normalexpiry restored. Native history/filetree/docstore/barrier
checks pass in prism-deletion-teardown-native-verify.json, adapter evidence
prism-deletion-teardown-native.json/.log. All three diagnostic modulealiases removed.

NOT integrated into native deleteProject yet. Calling drain then normaldelete without
a durable admission boundary would allow new accepted deletion in the gap; do not
claim project-removal atomicity or lifecyclecompletion. Next: durable teardown intent
and guarded admission, current authorization through full project-removal operation,
restore/failedteardown handling, then native lifecycleintegration and combinedbuild.
Source-only newservice/coordinatorchange; candidate18081v33 and demo18080v30 unchanged.
All foreground tests terminal, daemon47068 persistent. Overall goal incomplete.

## Project admission Mongo proof and stable reservation IDs
Real Mongo probe in unique temporary collection passed 50 concurrent admission/closure
races, duplicate retries, conflicting bindings, closed gate across fresh adapters,
exact release, missing/malformed identities and lost response recovery. Collection
removed and three diagnostic files removed from candidate; no live project changes.
Evidence: plan/prism-project-admission-native.json and reproducible .mjs probe.
Reservation begin now optionally accepts a validated persisted-ticket operationId,
refuses mismatching existing operation IDs, and preserves the admitted identity after
lost replies. 33 reservation/coordinator/teardown tests passed; evidence
plan/prism-project-admission-reservation-tests.log. Admission caller integration,
project lifecycle close/drain/removal and restore are STILL NOT implemented/deployed.
User question about model menu prompted live per-model harness smoke test; report
plan/prism-all-models-smoke.json. Do not conflate catalog availability with inference.

## Live model-menu availability check
User asked whether eight model choices are functional. Fresh Codex model/list supplied
eight entries. Sequential real document-harness calls succeeded for all eight at low
effort; thread/start confirmed each requested model ID, turn/start received low,
all replies MODEL_OK and no file changes. Individual latency 4.7–6.3 seconds.
Evidence: plan/prism-all-models-smoke.json/.log and reproducible .mjs. Source trace
confirms conversation selection -> Web agent service -> daemon task -> backend ->
Codex thread/start model and turn/start effort. This is current account connectivity,
NOT all-effort/tool capability testing or independent verification of provider internals.
Project-admission targeted lint also passed. No deployment or credential change.

## v35 selection menu and line-diff review deployed
User demo18080 now image overleaf-agent-acceptance:20261031-v35,
sha256 ff4605f4451c9220a5c6ee57733e28381435b88ed588a292a67b3645f934b09f.
Eight frontend file hashes verified; basev30 backend retained, no lifecycle WIP.
Single selection menu, collapsed secondary controls, labelled buttons/Escape handling.
Shared ProposalDiff supplies old/new line numbers, red/green +/- rows, bounded word
highlights for paired equal-length replacement blocks, context folding and newline
notice. Conversation file cards and expanded OLModal review, user/status/summary
separation; selection popup shares same renderer. This is NOT source-editor inline
Keep/Undo nor automatic writeback. Explicit accept/reject/version checks retained.
29 targeted frontend tests pass; diff/menu lint passes. git diff --check reports only
one extra trailing blank line in preview-react.tsx; no full repo clean/typecheck claim.
Actual saved conversation browser review passed three widths1440/1000/760 with
zero proposalPOSTs, no browser errors and unchanged manuscript; modal screenshots
retaken after fade transition. Menu browser pass samewidths; initial parallel login
failed transiently (preserved initialfailure JSON/PNG), sequentiallogin passed with
samecredentials. Sources/evidence: prism-review-diff-{source-manifest,deploy,browser}.json,
prism-selection-menu-browser.json, screenshots prism-review-diff-expanded-1000.png
and prism-selection-menu-1000.png. v34initial build not deployed. Candidate18081v33,
originalinstallation, fixedcredentials, manuscript and backendunchanged.
Next overall work: complete admission/lifecycle integration, combined regression;
Zotero positiveauth remains unavailable. Goal remains active/incomplete.

## v36 source-position selection review accepted
Demo18080 now overleaf-agent-acceptance:20261031-v36,
sha256 dce51f3dd44dbb0b3653dcaf6227da625582dc9f8ebc575ad1b259a45e03bdda.
Four source hashes verified against image; basev35 frontend preserved, no backend
or credentials change. Selection preview becomes a non-editable CodeMirror block
below selected source; original selection marked; loading/error remain tooltips.
Shared line/word diff, accept/reject, original-text check and doc-change invalidation.
Widget roots explicitly unmount in microtask. Suspected equivalent-widget cleanup
risk was checked, NOT reproduced: added reuse cleanup test passes without fix.
6 inline/stale tests plus later4-test inline run (including cleanup) pass;7 unique
checks total; targeted lint passes. Model browser fixture project6ae596bc2f76a5ab468096b3
created using native snippet API for fixed syntheticowner; real transform responses
200 twice, exact shows->show output; reject preserves source, accept changes selected
text, native platform Undo plusreload confirms original persisted.3widths pass.
Evidence prism-inline-selection-browser.json/.log; screenshots -1440/-1000/-760.png;
source manifest/deploy JSON. Initial browser check incorrectly reconstructed source
from rendered cm-line DOM (block widgets split visual lines); retained initialfailure,
corrected verifier to read CodeMirror document state, rerun passed. No product change
needed for that assertion. Test page alone intercepted automatic grammar checks to
avoid competing daemon jobs; transform backend real, global user settings unchanged.
This covers SELECTION workflow only; conversation proposals still use file cards/modal,
not source-position inline review. No automatic apply / Keep semantics claimed.
Main user project not modified; fixture restored; originalinstallation/candidatev33
untouched. Overall goal active: integrate conversation source review, finish deletion
lifecycle admission, combined regression, Zotero positiveauth pending credentials.

## v37 conversation proposal source review verified; v38 polish building
New agent-editor-review extension renders a non-mutating block at first changedline.
Review in editor is offered only pending existing textdoc proposals withdocId;
AssistantDock opens by nativeopenDocWithId, waits for current identity/contentmatch,
then shows block. isCurrent checks proposal/task, source docidentity and navigation
sequence; edits clear block. Buttons invoke original conversation decision callback,
never write CodeMirror source directly. Inflightguard prevents double submits;
unconfirmed results remain visible. Conversations clear obsolete previews; async open
is invalidated on navigation/projectcleanup. No creation/deletion inlinecontrol.

Actual native syntheticproject6ae599dc85fa3d9374b10e31, conversation
fc5ea71d-c1c7-423c-a9d9-add4ae0e5051, task379b97a9-0f81-4d0a-9764-7a0b9a64e58d,
proposalb2459a11-d427-4ca3-9058-b206542ad3e7: realCodex changed notes.tex;
UI startedonmain.tex, openednotesbyidentity;3widthscreens pass. No writebeforeaccept,
one originalproposal POSTaccepttrue, nativecollaborativeupdate and reloadconfirmed.
Evidence prism-agent-inline-browser.json and screenshots. Fixture intentionally retains
accepted change; do not rerun creation or task blindly. Mainuserproject unchanged.
Runtimev37 sha2565dd458bdeb0aa74e9d02e9f641df733a114f788ea5e1a1a09a10ebef01bc16c2,
five sourcehashesverified. Full typecheck found unsupported title frompriorcomposer
and invalid exactoptions in frontend rolequeries; fixedsourceprop andtestqueries.
Finaltypecheck retains13 existingmodule/nullabilityerrors, no newlyintroducederrors.
37 combinedreviewfrontendtests pass; sourceinline targetedlint passes. JSDOM emits
TimeoutNaNWarning for scrollgeometry; actualbrowser reportsnoJSerrors.
Two diagnostic commands used repo-relativepaths under services/webcwd andfailedbefore
edits; correctedtoabsolutepaths. v38 contains onlytitlecleanup andsecondaryReject/Close
buttons, buildsfromv37. Do not claimv38deployeduntilhashcheck/readiness/regression.

## v38 final review UI deployed and read-only regression passed
Runtime userdemo18080 v38 sha25644557fb5bc39ae81410809dbd18bfa0234ae508aecaedbaca165e55f94e652aa.
Two sourcehashesverified; v37 inlinebackend/callbacklogic unchanged. Composer title
prop removed (aria-label retained), Reject/Close review use secondaryvariant.
37 combinedfrontendtests pass; finaltypecheck13 existingmodule/nullabilityerrors.
Actual savedconversation read-only browser regression passes3widths, no proposalPOST,
noJSerrors or documentchanges. Evidence prism-review-polish-{deploy,browser}.json.
Nativefullmodel/file-switch/inlineaccept proof remains exactv37 report
prism-agent-inline-browser.json; do not claim a second modelrunonv38. Screenshots
prism-agent-inline-1000.png (v37 core unchanged) and prism-review-diff-expanded-1000.png
(v38). Fixedcredentials preserved; candidate18081v33 and realpapers untouched.
Conversation source review currently covers pending edits to existing documents;
create/delete stay in dedicated cards. Explicitreview-beforeapply remains; no
conversation autoapply/Keep/Undo semantics claimed. Next overallgoal work resumes
remaining deletionlifecycle/admission integration and combinedproduct acceptance.

Deletion settlement verification: separated transition logic from native adapter
so failure outcomes are directly exercised. Cleanup must precede restoring task TTL.
45 combined Node tests pass, but native Mongo acceptance of new admission adapter
and whole-project close/drain remain outstanding. Demo stays v38; candidate stays v33.

## Native admission acceptance verified
Isolated candidate18081 (v33 running app unchanged) loaded diagnostic aliases of
current reservation/admission/settlement/coordinator/controller modules in a separate
Node process. Synthetic obsolete-54239176.tex created and accepted via actual
agentService.decide. Task7d3e9276-ed7d-4fad-b0ea-70255cced85f, proposal
c215f0d4-5caf-4215-82f2-18c1fe60f4af, doc6ae59e5886298d1124a7b6d0.
Admission UUID1ab3f8d7-8c34-4b76-a43e-141cef5eb9a0 preserved through committed receipt;
project ticket removed, accepted task expiry restored. Independent read-only native
verification confirms filetree removal, Docstore soft deletion, history acknowledgement
at version26 and no pending history barrier. Evidence:
plan/prism-admission-acceptance-native.json and prism-admission-acceptance-verify.json.
Diagnostic aliases/scripts removed in finally. No live routing changes, no main-demo
or real-paper edits. Do not rerun fixture creation unnecessarily. Previous attempted
read of nonexistent prism-deletion-teardown-native-verify.mjs corrected by adapting
existing prism-model-deletion-verify.mjs. Whole-project close/drain and late-worker
fencing remain incomplete; next integrate these before rollout.

## Teardown reconciles accepted operations after cleanup outage
Changed DocumentDeletionTeardown.mjs to reauthorize and settle already accepted,
committed operations instead of skipping cleanup. Native teardown adapter now calls
settleDeletionAdmission before restoring task TTL. Three additional regression tests
cover retry without delete, failed cleanup, revoked authority; 19 teardown/settlement
tests and targeted lint pass (prism-teardown-settlement-{tests,lint}.log).
Native injected cleanup outage persisted an accepted task without TTL and ticket.
Initial probe failed because it expected DELETION_UNCERTAIN but repeated settlement
failure propagates the raw cleanup error. Failure log preserved at
plan/prism-teardown-settlement-outage.log; structured error handling remains to fix.
Did NOT recreate/delete another fixture after failure: fresh process resumed the
persisted synthetic task306794ce-fc6d-4d14-b178-93b5d0f75db3 and verified cleanup,
restored expiry and unchanged operatione0d2f48e-2bda-408c-a08f-9f70ace7ee3b.
Evidence plan/prism-teardown-settlement-native.json. Diagnostic aliases removed.
Whole-project admission closure/drain and late-worker fencing still incomplete.
No live demo deployment or real-paper changes.

## Stable deletion settlement errors verified
WritingAssistAgentService now returns 502 DELETION_UNCERTAIN when failure settlement
itself fails, with original error retained as cause; no raw internal cleanup message
in user-facing message. Covers successful deletion followed by failed settlement,
uncertain execution, and aborted snapshot conflict followed by failed settlement.
32 service tests pass; targeted lint passes. Initial new test incorrectly used id
instead of visible taskId (404), corrected to existing public task shape.
Real isolated native fault injection/recovery passed, task
c6cd5bb2-bb4f-4864-a240-fea8ba5d4eb5, operation
8eaab3a1-9a3e-4e64-942b-ce99132c4a4f. Verified 502/code, accepted retained task without
expiry, durable ticket, recovery cleanup and expiry restoration using same operation.
Evidence plan/prism-settlement-error-native.json and prism-deletion-settlement-error-
{tests,lint}.log. New service diagnostic alias included; all aliases removed afterwards.
Demo unchanged; native probe uses only synthetic acceptance file. Next remains whole-
project admission closure/drain integration and late-worker fencing; not complete.

## Admitted crash-gap recovery implementation
Coordinator now accepts internal admittedOperationId only with explicit readAdmission
adapter, mutually exclusive with existingOperationId. Checks full ticket binding and
UUID, rejects different receipt identity, rereads ticket after history preflight,
and fills missing reservation with the original admitted UUID. Never calls admitDeletion
in this recovery mode. Existing-only semantics unchanged.
Teardown engine supports admitted rows only via resumeAdmitted adapter after task
snapshot, authority and retention checks. Missing adapter blocks, no blind fallback.
42 coordinator/teardown tests pass; targeted lint passes. Evidence
plan/prism-admitted-drain-tests.log and prism-admitted-drain-lint.log.
Not deployed or native-verified yet. Next native adapter must atomically close project
admission under authorization, merge admitted tickets with receipts with exact identity
checks, wire readAdmission/resumeAdmitted, reconcile terminal conflict tickets, and
ensure no admissions remain before whole-project removal. Late-worker fencing still
requires explicit resolution; read/recheck alone does not establish an atomic fence.

## Native teardown adapter admission wiring (source only)
DocumentDeletionTeardownService now closes project admission after whole-project
permission check under structure lock, merges tickets with primary receipts using
new DocumentDeletionDrainInventory, wires readAccepted/admittedOperationId recovery,
and checks no ticket remains after drain. Engine handles a terminal conflict ticket
only with absent execution receipt, through settlement (never executes deletion).
Inventory rejects duplicate/cross-project and mismatching operation/snapshot rows.
48 coordinator/inventory/teardown tests pass; targeted ESLint passes.
Evidence plan/prism-admission-drain-integration-{tests,lint}.log.
IMPORTANT: recovery service now durably closes project admission. Do not rerun older
native scripts against the shared candidate project6ae57d2fa2564a345a7efba6; next native
probe MUST create its own disposable synthetic project and preserve the closed intent.
No live deployment. Native verification of this wiring, actual ProjectDeleter call-site
integration, restore behavior and late-worker atomic fencing still remain. Existing
project lock/rechecks alone do not establish that final lifecycle guarantee.

## v40 contextual Agent conversation deployed and real-browser verified
User requested selected source line labels, chat presentation and visible Agent work.
Implemented sourceSelection capture from current editor selection on send; authenticated
server derives path/line range from exact snapshot and rejects stale/out-of-project
text. Selection passes into harness request scope and persists in task/turn/history.
No invented range for legacy turns. Added public activity normalizer for command,
file, tool and agentMessage items; excludes internal reasoning/deltas, bounds text,
redacts common credential forms and workspace paths. Task manager retains up to200
items; Web durable activity budget64KB per turn. Compile/PDF tools also emit states.
Final summary now uses last public assistant message; intermediate messages remain
in activity. UI uses sanitized micromark, user range chip and expandable command/
output/exit/file/tool activity, preserved after completion and reload.

Runtime demo18080 v40 sha256a5972470473e43329282ad3d09e44dc98bda68f96bd9b34d8aeceb7e657ac2b4;
13 Web source hashes verified. Host daemon73960, idle verified before restart.
Source-only deletion modules were NOT rolled into this UI image (AgentService includes
its tested structured-error handling, deletion feature still disabled in demo).
46 backend tests,20 frontend tests,19 harness tests pass; targeted Web ESLint clean;
full frontend typecheck retains13 prior errors. Initial marked import lacked types,
replaced with existing micromark. Agent subtree has no ESLint config; do not claim
agent lint passed. One relative test-file write failed under services/web cwd before
mutation, corrected absolute path; frontend test run then passed.

Real Codex task55869676-7b03-4e84-a492-7a2c8b07a289 in syntheticproject
6ae599dc85fa3d9374b10e31, conversationc0c7de08-481a-420a-accb-53250c57b242:
selected main.tex L1, actual sed command/output and public updates, final explanation,
selection/activity durable after reload, unchanged source, no accepted proposals,
no browser errors. Evidence prism-agent-chat-browser.json, readback.json, screenshots
prism-agent-chat-completed-{1440,1000}.png (visually inspected1000).
Original screenshot prism-agent-chat-1440.png captured live activity before UI's next
poll; completed screenshots came from separate read-only readback, no new model task.
Fixed account unchanged. Earlier v39 removed redundant Discussion rail and directly
opens Literature, retained in v40. Backend project admission native probe deferred
by these user UI requests and remains next overall-goal work, not complete.

## Native closed-admission crash-gap drain verified
Separate syntheticproject6ae5a5d38cf2a8855ddcd818 (Prism admission drain fixture
4343e77b-2e68-4517-990c-d4ce8149abc0) created via native snippet creation and native
forwards history migration. Only obsolete.tex was proposed/accepted and registered;
no reservation existed before recovery. Current diagnostic teardown service closed
admission then recovered ticket-only gap using operation
fea74b05-71e0-4b13-bac0-f797bcab058d. Task89115d3b-0fde-4058-8ae0-5ab7f79c94a6
accepted, ticket gone, expiry restored; new admission rejected409 after closure.
Independent native verification confirms filetree removal, Docstore soft deletion,
history acknowledged at version3 and no pending history barrier.
Evidence plan/prism-admission-drain-native.json and prism-admission-drain-verify.json.
All diagnostic aliases removed. Closed syntheticproject retained for evidence; do not
reopen or reuse it for normal acceptance. Shared candidateproject unchanged. Runtime
candidate stillv33, demo stillv40. Next unresolved: actual ProjectDeleter call-site and
restore integration, plus atomic late-worker fencing before enabling reviewed deletion.

## v41 message bubbles and role avatars delivered
Assistant execution/activity and reply now share a pale themed rounded bubble.
User label replaced with person avatar; assistant message label replaced with sparkle
avatar. Inline SVG avoids unavailable symbols in bundled icon-font subset. Both roles
retain accessible names. Current and historical turns use same presentation; composer,
source references and proposal cards unchanged. Four UI files only deployed atopv40.
Runtimev41 sha256537bedaf4b972d580885f6a43e930694caaa991b0adf5c5b7f2b34b45327f344;
source hashes verified,20 existing frontend tests pass, targeted lint passes.
Actual read-only browser verifies role icons, nontransparent bubble and no horizontal
overflow at1440/1000. Screenshot1440 visually inspected. Evidence
plan/prism-message-bubbles-{deploy,browser}.json, screenshots and tests/lint logs.
No new model request, paper edit, account change or candidate18081 update.
Project deletion entry/restore inspection had made no code edits when user steered UI;
that integration and concurrency fencing remain outstanding overall goal work.

## Preserve archived admission state; restore only drained projects
Project schema now declares hidden admission Map and teardown metadata. ProjectDeleter
explicitly selects these plus deletionReceipts/history barrier when taking archive
snapshot; ordinary queries remain unchanged. undeleteProject checks primary unresolved
reservations, archived admission tickets and pending history before restoration. A
drained restoration clears old admission closure, preserves terminal receipts.
47 ProjectDeleter unit tests and targeted ESLint pass; tests cover pending admission,
reservation/history blockers and closure clearing without losing completed receipts.
Evidence prism-project-restore-admission-{tests,lint}.log. No runtime rollout/native
schema verification yet; do not claim concurrency fencing from these read checks.
Initial edit command used services/web-relative cwd with root-relative paths and failed
before mutation; corrected from repo root. The first test invocation therefore checked
old source only; final47-test log is authoritative for changes.
Next: wire authorized drain into actual deleteProject, refresh archive snapshot after
drain, and resolve late-worker atomic fencing before candidate deployment.

## ProjectDeleter now invokes authorized drain before archival (source only)
deleteProject checks pending reservations and persisted admission/closure metadata;
when reviewed deletion is enabled or recovery exists, invokes native teardown service
using explicit interactive deleter or owning user for internal account-removal jobs.
Recovery rechecks whole-project authority. After drain, rereads full project including
hidden recovery fields before flush/archive to avoid restoring a stale pre-drain tree.
Failure exits before Docstore archive/project removal. 49 ProjectDeleter tests pass,
including actor forwarding, recovery failure ordering and fresh snapshot archival;
targeted lint passes. Evidence prism-project-drain-entry-{tests,lint}.log.
Not deployed or native-verified. Next candidate image must include new Project schema
and teardown modules, then disposable delete/undelete round-trip verification. Atomic
late-worker admission/reservation fencing still unresolved: don't enable user-demo
deletions or claim project lifecycle race safety from this integration alone.

## Native lifecycle roundtrip verified; nested archive projection fixed
Candidate18081 now v43-deletion (v42 introduced11 backend files, v43 fixes archive
read projection). Userdemo18080 staysv41. Native syntheticproject
6ae5a9739305e09f47bc2951, operationae6e988f-b987-49d6-a4a3-5a5f89921eb8:
actual deleteProject drained admitted-only operation, archived post-drain tree and
receipt, removed project; undelete restored main content without obsolete.tex and
cleared closure while retaining completed receipt. First verifier failed because
DeletedProject embeds ProjectSchema and its ordinary lean query hides recovery fields.
Inspection revealed undelete itself needed explicit +project.* projection too. Fixed,
then resumed SAME archived fixture (no duplicate creation). Archive verification uses
raw collection BSON; original failure log preserved. Unit expectations now require
nested recovery projection;49tests and lint pass. Evidence
prism-project-lifecycle-roundtrip-native.json, first-failure.log, fixture.json;
prism-restore-projection-candidate-deploy.json. Diagnostic files removed. Atomic
late-worker fencing remains unresolved, no user-demo reviewed deletion rollout.
User next supplied git-bahn/git-graph link without explicit action; inspected README,
awaiting clarification whether desired for paper history or Agent task visualization.

## Transactional admitted reservation start (source only)
Confirmed acceptance Mongo configured replica set. New DocumentDeletionAdmittedStart
verifies task snapshot/applying state and ticket binding, writes both task and project
and creates reservation in one session/transaction. Native adapter uses one Mongoose
client for all collections, snapshot read concern and majority write concern. Controller
and teardown coordinator use this adapter for missing admitted receipts.30 focused
start/coordinator tests pass; targeted lint passes. No runtime deployment/native txn
race verification yet. Evidence prism-admission-transaction-{tests,lint}.log.
CRITICAL NEXT: settlement still updates task before checking terminal receipt/ticket.
Transaction start prevents starts AFTER terminal task update, but a start that wins
before conflict settlement can create a preparing receipt and leave conflict task.
Need atomic terminal settlement validating receipt absence/committed identity, task
transition and ticket removal in SAME transaction before claiming race safety. Also
verify native transaction retry under forced interleavings; unit adapters do not prove
Mongo rollback/conflict behavior. Do not deploy this partial fencing work to demo.
Git-graph purpose still awaits user clarification; no inferred implementation.

## Git synchronization clarification 2026-10-31
Official docs checked: https://docs.overleaf.com/integrations-and-add-ons/git-integration-and-github-synchronization/github-synchronization
Docs describe conflict branch creation and external conflict resolution, no branch support in Overleaf, bundled commits attributed to linked owner, and possible comment/track-change loss or displacement. Do not describe all existing sync as unconditional overwrite.
Local repository contains services/git-bridge Java implementation and server-ce/test/git-bridge.spec.ts; runtime availability and GitHub implementation not yet audited.
Safety requirements: durable recovery point is stronger than a temporary Git stash; compare base/web/remote; revalidate web versions at apply; reject stale remote head on push; track per-user collaboration history separately from Git commit author; branch workspaces must not switch every collaborator's shared buffer. Graph must reflect real commit parent relationships.

Git merge preview tests: plan/git-merge-preview-tests.log (7 pass). Inputs copied before asynchronous work, max 8 MiB each, temp directory private, files0600, cleanup in finally, shell-free git merge-file with fixed filenames and timeout. Conflict output is preview-only; caller must never apply unresolved markers. Fingerprints alone do not provide concurrent-write protection; atomic validation/write integration remains required.

Native write audit: DocumentUpdaterHandler.setDocument accepts expectedVersion and routes to /conditional. DocumentManager checks version under setDocWithLock. HttpController treats only reviewed writing-assist changes as non-external; Git integration must preserve source identity and explicitly establish review safeguards, not spoof writing-assist. This gives per-document concurrency protection, not atomic multi-file/tree synchronization. Recovery journal and file-tree/version coordination remain necessary.

Repository reader accepts only full refs/heads or refs/remotes names or full commit IDs and resolves before reading. All subprocess calls use execFile, bounded buffers/timeouts; inherited GIT_* routing/config injection removed, global/system config disabled, replace objects disabled. Repo path must come from trusted server binding, not HTTP input. Git author metadata is untrusted and must be escaped in UI; not proof of authenticated editor identity. Graph currently reads ancestry of one selected ref; renderer and combined multiple-branch traversal remain pending. Merge-base lists all ancestors; multiple bases are not silently reduced to one. Binary bytes preserved in snapshot; executable-mode roundtrip and other Git metadata are not yet represented in content-only merge planner.

Recovery store uses trusted server-owned filesystem volume, 0700 staging directories/0600 files, validated UUID checkpoint identifiers, bounded reads before decoding, blob hash and manifest hash verification, and project identity checks. Caller authorization still required. No TTL/cleanup until operation references and retention policy exist. Disk reopen tested, not physical power-loss durability or multi-instance shared-volume behavior. Missing WritingAssistSnapshot.mjs lookup was a guessed filename; no source change based on it.

Preview service checkpoints all three input trees so repository GC/offline state does not prevent review. Operation holds checkpoint IDs/hashes, binding revision, base/remote IDs, fingerprints and changed-file summaries; no source bytes in Mongo. Failed authorization/binding/journal writes may leave unreferenced private checkpoint directories, intentionally not deleted before retention/orphan reconciliation exists. readProject adapter contract requires coherent native tree/document snapshot and is still unimplemented. Native operation adapter majority write and primary read tested on candidate database temporary collection, not user project collections.

Snapshot coherence: first tree read precedes complete doc/asset collection; second doc pass starts after first collection and final tree identity includes version/id/path/blob hash. Correctness depends on native monotonically increasing doc versions per entity and tree revisions; apply must revalidate under write coordination regardless. Source checkpoint intentionally excludes comments/ranges. First native probe ran from /overleaf with CommonJS eval and failed settings initialization with undefined path; corrected to established /overleaf/services/web ESM diagnostic invocation, then passed. Temporary imported probe directory removed in finally. Guessed FileRef.mjs path was absent; actual schema is models/File.mjs; FileHashManager confirms Git blob SHA1 hashing.

Git API public preview omits internal recovery references, source blobs and repository filesystem paths; returns operation ID/revision/status/commits and per-file action/conflict summary. Full per-file content endpoint and UI are still required. API native diagnostic invoked actual controller using synthetic request/response and captured router registration; not an HTTP/CSRF/browser acceptance test. It changed settings only in the diagnostic process and used read-only existing disposable fixture; temporary module directory removed. No binding rows inserted and no runtime settings/deployment changed.

Native preview integration used candidate disposable project6ae5a9739305e09f47bc2951 and temporary bindingId/repositoryKey UUIDs. Insert-only binding fails if already present; cleanup predicates include generated bindingId, so no preexisting binding is replaced or removed. Actual project data is read-only. Real git commit modifies only temporary repository main.tex; native project fingerprint and document versions match afterward. HTTP sessions/CSRF not exercised: controller invoked with synthetic req/res after native authorization. Full contents stay in checkpoints; public endpoint sends only display-sized versions, with no disk paths/manifest references.

UI changes preserve existing assistant and history views. Graph currently renders selected branch ancestry; tags on commits come from branch refs. Unmerged other-branch histories and clickable commit file inspection still needed for complete graph requirements. Async preview/file responses have generation guard; initial status/graph loads use AbortController. Normal getJSON/postJSON wrappers retain CSRF behavior. Frontend tests use stubbed API responses, not HTTP integration. Initial test failed because code/span accessible name lacked separator; explicit Review changes to <path> aria-label added. Existing full typecheck baseline has13 unrelated errors; don't claim full green.

All-branches traversal uses pinned object IDs rather than mutable refs for git log, and returns the same captured branch labels for UI. This is one bounded read of refs, not a globally atomic Git ref transaction; updates after capture require next refresh. More than1000 refs rejected rather than silently omitting branches. Selected graph remains100 commits with truncation notice. Visual fixture bundles actual source with esbuild and runs local file via Playwright; no network or user account involved.

Remote fetch boundary: public GitHub actual network smoke only; private auth inspected by fake runner but not authenticated live. Fetch force refspec is limited to server remote-tracking refs to observe rewritten remote history; no force-push functionality. Existing preview service rejects ancestry changes requiring rebind. Git stderr is not forwarded because it can contain credentials. Authorized HTTPS hosts require trusted server config; GitLab/custom-host policy and encrypted credential persistence still pending. New initial graph response generation guard prevents slower initial request replacing graph after manual refresh.

Binding does not imply any common Git ancestor between existing web project and repository. Initial-review explicitly uses empty baseline (null commit) for conservative union/conflicts; do not advance baseCommit until successful reviewed synchronization. Repository provisioning cleans pre-insert failures; repositories surviving ambiguous DB insert/owner-recheck failure are deliberately left for future reference-aware orphan reconciliation. Runtime binding uses owner read before/after fetch then unique project insert; lifecycle/ownership atomic race protection remains a needed gate. Current public-only form does not promise private repo support. Native API proof only tests unbound status/permissions and route registration, not newly added bind invocation.

Conflict choices are stored as an array (paths may contain dots), with user identity and bounded edited content; original three checkpoints remain immutable. Decisions reconstruct from raw pinned inputs, not previous merged text. Resulting tree must still have no structural collisions before ready. Review status ready is not applied. First concurrent unit test incorrectly assumed web choice wins; async filesystem reads make winner nondeterministic, so corrected assertion compares result with the one persisted decision while still enforcing exactly one success/one409. Native DB test independently proves CAS behavior. Binding proof performs real read-only public network fetch, creates isolated data only, and does not grant any external push authorization.

Conflict form initially used wrapping label around controlled textarea; Playwright exact label lookup timed out because its initial value polluted the label text. Changed to explicit useId/htmlFor association; browser fill/save then passed at both widths. First JSX insertion missed closing brace for saved-decisions details; formatter caught and corrected before tests. Saving an old revision fails without overwriting another reviewer's choices; local edited text stays until user reloads. Browser fixture has diagnostic JSON output outside component, not production product UI.

Apply preflight compares document revision and identity as well as bytes, catching edit-then-revert and replaced docs with identical content. Final merged-tree validation is required because union/manual decisions can exceed per-input project limits. Execution plan intentionally stores hashes/metadata instead of source blobs; exact before/after content must come from pinned source/result snapshots. Preflight alone cannot prevent edits between check/write; executor must revalidate under native lock and refuse ambiguous retries. Native probe only builds plan and verifies no mutation, not successful apply.

Git apply journal verification: plan/git-apply-journal-native.json passes against isolated candidate Mongo. Concurrent begin/start/confirm CAS each admit exactly one caller; recovery-required survives reconnect and blocks fresh starts. Files-applied is deliberately distinct from synchronized/completed. This establishes bookkeeping only; it cannot prove native file write atomicity or preserve concurrent edits until native writer integration is implemented. User project contents and running demo unchanged.

Native text write finding: lock-held expectedVersion check alone was insufficient because RedisManager read currentVersion separately from Lua mutation; delayed workers could resume after lease expiry. Added optional expectedVersion Lua precondition, wired to native updateDocument. Forced same-version concurrent native writes demonstrate one winner and no loser content/history insertion. Evidence plan/prism-deletion-native-fence-probe.json (14checks) and plan/git-version-fence-native.json. Two source files changed; existing other Prism changes preserved; demo and user projects untouched. Initial default ESLint invocation had no document-updater config; explicit services/web/.eslintrc.js verification used afterward.

Native receipt implementation evidence: plan/prism-deletion-native-fence-probe.json/log now16 checks. Modified services/document-updater/app/js/{DocumentDeletionFence,RedisManager}.js; diagnostic runner/probe updated for new editor-core import and two receipt cases. Recipients must NOT use cache-applied as final journal confirmation: document flush/history queue happen later, and Redis loss can remove evidence. Missing receipt remains unknown, never proof of no write. No HTTP route, live DU replacement or user document mutation performed. Source permits optional internal expectedWrite; OT-to-writer propagation remains next integration step.

Source changes this checkpoint: services/document-updater/app/js/ReviewedWriteRequests.js (new), DocumentManager.js, UpdateManager.js, HistoryOTUpdateManager.js; tests ReviewedWriteRequestsTests.js (new), DocumentManager/DocumentManagerTests.js, UpdateManager/UpdateManagerTests.js.122 tests pass; history-ot test uses real TextOperation/StringFileData but mocked storage/broadcast/history queue, not native persistence proof. Source internal receipt authority uses WeakMap instead of serializable operation metadata to avoid forged client fields and leaking write IDs into collaborator updates. Existing Redis native proof unchanged; new propagation not deployed. An initial test used the wrong editor-core builder API; corrected to TextOperation.remove(3).insert('new') after inspecting local code. No user documents touched.

Reviewed document durable admission: new services/document-updater/app/js/{ReviewedWriteStore,ReviewedDocumentWriter}.js plus mongodb.js collection. Execute uses a unique durable request record, never takes over an existing executing request or repeats a recovery-required write. A persisted snapshot alone is insufficient; exact cache execution receipt must also match identity/version/hash. document-persisted deliberately does not assert project-history delivery. Actual Mongo forced concurrency and ambiguous acknowledgement passed; native document/cache/write adapters remain mocked in this checkpoint. Project contents and running services untouched.

Native reviewed pipeline accepted on isolated candidate fixture6ae5bd020f286a4cf18bc6e8. Actual doc version0→1, no version increment on duplicate request, stale request conflict; native history latest-content matches persisted main.tex. Code copied to UUID diagnostic directory then removed, no live native service replacement. Scripts plan/git-reviewed-pipeline-{native,history}.{py,cjs/mjs}, fixture.mjs/json. Fixture remains intentionally for repeatable validation. New test output confirms history content readback only; it does not implement automatic operation history settlement or resolve unknown writes after Redis loss. Original user projects and18080 demo unchanged.

Reconciliation changed only ReviewedDocumentWriter.js and ReviewedWriteStore.js plus native diagnostic scripts. Actual native lost-response test confirms record without replay; a subsequent collaborator edit test verifies no rollback and no guessed confirmation at newer versions. Missing receipt with matching persisted content also remains unresolved. Candidate synthetic project6ae5bd020f286a4cf18bc6e8 finalversion7, history hash ded0723314118419e3334682664a88d7558e5436219dc1b5ee3ae24350851644. Temporary code copies removed; fixture and durable records retained. No changes to user papers or18080 demo.

Internal HTTP bridge now verified from actual web DocumentUpdaterHandler→temporary HTTP server→native reviewed writer→Redis/docstore. Default disabled and malformed body refusals verified. Source edits: new ReviewedWriteController.js; DU app.js/config/settings.defaults.js/ReviewedDocumentWriter.js; web DocumentUpdaterHandler.mjs; diagnostic runners. Fixture project6ae5bd020f286a4cf18bc6e8 version17/history hash eff4a3522650660099828ea5ca800af7d1cf97a85788cfe9010681698574a2c4. Tests cover internal transport, not browser/project authorization (caller still responsible), tree changes, or full Git apply. Demo untouched.

Git executor source introduced with mandatory coordinate callback, not a claim of existing atomic project coordination. Modified files: new GitApplyExecutor.mjs/GitDocumentApplyAdapter.mjs/git-apply-executor.test.mjs; DU ReviewedWriteController.js exposes stored afterHash in status.43 backend tests pass (plan/git-apply-executor-regression.log), lint pass. Existing actual native HTTP/web adapter/history probe rerun due response-shape change passes (fixture22). Multi-file executor itself still unit-level; create/delete/assets/resume and native project guard remain needed. No UI apply action exposed or running service replaced.

Changed GitApplyProgressGuard.mjs(new), GitApplyPlan.mjs(baseCommit), GitApplyExecutor.mjs(resume), git-apply-progress.test.mjs(new), git-apply-executor.test.mjs.47 backend tests pass. Resume validates original plan content hashes and uses persisted attempt; coordinator contract now receives progress record as fourth argument and must verify partially applied project under native coordination. Current guard handles text modifications; it is not a lock, lease fence or runtime integration. No services restarted or project files written in this checkpoint.

Project guard source changes: GitProjectApplyAdmission.mjs(new), models/Project.mjs, ProjectEntityMongoUpdateHandler.mjs, WritingAssist/DocumentDeletionProjectAdmission.mjs, ProjectDeleter.mjs. Native diagnostic copies use source structure helper with process-local schema addition because candidate schema is older.40 actual Mongo races + native blocked rename/closure pass, fixture content/tree unchanged; own ticket released in finally. Initial diagnostic called nonexistent .withoutLock on Mongo helper; corrected to actual exported renameEntity (source still checks Mongo condition). Release is internal only and not sufficient by itself to prove worker settlement. Future coordinator must not auto-release on uncertain error; full deletion lifecycle and mixed feature-flag configurations still need audit.

Atomic lifecycle source: new GitAtomicApplyLifecycle.mjs; GitApplyJournal.mjs optional session; GitProjectApplyAdmission.mjs optional session; GitApplyExecutor.mjs forwards userId to begin. Same Mongo client/session required for projects+operations. Start/finish transactions are short and exclude native HTTP file mutations. Failed/uncertain writes keep project gate; do not release in generic finally. Actual transaction rollback tests pass, but executor still needs native coordinator and guarded error/cancel handling to avoid indefinite tickets; no public API enabled.

Integrated Git text application now demonstrated from actual git commits to native saved document, not just native writer alone. New GitApplyService orchestration and mandatory per-step validation in executor. Test lives inside existing pipeline fixture/temporary internal HTTP server; separate web child imports source Git modules and native authorization/lock/snapshot modules. Successful journal files-applied+ticket release, unchanged treeversion, docversion+1; subsequent history matchesversion28. Artifacts plan/git-apply-service-native.json, plan/git-reviewed-pipeline-native.log, plan/git-reviewed-pipeline-history.json. Native integration has one changed text file; no claim of multi-file/native structure/browser acceptance. User projects and18080 demo untouched.

Changed GitAtomicApplyLifecycle.mjs and GitApplyService.mjs for internal stopRemaining. Stop never clears an uncertain in-flight marker. It atomically fences future steps and releases project gate only with a consistent confirmed receipt prefix; completed modifications stay intact. Actual transaction concurrency tests pass (20 races plus deterministic stop-first/partial cases), temporary collections removed. Complete native multi-file stop and public UI not yet tested or implemented. No demo deployment.

### Native multi-file apply and collaborator interruption acceptance
Extended the isolated native Git pipeline fixture with notes.tex and applied an actual two-file Git preview through the project gate, transactional journal, web HTTP adapter, native document updater and docstore. Both writes returned persisted receipts. A second two-file preview applied main.tex, then injected a real collaborator edit into notes.tex; the progress guard rejected the remaining Git write. stopRemaining preserved the completed main.tex change and the collaborator's notes.tex change, returned partially-applied idempotently and released the project gate. Native history flush/readback matches both current documents (main.tex version35, notes.tex version2). Evidence: plan/git-apply-service-native.json, plan/git-reviewed-pipeline-native.json, plan/git-reviewed-pipeline-history.json and corresponding scripts/logs. This checkpoint changes diagnostic scripts and the dedicated synthetic fixture only, not production source or running services. Public apply routes/UI, creation/deletion/assets, binding settlement/push and branch workspace isolation remain incomplete; no full Git-sync completion claim.

### Application runtime and HTTP entrypoint checkpoint
Wired createGitApplyService into GitSyncRuntime using the verified same-Mongoose-client transaction lifecycle, native structure lock, project admission and DocumentUpdaterHandler promises. A separate gitSync.applyEnabled flag defaults false. Added five login-protected endpoints under previews/:operationId/application: GET status, POST apply (required nonnegative integer review revision), resume, reconcile and stop. Service read authorizes before project-scoped journal access. New GitApplicationResponse allowlists operation status/revision, counts and per-file confirmed/unconfirmed/pending state; excludes snapshots, recovery paths, internal receipt IDs and document bodies. 56 focused backend tests and targeted ESLint pass. Native candidate diagnostic proves13 login routes, default404 on all five application actions, outsider403 on all five with application enabled, and exact sanitized owner status from a temporary operation. Temporary record/code copies removed; fixture tree remains main.tex/version3. Evidence plan/git-sync-api-native.json/log, git-application-api-tests.log and git-application-api-lint.log. This is runtime wiring/status/auth acceptance, NOT actual full HTTP write or browser acceptance. No service replacement. Remaining: UI controls, full HTTP write/recovery acceptance, create/delete/assets, lifecycle/mixed-config audit and binding/push settlement before production enablement.

### Application controls UI checkpoint
Added frontend/js/features/git-sync/application-controls.tsx and panel integration: explicit reviewed-revision apply, scoped status read, receipt reconciliation, continue/stop controls, confirmed/unconfirmed/pending file rows and terminal explanations distinguishing local file save from remote push. Failed mutation responses query the same operation without replay. If status also fails, only status checking remains available and parent prevents replacing the preview. Mutating controls are hidden for unconfirmed writes; resume/stop require observed progress. Parent disables conflict decision controls after claiming and blocks new previews while applying. Connected status exposes only default-off applicationEnabled and activeApplicationId so reopening finds the retained project operation. 15 frontend tests and targeted ESLint pass; native13-route permissions/default-off/status probe passes. Evidence plan/git-application-ui-tests.log, git-application-ui-lint.log and git-sync-api-native.json. Initial repeat test invocation used repo root and failed bootstrap module lookup; rerunning from services/web passed. No deployment, full browser visual acceptance or actual HTTP application acceptance yet. Existing create/delete/binary and push/settlement requirements remain open. Next: complete native HTTP/controller write and recovery acceptance, then browser inspection before enablement.

### Recovery entry and browser component acceptance
GitSyncView now retains an active-operation recovery entry even if preview reconstruction fails; its journal status remains queryable independently of recovery snapshots. Added a frontend regression proving status/reconcile remain accessible without starting new writes. Initial binding response now carries applicationEnabled so controls do not require panel reopening after connect.16 frontend tests and targeted lint pass. Actual ApplicationControls bundled into an isolated browser fixture with simulated transport passed420/900px status→reconcile→stop interactions, no page errors/overflow. Screenshot inspection found status wrapping under a long filename; fixed flex sizing and reran both widths, then visually inspected420px again. Artifacts plan/git-application-visual/{browser.json,uncertain-420.png,stopped-420.png,check.py,entry.tsx,requests.ts}. System Python lacked Playwright; uv run --with playwright used the available package environment successfully. Scope is real component DOM/browser with simulated HTTP, not production editor/native HTTP apply acceptance. Changed panel/runtime response/CSS/tests plus fixture artifacts and planning records; user documents/services unchanged. Next remains actual full controller HTTP writes/recovery, structural adapters and combined acceptance before enablement.

### Native web-controller HTTP application acceptance
GitSyncController now exposes createGitSyncController(runtimeProvider) while its production default still uses getGitSyncRuntime. Extended the existing dedicated two-file native fixture probe to mount actual controller handlers on a temporary127.0.0.1 Express server, injecting the real application service and fixture sessions. HTTP apply rejects outsider403 and stale revision409, saves both files with two confirmed native receipts, returns an allowlisted status identical to GET, and rejects duplicate apply409 without extra document versions. A second HTTP apply detects a real collaborator edit after its first confirmed file; HTTP stop returns partially-applied idempotently, preserves both completed Git content and the collaborator edit, and releases admission. Native history flush/readback matches main.tex version42 and notes.tex version4. Artifacts plan/git-apply-service-native.json, git-reviewed-pipeline-native.json, git-reviewed-pipeline-history.json and associated logs/scripts. Default-runtime13-route authorization/status regression and controller lint also pass. Scope: real web controller→HTTP adapter→native DU/Redis/Mongo/docstore/history; fixture session injection means production login/CSRF and full browser/deployed-runtime wiring are NOT qualified. Temporary servers/code/repository/operations/checkpoints cleaned on success; only dedicated fixture text and durable receipt/history records retained. No live service replacement or real user document edit. Remaining full objective: native create/delete/assets, base/push settlement, credentials/polling/branch workspace behavior, lifecycle mixed-config acceptance and combined Prism qualification.

### Atomic reviewed-remote baseline settlement
Added GitBindingSettlement.mjs and runtime lifecycle wiring with the bindings collection on the same Mongo client/session. After all receipts are confirmed, finishFiles atomically CAS-updates binding ID/revision/branch/old base to the reviewed remote commit, increments binding revision, records last applied operation/time and hasLocalChangesAtApply, completes journal and releases admission. State is review-applied, never a claim of push/current synchronization. buildApplyPlan computes retained local differences against the remote tree fingerprint. stopRemaining only settles when every planned receipt is confirmed; partial/cancelled operations keep the old baseline. Native disposable Mongo tests prove changed-binding rollback, exactly-once revision/base advance and partial-stop baseline preservation.57 backend tests and source lint pass. Updated real two-file HTTP pipeline uses actual Mongo binding settlement instead of manually advancing its test binding; after first apply baseline/revision/state and no-local-difference flag match, subsequent interrupted application preserves previous base/revision. Actual history readback matches main.tex49/notes.tex6. Evidence plan/git-atomic-apply-native.json, git-apply-service-native.json, git-reviewed-pipeline-history.json, git-baseline-settlement-tests.log/lint.log. Diagnostic fixture only; no service changes. Existing text-only limitation, structural adapters, push/private credentials/branch workspace isolation and combined browser/deployment gates remain incomplete.

### Reviewed snapshot Git commit construction
Added GitCommitWriter.mjs: validates/copies the full fingerprint-matching file snapshot plus author/parent inputs, creates blobs with no filters and nested trees via mktree, preserves first-parent executable modes, creates deterministic commits with explicit timestamp/author/message and up to two ordered parents, then reads back and verifies the complete tree. No branch/index/worktree writes or external push. Rejects invalid metadata/parent IDs, unsafe trees and LFS; parent snapshot reader rejects symlinks/submodules. Real Git tests cover nested Chinese/space paths, binary bytes, additions/deletions, executable mode retention, author identity, merge parent order, deterministic retry, asynchronous caller mutation isolation, untouched refs/index/worktree, empty bare root commit and invalid-input rejection.59 focused backend regressions and targeted lint pass (plan/git-commit-writer-regression.log, git-commit-writer-lint.log; dedicated initial test log git-commit-writer-tests.log). Temporary test repositories removed. This is a commit construction primitive, not connected Web commit/push: durable operation binding/object retention, guarded ref/push, credentials and UI remain required. Native create/delete/assets application and full Prism acceptance remain open; no deployed changes.

### Exact-head guarded push transport
GitRemoteTransport now provides explicit push and inspectPush primitives. Validates full refs/heads destination, immutable commit IDs and explicit expected head (null means branch creation); copies request before awaits, verifies source resolves to that commit and expected head is its ancestor. Push uses one refspec, exact --force-with-lease branch:OID (empty for creation), --atomic, no tags/submodules/hooks and existing HTTPS host/credential confinement. Despite lease syntax, ancestry guard forbids rewriting reviewed history. Any transport failure is unconfirmed, never automatic retry; inspectPush reads only exact remote ref and reports confirmed/unchanged/changed. Actual Git tests use a test-only HTTPS→temporary local bare repo transport substitution: validate lost success response then read-only confirmation without second push, collaborator advancement injected after ancestry validation but before push rejection, non-descendant rejection, create-only branch refusal to overwrite, and invalid input without Git execution. Initial fixture setup tried update-ref before transferring peer object; corrected to real peer push, then injected it at the race window.61 backend regressions and lint pass (plan/git-guarded-push-regression.log, git-guarded-push-lint.log). All test repos removed; no external push. Not yet connected to public routes/UI; durable push intent/journal and object pinning, credential provider, authorization and binding settlement still required. Full create/delete/assets native application and Prism/deployment gates remain open.

### Retained commits and durable push journal
GitCommitWriter.retain now creates an immutable refs/overleaf/pushes/<operation UUID> ref with update-ref expected-zero CAS. Repeated same-commit requests read back successfully, different-commit replacement is rejected. Real Git test verifies retained commit survives gc --prune=now without moving normal branches. Added GitPushJournal.mjs: allowlisted insert-only intent (no credentials), majority writes/primary reads, scoped project identity, idempotent same-intent preparation, single prepared→pushing claim, no TTL/takeover, exact attempt+branch+commit confirmation and read-only remote observations. Unchanged/changed remote does not reopen a push; unconfirmed state persists across connection loss. Actual Mongo disposable-collection native test proves concurrent single winner, reconnect persistence, no replay, mismatched confirmation rejection and credential exclusion. Evidence plan/git-push-journal-native.json/log, git-retained-commit-tests.log, git-push-journal-lint.log. Tests use synthetic commit IDs in Mongo; real Git retention tested separately. Public push service/executor still unwired; pin/journal composition, credentials, current-user authorization and binding lifecycle settlement remain next, along with existing native structural apply/Prism gates. No remote push, deployed change or user manuscript edit.

### Push executor native composition checkpoint
Added internal GitPushExecutor.mjs requiring authorization, project/binding coordinator and fresh trusted context resolver. Checks approving actor, binding ID/revision/branch/base and retained commit before claim and dispatch; rechecks permission immediately before transport. Existing non-prepared attempts return original state rather than dispatch again. Exact transport acknowledgement confirms journal; unknown errors are sanitized and marked unconfirmed. Reconcile only inspects the same remote commit and never starts a write.64 focused regressions and lint pass; unit cases cover concurrent/repeated dispatch, wrong approving actor, lost response, binding/retained commit changes and permission loss after claim. Extended native Mongo probe to compose actual CommitWriter+retained ref+PushJournal+PushExecutor+RemoteTransport with two disposable bare repos. Real push succeeds but injected response loss persists unconfirmed; a new executor does not replay, read-only reconciliation confirms pushed and remote ref equals approved commit. Evidence plan/git-push-journal-native.json/log, git-push-executor-regression.log/lint.log. Native authorization/coordinator remain fixture injections, NOT production lock/identity acceptance; no external push. Production prepare service, native binding/push lifecycle coordination, credentials, baseline settlement and UI remain required. Structural apply/combined Prism gates still open. Test-only lint declaration errors fixed before successful rerun. No deployed service or user document changes.

### Atomic push admission and binding settlement
Added GitAtomicPushLifecycle.mjs using same-client Mongo transactions, existing native project admission and push journal session support. Push intents now require reviewed treeVersion; executor passes approving user to claim. Claim verifies immutable approving actor, binding and exact project tree/access then commits project ticket and pushing state together. Remote confirmation CAS-updates journal plus binding base/revision/last-push metadata and releases exact ticket atomically; stale binding or ticket ownership rolls confirmation back. Confirmed read-only observations use the same settlement; uncertain outcomes retain protection. Native Git/Mongo probe now uses this real lifecycle on disposable project/binding collections: lost successful push retains ticket, read-only confirmation updates base and releases it, wrong actor never claims, changed binding rolls back confirmation with gate retained.64 regression tests and lint pass (plan/git-atomic-push-regression.log/lint.log, git-push-journal-native.json). This does not qualify production runtime/user-auth/CSRF or actual native project deletion integration: probe authorization/coordinator remain injected and collections disposable. No external push/deployed change/user file edit. Still required: server prepare/context/credential provider and push-specific status routing, full lifecycle coordination audit, browser workflow and structural Git apply/remaining Prism gates.

### Immutable push preparation and review service
Added GitPushPreparation.mjs: requires established binding baseline, rejects cached incoming commits, captures coherent project snapshot, computes full add/delete/modify diff, resolves author via trusted server callback, builds and retains immutable commit, then persists intent after rechecking binding/access. No remote push occurs during preparation. Review/file endpoints are internal service methods reconstructed from pinned commit+parent with fingerprint verification and bounded text/binary/absent display; later project edits do not alter approved commit. Real Git test covers server-supplied author, binary/add/delete paths, immutable readback, permission refusal, initial sync refusal and incoming-change refusal.65 backend tests and lint pass. Native Mongo/Git pipeline now starts through this preparation service (fixture project snapshot/author/auth/coordinator callbacks), reconstructs reviewed file then executes actual local-remote push, lost-response reconciliation and transactional settlement. Evidence plan/git-push-preparation-regression.log/lint.log and git-push-journal-native.json. Preparation currently creates a fresh review ID per explicit request; retained unjournaled commits on ambiguous failure require later retention cleanup. No public runtime/routes/UI wiring or credentials yet; no external push/service update/user document changes. Remaining native structural application/complete Prism gates unchanged.

### Isolated encrypted Git credential provider
Added GitCredentialStore.mjs with mandatory dedicated32-byte key, AES-256-GCM/random96-bit IV and authenticated context [version, project, session user, normalized HTTPS repository]. Tokens are scoped to project+user and exact repository with no shared-owner fallback. Save/load/status/remove require current write authorization; status returns configured boolean only. Ciphertext shape/version/key/tampering failures return generic errors. No development-key fallback; existing WritingAssistEncryption's dev default/truncation/padding was deliberately not reused.67 backend regressions and lint pass, including cross-user/repository isolation, randomized encryption, ciphertext transplant rejection, wrong key/denied actor rejection and removal. Actual Mongo probe with synthetic token proves no plaintext persistence, decrypt after client reconnect and removal; native Git/push pipeline regression still passes. Evidence plan/git-credential-store-regression.log/lint.log and git-push-journal-native.json. No real credential collected, configured or logged; provider not yet wired to public settings/runtime. Remaining integration includes explicit key config/rotation handling, own-credential routes/UI, private bind/fetch/push, user/project deletion cleanup and revoked-user self-removal policy. Also discovered integration mismatch to resolve before push runtime: existing bound refs use refs/remotes/origin/* while push intents require refs/heads/*; preserve tracking ref separately from destination branch. No deployment/external push/user document changes.

### Tracking ref and push destination integration
Added GitBranchIdentity.mjs to derive only refs/heads/<name> from validated refs/remotes/origin/<name> or existing heads bindings, preserving nested/Unicode names and rejecting other remotes/tags/unsafe refs. PushJournal now persists destinationBranch separately; binding CAS continues using original tracking branch, while transport requests/receipts/observations match destinationBranch. Executor rejects destination tampering; preparation validates binding namespace early. Native prepare→real local-remote push→lost-response reconcile→atomic baseline settlement now uses refs/remotes/origin/main binding and verifies remote contains no refs/remotes namespace.68 full backend regressions passed; subsequent targeted branch/executor tests and native pipeline pass; lint issues in ref validation were fixed and lint passes. Evidence plan/git-branch-identity-regression.log/tests.log/lint.log and git-push-journal-native.json. No external push/deployment. Runtime still must refresh/CAS-update tracking cache after successful push before next comparison; public push/context/credential endpoints and browser integration remain pending, as do structural apply and complete Prism gates.

### Runtime own-credential endpoints and fetch integration
GitSyncRuntime now lazily builds GitCredentialStore only with explicit64-hex GIT_SYNC_CREDENTIAL_KEY (default empty). bind/provision and refresh/fetch resolve only current authorized user's repository-scoped token; no shared-owner fallback. Provisioner forwards transient token to transport without persisting it. Added16-total login routes including own credential GET status, POST save and POST remove; controller uses session actor, bounded body/query and allowlisted configured boolean. Native controller/Mongo probe with ephemeral key and synthetic token verifies missing-key503, save/status/resolve/remove, ciphertext storage, body userId ignored, outsiders403; test record/key removed and fixture document unchanged.68 backend regressions and lint pass; targeted provisioner test verifies token arrives at transport but not bare repo config, plus defaults syntax passes. Evidence plan/git-sync-api-native.json, git-credential-api-regression.log/lint.log, git-private-provision-tests.log. No real token/private remote request or deployed service change. Still required: credential UI, lifecycle cleanup/key rotation/revoked-user removal policy, production push runtime/status routes and full native/browser acceptance. GIT_SYNC_CREDENTIAL_KEY has not been configured on running services.

### Own-credential frontend controls and browser acceptance
Added CredentialControls.tsx to Git panel outside repository-binding form. Collapsible selected-repository status/password input/save/remove; no browser storage, no saved-token echo, token cleared before POST and on close/repository switch. Unique request symbols invalidate stale fetch/save responses so old repository state cannot overwrite current UI; unknown mutation response is not automatically retried. Connected status and bind response expose normalized remoteUrl for own-credential management.19 frontend tests and targeted lint pass; native16-route credential/auth/status regression passes. Browser fixture using real component with simulated transport passes420/900px save/remove, password type, empty input after submit, no plaintext body/overflow/errors. Screenshot inspected; panel details rule initially overrode padding, fixed selector and reran/inspected. Artifacts plan/git-credential-visual/{browser.json,saved-420.png,check.py}, git-credential-ui-tests.log/lint.log, git-sync-api-native.json. Initial command mixed root-relative paths with services/web cwd and failed test creation; corrected before verified run. Ref cleanup warning fixed with unique request symbols, descriptions added per lint. No live service/key/token configured, no actual private remote request. Still pending production push runtime/HTTP/UI, retention/credential lifecycle, structural apply and full Prism acceptance.

### Default-off production push runtime and HTTP entrypoints
GitSyncRuntime.getPushService composes native project snapshot/structure lock, same-Mongoose-client atomic push lifecycle, actual UserGetter author identity, confined repository writer/reader and current actor encrypted credentials. Added readRetained UUID-only read to verify pinned commit without creating refs. Dedicated pushEnabled=false default; six authenticated routes prepare/review/file/status/execute/reconcile with publicPush allowlist. Project admission ticket now records kind apply/push; status returns activePushId separately from activeApplicationId. Native candidate controller diagnostic verifies22 login routes, all push actions default404, enabled status sanitized, all outsider calls403, plus credential/application regressions.68 backend regressions and targeted lint pass; retained-ref read/path rejection test and native actual Git/Mongo push lifecycle regression pass after changes; defaults syntax checked. Evidence plan/git-sync-api-native.json/log, git-push-runtime-regression.log/lint.log, git-retained-commit-tests.log, git-push-journal-native.json. This verifies runtime load/status/permissions, not complete production-context HTTP push or login/CSRF/browser. No service changes, external push or real credentials. Pending tracking-ref cache update after push, public UI and production-context prepare/push acceptance, credential/lifecycle cleanup, structural apply and full Prism gates.

### Confirmed push tracking-cache maintenance
GitCommitWriter.advanceTracking validates origin tracking namespace and immutable descendant commit, then update-ref --no-deref with exact expected old head. A changed/deleted/locked ref is not unconditionally overwritten; exact already-current commit is idempotent, otherwise refresh-required. Added GitPushCacheUpdater requiring current permission and exact settled binding identity/revision/base/last-push operation. Runtime execute/reconcile runs cache maintenance after confirmed remote receipt; failure preserves pushed status and public response exposes only bounded trackingCache result.69 regressions and targeted lint pass, including actual Git stale cache/newer fetch preservation, no heads mutation, no backward ancestry, permission/binding mismatch and failure classification. Native complete preparation→Git/Mongo push→reconciliation→settlement now advances actual origin tracking cache and verifies next preparation detects no duplicate changes. Evidence plan/git-push-cache-regression.log/lint.log and git-push-journal-native.json. No external push/deployment/user document changes. Cache is not a live remote truth; new remote updates still require fetch. Remaining public push UI and production-context HTTP/browser acceptance, lifecycle cleanup/key handling, structural apply and full Prism gates remain open.

### Git reviewed push UI checkpoint
Verified23 frontend tests, scoped lint, real-component simulated-transport browser420/900. Request ambiguity must take precedence over retained prepared status in user wording; fixed misleading nothing-pushed message after network loss. Browser screenshot plan/git-push-visual/review-420.png shows line+word diff, immutable source, explicit approval; unknown response offers status/reconcile only. This does not establish deployed/native authenticated end-to-end push. Next production-context HTTP pipeline and safe failed-push terminal policy, then editor-integrated acceptance; broader Prism/structural sync work remains.

### Pre-dispatch rejection evidence
Distinguished known local failure before transport from unknown remote outcome. Internal-only rejection transition can release exact gate transactionally, never advance binding. Native real Mongo rollback verified using deliberately mismatched attempt in disposable project collection; prior lost-successful-push-response local Git test remains passing.69 backend/24 frontend/scoped lint pass. No deployment. Initial attempt to read lint output preceded completion; polled same live session and verified exit0/log afterward.

### Real HTTP push flow
Actual push controllers now exercised through HTTP rather than direct executor only, with temporary bare remote and disposable Mongo collections. prepare201, malformedmessage400, missingfile404, lostresponse502, statusunconfirmed, reconcilepushed, repeatedexecute no replay; six outsider calls403. Session actor beats forgedbodyuserId. Runner cleans temporary copies/collections/repositories and closes HTTP listener; imported production modules require explicit process exit afterward. Proof scope explicitly excludes real session/login/CSRF, native project snapshot and production runtime composition. Artifacts plan/git-push-journal-native.json/log. No production deployment.

### Native runtime preparation evidence
Default runtime now tested without replacing snapshot, user lookup, authorization, repository confinement, journal or Redis coordination. Native test project snapshot exactly equals resulting commit files; commit author checked against DB user without printing email; forged body identity ignored. Permission denial verified with native AuthorizationManager. Project stayed version3/main.tex; actual push intentionally not invoked. Dedicated process-only settings and exact-UUID cleanup, followed by successful unbound/default-off native API verification. plan/git-push-runtime-native.json and git-runtime-post-cleanup.log. Remaining login/CSRF and browser/native transport integration explicitly unproven.

### Automatic Git notification behavior
Current frontend checks remote once per minute while Git panel is open, browser visible/online and no review/action is active. It fetches then updates cached status/graph; no auto project application. Incoming differences show notice next to explicit review button. Rail preserves mounted tabs, so visibility must come from rail/layout context, not just component mount or document.visibilityState.27 tests/lint pass. No browser screenshot/native deployed acceptance for this new control yet; source-only. Review dismissal/resume and cross-panel persistent notifications remain possible next work; do not describe current polling as always-on background watcher.

### Review dismissal semantics
Close review is UI dismissal, not remote cancellation. Explicit status allowlists prevent unknown/new server states from accidentally exposing dismissal. Both controls preserve server journals/checkpoints; fresh prepare creates fresh snapshot. Automatic check resumes after merge dismissal; prepared push onReview callback becomes false after close.28 tests and component browser420/900 pass, screenshot reviewed. Retention cleanup and fully integrated browser acceptance remain outstanding.

### Structural sync prerequisite
Asset bytes alone were insufficient: native snapshot omitted entity IDs from returned metadata, and RecoveryStore froze only documents. Added asset identity propagation and content hash validation. Same-byte replacement now invalidates reviewed apply/partial progress. Binary checkpoint roundtrip uses actual disk RecoveryStore; test initially failed with metadata.assets undefined and exposed filtering bug, now fixed.72 regression tests, focused recovery-invalid test, scoped lint pass; native text fixture preparation passes but is not evidence for native binary application. Structural adapters and history settlement still pending.

### New document tree commit stage
GitDocumentTreeCommit uses actual native project tree shape and exact Git apply ticket. Dedicated receipt and insertion/version update in same Mongo transaction; no success to executor until later history/docstore stages. Actual Mongo test uses disposable collections and no project files. Parallel matching requests insert once; receipt insertion exception rolls back tree; .git/traversal/native top-level reserved name/missing folder/pathcollision/permission/version/entity-limit checks pass. This primitive only creates documents under existing folders; no creation UI/runtime adapter claimed. No deployment.

### Storage-only creation stage
GitDocumentStorageStage retains original docId before network dispatch and never retransmits an existing intent. Readback checks initial version0, rev and reviewed SHA256; success is storage-only. Mandatory authorizeStep must eventually bind native permissions/admission/inFlight state; currently dependency contract tested with fixtures, not wired production. Added recheck comparison after noticing a permission callback alone would not detect returned changed step path/hash.78 regressions/lint pass. No native storage completion claim and no deployment. A crash before dispatch can conservatively retain unresolved staging; safe terminal handling remains future work.

### Native new-document storage acceptance
Actual docstore initial revision was >=1 (unit fixtures permitted0); stage correctly retains returned revision and tree commit checks it. Lost-successful-response readback and restart produce only one POST. Tree now verifies persisted stage receipt transactionally instead of trusting caller's docId/rev. Native test rejects storing state and mismatched rev before tree version changes. Docstore cleanup checks HTTP404 specifically, not arbitrary read error. Disposable data fully removed. Native authorization/admission/history and runtime/browser wiring remain distinct unverified requirements.

### Creation history retry semantics
New stable event builder derives payload from both confirmed storage and tree receipts, with original bytes SHA256 verification and fixed timestamp. History processor accepts creationWriteId only for add-doc-shaped events; same-ID conflicting events fail before ordering. Already persisted tagged retries are removed even when behind newer events; untagged ordering remains strict.43 processor tests/80 backend regressions pass. Explicit ES-module parser needed for this service's lint invocation. This is payload/dedup groundwork, not proof of Redis queue delivery or durable history persistence.

### Creation history durable delivery foundation
Immutable outbox event saved/readback before enqueue; DU loads event itself and confirms current project ticket/tree version/history ID, never accepts browser event data. Repeated enqueue is permitted only for same stable event (processor dedup implemented previously).83 backend/25 DU unit tests pass; web lint passes, DU missing config limits static check to explicit parser/no-unreachable. This checkpoint does not prove real queue persistence or history settlement and adds no public feature/deployment.

### Official GitHub sync behavior checked
Source: https://docs.overleaf.com/integrations-and-add-ons/git-integration-and-github-synchronization/github-synchronization
Official documentation says conflicting simultaneous edits cause a separate branch containing the Overleaf version, to be merged manually. Thus blanket overwrite is not confirmed as intended behavior. Documented limitations include pull-induced loss/displacement of track changes/comments, bundled multi-user edits under connected owner's identity, and lack of branching support in Overleaf Git. Product requirement: no silent overwrite; preserve snapshots and revalidate collaborative state at apply time. Native creation queue checkpoint verified in plan/git-creation-queue-native.json; consumer persistence remains unverified.

### Creation history confirmation stage
Added internal GitDocumentHistoryConfirmation.mjs: requires current in-flight authorization, receipt-backed outbox enqueue, exact persisted history ID/structure version, immutable snapshot at reported history version, native Snapshot parsing and exact created UTF8 content/hash comparison. Reauthorizes before majority immutable proof write, reads proof back, never claims full apply completion. Six focused tests cover queue-only evidence rejection, missing/changed snapshot content, changed authorization, lost receipt acknowledgement recovery and changed identity/conflicting proof. Full89 Git/deletion-admission regressions and scoped web lint pass. Initial changed-content fixture used invalid raw file format; strengthened status assertion exposed it and corrected to native File.toRaw(), then reran all tests successfully. Evidence plan/git-creation-confirmation-{tests,regression,lint}.log. Dependencies for history service/authorization remain injected; no native end-to-end persisted history acceptance, runtime creation adapter or deployment yet. Next actual history consumer persistence probe and native adapter integration, structural progress guards; full Prism/Git goal remains active.

### Native immutable history reader and internal service composition
Added GitDocumentHistoryReader.mjs with timeout-bounded native project-history version and history-v1 snapshot reads; snapshot URL takes confirmed immutable history ID directly rather than re-resolving project mapping. Confirmation now passes that ID; test asserts it. Added GitDocumentHistoryService.mjs composing actual DU queue client, durable outbox, reader and confirmation while requiring caller's exact authorization/receipt readers/project lock. Not wired into public apply runtime. Native probe plan/git-history-reader-native.mjs/.py copied into UUID isolated candidate directory and read existing synthetic fixture: real history version3, structure3.0, parsed editable main.tex. First probe lacked private staging auth initialization and returned401; initialized existing private env without printing, rerun passed. Scoped lint and89 backend regressions pass. Evidence plan/git-history-reader-native.json, git-history-reader-regression.log, git-history-reader-lint.log. No manuscript edits/deployment. This verifies actual read transport, NOT consumption/persistence of a newly queued creation event; that full native pipeline plus structural progress/runtime integration remains next. Full goal active.

### Native Redis creation consumer persistence acceptance
Added plan/git-creation-consumer-native.mjs/.py. Probe copies current project-history code to UUID directory, allocates fresh history ID, namespaces all history Redis keys, seeds stable creation JSON, invokes actual processUpdatesForProject (native lock/read/parse/compress/blob upload/history append/queue removal), reads persisted snapshot bytes/structure version and retries duplicate event. Duplicate same batch and later retry leave history version1 unchanged. Cleanup deletes only allocated history and exact synthetic metadata/keys; /latest/history returns404 afterwards. Native report passes; JS/Python syntax checks pass. First auth attempt lacked V1_HISTORY_PASSWORD initialization (separate from STAGING_PASSWORD); corrected private environment before module import. Cleanup test initially expected404 from /latest/content, but that endpoint propagates missing-chunk as500; verified source and used /latest/history which explicitly maps missing chunk to404. Runner removes stale report before every run. Evidence plan/git-creation-consumer-native.json/log/run.log. This is real Redis consumer-to-history persistence, but queue seeded directly; DU outbox enqueue + confirmation + native project creation must still be joined into one acceptance run, and creation runtime/progress adapters remain incomplete. No production manuscript/deployed service changes; full objective remains active.

### Composed creation apply adapter
Added GitDocumentCreationAdapter.mjs composing storage.stage, transactional tree commit and history confirmation. It validates matching durable storage/tree/outbox history proof, identity/path/content hash/docId/rev/tree/history versions before normalizing to document-persisted receipt. inspect only authorizes and reads receipts, never invokes storage/tree/history writes; incomplete creation remains unresolved. GitApplyExecutor now passes operationId/attemptId to apply and inspect. Five adapter tests plus executor identity test cover stage ordering, history failure, lost final response, read-only recovery, changed bytes/attempt/proof/payload.95 backend regressions and scoped lint pass; logs plan/git-creation-adapter-tests.log/lint.log. Adapter not registered in native runtime: requires concrete authorizeCreation/current tree-version context and structural progress guard; no complete native composed apply acceptance yet. No deployed services/manuscripts changed. Next native coordinator/progress integration and joined acceptance, then remaining structural operations and full Prism requirements.

### Structural progress validation for document creation
GitApplyProgressGuard now exports opt-in validateDocumentApplyProgress for text modification plus text creation. Reconstructs expected file bytes/document IDs/version0 and increments expected tree version only from confirmed creation receipts; rejects unexpected files, path collisions, collaborator edits, changed document IDs/versions, missing history proof or incorrect tree receipt. Existing validateTextApplyProgress remains strict text-only and is still runtime default. GitApplyJournal validates and preserves creation docId/version/treeVersion/historyVersion rather than dropping structural evidence. Tests cover pending/completed creation, read-only snapshot preservation, concurrent edits and incomplete receipt rejection.98 backend regressions and scoped lint pass (plan/git-creation-progress-tests.log/lint.log). Initial journal test stub returned modifiedCount only, but implementation uses matchedCount; corrected fixture to native Mongo result shape; lint declaration split fixed. No deployment or manuscript changes. Next concrete creation authorization/coordinator and opt-in runtime registration with joined native acceptance; remaining folders/assets/deletions/Prism tasks unchanged.

### Native-record creation authorization and service composition
Added GitDocumentCreationAuthorization.mjs checking exact actor/project/operation/attempt/in-flight write, immutable supplied step, preceding confirmed creation receipts, project admission gate/lifecycle and expected directory version before and after current tree commit. Rechecks native authorization after reads. Five focused tests cover recovery, changed actor/gate/step/lifecycle, mismatched tree history and prior receipt counts; full103 backend regressions and scoped lint pass. Added GitDocumentCreationService.mjs connecting this authorization to storage, transactional tree insertion, receipt-backed outbox, history confirmation and adapter, with caller-provided native I/O and same-client collections. Service imports and lint pass; composed service does NOT yet have joined native execution acceptance and is not runtime registered. Evidence plan/git-creation-authorization-tests.log/lint.log and git-creation-service-lint.log. Initial service write used root-relative path from web cwd and failed without changing files; corrected path. No deployment or manuscript writes. Next joined native service acceptance, then opt-in runtime integration and remaining structural/Prism work.

### Joined native creation service and journal acceptance
Added plan/git-creation-service-native.mjs/.py and git-creation-service-worker.mjs. Uses actual composed creation service, Mongo collections isolated by UUID, real native DocstoreManager HTTP (injected lost successful response), same-client transaction, durable outbox, isolated Redis queue and current project-history consumer/blob/history write, immutable snapshot readback and durable history proof. Exactly one docstore POST; inspect returns receipt without replay; unrelated tree increment rejected. Actual GitApplyJournal rejects incomplete history receipt then persists complete creation identity/tree/history version and clears in-flight/advances nextIndex. Native probe passes, JS/Python syntax checks pass. Fresh docstore and history IDs cleaned and readback404 verified; isolated collections/Redis keys/code copies removed. Evidence plan/git-creation-service-native.json/log/run.log. Explicit limits: test permission callback, isolated project collections, direct outbox-to-Redis queue adapter; DU HTTP, browser/CSRF and complete native apply executor/project-lock integration not covered. No deployed services or user manuscript changes. Next register guarded native creation dependencies, ensure recovery runs under native project lock, exercise full executor/DU route, then missing folders/assets/deletion/Prism acceptance. Full goal remains active.

### Default-off native creation runtime registration and locked recovery
GitApplyService accepts explicit creationAdapter, selects structural progress validator only when registered, and wraps reconcile in native project lock through inspection/journal confirmation. GitSyncRuntime composes creation service with native Mongo collections/transaction/auth/docstore, reviewed content reader, DU queue client and immutable history reader when gitSync.creationEnabled=true. Added setting default false; running services unchanged. New tests prove lock covers recovery and creation without adapter rejects before journal claim.105 backend regressions and scoped lint pass. Actual copied-runtime/API native probe passes default denial, native owner/outsider checks,22 login routes, sanitized status/credential controls; original synthetic fixture unchanged treeVersion3/main.tex. Evidence plan/git-creation-runtime-tests.log/lint.log/native.log. Native probe does not enable creation or execute creation HTTP; remaining gates include native creation through DU HTTP and full executor, realtime file-tree notification, missing-folder creation, structural asset/delete support and overall Prism acceptance. No deployment or user manuscript changes; full goal active.

### Native creation notification and frontend replay protection
Added GitDocumentCreationNotification.mjs emitting native reciveNewDoc envelope (folderId, docId/name/rev, source, actor) only after adapter verifies complete durable receipts. Creation adapter publishes after apply and on successful inspect; publication failure leaves operation recoverable and inspect re-emits without storage/tree/history writes. Service/runtime pass native EditorRealTimeController publisher. Frontend createEntityInTree now deduplicates entity ID across whole tree, preserving later rename/move state instead of appending duplicates.107 backend tests, one focused frontend test and scoped lint pass; evidence plan/git-creation-notification-{tests,frontend,lint}.log. This tests payload/retry and actual frontend mutation helper; no real socket/browser delivery acceptance yet. Redis publication is not browser receipt acknowledgement. Default creation flag remains false; no deployment/user manuscript changes. Next full native DU/executor and live browser notification acceptance; other structural and Prism requirements remain open.

### Joined native creation now traverses web client/DU HTTP and realtime publisher
Extended plan/git-creation-service-native.mjs/.py and worker.mjs; added git-creation-service-du.cjs. Isolated DU subprocess uses current actual HttpController/ProjectHistoryRedisManager, fixture Mongo collections and same namespaced Redis keys as history worker. Actual copied DocumentUpdaterHandler calls loopback HTTP; DU validates durable event/gate and queues it; native history consumer drains it, persists snapshot and confirmation/journal succeeds. Native EditorRealTimeController now invoked by joined service and independent Redis subscriber verifies exact project reciveNewDoc folder/doc payload on apply and recovery. Both passes retain exactly one docstore POST and stale-tree rejection. Probe report plan/git-creation-service-native.json passes; allocated docstore/history cleanup404 and collection/subprocess/code cleanup complete. JS/Python syntax checks pass. No deployment/user manuscript changes. Limits remain fixture permission, isolated project records, no full apply executor native lock/claim/binding settlement or actual browser websocket reception. Next full executor and editor acceptance; overall Prism/Git feature scope remains active.

### Native creation through complete apply service/executor and recovery
Added plan/git-creation-executor-native.mjs/.py derived from joined service probe. Runs actual GitApplyService/executor, atomic admission/journal/binding settlement and native sequentialProjectStructureUpdateLock. Uses actual creation service, docstore, DU HTTP, Redis consumer/history snapshot confirmation and realtime publisher. Native progress reader checks actual stored document/version and project tree. Success advances baseline in same transaction as terminal status/gate release, with exactly one docstore POST; stale second apply rejected without a remaining gate. Recovery variant injects failure after notification publish: operation recovery-required, gate retained, baseline unchanged; reconcile confirms durable receipt under lock; resume completes and releases gate, still one POST. Both pass; artifacts plan/git-creation-executor-native-success.json and git-creation-executor-native.json/log/run.log (latter recovery variant). Syntax checks pass. Fresh native data cleaned with404 verification. Scope retains fixture permission/review/recovery-source and isolated project/binding collections, not live browser or actual Git repository-derived review. No deployment/user manuscript change. Next real editor/browser and repository preview acceptance plus missing folders/assets/deletion and full Prism requirements. Goal remains active.

### Real Git repository preview to native creation acceptance
Added plan/git-creation-repository-native.mjs/.py. Replaces synthetic plan/preview/recovery from executor probe with disposable local Git repository (empty baseline commit then new.tex commit), actual GitRepositoryReader, GitSyncPreviewService, Mongo operation store and private on-disk GitRecoveryStore. Actual plan derived from preview proceeds through native apply service/executor/lock/atomic lifecycle/creation/DU HTTP/Redis/history/notification. Confirms remote commit identity, original empty recovery snapshot, exact committed bytes, settled baseline and stale replay rejection. Both normal and lost-notification recovery variants pass with one storage POST, final gate release and cleanup404. Artifacts plan/git-creation-repository-native-success.json and git-creation-repository-native.json/log/run.log; JS/Python syntax checks pass. Scope still fixture permission, isolated project/binding records, local Git only; no live editor/browser or external GitHub. No running-service deployment or user manuscript changes. Next native browser/project authentication acceptance and unresolved directories/assets/deletion/Prism features. Goal remains active.

### Missing ancestor folders created atomically with document
GitDocumentTreeCommit now creates absent ancestor folders in the same transaction as the document and receipt, stores stable createdFolders IDs/parent order, counts them against entity limit and rejects occupied/ambiguous ancestors. Existing folders reused; one project version increment for this atomic document/path addition. GitDocumentCreationNotification emits native reciveNewFolder parent-first then reciveNewDoc; frontend existing ID dedupe protects replays. Real Mongo probe extended for two missing levels, rollback leaves no folders, limits and concurrent retry insert once.108 backend tests/scoped lint pass. Real Git repository probe now supports CREATION_NESTED=1 and recursively reads native docs; nested tex/sections/new.tex plus lost-notification recovery passes entire preview/executor/DU/history/settlement with one storage POST. Evidence plan/git-document-tree-native.json, git-folder-creation-tests.log/lint.log, git-creation-repository-native.json/log/run.log. Runtime still disabled; no deployment or manuscript edits. Browser/auth acceptance, binary/deletion synchronization and remaining Prism work stay open.

### Native project records and authorization in repository acceptance
Repository probe now supports CREATION_REAL_PROJECT=1: allocates a fresh real projects record owned by stable test owner, uses actual AuthorizationManager on prepare/apply/recovery/resume, and DU reads real project gate while event/operation/binding collections remain isolated. Native owner accepted; outsider prepare403 with no operation inserted. During injected lost-notification recovery, temporarily change only fresh project's owner: original actor recovery403 and state stays recovery-required; restore owner, reconcile/resume succeeds. One docstore POST, gate/baseline settlement and nested directory/history checks remain passing. Native report plan/git-creation-repository-native.json marks nativeProjectPermissionVerified/revokedPermissionBlocksRecovery true. Exact created project deleted by ID+unique test name and verified absent, never drops shared projects collection; other newly allocated data cleaned. JS/Python syntax pass. No existing project/account/deployed-service changes. Still no live editor/browser or external GitHub; operations/binding collection isolation and other structural/Prism requirements remain. Goal active.

### Live authenticated editor sees repository-created document without reload
Added plan/git-creation-repository-browser.py and browser gates to native repository probe. Chromium logs in with unchanged private stable credentials, opens fresh real project before apply, stays open through actual Git preview/native apply/DU/history/notification, sees tex/sections/new.tex without reload, opens document and checks exact source text. Screenshot plan/git-creation-repository-browser.png inspected; JSON/log/run.log passed. Browser uses existing candidate UI (not new Git panel), apply is driven by native test orchestrator, not browser Git route. Normal path only: current candidate frontend lacks newly added dedupe, so repeated-notification browser recovery is not claimed. Fixed cleanup after first successful run: close page before gate release, native DU DELETE shutdown=1 flush/delete cache before docstore destruction; rerun passes. Exact prior probe project6ae5e55d11d0b679675c54f0 cache also cleared after verifying project absent; no shared collection deletion. Final cleanup verifies docstore/history404 and project absence. JS/Python syntax checks pass. No production deployment or user manuscripts/accounts changed. Remaining native Git UI/CSRF/button acceptance, frontend dedupe deployment, binary/deletion sync and full Prism scope still active.

### Preview availability before application
Implemented GitPreviewAvailability from immutable preview bytes and native document identities. Runtime supplies actual apply/creation flags; prepare/read/resolve controller responses expose only canApply/reason/blocked paths, never native metadata. UI lists unsupported deletes, binary writes, attachment replacements and disabled creation before applying; revised previews recalculate and keep native execution guards. Added classifier coverage using real tree merge/resolution, component no-submit/revision-update check, and panel wiring check. Backend110 and frontend30 tests pass; scoped eslint passes. Evidence plan/git-preview-availability-tests.log, frontend.log and lint.log. No deployment, account changes or manuscript changes. This is advance disclosure, not structural support; binary/delete adapters, browser Git route acceptance, branch collaboration and full Prism scope remain unfinished.
Changed: GitSync/GitPreviewAvailability.mjs (new), GitSync/GitSyncPreviewService.mjs, GitSync/GitSyncRuntime.mjs, GitSync/GitSyncController.mjs; frontend git-sync/application-controls.tsx and git-sync-panel.tsx; test/agent/git-preview-availability.test.mjs (new), frontend git-sync/application-controls.test.tsx and git-sync-panel.test.tsx. Paths rooted in services/web/app/src/Features, services/web/frontend/js/features, services/web/test as applicable. Planning/notes appended only.

### Deletion confirmation and partial progress foundation
GitApplyJournal now rejects delete confirmations without native document-deleted state, exact original docId/version/beforeHash, null afterHash, expected cumulative structural version and persisted history version. Saves those fields in majority-confirmed journal receipt. Creation tree-version counting includes preceding deletions for mixed plans. Added opt-in validateStructuralApplyProgress: reconstruct confirmed deletion effects on document identities/files/tree version, preserve archived snapshot, reject missing/unconfirmed deletion, recreated paths and collaborator changes. Existing text/creation validator remains strict; runtime has no deletion adapter and UI still blocks deletes. Tests cover pending/confirmed deletion, corrupted proof, absence without confirmation and collaborator edits;113 backend tests pass. Evidence plan/git-deletion-progress-tests.log and scoped lint log. Changed only GitApplyJournal.mjs, GitApplyProgressGuard.mjs and tests git-creation-journal.test.mjs/git-apply-progress.test.mjs plus planning records. No real files deleted, no deployment or credential changes. Next native deletion adapter must bind Git operation to native reservation/history/atomic lifecycle and executor; not yet implemented. Full Git and Prism objective remains active.

### Executor recognizes deletion confirmation and non-replaying recovery
GitApplyExecutor uses action-specific receipt validation: delete requires document-deleted plus exact doc/version/beforeHash, null afterHash and valid structural/history versions; normal modifications still require document-persisted. Both apply and reconcile reject incomplete receipts and retain uncertain status. GitApplyService optionally accepts deletionAdapter and chooses structural validator only when explicitly registered. Runtime does not register one, flags unchanged, preview still blocks deletion. Added mixed deletion/modification, lost deletion response/reconcile/resume with one deletion and one claim, and incomplete receipt tests.116 backend tests and scoped eslint pass; logs plan/git-deletion-executor-tests.log and git-deletion-executor-lint.log. Changed GitApplyExecutor.mjs, GitApplyService.mjs, git-apply-executor.test.mjs plus plan/notes. No native deletion, deployment, manuscripts or credentials changed. Next implement native deletion adapter authorization/reservation binding and atomic lifecycle integration; existing WritingAssist coordinator is task/proposal-specific and cannot be invoked by inventing task IDs. Overall goal active; complete Git and Prism acceptance still open.

### Explicit Git source identity in native deletion reservations
DocumentDeletionReservations now validates discriminated source=git-sync with gitOperationId/gitAttemptId/gitWriteId/gitReviewRevision and original document snapshot; legacy taskId/proposalId bindings unchanged. Mixed source fields/unknown sources invalid, cross-source reservation reuse rejected. DocumentDeletionReservation schema supports Git source with conditional fields. Web recovery and DU missing-cache recovery compare all Git source fields across storage reads. Added Git reservation lifecycle/source-isolation and recovery identity-change tests.188 combined deletion/Git backend tests and21 DU deletion-manager tests pass, scoped web lint passes. Logs plan/git-deletion-source-tests.log, git-deletion-source-du.log, git-deletion-source-lint.log. Changes: DocumentDeletionReservations.mjs, DocumentDeletionRecovery.mjs, models/DocumentDeletionReservation.mjs, DU DocumentDeletionManager.js, document-deletion-reservations.test.mjs, document-deletion-recovery.test.mjs, plan/notes. No native deletion requests, deployment or user files changed. This adds identity representation only, not authorization: next Git admission must atomically verify exact in-flight step/gate before creating native reservation; native commit/settlement/teardown integration still open. Runtime deletion remains unregistered/default blocked. Full goal active.

### Transactional Git deletion reservation admission
Added GitDocumentDeletionStart.mjs: validates explicit Git binding, exact active reviewed delete step/in-flight attempt/revision and prior structural receipts; verifies document identity/path against native tree; checks project gate/version/member/lifecycle in transaction; writes operation and project counters in same session before native reservation begin. Stable native operationId is gitWriteId. No AI task is fabricated. Unit tests cover identity binding, changed step/version/path/attempt, project query rejection, duplicate/moved native doc and operation CAS miss. Tests use isolated adapters, not real Mongo transaction proof. No runtime wiring or actual document deletion. Next native transaction rollback/concurrency acceptance, then Git commit/settlement integration. Changed new source and git-deletion-start.test.mjs plus plan/notes; full objective remains active. Evidence plan/git-deletion-start-tests.log and git-deletion-start-lint.log.

### Native Mongo deletion reservation admission acceptance
Added plan/git-deletion-start-native.mjs/.py. Executes current GitDocumentDeletionStart and current DocumentDeletionReservations in an isolated candidate subprocess against actual Mongo replica with snapshot/majority transactions and UUID collections. Dependency import relocated only in copied probe source. Injected reservation failure rolls back project and operation counters;8 permission/gate/lifecycle/terminal-state denials leave zero reservations. Revoking owner after transactional project read causes conflict/retry then409, with no reservation or operation counter committed.8 concurrent retries converge on one stable native reservation and8 committed counters. Native project tree/version unchanged; no actual deletion performed. All allocated collections removed and verified absent, copied code removed. JS/Python syntax pass. Report plan/git-deletion-start-native.json/log. No service deployment, account/manuscript change. Next actual Git-bound commit/history/settlement adapter integration remains required; runtime deletion still unavailable. Full Git and Prism objective active.

### Native deletion adapter contract and read-only reconciliation
Added GitDocumentDeletionAdapter.mjs and git-deletion-adapter.test.mjs. Adapter derives explicit Git reservation identity from exact step and authorized context; apply delegates native execution, then independently reads proof. Confirmation requires committed matching reservation, exact native project receipt/history identity/version, soft-deleted storage, absence from tree and live cache absence. Reauthorizes after proof read. inspect never calls executeDeletion, even after a lost response; confirmed notification may be re-emitted. Tests cover incomplete/wrong proof, revoked access, replacement bytes, lost response and no replay.195 combined backend tests and scoped lint pass; logs plan/git-deletion-adapter-tests.log and git-deletion-adapter-lint.log. Important integration finding: existing WritingAssist inspectDeletion re-runs cache cleanup, so cannot be reused as a read-only Git proof reader. Native readProof/authorization/execution composition and cache inspection endpoint still needed; adapter is not registered in runtime. No real deletion/deployment/user files changed. Overall goal active.

### Read-only native Redis deletion cache proof
DocumentDeletionFence now exposes inspectClearedCache within existing generation-bound operation context. Single Lua execution requires exact deletion marker and absence of all11 document cache keys removed by native cleanup; missing/wrong marker returnsfalse, generation mismatch errors. Never loads documents, writes markers or evicts residual keys. Added plan/git-deletion-cache-native.cjs/.py using random synthetic native Redis document keys, verifying11 leftover cases, missing/wrong marker, generation change and state preservation. Native proof passes, cleanup verifies keys absent, copied modules removed. Existing native version-fence concurrency probe also passes;21 DU manager unit tests and JS/Python syntax pass. Evidence plan/git-deletion-cache-native.json and git-deletion-cache-du.log. Only DU fence source, new probe artifacts, plan/notes changed; no deployment or manuscripts/account change. Next DU read-only manager/HTTP+web client and Git native proof composition remain required; primitive alone does not prove deletion or authorization. Full goal active.

### Read-only deletion inspection manager and internal API
Refactored DU cleanup prerequisites into shared checkDeletionCache; new manager.inspect holds native doc lock/generation context, validates durable reservation/project history/tree absence/storage soft deletion, then only calls fence.inspectClearedCache. Cleanup behavior retained. Added default-off GET /project/:project_id/doc/:doc_id/deletion/:operation_id with no-store/allowlisted response and web DocumentUpdaterHandler.inspectDocumentDeletion using bounded GET and strict identity/boolean checks. False remains unconfirmed; private response fields discarded. Tests assert inspection never reloads/evicts/writes markers, gates refuse by default, URL operation used, client handles true/false and rejects malformed identity/status.136 DU manager/controller tests,69 web handler tests, scoped web eslint and DU syntax pass. Evidence plan/git-deletion-inspection-{du,web,lint}.log. Changed DU app.js/HttpController.js/DocumentDeletionManager.js and their two test files; web DocumentUpdaterHandler.mjs/test; plan/notes. No running service deployment or user content mutation. Native HTTP end-to-end probe and Git proof-reader/commit/lifecycle composition still required before enabling; full goal active.

### Git native deletion proof reader composed with adapter
Added GitDocumentDeletionProof.mjs: validates scoped explicit Git reservation, committed state, native project receipt/history/version, soft-deleted document metadata and no reappearing doc ID/path; invokes bounded DU read-only inspection; repeats durable snapshot and rejects changed receipt before returning proof. No document content loads or mutations. Added git-deletion-proof.test.mjs including actual adapter+reader composition, missing/mismatched state before HTTP and mutations across HTTP read.198 combined backend tests and scoped eslint pass; logs plan/git-deletion-proof-tests.log/lint.log. Source reader is dependency-injected and not yet wired in runtime; tests use isolated collection/HTTP adapters, not native end-to-end deletion. No deployment/user data changes. Next actual Git deletion authorization and native tree/history/storage/cache commit composition, then native HTTP integration; full Git/Prism goal remains active.

### Git deletion authorization before and after native tree commit
Added GitDocumentDeletionAuthorization.mjs accepting adapter args. Validates current native permission twice, exact active plan/step/in-flight attempt/review, preceding creation/deletion receipts, original gate and current tree version. After native removal accepts only matching deletionReceipts entry/current history and own deletionHistoryPending; unrelated pending work/teardown/admissions rejected. Returns original expectedTreeVersion and reviewRevision to adapter before/after deletion. Added git-deletion-authorization.test.mjs for recovery stages, wrong snapshot/actor/receipt/history/lifecycle, revocation and prior deletion history proof.202 combined backend tests/scoped lint pass; evidence plan/git-deletion-authorization-tests.log/lint.log. No runtime registration/deployment/user file changes. Next wrap native DocumentDeletionProjectCommit in same-client transaction with operation/project mutation checks and this authorization; then compose native execute/history/storage/cache and proof reader. Full goal active.

### Transactional native Git deletion tree commit accepted on Mongo
Added GitDocumentDeletionCommit.mjs wrapping existing native DocumentDeletionProjectCommit with same-client transaction, explicit Git binding, pre/post-tree authorization, operation/project mutation counters and native member predicate. Native reservations must already be committing/committed. Added plan/git-deletion-commit-native.mjs/.py based on admission probe using UUID isolated Mongo collections. Verified unprepared refusal, injected failure after native $pull rolls back tree/receipt/counters,5 concurrent commit retries remove once/increment project version once, rootDoc clearing, same pending-history operation and Git gate retained, and post-commit permission revocation rejects with counter rollback. Admission8 concurrent retries checks retained. Native result passes; collections/code copies cleaned, syntax/scoped lint pass. Report plan/git-deletion-commit-native.json/log, git-deletion-commit-lint.log. Scope is real Mongo tree commit with simulated DU preparation; no actual docstore/history/cache deletion qualification. No production/shared project edits or deployment. Next compose real DU prepare, history preflight/confirmation, soft-delete and cache cleanup, mark committed, then adapter/proof/runtime acceptance. Full goal remains active.

### Native Git deletion execution sequence
Added GitDocumentDeletionExecution.mjs composing explicit reservation/authorization, readiness preflight, DU prepare + persisted state readback, transactional tree receipt, history proof, native soft-delete, cache cleanup, live read-only cache proof, and reservation committed/readback. Exact identity checked at every acknowledgement and permissions rechecked before mutations. Errors leave state for explicit same-operation recovery; completed retries do not mutate. Added git-deletion-execution.test.mjs covering stage order, lost successful prepare acknowledgement without new admission, failures at history/storage/cache/proof, wrong acknowledgements and completion suppression.206 combined backend tests and scoped lint pass; logs plan/git-deletion-execution-tests.log/lint.log. Tests use substituted services, not native full-chain proof. No runtime registration/deployment/user deletions. Next compose real service dependencies + adapter/proof reader, explicit recovery wiring and native integration acceptance. Full goal active.

### Git document deletion service composition accepted with real Mongo
Added GitDocumentDeletionService.mjs composing current authorization/admission/transactional commit, native reservation store, native history preflight/confirmation, execution sequence, read-only proof and adapter. authorizeInput independently scopes current plan/binding at every stage. Added plan/git-deletion-service-native.mjs/.py: uses real UUID Mongo project/operation/reservation/doc-metadata collections, real service/tree/history-confirmation/proof code; DU, history HTTP and docstore calls deliberately simulated. Validates completed receipt, one call per mutation stage, read-only inspect, committed reservation, cleared history pending and retained Git gate. Report explicitly nativeHttpServicesSimulated=true; not end-to-end native deletion proof. All isolated collections/copied code cleaned. Native report plan/git-deletion-service-native.json/log; syntax and scoped lint pass. No deployment or user data changed. Next real DU HTTP/history consumer/docstore/Redis probe, then runtime opt-in registration and explicit uncertain-deletion continuation; full Git/Prism goal remains active.

### Actual HTTP deletion inspection chain accepted
Added plan/git-deletion-inspection-native.cjs/.py. Runs exact current web DocumentUpdaterHandler in subprocess via loopback HTTP to copied current DU controller/manager/fence, actual Mongo and Redis. Uses UUID-isolated collections and prefixed Redis key schema. Validates default-off, missing marker false without repair, valid cleared true, leftover docLines false without eviction, mismatched HTTP acknowledgement rejection, soft-deleted metadata prerequisite and no-store409. All seeded collections/namespace Redis keys and copied modules cleaned; JS/Python syntax pass. Report plan/git-deletion-inspection-native.json/log. Scope explicitly seeded committed deletion records and read-only query only, not actual prepare/delete/history consumer chain. No service deployment or user documents/accounts changed. Next real DU preparation/docstore/history consumer integration into Git deletion service acceptance; full objective active.

### Actual native DU preparation from clean cache accepted
Added plan/git-deletion-preparation-native.cjs/.py, reusing isolated current-source DU HTTP and actual current web client harness. Real Mongo project/doc/reservation records and namespaced native Redis cache; no deletion receipt preseeded, native tree contains test doc. Default-off verified. Cache version4 vs reviewed3 rejects with409, removes only preparing reservation, leaves exact content/version and no Redis marker; reinsert reviewed reservation and version3 prepares through actual UpdateManager/DocumentManager/Redis fence to committing; same-operation retry preserves state/content. No storage soft-delete or file-tree mutation performed. Report plan/git-deletion-preparation-native.json/log; code/namespace records cleaned, syntax passes. Scope explicitly clean seeded cache: flush unmodified path skips persistence HTTP; dirty-cache flush and full native history/deletion execution still unverified. No deployment/user files/accounts changes. Next full native service chain with real storage/history and pending-edit behavior; overall goal active.

### Git deletion history provenance and native consumer verified
Fixed DU ProjectHistoryRedisManager.queueReviewedDeletion: explicit Git source validates operation/attempt/write/review identity, rejects mixed task fields, checks current project gate/version/history before enqueue, emits git-sync provenance instead of writing-assist. Legacy source behavior retained. Added producer regression;26 producer tests pass. Added plan/git-deletion-consumer-native.mjs/.py running actual copied UpdatesProcessor, Redis and history storage on disposable history. Creates original document then consumes duplicate deletion events; latest snapshot lacks file, old immutable snapshot retains exact content, later duplicate replay adds no history version. History/Redis/synthetic metadata removed; report plan/git-deletion-consumer-native.json/log. Scope queue seeded directly, not joined DU producer or full Git apply. Syntax checks pass; no deployment or user documents changed. Next joined Git service with real producer/consumer/docstore/DU preparation+cleanup and explicit recovery/runtime integration. Full objective remains active.

### Creation authorization after confirmed native deletion
Fixed GitDocumentCreationAuthorization.mjs to accept preceding document deletion only with document-deleted receipt, exact document identity, original version/hash, null after content, cumulative tree version and persisted history version. Missing receipt now yields controlled409. Existing lifecycle/pending-history and second permission checks retained. Added3 regression tests: before/after creation commit and recovery following deletion,15 incomplete/corrupt/pending-state cases, and interleaved delete/create/create tree counting.209 combined Git/native deletion Node tests pass; scoped ESLint exits0. Evidence plan/git-mixed-creation-authorization-tests.log. Changed only creation authorization and its agent test plus task_plan.md/notes.md/log. No runtime settings, deployment, user documents or credentials changed. This closes one mixed-operation authorization gap, not full native deletion or browser acceptance. Next remains joined native deletion service/DU/history/docstore proof, explicit interrupted-stage recovery, runtime integration, binary support and full Git/Prism acceptance. Goal active.

Joined deletion probe first attempt failed before deletion: web settings do not include DU pathname key function. Use native DU default key schema in isolated probe. Disposable creation/storage/history cleanup completed via finally.

### Joined native creation then deletion verified
Added plan/git-deletion-joined-native.mjs/.py and git-deletion-joined-du.cjs. Copies current Git/native deletion dependencies, DU and history consumer into UUID subprocess paths in existing candidate (no deployment/restart). Real creation allocates docstore doc and history. Then explicit Git deletion service performs native DU HTTP preparation, transactional tree removal, real DU history producer/consumer, real docstore soft-delete, native Redis cleanup and read-only proof; committed reservation and journal confirmed. Latest immutable history snapshot lacks file; original snapshot retains exact text. Stable inspect returns identical completed receipt. Final successful rerun report plan/git-deletion-joined-native.json/log. Cleaned namespace cache, isolated Mongo collections, actual disposable docstore/history and copied modules. JS syntax checks pass. Initial harness failures: web-side cache schema lacked pathname; then web/DU cache configuration mismatch caused persistence fallback. Resolved by seeding clean cache within isolated DU sidecar; removed misleading parent cache assertion. Scope: fixture authorization and resync readiness, isolated project collections, clean seeded cache; no dirty-cache flush, browser, full apply settlement or deployment qualification. User manuscripts/credentials/settings untouched. Next explicit partial-deletion continuation and lifecycle/runtime integration, dirty-edit acceptance, binary support, full Git and Prism scope remain active.

### Native deletion lost-response recovery matrix passed
Extended plan/git-deletion-joined-native.mjs/.py with --lose-response prepare|history|storage|cleanup. Each case first executes real stage then injects lost acknowledgement, verifies reservation committing/original write identity, inspect returns null without mutation calls, revoked fixture authorization rejects continuation, restores permission and explicitly reapplies same service operation in recovery-required state. All4 cases pass. Prepare invoked once in all; history requeued only after lost history acknowledgement (2 calls, unchanged persisted history version); storage PATCH repeated after storage/cleanup loss; cache cleanup repeated only after cleanup loss. Final tree version3, one reservation, completed replay adds no mutation calls, native journal confirmation succeeds, original history content remains exact. Reports/logs plan/git-deletion-joined-native-{prepare,history,storage,cleanup}.{json,log}; matrix plan/git-deletion-recovery-matrix.json. JS/Python syntax checks pass; disposable data removed each run. No production source/settings/deployment/user project/credential changes. This verifies underlying same-operation service continuation, not executor/controller/UI exposure. Reviewed GitApplyExecutor: reconcile only inspects; resume refuses unresolved inFlight. Next explicit native deletion continuation needs coordinated partial-state validation and lifecycle/public API integration. Clean seeded cache/fixture resync readiness and fixture permission remain limitations; dirty-edit handling and full Git/Prism objective remain open.

### Whole-project progress validation for partial deletion
Added validateDeletionRecoveryProgress to GitApplyProgressGuard.mjs. Explicit opt-in accepts only exact active in-flight native document deletion in applying/recovery-required, with explicit null native tree receipt before removal or exact write/doc/path/version/hash/resulting-tree receipt after removal. Reconstructs expected full project from immutable snapshot plus prior confirmed receipts and the pending tree mutation; does not invent history completion, append journal receipts or advance progress. Existing text/creation/structural validators still reject uncertain writes. Added3 tests covering both stages, collaborator content/version/identity changes, remote/binding drift, wrong active step/native receipts and disappearance without proof.212 combined Git/native deletion tests pass; scoped ESLint passes. Evidence plan/git-deletion-recovery-progress-tests.log. Changes limited to guard/test and task_plan.md/notes.md/log. This is an internal prerequisite, not recovery API wiring; caller must read native receipt and authorize exact reservation under project lock and retained admission. Next executor/service continuation needs this validator plus native stage authorization and explicit mutation endpoint/UI. No runtime enabling/deployment/user files/account changes; full Git/Prism goal remains active.

### Explicit executor continuation for interrupted deletion
GitApplyExecutor now offers continueDeletion(projectId, operationId, userId), gated by explicit coordinateDeletionRecovery dependency. Ordinary executors reject by default. Validates active uncertain native document deletion, authorizes before/inside coordination, rereads exact attempt/index/inFlight/plan/prior receipts, invokes original adapter with null content and same write/attempt identity, requires full deletion receipt and journal confirmation, then stops without advancing remaining files. Exceptions mark same step uncertain. Reconcile remains inspection-only. Added4 test groups for identity/no extra claim/no following writes, absent coordinator/collaborator rejection/revoked access, durable state races, and repeated failure/incomplete proof/journal rejection.216 combined Git/native deletion tests and scoped ESLint pass; evidence plan/git-deletion-continuation-tests.log. Changed executor/test plus task_plan.md/notes.md/log only. Not wired into GitApplyService/controller/runtime/UI: native coordinator still must read partial deletion receipt/reservation and apply whole-project recovery guard under project lock. No deployment/settings/user files/credentials changed. Next service coordinator, recovery route/UI and actual endpoint acceptance; dirty-cache/binary/full Git and Prism objective remain open.

### Apply service deletion recovery coordination
GitDocumentDeletionService now exposes readRecoveryContext: verifies native Git authorization, exact bound reservation/write, reads native tree receipt on primary, reauthorizes and rejects stage/context changes. Read-only, no replay. GitApplyService registers executor continuation only for an adapter with this method, holds withProjectLock, verifies apply gate owner/attempt/original tree, reads exact context, preview/repository/recovery snapshot/current full project, uses validateDeletionRecoveryProgress, then executes same deletion and journal confirmation under lock. Exposes internal continueDeletion method; no controller/runtime/UI activation. New git-deletion-continuation-service.test.mjs covers both structural stages and rejection of collaborator edits, tree drift, wrong owner/kind/attempt, missing context and remote changes before adapter mutation.218 combined tests pass. ESLint initially flagged3 multi-variable declarations in new test; fixed declarations and scoped ESLint/retest pass. Extended joined native probe to verify real readRecoveryContext before/after removal and denied permission without mutations; prepare/history lost-response native reruns pass, disposable data cleaned. Logs plan/git-deletion-recovery-service-tests.log and updated git-deletion-joined-native-{prepare,history}.{json,log}. Changed GitDocumentDeletionService.mjs, GitApplyService.mjs, new service test, joined harness, task_plan.md/notes.md/reports. No deployment/settings/account/user document changes. Scope limitation: service coordinator test uses substituted snapshots/lock; native probe tests deletion service context rather than actual GitApplyService/native snapshot route. Next full native coordinator and HTTP/UI integration, lifecycle teardown and dirty-cache handling; full Git/Prism objective remains active.

### Deletion continuation API and frontend control
Added authenticated POST /project/:projectId/git-sync/previews/:operationId/application/continue-deletion using existing controller UUID/session/no-store/public response path. GitApplyService exposes deletionContinuationEnabled only when native adapter recovery context exists. Public response advertises canContinueDeletion only for that capability plus active unconfirmed native document deletion; default response shape unchanged. ApplicationControls shows separate Continue interrupted deletion button only on server capability plus matching uncertain file/status, uses explicit POST, and queries same-operation status after failure without replay or resuming later files. Added public response capability tests and3 frontend interaction cases.219 combined backend tests (see git-deletion-recovery-api-tests.log),33 Git frontend tests, scoped ESLint pass. Initial attempt used Vitest frontend filter and ran0 tests; corrected to NODE_ENV=test TZ=GMT npx mocha --timeout5000 --exit --require test/frontend/bootstrap.js test/frontend/features/git-sync/*.test.tsx and confirmed33. Changed GitApplyService.mjs, GitApplicationResponse.mjs, GitSyncController.mjs, GitSyncRouter.mjs, application-controls.tsx, git-application-response.test.mjs, application-controls.test.tsx plus planning/log. No deployment/settings/user documents/credentials changed. Native runtime still registers no deletion adapter, so capability remains false and new button hidden in live candidate. HTTP/session/CSRF integration and full native snapshot coordinator acceptance not yet run for new endpoint; these remain required along with teardown/dirty-edit/binary support and full Git/Prism goal.

### Native apply-service coordinator: post-tree passes, pre-tree gap reproduced
Extended plan/git-deletion-joined-native.mjs/.py with --coordinator and test-side DU GET document route. Recovery now invokes actual GitApplyService/GitApplyExecutor under native sequentialProjectStructureUpdateLock, reads isolated native Mongo tree using current createProjectSnapshotReader, actual web DU HTTP document client, actual deletion service/storage/history/Redis and journal. Fixture repository/review/recovery map/permission/resync readiness remain substituted. Post-tree history-response-loss case passes: one native project lock, original deletion confirmed once, no next-file execution, second continuation rejects, exact historical original retained, disposable data removed. Evidence plan/git-deletion-joined-native-coordinator-history.json/log. Pre-tree prepare-response-loss case FAILS before mutation: ordinary snapshot GET enters DocumentManager.getDocAndRecentOpsWithLock -> DocumentDeletionFence.withOperation and returns DOCUMENT_DELETION_FENCED. Evidence plan/git-deletion-joined-native-coordinator-prepare.log; no success report. This contradicts broad pre-tree service qualification from substitute-only tests; retain disabled runtime. Correct next fix is operation-bound read-only cache snapshot verification for the exact reserved deletion, not relaxing normal deletion fence or trusting archived bytes as live state. Need enforce native reservation/project identity, Redis generation/marker and doc lock, no load/flush/cache mutation, then scoped snapshot-reader override for only that doc. JS/Python syntax pass; failed probe finally removed synthetic data. Changed only3 joined probe files and task_plan.md/notes.md/reports. Full HTTP/login/CSRF, dirty cache, lifecycle/binary and Git/Prism completion remain open.

### Atomic reserved-document snapshot read primitive
Added readReservedSnapshot to DU DocumentDeletionFence.js with read-only Lua. Within captured operation generation, atomically requires exact deletion marker, raw document version, project identity, matching pathname (native leading slash supported) and present serialized lines; returns serialized snapshot without SET/DEL/load/flush. Rejects invalid input and missing operation context. Caller still must validate exact durable reservation and project authorization under native doc lock. New plan/git-deletion-snapshot-native.cjs/.py passes actual Redis exact-content and8 missing/wrong identity/cache cases, verifies all keys unchanged on success/rejection, simulates generation mismatch and confirms no mutation. Report plan/git-deletion-snapshot-native.json. Existing11-key cleanup inspection regression rerun passes (git-deletion-cache-native.json); JS syntax passes. Isolated UUID keys and copied code removed. Changed fence primitive/new native probe and task_plan.md/notes.md/reports only. No HTTP route/native manager authorization/snapshot-reader integration yet; this primitive alone does not fix pre-tree GitApplyService recovery. Next add exact-reservation authorized snapshot manager and private endpoint, web client/scoped reader, then rerun previously failing native coordinator case. No deployment/account/user data changes; full goal active.

### Durable reserved snapshot authorization in DU manager
Added DocumentDeletionManager.promises.readSnapshot. Validates Git-only fenced/committing reservation and exact IDs/write/review/content binding, holds native document lock and captured fence generation, checks current apply gate and member access, absence of deletion tree receipt/teardown/pending history, unique matching native doc path/identity and nondeleted storage metadata. Calls atomic readReservedSnapshot, parses bounded native text representation, verifies SHA256 against reservation, then rereads durable state/membership and rejects any signature change. Does not use document loader, flush, cache mutation or reservation writes. New ReservedSnapshotTests.js adds17 cases incl success,14 pre-cache denial states, malformed/changed text and mid-read revocation/binding change; all40 manager tests pass; Node syntax passes. First attempt to insert tests used repository-relative path with DU cwd and failed before write; corrected by creating new test file from repository root and reran real new tests. Changed DU DocumentDeletionManager.js, new manager test and task_plan.md/notes.md only. No private HTTP/web client/scoped project snapshot wiring yet, so pre-tree coordinator failure remains pending. Next expose default-off internal read endpoint, validate web acknowledgement, scope snapshot override to exact doc/operation and rerun native coordinator prepare case. No deployment/user data/accounts changed; full goal active.

### Reserved snapshot HTTP/client/scoped reader integration fixes pre-tree recovery
Added default-off private DU GET /project/:project_id/doc/:doc_id/deletion/:operation_id/snapshot. Uses readSnapshot authorization, no-store, allowlisted result and sanitized identity/generation/conflict errors. Web readDocumentDeletionSnapshot validates exact identifiers, text/size/version/path/SHA256 and returns allowlisted fields with bounded request timeout. createProjectSnapshotReader accepts optional internal deletionRecovery doc/write context and configured reserved reader; only matching doc uses it in both snapshot passes, all others normal. Native project reader registers actual web client. GitApplyService supplies context only for active authorized pre-tree deletion; post-tree reads remain ordinary. Extended isolated DU/probe and reran real native coordinator: previously failing prepare-loss case now PASSES with1 project lock,2 reserved document reads,1 call each prepare/history/storage/cleanup, confirmed journal and preserved original history. Post-tree history-loss regression also passes. Disposable data removed; report git-deletion-joined-native-coordinator-{prepare,history}.json/log.220 backend tests,155 DU manager/controller tests,71 web-handler tests pass. Scoped ESLint initially flagged3 test declaration styles; --fix resolved them, exit0; DU syntax passes. Changed DU app.js/HttpController.js, Web DocumentUpdaterHandler.mjs, GitProjectSnapshot.mjs/GitNativeProjectSnapshot.mjs/GitApplyService.mjs,3 tests (DU HttpControllerTests, web handler test, git-project-snapshot),2 joined probe files plus task_plan.md/notes.md/logs. Native probe still uses fixture repository/review/recovery map, permission/resync readiness and clean cache; not live login/CSRF/UI or dirty-edit qualification. Runtime deletion remains unregistered/default-off. Next lifecycle teardown/dirty-cache and full authenticated Git interface acceptance; binary/branch collaboration and full Prism goal still open. No deployment/user manuscripts/credentials changed.

### Git deletion settlement proof during whole-project teardown
Added GitDeletionTeardownProof.mjs read-only verifier: committed exact Git binding, original operation terminal files-applied/partially-applied with no inFlight, same attempt/review, matching reviewed deletion and confirmed journal proof, no active project Git gate, matching native tree/history receipt, old doc absent from tree and storage soft-deleted. DocumentDeletionTeardown handles Git rows separately and requires verifier/current committed binding, reauthorizes removal, never calls readTask(undefined), resumes Git work or settles fabricated AI tasks. Native TeardownService wires primary Mongo evidence reads. Unfinished/mismatched Git deletion blocks removal. Added teardown dispatch regression and proof tests;223 combined tests/scoped ESLint pass (plan/git-deletion-teardown-tests.log). Joined native coordinator history-loss probe now verifies proof false while apply gate retained, finishes files using actual AtomicApplyLifecycle snapshot/majority transaction, then proof true. Does not actually remove a user project; repository binding settlement omitted in synthetic fixture. First probe failed because new verifier imported stale container reservation module; extended isolated dependency relocation glob, rerun passed and synthetic data removed. Report plan/git-deletion-joined-native-coordinator-history.json/log. Changed new GitDeletionTeardownProof.mjs, DocumentDeletionTeardown.mjs/Service.mjs,2 tests, joined probe mjs/py and planning/evidence. No runtime enable/deployment/user manuscripts/accounts changed. Native whole-project deletion route itself remains to qualify; dirty-cache, full authenticated Git UI, binary/branches and full Prism goal still open.

### Native deletion rejects newer unflushed editor state
Extended isolated joined probe with standalone --stale-edit. Real creation first produces actual docstore/history and reviewed Git delete at version0; test-only DU cache seed then writes newer text/version1 and unflushed timestamp. Actual Git deletion service + native DU HTTP preparation returns409 before flush/tree/history/storage/cleanup. Verified reservation preparing row removed, original native doc still in tree/version2, original Git admission retained, no deletion history pending, ordinary native DU read returns exact newer text/version1, docstore still exact original/version0/nondeleted, history version unchanged. Stage calls prepare1/history0/storage0/cleanup0. Report plan/git-deletion-joined-native-stale-edit.json/log passes, disposable records/storage/history/cache/copies removed. JS/Python syntax pass. Changed only joined probe mjs/py/DU helper and task_plan.md/notes.md/report; no production source/deployment/user data/accounts changed. Scope explicitly seeded dirty cache, not browser-generated OT edit or successful dirty flush. Inspected actual persistence path: DU flushDocIfLoaded -> PersistenceManager POST -> private DocumentController.setDocument -> ProjectEntityUpdateHandler.updateDocLines -> Docstore. Next positive dirty-flush qualification needs real native project visibility through that private web path, without replacing it with direct storage mocks. Full Git/Prism goal active.

### Native reviewed dirty-cache flush and retained bytes qualified
Extended plan/git-deletion-joined-native.mjs/.py and joined-du.cjs with --dirty-flush --coordinator --lose-response prepare. Creates fresh UUID/name guarded native projects record, all operation collections/cache namespaces isolated. Seeds reviewed changed version1 while stored original is version0, invokes actual DU preparation -> PersistenceManager -> authenticated native private Web endpoint -> Docstore. First run failed401 because subprocess lacked service credentials; load existing WEB_API_USER/PASSWORD privately from container environment before settings, pass only to child environment, never log credentials. No production configuration change. Verified exact reviewed bytes/version persisted while native tree still contains document, lost successful prepare response, exact reserved snapshot reads under native project lock, same-operation continuation, one call each prepare/history/storage/cleanup, journal confirmation and atomic gate settlement. Added final include_deleted peek verifying exact reviewed version1 remains recoverable after soft deletion. Original creation history content remains exact. Final probe passes and removes fresh project by ID+name (never drops shared projects), isolated storage/history/cache/collections/copies. Evidence plan/git-deletion-joined-native-dirty-flush-coordinator-prepare.json/log; JS/Python syntax checks pass. Inputs current native service code; changed only three probe files plus task_plan.md/notes.md and evidence. No user manuscripts, stable account, production sources or deployments changed. Limit: seeded dirty cache, fixture repository/permission/resync, no browser OT generation or new-edit history event. Next actual OT/browser concurrent editing and full authenticated Git UI/runtime qualification; binary and branch collaboration remain open. Full Git/Prism goal not complete.

### Native OT edit and exact history before Git deletion passed
Extended three joined probe files with --native-edit requiring --dirty-flush --coordinator --lose-response prepare. Fresh named project starts from original clean cache; release fixture creation admission, invoke actual UpdateManager.promises.lockUpdatesAndDo/applyUpdate with ShareJS delete+insert op, document identity, version0 and user metadata. Verify actual DU HTTP snapshot version1, then drain native namespaced history queue using current UpdatesProcessor and check edited history snapshot exact text at history version2. No edited cache bytes or history payload are synthesized after applyUpdate. Subsequent reviewed deletion validates actual dirty cache, flushes through private native Web endpoint, recovers lost prepare response under project lock, confirms original identities/journal, preserves reviewed soft-deleted docstore bytes and original history. Report plan/git-deletion-joined-native-native-edit-dirty-flush-coordinator-prepare.json/log passed, disposable data removed; JS/Python syntax pass. Initial failures were test harness mistakes: callbackified UpdateManager instead of promises; missing getDocument fromVersion caused NaN range (not actual cache inconsistency); missing update.doc rejected by history translator. Corrected all without weakening native guards. Changed only probe mjs/py/DU helper, planning and evidence, no production sources/settings/accounts/manuscripts. Still seeded initial cache and fixture repository/authorization/resync; browser/session and simultaneous-user OT acceptance remain incomplete. Next actual concurrent edits/browser Git acceptance and runtime capability registration, then binary/branch requirements. Full objective active.

### Opt-in native document deletion registered in Git runtime
GitSyncRuntime now registers createDocumentDeletionService only when gitSync.deletionEnabled===true; default settings explicitly false. Uses same-client projects/operations/docs/documentdeletionreservations collections, native transaction/auth/DU/docstore, bounded native history readiness/version reader, and realtime removeEntity event tagged git-sync. Cross-checked actual DU mongodb collection is lowercase documentdeletionreservations (corrected initial camelcase wiring before qualification). Runtime passes deletionAdapter to apply service and publishes deletion capability; preview permits only native document paths with exact true flag, blocks attachment deletion and disabled cases. DocumentHistoryReader adds validated bounded resync-pending GET; local real HTTP test verifies false/true/503 and invalid identity rejection without request. Added preview capability test, updated service registration comment. Combined backend224 passed before added HTTP test; focused final4 tests pass in git-deletion-runtime-capabilities.log, scoped ESLint and syntax pass. Changed production files GitSyncRuntime/GitDocumentHistoryReader/GitDocumentDeletionService/GitPreviewAvailability and settings.defaults.js, two agent tests and planning/logs. No deployment or user data/account changes. Registration is now present but default-off, requires matching DU reviewedDeletionEnabled. Native service probes already passed, but actual authenticated runtime/CSRF/browser acceptance and notification behavior remain to verify before enabling any demo. Full Git/Prism completion remains unproven; binary and branch workspace features open.

### Logged-in browser receives Git deletion file-tree event
Added plan/git-deletion-joined-browser.py based on isolated joined runner and existing creation browser flow; uses stable private test account, Playwright via uv run --with playwright, fresh named native project owned by fixed test owner, interactive ready/deleted gates. Joined native harness emits actual EditorRealTimeController removeEntity(docId, git-sync), same event as runtime registration. Browser opens project, asserts new.tex exists, waits without navigation/reload, asserts file disappears and captures screenshot. Native coordinator dirty-flush/lost-prepare proof passes as before and fresh project/storage/history/cache/collections/copies cleaned. Report and visually inspected screenshot plan/git-deletion-joined-browser-dirty-flush-coordinator-prepare.{json,png}; log same prefix. System Python lacked playwright; used existing uv package environment, no global install. Changed joined native mjs/new browser py and planning/artifacts only; no production deployment/user manuscript/account changes. Browser deliberately never opens document, avoiding mixing production DU cache with isolated DU cache; screenshot confirms no selection/empty tree. This proves authenticated socket delivery and live file-tree removal, not clicking Git panel apply, real repository review/auth/CSRF, open editor closure, or browser concurrent edits. Next native runtime/controller/full Git browser integration remains. Full goal active.

### Real repository deletion review/archive/settlement passed
Joined native runner now supports --repository with coordinator: creates isolated local Git baseline containing reviewed bytes and a second commit deleting new.tex, actual createRepositoryReader/createSyncPreviewService/createSyncOperationStore/createRecoveryStore, native live project snapshot reads, generated delete plan/doc identity and immutable archived bytes. Atomically claims native admission and journal under project lock, uses journal-generated write ID, runs same native deletion lost-prepare/continuation checks against real preview/archive/ref. Adds isolated binding record and passes bindings into actual AtomicApplyLifecycle finishFiles; verifies baseCommit advanced to plan remoteCommit and revision2. Combined run --repository --native-edit --dirty-flush --coordinator --lose-response prepare passes, preserving original and edited history, dirty bytes before/after deletion, exact step identity, one call per deletion stage, cleanup of temporary repo/project/storage/history/cache/collections. Report plan/git-deletion-joined-native-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Initial failure was old global read-count assertion (8 vs2 because preview/planning reads are now real); fixed assertion to measure recovery-only read delta2, retaining total8 in report. Syntax checks pass. Changes two joined probe files plus planning/evidence only, production/default-off deployment/accounts/manuscripts unchanged. Scope: actual local Git review/archive and atomic claim/settlement, initial execution invokes deletion service directly before actual apply-service continuation; authorization and resync readiness still fixture, not full runtime HTTP/login/CSRF or external GitHub. Full requested Git/Prism goal remains active.

### Normal Apply/Continue/Resume with native permissions and history readiness passed
Joined native runner --full-apply requires --repository; skips test-side begin/startStep and invokes actual GitApplyService.apply using prepared review revision. Executor generates attempt/write IDs and marks recovery-required after injected successful prepare response loss; probe reads these durable identities rather than inventing them. continueDeletion confirms original step; normal resume validates post-deletion project and calls actual atomic lifecycle/binding settlement/gate release. Also replaced fixture project authorization with actual AuthorizationManager for native project (stable existing test owner, no account change), verifies unauthorized random user gets403 before preview. History resync readiness now uses actual bounded native /resync-pending endpoint via DocumentHistoryReader; history consumption remains isolated current-code worker. Final full run --full-apply --repository --native-edit --dirty-flush --coordinator --lose-response prepare passed,3 native project locks/12 snapshot reads/one mutation per stage, original and edited history/store bytes preserved, repository baseline revision2. Evidence plan/git-deletion-joined-native-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Changed two probe files/planning/evidence only; no production code/settings/deployment/user manuscripts/credentials. Initial inspection of deletion content dispatch confirmed checkedContent already normalizes missing merged paths to null; no speculative source fix made. Scope remains real local repository and native service orchestration with isolated operation/cache/history collections; not runtime HTTP/session/CSRF/frontend Apply click or external GitHub. PermissionRevocationChecked remains injected refusal, distinct from native unauthorized-user test. Full Git/Prism goal active.

### Loopback HTTP controller native deletion workflow passed
Added --http requiring --full-apply to joined native runner. Isolated Express loopback server uses current createGitSyncController with actual application service and native AuthenticationController.requireLogin; test-only session middleware injects actor from a probe header. Real HTTP POST Apply with forged body userId still acts as session owner, injected successful prepare loss yields500 then GET status200/no-store/strict public key allowlist/canContinueDeletion. POST continue-deletion200 confirms step and hides continuation; POST resume200 finishes files and atomic repository baseline settlement. Anonymous GET401, native nonmember403, invalid operation UUID404 (matches native InvalidParamsError mapping). Test error handler maps native validation classes but is not full application error middleware. Initial harness errors corrected: static controller import initialized settings before private environment loading (history401); native401 is text not JSON; InvalidParamsError maps404 rather than400. Final command --http --full-apply --repository --native-edit --dirty-flush --coordinator --lose-response prepare passed and all disposable data removed. Evidence plan/git-deletion-joined-native-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Changed2 probe files/planning/evidence, no production code/settings/manuscripts/accounts/deployment. Scope explicitly injected session, loopback endpoint composition rather than production GitSyncRouter/global CSRF/session store; no browser Apply click or external GitHub. Next cookie/CSRF/full runtime and GUI integration; full goal active.

### Actual login cookie/native Redis session/CSRF workflow passed
Added --session requiring --http --dirty-flush. Python Playwright logs in existing fixed account on18081, keeps cookie only in memory and sends JSON via subprocess stdin (not argv/log/files). Node loads existing CRYPTO_RANDOM privately before settings (actual settings.js sessionSecret uses OVERLEAF_SESSION_SECRET||CRYPTO_RANDOM), uses express-session with actual cookieName/secret and native CustomSessionStore/UserSessionsRedis plus Csrf.middleware. No actor injection in session mode. Anonymous/corrupt-cookie GET401, invalid UUID404; missing and wrong CSRF POST403 leave operation ready. Authenticated read-only probe token endpoint supplies req.csrfToken; valid token then drives actual controller Apply/interruption/status/continue/resume and native repo/OT/archive/settlement flow. Final uv run --with playwright python plan/git-deletion-joined-native.py --session --http --full-apply --repository --native-edit --dirty-flush --coordinator --lose-response prepare passes; realLoginCookieAndCsrf=true, injectedSession=false. Report/log plan/git-deletion-joined-native-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare. Initial failures missing SESSION_SECRET file/secret resolved by inspecting only configuration key expressions; no secret values printed. Broad grep encountered service filesystem traversal and was stopped by exact owned command match; terminal143 verified. Fresh disposable project/repo/data cleaned; ordinary test login session uses native expiry, not claimed removed. Changed two harness files and planning/evidence only, no production deploy/account changes/manuscripts. Still isolated HTTP route composition with runtimeProvider service injection and isolated history/cache; production GitSyncRouter registration and browser Apply controls not yet exercised together. Full Git/Prism goal active.

### Unchanged production GitSyncRouter registration passes real session workflow
Replaced hand-built4 HTTP routes in joined probe with unchanged GitSyncRouter.apply. Temporarily assign factory controller handlers to default exported object during synchronous registration, restore object immediately; service dependencies remain isolated test runtime, production source unchanged. Removed global login gate so route's actual requireLogin is tested; native Csrf runs globally and token helper has own login. Added GET continue-deletion404 (POST-only), valid-token negative review revision400 with operation still ready. Full actual-login/cookie/native-session/CSRF/repository/native-OT/apply/continue/resume run now passes and report productionGitRouterRegistration=true. Failure investigation: anonymous requests now cause CSRF session save, uncovering missing cookie-parser in test composition; CustomSessionStore.set needs sess.req.signedCookies. Added native cookieParser(settings.security.sessionSecret), matching cookie options and15s per-request AbortSignal. First unbounded request hit outer90s subprocess timeout and left actual Node/DU alive; verified PIDs12783/12799 and exact prefix git_joined_a224c103365540a2a3a1de8f7c16234a before stopping them. Scoped cleanup plan/git-deletion-interrupted-cleanup.mjs removed fresh project6ae602d7934a50eeddbc29af/docstore/history/prefixcollections; sidecar SIGTERM cleared its cache. Recovery manifest ownership verified before removing /tmp/git-deletion-repository-VwnhyG. Later bounded failed run exited cleanup normally, final run passed and disposableDataRemoved true. Evidence updated plan/git-deletion-joined-native-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Changes harness/planning/cleanup artifact only; no live deployment/account/manuscript changes. HTTP routes now actual production registration, but runtime provider still assembled service, no browser Apply control click/external GitHub. Full goal active.

### Git annotated-document deletion guard added
Inspection found Git recovery snapshot/archive currently stores text/doc versions without annotation ranges; native deletion preparation had no Git annotation-specific gate. DocumentDeletionManager.prepare now checks current snapshot.ranges.comments/changes after draining outstanding edits under native doc lock, before flush/fence/tree mutation. Git rows with nonempty annotations reject409 with actionable error; only preparing reservation removed, fenced recovery record retained. Legacy AI deletion behavior unchanged. Added4 unit cases (comments, changes, fenced recovery, empty ranges) verifying no flush/fence/update and preservation;159 DU manager/controller tests pass in plan/git-deletion-annotations-tests.log. Complete real-login/CSRF/production-router/full-apply/native-OT/local-repository recovery regression rerun passes, temporary data removed. Changed DU manager and unit test plus planning/logs, no deployment/user data. Initial edit command used wrong cwd and wrote checkpoint to service-local task_plan.md; verified exact newly created content, moved to root canonical plan and removed only that accidental file, then edited actual sources and ran tests. Scope: guard for current native snapshot at initial/fenced preparation. Existing committing receipts and missing-cache fenced recovery aren't newly qualified for annotations; full annotation-preserving archive and early preview feedback remain open. This restriction prevents newly reviewed annotated documents from being deleted without recovery support, not a claim of full annotation synchronization. Full Git/Prism goal active.

### Annotated deletion is blocked at preview and planning
GitProjectSnapshot records optional hasAnnotations:true from comments/changes, rereads presence in optimistic second pass and rejects annotation-only presence races even if text/version unchanged. GitRecoveryStore validates optional boolean metadata, keeping old snapshots compatible without archiving annotation text. GitApplyPlan includes presence in reviewed document identity and rejects deleting annotated documents before journal claim; GitPreviewAvailability emits per-file reason even when deletion capability enabled. Existing ApplicationControls displays blocked reasons and disables Apply, so no frontend source change needed. Added snapshot metadata/privacy/race, apply-plan rejection/stale-review and preview reason tests.228 combined Git/native-deletion backend tests pass (plan/git-annotation-preview-tests.log); scoped ESLint passes. Changed4 Git modules and3 tests plus planning/logs. No deployment/user manuscript/account changes. Native under-lock guard still protects later races. Full annotation-preserving archival/restoration not implemented; text modifications continue existing native OT handling, not newly qualified here. Actual full-runtime/browser UI acceptance, binary support, branches and overall Git/Prism goal remain open.

### Real ApplicationControls browser clicks drive native session HTTP workflow
Added plan/git-application-native-ui/entry.tsx bundled with actual ApplicationControls, git-sync.css and fetch-json (no simulated responses), plus plan/git-application-native-ui.py interactive runner. Current joined native HTTP server serves authenticated component fixture, browser obtains CSRF from native middleware. Playwright logs in fixed account; same cookie travels privately over stdin; browser traffic relayed via Docker fetch to actual isolated HTTP port because Mac host cannot directly reach container loopback. Relay preserves method/body/CSRF/cookie, returns actual response without synthesizing state. Browser clicks Apply reviewed changes; injected native prepare acknowledgement loss returns failure, real component auto-GETs same-operation status and enables Continue interrupted deletion; clicking confirms1/1; Continue remaining changes finishes native lifecycle/binding settlement. Browser pageErrors=[], screenshot visually inspected at1000x800. Full native repository/archive/OT/history/persistence checks and cleanup pass. Evidence plan/git-application-native-ui/run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log and completed.png. Added ui gating to joined native mjs and current component bundle/runner; no production frontend logic changes/deployment/user manuscript/account changes. Existing generic report scope says no full UI action; specifically this now qualifies actual application-controls actions, still not full editor GitSyncView or getGitSyncRuntime factory/full live collection setup or external GitHub. Source report now includes browserScope to clarify future runs. Full goal remains active; branch workspaces/binary/other Prism requirements still open.

### Actual Git Runtime factory capability and authorization qualification passed
Updated guarded existing plan/git-sync-api-native.py for23 native routes and continueDeletion. Uses actual getGitSyncRuntime (no factory replacement): verifies apply disabled404; apply on/deletion off gives no registered continuation or public deletion capability; deletion true registers native deletion service and advertises exact supported uncertain delete; toggling off removes public continuation; internal write IDs/recovery paths stay absent. Route exactly POST. Probe found actual nonmember continuation returned409 before auth when capability disabled. Fixed GitApplyExecutor.continueDeletion to await project write authorization before capability check, without reading journal. Added regression asserting403/no read. Executor15 tests and scoped ESLint pass; native runtime probe now passes all owner/nonmember/flag/publicresponse/credential and push checks. Artifact plan/git-sync-api-native.json/log and git-runtime-authorization-tests.log. Fixture manuscript6ae5a9739305e09f47bc2951 read-only; test UUID operation and existing synthetic credential scoped records cleaned in finally. Runtime settings toggled only in subprocess; live deployment/account unchanged. Changed executor/test/native API probe and planning/evidence. This proves actual Runtime registration/config, not that full native mutation chain has run through getGitSyncRuntime with production collections; previous component chain still uses isolated service provider. Full Git/Prism goal active, binary/branch and full editor integration open.

Full GitSyncView first browser run found fixture relay dropped query strings, so file?path=new.tex returned validation failure. Fixed relay to preserve query, added line-diff and removed-row assertions. Failed run reached normal probe cleanup; no production code change required.

### Full GitSyncView native browser acceptance passed
Replaced ApplicationControls-only fixture with actual GitSyncView. Native controller provider now supplies actual isolated repository reader and preview service plus current prepared operation. Browser verified real two-commit graph, new.tex review, line diff and removed rows, then Apply -> lost prepare acknowledgement -> Continue interrupted deletion -> Continue remaining changes. Native login/CSRF/router, OT edited bytes, recovery archive/history/storage and final baseline settlement checks pass. pageErrors empty; disposableDataRemoved true. Screenshot visually inspected at plan/git-application-native-ui/review.png; report plan/git-application-native-ui/run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json. First run uncovered query-string loss in test HTTP relay, fixed before passing rerun; no production bug claimed. Changed fixture entry/bundles, runner, joined native provider and records only. Existing user data/account/deployment untouched. Still isolated panel/service provider with local Git; not full editor/runtime factory mutation or external GitHub sync. Binary files, branch workspaces and remaining Prism requirements stay open.

### Saved merge decision UI corrected and native roundtrip passed
ConflictControls no longer selects web by default for automatic merges (which could actually delete file). Requires explicit draft choice, labels unsaved choice as not yet affecting Apply, restores saved resolution and uses actual merged text instead of replacing it with web text. GitSyncView supplies typed saved choice and result text; keyed revision remount reflects successful save. Added two regression cases; all35 Git frontend tests and scoped ESLint pass. First test invocation from root failed module alias resolution; corrected cwd services/web, no source workaround. Native full-panel browser now saves web choice, verifies zero changed files/No changes, then saves remote deletion, verifies selected saved choice and deleted-line diff, applies and recovers interrupted native deletion. Report savedWebThenRemoteDecisionVerified true, no page errors, all isolated native cleanup passed. Changed production conflict-controls.tsx and git-sync-panel.tsx, corresponding tests, fixture runner/bundle and records. No deployed service/account/manuscript changes. Full editor integration, GitHub roundtrip, binary support, branches and remaining Prism scope are still incomplete.

### Unsaved merge decisions block stale preview application
ConflictControls reports dirty state, provides explicit discard resetting to saved choice/merged text, and clears dirty state on revision/file unmount. GitSyncView disables application, push, review refresh/prepare/close and file switching while unsaved; Save remains available. Added panel regression verifies blocked buttons cause no application request and discard restores prior preview.36 frontend tests and scoped ESLint pass. Real native browser rerun asserts Apply disabled after selecting web choice, saves web then remote decision, and successfully applies/restores interrupted deletion with archive/history/baseline checks. pageErrors empty, disposable data removed. Changed two Git UI modules, panel test, browser fixture runner/bundle and records. No deployment/user content/account changes; overall objective incomplete. Next substantial step remains full editor/runtime integration, not further treating isolated panel acceptance as completion.

### Actual Runtime native project preview and apply-plan qualification passed
Verified rail GitSyncPanel and production runtime/routes are already wired but gated off. Extended native UI probe to exercise actual getGitSyncRuntime service.prepare/readFile/planApply with fresh real project, standard gitSyncBindings/gitSyncOperations collections and UUID repository under configured root. Runtime/native snapshot test copies only relocate DocumentUpdaterHandler import to identical copied handler bound to isolated native DU endpoint; no function mocks for preview path. Assertions prove native OT-edited reviewed bytes/version, deletion result, exact docId and one-step apply plan. Temporary standard-collection records removed by projectId/bindingId in finally. Existing complete browser/native apply recovery still passes; runtimePreviewVerified true, pageErrors empty, disposableDataRemoved true. Changed plan/git-application-native-ui.py and plan/git-deletion-joined-native.mjs plus evidence/records; production code/deployment/user data unchanged. Initial Python edit matched nested dependency loop causing syntax error before any execution; repaired scoped block, final run passed. This qualifies actual runtime preview/plan only; mutation still assembled isolated service. Next: execute actual runtime application on owned disposable fixture with standard reservation/history collections, then full editor UI. No claim of overall completion.

### Actual Runtime text modification persisted and settled
Extended native joined fixture with real local repository text commit before deletion scenario. Actual getGitSyncRuntime.service.prepare and getApplicationService().apply use standard gitSyncOperations/bindings and native project collections, unchanged reviewed-write controller/writer and native docstore. Assert files-applied, exact changed cached and durable text, document version +1, binding baseline equals incoming commit, and project application admission released. Then resulting content/version feeds existing native deletion/UI recovery scenario, which still passes. Sidecar routes native ReviewedWriteController and isolates its receipt collection under fixture prefix; cleanup drops only prefix receipts, deletes standard Git rows by fresh project ID/binding UUID, destroys only owned project/history/storage. First attempt404 exposed missing reviewedWritesEnabled on isolated sidecar; added flag there only. Final report runtimeTextApplyVerified=true, runtimePreviewVerified=true, pageErrors=[], disposableDataRemoved=true. Changed plan/git-deletion-joined-native.mjs and plan/git-deletion-joined-du.cjs plus evidence/records, no production deployment or user manuscript changes. Runtime handler imports still relocated to identical copied handler bound to isolated DU; runtime deletion mutation remains assembled service, browser still standalone GitSyncView. Full editor and external GitHub/binary/branch/Prism scope remain incomplete.

### Deployed editor reads actual Runtime-written text
Added editor gate after actual runtime text apply. Playwright opens a separate authenticated page on deployed18081 project URL, checks actual file tree/new.tex and CodeMirror state text exactly equals runtime-written manuscript, captures plan/git-application-native-ui/editor.png (visually inspected). Closes editor before continuing; native harness evicts only fresh project from deployed DU using normal DELETE project cache endpoint, also guarded in finally, then continues full isolated review/deletion recovery. Final report deployedEditorReadsRuntimeContent=true and prior checks pass; disposableDataRemoved true. Initial attempt used Browser.new_page implicit context, which forbids a second page; changed to explicit shared browser context. That failed attempt still ran scoped cleanup; final run passes. Changed plan/git-deletion-joined-native.mjs and plan/git-application-native-ui.py plus evidence/records only. Deployed files/config, fixed credentials and user manuscripts unchanged. This is reopen/read integration with actual editor, not live cross-client synchronization or in-editor Git-panel mutation; compilation not asserted (fixture is plain text). Remaining full goal unchanged.

### Live editor receives actual Runtime text update without reload
UI acceptance now shares native document-updater cache/locks for freshly allocated project/doc IDs; history queue and receipt collections remain fixture-isolated. Before actual runtime apply, open deployed editor/new.tex and assert current unflushed revision. After runtime apply, same open CodeMirror document receives exact incoming text without navigation/reload; subsequent reload retains content. Browser/native deletion-recovery regression still passes. Report deployedEditorUpdatedWithoutReload=true and disposableDataRemoved=true. Scoped cleanup evicts only fresh project cache via native DU endpoint (also finally), then destroys owned storage/history/project; no global key scans beyond isolated prefixes. Changed plan/git-deletion-joined-du.cjs, plan/git-deletion-joined-native.mjs, plan/git-application-native-ui.py and evidence/records; deployment config/code and user projects unchanged. This qualifies single open editor delivery plus persistence, not simultaneous edits or Git UI inside full editor. Remaining GitHub push/pull, branches, binary files and Prism objective incomplete.

### Intervening browser edit refuses stale Runtime apply; explicit merge preserves both
Two real editor pages (same authenticated account) open fresh project after runtime preview. Peer inserts note through actual keyboard/OT; first page observes it. Native Runtime apply of old preview rejects409; exact peer text, old Git baseline and absence of application ticket verified. Fresh preview explicitly resolved to incoming Git text plus peer note; actual runtime apply persists both, increments current version, settles baseline, updates both open pages without reload, and survives reload. Existing deletion/UI recovery chain passes. Initial run reached these assertions but cache eviction failed because test sidecar and deployed editor produced separate history queues; now UI mode uses native shared history queue/cache/locks for owned project, worker preserves shared history state between calls, teardown removes only project-specific history keys/records. Final report staleBrowserReviewRejected=true, peerBrowserEditPreserved=true, disposableDataRemoved=true. Earlier failed fixture6ae6182ab1946cde7b02af1b verified absent; scoped history state removed. Changed four plan harness files (joined-native, joined-du, history worker, UI runner) and evidence/records, no production code/deployment/user data. Still not different-user permission proof, arbitrary concurrent schedule proof, in-editor Git panel operation, GitHub roundtrip or full objective completion.

### Current full editor Git rail integration passed with test-served assets
Deployed v43 asset scan lacked Git rail code. Built current full frontend into plan/git-editor-assets using project webpack config, no minification, preserved hidden source maps (resolve-url-loader requires them), no copying unchanged vendor assets. Build passed. Added plan/git-editor-native-ui.py: serves current manifest assets only to acceptance browser, retains CSP nonce and ensures Socket.IO loads before new bundle, injects Git feature meta only in test HTML, forwards Git API requests unchanged to native isolated controller. Uses actual full editor rail tab to execute graph/file diff, explicit web/remote resolution, apply, uncertain deletion continuation and resume; all prior native/runtime/two-browser stale-preview checks pass, pageErrors empty, disposableDataRemoved true. Fixed production GitBranchIcon accessible title so tab has name; scoped ESLint and full build pass. Diagnostics plan/git-editor-load-probe.py read existing fixture only (editor may auto-compile), did not edit manuscript. Initial full-page attempts stuck on CSP then socket script ordering; corrected harness, no production bypass. Evidence editor-run JSON/log and full-editor-review.png. Screenshot visually exposes narrow inherited file-tree rail width (~150px), poor wrapping of decisions; next fix panel width/layout before considering usable delivery. Production services/assets/config/account unchanged. Backend deletion path still assembled isolated service; external GitHub, branch workspace, binary support and remaining Prism scope unfinished.

### Git rail width and bounded scroll corrected
Git tab now starts/expands to36% rail size instead of inheriting15% file-tree width, retaining normal resize controls and existing28% literature behavior. GitSyncPanel wraps header/content in bounded flex column; content flexes below header with internal scroll and stable scrollbar gutter. Full editor acceptance asserts panel>=320px at1000px viewport and bottom within viewport, then repeats real runtime/two-session stale-edit preservation and sidebar diff/resolve/apply/recovery. Build and scoped ESLint pass; native browser passes with no pageErrors, cleanup true. Visually inspected full-editor-review.png: ~345px rail, readable decisions and line diff. Changed rail-context.tsx, rail-panel.tsx, git-sync-panel.tsx, git-sync.css plus browser assertion/records/build artifacts. Deployment/user projects unchanged; full GitHub/branches/binary/remaining Prism goals still incomplete. Plain-text fixture intentionally does not qualify PDF compilation.

### Click commit graph entries to inspect changed files
Added bounded immutable commitDetails reader using diff-tree NUL-delimited paths, no rename guessing, first-parent comparison for merges and empty-tree comparison for root. Validates full commit ID, UTF8 paths/status/count/output limits; no checkout/filter/project mutation. Added authenticated read endpoint /commits/:commitId (24 total routes), native read authorization and404 for unbound project. Graph subjects now accessible buttons; CommitDetails displays author/date/shortID, explicit comparison basis and changed file statuses, with abort on selection switch and error/empty distinctions. Tests: real Git initial+merge details and invalidID assertions pass;38 frontend tests pass; scoped ESLint passes after correcting Mocha hook syntax; full webpack build passes. Full editor/native browser clicked real remove-document commit, verified new.tex deleted, closed details and completed previous merge/apply/recovery chain. Actual runtime API probe verifies new endpoint nonmember403/unbound404 and24 routes; existing native checks pass. Changed reader/controller/router, commit-graph/panel/CSS, new commit-details component and tests, native probes/planning. UI failure wording clarified to close/reopen before retry. Deployment/accounts/manuscripts untouched. Commit per-file historical diff, branch workspaces/switch, GitHub roundtrip, binary support and full Prism objective remain unfinished.

### Historical file diffs wired into commit details
Added read-only /commits/:commitId/file?path endpoint with native authorization and25 total routes. Reader accepts only paths changed by selected immutable commit, reads exact literal Git tree path and bounded blobs from first parent/current commit, returns text/absent/binary/unsupported/too-large descriptors and modes. No working tree access or mutation. Commit detail file buttons load existing line/word diff; binary, symlink/submodule, size limit and truncated preview are explicit, and mode changes shown. Tests:39 Git frontend passing; real Git tests cover initial file, first-parent merge, special bracket/space literal path, binary, symlink and unknown path; scoped lint and full frontend build pass. Actual runtime API verifies new endpoint outsider403/unbound404 and25 routes. Full editor acceptance clicks real historical deletion file and verifies removed-line diff, then completes prior sync/recovery/two-session checks; no pageErrors, cleanup true. Changed reader/controller/router, commit-details component, tests and native browser/API harness plus records. Existing deployment/user content unchanged. Branch create/switch/workspaces, actual GitHub roundtrip, binary sync (distinct from preview) and remaining Prism objective remain unfinished.

2026-11-01 Git stability checkpoint: real authenticated local HTTPS Git transport test added at services/web/test/agent/git-https-transport.test.mjs. Real TLS validation, Git http-backend, lease rejection and lost-response reconciliation passed; scoped ESLint passed. Combined backend regression230/230 in plan/git-stability-backend-tests.log. No real remote push/deployment/account/manuscript changes. User-facing Git release checklist now2/8, tracked in task_plan.md; update bracketed progress on each completed milestone. Do not describe this as completed GitHub integration.

Runtime structure probe found a harness lifetime issue: DocumentDeletionManager captures db.documentDeletionReservations when required. Switching db property after first native runtime deletion did not switch module's reference, so later prefixed assembled-service deletion failed before lost-ack injection. Fixed UI probe to use standard documentdeletionreservations throughout; cleanup deletes only generated projectId records (never drops standard collection). Re-run passed actual factory text/create/delete, baseline/tree/docstore/history assertions and original browser recovery chain. Added next probe variant injecting lost prepare acknowledgement at actual factory's DU handler, then factory reconcile/continueDeletion/resume; running verification. Native creation interrupted before complete receipt still lacks explicit continuation and needs qualification/implementation before stable milestone3 can be closed.

Final runtime structure browser run passed: runtimeDeletionRecoveryVerified=true, runtimeStructureApplyVerified=true, runtimeTextApplyVerified=true, peerBrowserEditPreserved=true, disposableDataRemoved=true, pageErrors=[]. Lost native prepare acknowledgement was injected only at copied test handler; actual runtime coordination/journal/adapters/history/storage used throughout. Milestone2/8 remains pending creation-interruption continuation. No processes remain from completed run.

Creation continuation implemented and verified (235 backend,40 frontend,lint,webpack,26-route native API). Real runtime history-failure injection preserved one doc/storage receipt, resumed using original identity, settled baseline; subsequent native deletion recovery/browser regression passed. Evidence plan/git-runtime-creation-recovery-browser.log, plan/git-creation-continuation-tests.log, plan/git-creation-continuation-frontend.log, plan/git-sync-api-native.json. Git milestone3/8 complete for normal lifecycle and explicit recoverable interruptions. Missing ambiguous storage object remains safely unconfirmed with no blind POST. Next actual branch workflows; full delivery/GitHub/Prism remain active. No live test processes remaining.

Reviewed branch-switch implementation: base remains current synchronization baseline, web snapshot retains local modifications, target snapshot pinned to selected existing branch ID. This is checkout-style carry-over, not a merge commit across branches. Journal claim matches targetBranch (null for normal reviews); apply/resume recheck target head, settlement verifies operation/plan target match and atomically changes branch with baseline after receipts. Added API and sidebar selector/preview status; displayed branch changes only on files-applied. Real divergent Git unit/integration fixture passes local-edit carry-over and target-head drift rejection;41 frontend tests and236 backend tests pass,27-route native authorization check passes,webpack and scoped lint pass. Runtime branch-switch fixture in progress (same-content target tests zero-step transaction while retaining dirty web text). Branch creation/merge commit work remains pending.

New-branch publication path now functional through real Git + native Mongo transaction test (local remote only). Expected destination head=null, source baseline stored separately. Lost push response cannot switch web binding until remote exact commit confirmed. Same-name remote race preserves existing branch; cache compare-and-swap handles newly confirmed tracking ref.237 backend/42 frontend, real HTTPS test, lint/build pass. No deployed change or external push. Milestone3/8; next true merge commit workflow, then binary/distinct-user/candidate acceptance.

Branch merge pipeline added: unique common ancestor -> reviewed base/web/source snapshots -> apply keeps destination baseline and writes pendingMerge ancestry -> optional incoming destination review carries same source parent and advances pending destination -> retained commit with two parents -> existing leased push atomically clears pendingMerge. Recursive/multiple-base or unrelated merges reject explicitly. New merges/switches blocked while pending, ordinary incoming review supported. Real Git test verifies conflict rejection, source drift rejection, independent web/destination/source content, destination update before commit, and exact ordered commit parents.238 backend tests and43 frontend tests pass; full build/scoped lint and28-route native authorization probe pass. Native Mongo/local Git push test now confirms actual two-parent push and pending ancestry clearance. Full editor/native runtime zero-file ancestry apply probe running; no live deployment or GitHub mutation.

### Asset storage foundation verified; recovery-before-tree fixed
Implemented GitAssetStorageStage.mjs and GitNativeBlobStore.mjs with immutable history-v1 Git SHA1 blobs, SHA256 reviewed content, durable asset identity, bounded reads, private temporary uploads, authorization rechecks and same-address lost-ack confirmation. Native disposable history/Mongo probe verifies actual uploaded bytes, lost acknowledgement, retry identity, bounded read, cleanup, and caller-buffer mutation isolation. Fixture authorization only; no asset tree/history-event publication or runtime registration yet.
Found and reproduced Document creation is not the active apply step when explicit recovery resumes after storage but before tree commit. GitDocumentTreeCommit now admits recovery-required with the same exact in-flight write/index/attempt checks. Real Mongo regression confirms cancelled/mismatched operations reject, concurrent recovery inserts once, rollback and ACL/path/entity limits remain effective. Native probe passed after failing on original implementation.
Validation:242 combined Git/native-deletion backend tests pass in plan/git-asset-foundation-backend-tests.log; scoped ESLint passes. Evidence plan/git-document-tree-native.json and plan/git-asset-storage-native.json. Changed production tree commit and native blob adapter, asset staging module/test plus native probes and records. Existing deployments, account credentials, real repositories and manuscripts untouched. Checklist remains4/8: asset tree/history/admission integration, distinct-user concurrency, candidate deployment and actual GitHub acceptance remain outstanding. Next inspect native file structure-history payload and implement asset tree commit with transactional receipts before enabling asset runtime.

### Transactional asset creation/replacement stage verified
Added services/web/app/src/Features/GitSync/GitAssetTreeCommit.mjs. Confirmed immutable storage receipt is required; history identity, reviewed size/hash, operation/attempt/write, native project gate, ACL, tree version and document-deletion fences are checked in one Mongo transaction. Creation atomically adds missing folders and native fileRef with fresh asset identity. Replacement checks old asset identity/blob hash, advances rev, clears linked-file metadata like native upload, and records old identity/hash/rev without deleting old content. Tree mutation and durable receipt commit together; exact replay returns one receipt.
Real Mongo plan/git-asset-tree-native.mjs/.py passes creation, replacement, concurrent replay, before-tree recovery, stale blob rejection, permissions/path/entity limit checks, deletion fences and injected receipt-failure rollback. Extended plan/git-asset-storage-native.mjs joins actual history-v1 upload/lost-ack confirmation to isolated native-shaped project tree, then reads exact bytes via published file hash; replay adds no second entry. Both native JSON reports passed; fixture data removed. Scoped ESLint for new production module passed. Prior242 backend result remains prior checkpoint, not rerun this turn; new stage is not yet registered in runtime.
Milestone stays4/8. Remaining asset work: native history event/outbox/confirmation, create/replace/delete runtime adapter and explicit recovery, asset-aware progress validation, binary classification including textual asset formats, actual web acceptance. Existing deployments, credentials, manuscript projects and external repositories unchanged.

### Asset history producer/outbox/confirmation implemented; native consumer pending
Added GitAssetHistoryPayload.mjs deriving an immutable ordered event group from matching storage/tree receipts and exact blob bytes. Creation emits add-file at N.0; replacement emits old-identity removal at N.0 and new-identity add at N.1. assetWriteId/assetEventIndex/assetEventCount identify the retry group. Native original code confirms rename-file then add-file behavior. No binary bytes embedded in event; history references verified Git blob hash.
Added GitAssetHistoryOutbox.mjs: majority durable group admission, immutable payload digest, exact retry comparison and authorization recheck before queue callback. Callback contract requires atomic append of whole group. Added GitAssetHistoryConfirmation.mjs: requires final group version/history identity, exact Snapshot file hash, bounded blob read with SHA1/SHA256/size verification and authorization recheck before durable immutable proof. Queue acknowledgement and partial replacement version cannot confirm.
Four new git-asset-history.test.mjs tests cover binary creation/replacement ordering, mismatched receipts/content/identity refusal, lost-ack same-group retry/tampered outbox rejection, final snapshot/hash/blob proof and permission revocation.246 combined backend tests pass in plan/git-asset-history-backend-tests.log; scoped ESLint passes. These are producer/outbox/confirmation component tests with stubbed native queue/snapshot callbacks, not real history persistence acceptance. Native queue endpoint/consumer validation/deduplication still must be implemented, followed by native history fixture, runtime lifecycle and web checks. No runtime flag/deployment/user content/account changes. Checklist remains4/8.
Next: add separate durable asset event collection and native queue adapter (not reuse doc-only creation endpoint); consumer dedup must key each asset event by writeId plus index, allow exact repeats across queue batches, preserve N.0/N.1 ordering, and reject conflicting variants. Continue with asset deletion and runtime integration after real history-worker verification.

### Native asset history queue and consumer verified separately
Added default-off reviewedAssetEnabled and /project/:project_id/reviewed-assets/:write_id/history internal endpoint, queueReviewedAssetHistory web client/controller, separate gitSyncAssetHistoryEvents Mongo collection. DU queue validates durable payload digest, ordered index/count/version, old/new file identity shapes, history identity and native project admission/version before one queueOps call atomically appends both replacement events. Request body never supplies payload. Project-history consumer validates tagged events, deduplicates by writeId/index, rejects conflicting groups, and filters already persisted events so replacement can resume after its removal event crossed a batch boundary.
Validation:47 native UpdatesProcessor tests,29 ProjectHistoryRedisManager tests,119 HttpController tests pass. Real web-client→HTTP DU→Mongo→Redis probe passes default-off, invalid identity, exact ordered-group replay, mismatched ack and stale gate rejection (plan/git-asset-queue-native.json). Separate actual Redis→processor→history-v1 probe uploads real binary blobs, verifies creation snapshot hash, processes removal separately then retries full replacement group, confirms final hash/version2.1 and no extra version on later replay; disposable history/Redis/state removed (plan/git-asset-consumer-native.json). This is separate queue and consumer integration evidence, not yet a single web apply lifecycle.
Web handler scoped ESLint and native source syntax checks pass. Direct native ESLint invocations could not qualify lint: document-updater lacks discovered configuration; project-history default parser rejects existing ESM imports. Logs retain these tooling failures; no unrelated lint reconfiguration performed. Initial test command used root cwd with service-relative log path and failed before running; rerun in correct service cwd passed.
Changed native DU app/controller/queue/Mongo/config and tests, project-history processor/test, web DU handler, new asset queue/consumer probes and planning/evidence. Existing deployment/settings on disk, account credentials and user manuscripts untouched. Native probes use copied code under UUID directories and isolated fixture IDs/Redis keys, removed afterward. Milestone4/8 remains: next wire actual asset creation/replacement service and history stages, deletion support, recovery/progress validation and runtime browser acceptance. No active test sessions remain.

### Joined asset creation/replacement service verified
Added GitAssetMutationAuthorization/Adapter/Service.mjs composing existing immutable blob staging, transactional tree commit, durable history event group, native queue and snapshot/blob confirmation. Authorization pins active step/attempt/old asset identity/blob/size, current admission and cumulative tree version; checks native permissions before/after reads. Adapter emits asset-persisted receipt only after complete matching history proof; inspect never stages/commits/enqueues, recovery context reads existing asset tree receipt. Prior confirmed document lifecycle and asset create/modify receipts are recognized by the new asset authorization only; other executor/journal/progress modules still require extension before registration.
Actual composed native fixture plan/git-asset-service-native.mjs/.py (new DU sidecar, existing history worker) passes real history-v1 binary upload with injected lost upload ack, Mongo tree commit, injected interruption before history queue, read-only inspect returning null, explicit same-identity retry, real web client→DU HTTP→Redis→processor→history confirmation, then binary replacement with new asset ID/rev1 and final history3.1/blob byte readback. One upload per mutation; stale tree version rejected; all own disposable data/copies removed. Fixture permission callback and isolated project collections are explicit limits; no browser/realtime/runtime executor qualification.
First joined run exposed authorization receiving storage intent extras (historyId/path/afterHash) and comparing them as tree receipt identity. Service now normalizes authorization input to the five operation identity fields, while storage recheck separately verifies history/path/hash intent. Re-run passed. Nine asset authorization regressions cover pre/post tree recovery, gate/actor/version/history mismatches, permission recheck, prior structural progress and replacement old identity/hash/size.
Validation:255 combined backend tests pass in plan/git-asset-service-backend-tests.log; scoped new-module ESLint passes; joined native report plan/git-asset-service-native.json passed. Changed3 production modules,1 test,new native service probe/wrapper/DU sidecar plus records; existing running deployment/config/credentials/user papers/external repositories unchanged. Checklist remains4/8. Next implement native asset deletion with history, notifications and runtime journal/progress/adapter registration, then full editor acceptance. No live sessions remain.

### Retained asset deletion tree stage verified
Added GitAssetRetentionStage.mjs: validates exact delete intent, archived original bytes (SHA256 and native Git SHA1), reads existing immutable native blob, rechecks authorization, persists one majority retained receipt. It never uploads or deletes blobs. Extended GitAssetTreeCommit for delete: requires matching retained receipt/old asset identity/hash/current admission and tree version, atomically removes fileRef with tree receipt, keeps previous blob/hash/rev and beforeHash for recovery. Duplicate identity or stale references reject; receipt failure rolls back tree removal.
Three new git-asset-retention.test.mjs tests cover exact replay/receipt tamper, unavailable or altered blob/archive refusal, permission revocation before receipt. Real Mongo tree probe verifies delete missing-retention rejection, receipt-failure rollback, concurrent replay, preserved original hash/rev. Real history-blob plus tree probe now creates then retains/deletes fixture asset, verifies zero fileRefs and exact original blob readback afterward. Its auth callback is fixture-only; deletion history not yet queued. Reports plan/git-asset-tree-native.json (retainedDeletionAtomicAndReplaySafe) and plan/git-asset-storage-native.json (deletedAssetOriginalBlobRetained); own data cleaned.
258 combined backend tests pass in plan/git-asset-retention-backend-tests.log; scoped ESLint passes. Re-ran actual composed create/replace native service after tree-stage changes: passed, including interrupted history retry and original one-upload-per-mutation behavior (plan/git-asset-service-retention-regression.log). No active sessions remain. Changed retention module,test,tree commit,two native fixture sources/reports and planning records; user content/deployment/credentials/external repositories untouched. Checklist4/8 unchanged.
Next: extend asset history producer/outbox/consumer/confirmation for a single deletion event (distinguish it from creation and replacement group), confirm missing path in native persisted snapshot while original blob remains readable. Then authorize/adapter/service deletion flow, runtime journal/progress and frontend notifications/acceptance. Full Prism/Git goal remains incomplete.

### Composed asset delete/history/recovery verified
Extended GitAssetHistoryPayload/Outbox/Confirmation for explicit assetDeletion=true single removal event at N.0, derived from retained original bytes and tree receipt. Confirmation requires path absence in exact native snapshot plus successful retained blob SHA1/SHA256/size readback. Outbox carries action/beforeHash. Native DU queue validates deletion identity/tag/action; project-history validates and deduplicates standalone deletion separately from the two-event replacement group.
Extended GitAssetMutationAuthorization/Adapter/Service to delete: reads original bytes via server readContent callback (not caller null after-content), invokes retention instead of upload, removes tree reference, confirms deletion history, returns asset-deleted receipt with beforeHash/original assetId/blob/rev. Read-only inspect remains non-mutating. New asset authorization handles prior asset deletion receipts, but other existing executor/journal/progress readers still need asset-aware integration.
Real composed plan/git-asset-service-native.mjs now tests create→replace→delete through native history blob/Mongo/web-client/DU-HTTP/Redis/processor/storage. Injected deletion failure before history enqueue after tree removal; inspect returned null; same operation resumed under recovery-required, confirmed history4.0 absence and original blob byte readback, no extra upload (2 uploads for create+replace only). Existing interrupted creation and stale-tree guard pass. Fixture auth and isolated project collections remain explicit limitations; no runtime executor/browser/realtime integration claimed. Own data cleaned, report plan/git-asset-service-native.json / run log plan/git-asset-deletion-service-run.log.
Validation:260 combined backend tests,48 native consumer tests,30 DU queue tests pass; scoped Git asset module ESLint passes. Added2 focused history deletion tests for exact retained event and rejection of still-present snapshot/corrupt retained bytes; consumer/queue tests reject malformed deletion tags. Changed6 Git history/mutation modules,DU queue,history processor,3 tests,native service probe and records. Existing deployment/user manuscripts/credentials/external repositories untouched. No active test sessions remain. Checklist stays4/8. Next: native file-tree notifications, asset receipts in journal/progress guards and native runtime registration, explicit recovery endpoint/UI, textual asset classification, full browser validation.

### Asset journal and opt-in whole-project progress guards verified
Added GitAssetReceipt.mjs shared isAssetStep/changesProjectTree/validAssetReceipt helpers. GitApplyJournal now validates and retains complete asset-persisted/asset-deleted receipts, original beforeHash for deletion, new identity/blob/rev/history proof, and counts asset modifications as tree-version increments; subsequent document creation/deletion expected tree counts include replacements. Invalid asset-shaped modify intent cannot silently fall through normal text receipt handling.
GitApplyProgressGuard adds opt-in validateAssetApplyProgress and validateAssetRecoveryProgress. Replays confirmed asset create/replace/delete with SHA256 reviewed contents, Git blob hashes, identity uniqueness, exact tree versions, and pending tree receipt identity checks. Final comparison covers all document versions/IDs, all asset IDs/hashes, all file bytes, binding and remote baseline. Existing text/document guard modes remain restrictive. Four new git-asset-progress tests cover every prefix of mixed asset+document plan, unrelated collaborator edits/identity changes, invalid receipts, pre/post-tree recovery, and journal retention.
Validation:264 combined backend tests pass (plan/git-asset-progress-backend-tests.log). Real composed native service now calls actual journal.confirmStep for create,replace,delete and rejects missing historyVersion before recording each result; nativeAssetJournalVerified=true plus existing interrupted creation/deletion and retained bytes pass (plan/git-asset-service-native.json / plan/git-asset-journal-native-run.log). Native permission callback and isolated fixture project collections remain explicit limitations; full runtime/browser still pending. Scoped ESLint initially flagged three multi-const declarations in new test; --fix split declarations, then passed. Production modules passed scoped lint. No test sessions remain.
Changed shared receipt module,journal,progress guard,new test,native joined fixture and planning/evidence; existing deployment/config/account credentials/user manuscript/external repos unchanged. Checklist4/8. Next: doc creation/deletion native authorization must accept preceding asset receipts; DU text native write gate and structural counting need review; doc recovery guards must opt into mixed assets when runtime enabled; add native notifications, asset coordinator/adapter registration and explicit continuation API/UI before browser qualification.

### Mixed document/asset authorization and native notifications verified
Document creation/deletion authorization now recognizes preceding confirmed asset create/replace/delete receipts through shared GitAssetReceipt validation; asset authorization uses the same validator. Missing history and incorrect tree versions still reject. Document creation/deletion recovery guards accept an explicit allowAssets option, default false, to validate mixed prior asset progress only when a coordinator opts in. Tests cover all3 prior asset actions and pre/post-tree document recovery following assets, including collaborator identity changes.
Added GitAssetNotification.mjs with native reciveNewFolder/reciveNewFile/removeEntity publication: replacement removes original identity before publishing new identity, deletion removes only original identity, payload keeps hash/rev/created and native argument order. Validates all identity/folder/event data before emitting. Unit tests verify ordered events, exact retry payload, invalid identity/date/hash refusal. Native composed service now subscribes to real editor Redis channel and verifies6 notification groups across apply+inspect for create/replace/delete, alongside prior blob/history/journal/recovery proofs. nativeAssetNotificationsVerified=true in plan/git-asset-service-native.json; no browser delivery claim.
Reviewed native ReviewedDocumentWriter.js: it binds document version/write receipt and delegates project authorization/tree coordination to web; it does not independently count structural plan steps. No DU text change needed for asset tree increments at this layer; full runtime coordinator qualification remains required.
Validation:269 backend tests pass in plan/git-mixed-assets-backend-tests.log; native service+Redis notification probe passes and removes own fixtures (plan/git-asset-notifications-native-run.log); scoped lint passes after splitting one multi-const test declaration. During edits a generated else lacked if, caught by node --check and fixed before tests. A lint-fix attempt used root-prefixed path while cwd was services/web; failed without editing, corrected to service-relative path. No active sessions remain.
Changed3 authorization modules,progress guard,new notification module,4 tests,native joined probe and planning/evidence. Existing runtime/deployment/config/credentials/manuscripts/external repositories untouched. Milestone4/8 unchanged. Next add assetAdapter/runtime flag and native readContent selection (before recovery archive for delete, merged bytes otherwise), progress/recovery routing, explicit continueAsset endpoint/UI, then actual factory/browser mixed-file test. Textual new assets such as SVG still require classification support before binary milestone completion.

### Asset runtime continuation validation
Evidence: plan/git-asset-runtime-backend-tests.log (273 pass), plan/git-asset-controls-tests.log (46 pass), plan/git-sync-api-asset-native-run.log (29 routes and runtime flag/ACL checks pass), plan/git-asset-runtime-lint.log, plan/git-asset-editor-build.log (exit0). Added UI explicit continuation and availability flags; executor verifies original attempt/write and stops after current asset. Full runtime mixed-asset execution/browser still unverified; do not promote milestone5 yet.
Next classification source: services/web/app/src/Features/Uploads/FileTypeManager.mjs isEditable(content,{filename}) uses settings textExtensions/editableFilenames/max_doc_length and rejects surrogate/null. GitApplyPlan.mjs afterKind currently uses only UTF8/NUL. New UTF8 assets must use native classification, consistently with public preview availability; avoid treating SVG as editable document by default. Preserve existing native document/asset identities. Live deployment/credentials/papers untouched.

### Native UTF8 asset classification and history materialization diagnosis
GitContentKind.mjs now shares classification between apply plans and preview availability; GitSyncRuntime supplies native FileTypeManager.isEditable through preview service and internal capabilities. Native API probe confirms SVG asset, TEX document, existing SVG document identity, surrogate/nonUTF8/max_doc_length rejection. Backend276 tests and scoped ESLint pass.
Extended joined editor fixture to execute actual runtime mixed PNG/SVG/TEX create, injected asset history interruption and explicit continuation, asset replacement, mixed deletion. First actual run failed safely at SVG history confirmation: snapshot projectVersion6.0 matched expected6.0, but file.getHash() was null. Disposable diagnostic rerun confirmed history materialized UTF8 SVG as a StringFile. Fixed GitAssetHistoryConfirmation to derive Git blob SHA1 from exact UTF8 string when hash absent; still independently verifies original blob size/SHA1/SHA256. New regression tests materialized CRLF/Chinese SVG content, changed text/blob, wrong version/history and permission rejection. Diagnostic code removed from wrapper.
Errors: two exploratory zsh wildcard searches had unmatched paths; used actual discovered paths thereafter. Temporary diagnostic insertion accidentally matched nested Python loop and raised IndentationError before launching; repaired and compile-checked. Native runtime rerun is underway; do not claim end-to-end success until terminal output/report checked.

### Mixed asset runtime final result
Final joined runtime/editor probe passed after fixing second integration defect in GitDocumentDeletionStart transactional admission: preceding canonical asset receipts now increment structural version. Added tests for create/replace/delete and absent history proof refusal.277 backend tests pass, relevant lint passes. Report runtimeAssetApplyVerified=true, disposableDataRemoved=true,pageErrors=[] at plan/git-application-native-ui/editor-run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json. Asset actions were actual factory/service calls under native permission/lock/storage/history; browser asset file-tree/recovery controls not yet exercised. Existing full editor text/peer edit and Git graph/review/delete controls still passed. No active processes; deployment/credentials/manuscripts untouched. Next add asset-specific UI gates and live HTTP recovery coverage.

### Asset browser probe implementation and selector corrections
Added plan/git-runtime-http-probe.mjs disposable loopback production router/session/CSRF listener, copied only into own test module directory. Joined fixture delegates interrupted asset continuation and remaining writes to actual editor Git panel over native HTTP. UI gates verify realtime tree add/replacement/delete, doc/file kind, changed asset IDs, old IDs absent, reload persistence. First run reached assets-added after successful live continue-asset/resume, then wrong rail label Files timed out; corrected to native File tree. Second run verified added IDs/types and screenshot but clicked already-selected File tree at replacement, collapsing it; corrected to click only if file-tree is not visible. Both failures were test selector behavior, not a claim of full acceptance. Fresh rerun active. No deployed files/credentials changed. Static fixture is plain text/binary bytes and not a PDF compile/image-decoding qualification.

### Attachment milestone5 accepted in real editor
plan/git-asset-browser-run.log completed0. Report assetBrowserRecoveryVerified and assetRealtimeTreeAndReloadVerified true, alongside actual runtime asset lifecycle and existing editor/Git checks;pageErrors=[],disposableDataRemoved=true. Native production router/session/CSRF was used for live continue-asset and resume. Verified realtime added doc/file types, replacement new IDs/old absence, reload persistence, realtime+reloaded deletion. Screenshots assets-added.png/assets-replaced.png inspected. Test fixture not a compile qualification. Milestone now5/8; next distinct-user concurrency/ACL, then candidate regression and real GitHub acceptance. No active processes or changes to deployment/credentials/manuscripts. This turn changed only local probes/records; previous277backend/46frontend counts were not rerun.

### Distinct-user browser/ACL acceptance
plan/git-distinct-users-browser-run.log passed, own project/data cleaned, no page errors. Two existing fixed accounts used independent authenticated browser contexts; no credentials modified. Reviewer edits arrived at owner browser, stale owner preview rejected and merged result preserved peer text in both browsers. Native runtime authorization rejects readOnly write/prepare/apply even for preview created before revocation, creates no admission and leaves bytes unchanged; removed user cannot read preview/application/project. Only disposable project roles changed/restored. Report distinctUserAccessVerified/distinctAuthenticatedEditorsVerified true. Milestone6 accepted; next isolated candidate build/full runtime regression (milestone7), then actual GitHub qualification8. This is functional concurrency/ACL evidence, not stress test or external GitHub proof. No live sessions remain.

### Candidate v44 build started (milestone7 not complete)
Verified current candidate18081 v43-deletion/demo18080 v41. plan/git-candidate-source-inventory.json compared201 modified/untracked production paths to actual v43 source hashes;139 differ. plan/git-candidate-build-context.py froze source delta and manifest into plan/git-candidate-v44-context, target overleaf-agent-acceptance:20261101-v44-git. Docker build live exec session49579; log plan/git-candidate-v44-build.log. Dependencies fetched/linked successfully (~117s), production webpack currently running; no terminal result yet. Do not restart just because output is quiet; poll same session.
Prepared (not run) plan/git-candidate-verify-image.py validates all201 hashes and image ID; plan/git-candidate-deploy.py gates on verified image, expected old image, zero active agent/Git operations, preserves private existing tokens and creates/reuses0600 credential key without rotation. New candidate-only compose/settings enable Git/DU write/create/delete/assets and push; old compose remains rollback. No activation, key creation or running service change yet. Files contain no credentials. After build terminal success run image verification; before activating re-read plan and verify guards, then use candidate's own HTTP/assets/services for regression. Existing source unit results not rerun this turn; standalone script Python/Node syntax checks passed.

### Candidate v44 direct acceptance result
Build49579 exited0;201 source SHA256 checks passed;v44 image71ef785bea1849496d47503f67523a002d229470d82199419f9ff4f1cd658994 activated only18081 via guarded script. Login200;demo18080v41 unchanged. Native/direct browser initially failed graph EACCES because root fixture seed made private repository dirs; corrected exact new Git roots/fixture checkout ownership to app-data owner(www-data), updated fixture script, resumed sameproject. Direct browser40882 exited0, no page errors: graph/diff/apply, exact main.tex, PNG+SVG assets andnotes document, reload and compiled PDF text allpass. No resource relay or copied production modules in this acceptance. Project6ae63d842901c3da7121eb14 retained for next direct scenarios; reports git-candidate-direct-browser.json,git-candidate-direct-fixture.json,PDF and screenshot. No active processes. Stage7 still pending branch/replacement/deletion/recovery/assistant candidate regression; stage8 actualGitHub pending.

### Candidate PDF rendering refresh failure
Repeatable direct browser script plan/git-candidate-rendered-pdf.py proves first compile visible canvas/text, but refresh shows compile-in-progress and no canvas after90s. Existing downloaded-PDF pass does not cover this failure. Evidence plan/git-candidate-rendered-pdf.json/.log/.png. Inspect request sequencing and CLSI compile lock next; services/web/app/src/Features/Compile/ClsiManager.mjs maps HTTP423 to compile-in-progress. Do not assume stale lock solely from terminal browser and no latex processes. Test19940 terminal; candidate remainsv44, progress6/8.

### PDF refresh diagnosis refinement
Normal sequenced candidate-own-services browser flow passes: initial auto compile, explicit manual compile, reload auto compile all success with actual rendered text/canvas (617x872,958 dark pixels). Evidence git-candidate-rendered-pdf-sequenced.json; screenshot visually verified. Original early-click test did not wait initial auto compile and its generic response predicate could capture wrong request. Do not call that failure a proven lock leak or claim production fix. Early-click/reload overlap remains distinct follow-up. Only test script and planning/evidence changed this turn; v44/demo/fixed accounts untouched. Test sessions29013/75158 terminal.

### Candidate attachment lifecycle evidence
Direct production-assets/runtime acceptance passed replacement then deletion in original temporary project6ae63d842901c3da7121eb14. State plan/git-candidate-lifecycle-state.json retains original/new IDs/hashes and localcommit IDs. Native bytes matchGit and no application gate; main.tex unchanged. Browser real-time filetree/reload pass, zero JS errors. Test-only assetId field mismatch fixed and resumed without duplicatecommit/apply. Currentbinding/localHEAD fd399696f37b5b8b82a1d197b3772092b0650e1b; onlymain.tex remains. No externalremote. Candidate stillv44; demo/fixedcredentials unchanged. Branch operations and agent compatibility remainmilestone7 work.

### Direct candidate branch switching
Three real UI switches passed: candidate-review changed manuscript; main restored manuscript; candidate-identical changed binding with zero file difference. Native exactbranch/base/content + reload verified, pageErrors[]. Fixture refs persisted in git-candidate-branches-state.json. Corrected test tabtoggle only; no production changes. Sessions77960failed/23797passed terminal. Current bindingcandidate-identical, basefd399696; featurecommit6235ffee available for next reviewed merge. Progress6/8; no actualGitHub evidence yet.

### Candidate branch merge acceptance
Actual browser diff/review/apply passed into candidate-identical, native exact text+durable source/destination/commonbase ancestryverified. Reload retains notice and prevents newbranchtransition beforecommit. Report plan/git-candidate-merge-state.json passedtrue,pushVerifiedfalse,pageErrors[]. Session80665 terminal. Current fixture pendingMerge operation20dce307-f52c-495e-aee7-a4be2071dece, source6235ffee,targetfd399696; manuscript contains independently edited supporting material. No remote publication. Next assistant compatibility should read this merged content using actual Codex backend, verify tools/bubbles and unchanged project; don't claim full Prism done.

### Candidate assistant fails closed on injected CUA
Read-after-Git realmodel gate failed beforeturn: unexpectedexternaltoolconnection. TaskGET report git-candidate-assistant-status.json authoritativefailed; older capturedtask running was testlistenergap. Runtime diagnostic git-candidate-mcp-status.json: cua_repl connected3tools despite normal configuredMCPserversdisabled and browser_use/computer_use false. Extra external/in_app_browser/CDPflags ineffective and reverted; explicitthreadMCPcua_repl disabled rejected -32600. Next inspectactualCLI CUA/plugin controls and isolate perprocess; retainfailclosed guard. No liveprocess/session remains; no globalconfigedit/daemonrestart/modelretry. Fixedcredentials unchanged. Current capabilities document now distinguishes currentv44 Gitchecks from historicalPrismchecks.

### Agent compatibility fix and runtime proof
ConfiguredpluginscaninjectMCPserversoutsideconfig.mcp_servers. Disableeffectivepluginsperthread aswellasMCP; do notrelaxinventoryguard. NewdisabledPluginConfigurationcopiesonlyenabledfalse, testscoversecretomission. All117agenttests pass; actualCLIserverinventorynoactiveexternaltools. Sharedtestdaemonrestartedguardedly73960→23658; existingtokens/speech/compiler retained. Actualcandidatebrowsertaskec628b1d-9bbe-49c2-84ad-67bf5d25c751completed: filesystemread mergedmain.texline4,3activityentries, bubblesavatars, unchangednativecontent/mergeancestry. Reportgit-candidate-assistant.jsonpassedtrue,pageErrors[]. Screenshotavailable. Testcapturefixedtoignoreoldconversationresponses. Progress6/8; candidatesstillneedcombinedregression/actualGitHubandfinalPrismaudit.

### Real AI edit compatibility after Git merge
Candidate task8f7b4606-3898-4876-82fe-207a60a6add1 completed actualfileedit+controlledcompile+PDFinspection. Oneproposal, originalnativebytesunchangedbeforeaccept; actualbrowserdiff/accept; exactexpectednativebytesafter, sameGitpendingMerge, reloadeditor/renderedPDFverified. Reportplan/git-candidate-assistant-edit.jsonpassedtrue,pageErrors[]. Fixedtestdefault-openreviewtoggle andresumedsameproposal; nosecondmodelrun. Fixturemain.texnowadds The supporting material is available for review. beforeenddocument. Sessions79305failedtest/45099passedterminal. Progress6/8; nextdirectcandidatecollaboration/access/recovery beforefinal7audit, thenactualGitHub8.

### Candidate actual multi-user/ACL acceptance
Twofixedaccounts, distinctbrowsercontexts; peereditsrealtimeowner andpeerreloadverified. readonlyGETstatus200/POSTpreview403; revokedGET/POST403. Fixture-onlyrolechangesrestoredtonone. Exactmarkerremovedthroughownereditor; nativeexpectedAIeditedmanuscriptbytespassed; noJSerrors. Reportgit-candidate-collaboration.json; session71352terminalexit0. Currentdemo/accountsunchanged. Nextinterruptedrequestrecoverycandidategate before7finalaudit; progress6/8.

### Candidate ambiguous response recovery
Newdisposablefixture6ae6452c036df0304b4ac022 actualGitapply200response droppedaftercompletion. Browserreadbacksameoperation once, exactlyonePOST, confirmednative4files/2assets/reload/PDF. Reportgit-candidate-recovery-browser.jsonpassedtrue,lostResponseReconciledtrue,pageErrors[]. Session56098terminal0. Coverageindexgit-candidate-combined-audit.json has9passingreportgroups, notnewreruns. Remaining7gaps: earlycompile/reloadrequestcorrelation andfinalhostAgent+candidateinventory. Progress6/8. Noexternalremote; originalcombinedfixtureuntouched.

### Compile overlap concrete failure/fix checkpoint
Inflightreload requesttrace provesauto3status too-recently-compiled whilepriorpage manual2running; UIleftServerError90s. Fixedinitialautocompileonly bounded1/2/4s retry forbusy/recentstatuses withabort;7unit+lintpass. Actualcandidateunverified untilv45. Build75238live; immutablecontextplan/git-candidate-v45-context and203sourcehashmanifest, delta2files. Currentv44/demo41unchanged. Resumeexistingbuild, thenverify/deploycandidateonly andtestsameinflightreloadwithNOmanualretry. Finalinventory201validatedpreeditv44+hostAgentPID23658, notnewpendingfrontend.
Buildcorrection:75238terminalfailed duearchitecturemissing--platform; localv44islinux/amd64. Explicitamd64replacementbuild99164live(loggit-candidate-v45-build-amd64.log), old75238mustnotbepolled/restarted. Candidateunchanged.

### v45 build continuation
Build99164confirmedliveagain; yarninstallfinished79s withwarnings,webpackstarted (Browserslist warning84s). Preparedsyntax-checkedv45verifier/deployer/compose andinflightrefreshacceptance withnomanualretry. Noactivationperformed; v44rollbackcomposepreserved. Nextpollsame99164,verify203imagehashesoncebuildterminal0,guardedcandidateactivate,waitlogin200,runv45inflightscriptthenfinalinventory/audit. Do notinferfailurefromquietwebpack.

### Verified build wait checkpoint
Repeatedlivepolls99164throughthisturn confirmstillrunning,noexitcode,nooutputbeyondwebpackstartup/Browserslist84s. No duplicatebuildoractivation. Waitingisverifiedagainstliveexecsession, notjustlogfile. v45acceptancescriptnowrequiresobservedtransientresponsefollowedbyautomaticrender; v45finalinventoryscriptready. Continue99164/loggit-candidate-v45-build-amd64.log untilterminal, thenverify/deploy/test. Progress6/8.

### v45 automatic recovery accepted; Git checklist7/8
Build99164exit0,203image/live/worktreehashespass, candidate18081v45 activatedguardedly; demov41unchangedHTTP200. Inflightreloadactualbrowserreportsbusythenautomaticretry-success andrenderedPDF,nomanualretry/noJSerrors (git-candidate-v45-compile-inflight.json). FinalinventoryhostAgent23658; candidateimage915c1b5a...ad8a. Combinedauditmarksisolatedmilestone7completeonly. ActualGitHub8requiresdesignatedtestrepo/branch; asyncquestionpending. Privateacceptanceconfigonlygit-sync-credential.key,noGitHubtestdestination. Noexternalpush. OriginalPrismrequirementsremainactive. Allsessions terminal.

### v45 literature current evidence
LiveCrossrefsearch, previewandrejectpassedwithunchangedbibliographies/manuscript,pageErrors[]. Zotero liveconnectionfalse; positiveauthnotverified. CurrentUIrailnameLiterature; oldPaperAssistantselectorfixedintestonly. Session59037terminal0, task287738ea-9385-4fe6-b643-d8e6611c1043 rejected. Evidenceprism-v45-literature.json. Pendinguserinputs: GitHubtestURL/branch andZoterouserlibrary/readonlyconnectionviaUI(nochatsecret). Git7/8doesnotmeanwholePrismcomplete.

### v45 image conversion realmodel proof
Taskfd3664a8-f16a-41e2-a9bd-1fbe220be848/project6ae64a3f1405fb5e5615293c: PNGintegralread→actualfileedit→controlledcompile+PDFinspection→reviewaccept→reloadrenderedformula. SourceandPDFscreenshotsvisuallymatchimage; preservedsentence, unchangedbeforeaccept, metadata-onlysavedattachment,noJSerrors. Reportprism-v45-image.jsonpassedtrue;43168terminal0. Pluginisolationfixdoesnotbreakthisimageharnesspath. Git7/8pendingexternalrepo; positiveZoteroconnectionstillpending.

### Current v45 saved review UI acceptance passed
plan/prism-v45-review-browser.py reuses actual accepted assistant-edit conversation on candidate18081, without new model call. Three widths1440/1000/760 passed addition-line/number rendering, viewport-bounded expanded diff, closing and unchanged editor, zero proposal POSTs/noJSerrors; saved assistant/user avatars, bubble and execution disclosure visible. Report prism-v45-review-browser.json passedtrue. Narrow expanded screenshot visually inspected: green added line, old/new line numbers, accepted state and close button clear. This addition-only proposal does not test removed-line coloring, nor every scroll interaction. Initial systemPython failed missingplaywright before browser; reran existing uv package environment, session28087terminal0. Updated current capability table; no production code/deploy/account changes. Git checklist7/8 unchanged, full Prism acceptance still incomplete.

### Whole-scope acceptance audit consolidated
Read baseline/combined plan/current lifecycle source and concrete native JSON evidence. Corrected stale top-level deletion status: ProjectDeleter recovery/admission integration and native archive/restore are present and passed. Added plan/prism-final-acceptance-audit.md preserving full objective, historical-vs-current evidence, current external gaps, and actionable cancellation/diagnostic-repair checks after plugin isolation change. Candidate live inspect reportsv45-compile/running. Previous turn was progress (actual current layout acceptance); this turn audit changed next-action priority and removed misleading incomplete-implementation claim. No source changes, model calls, publication or credentials mutation. Next real current cancel→reload→newtask check; then compile-diagnostic repair. Git7/8, overall incomplete, not at impasse.

### Current v45 cancellation passed; diagnostic repair in progress
Actual sleep90 command observed running; taskba3b44a8-98e4-404d-9e67-c38b3ac2f4ef cancelled via UI in0.10s. No proposals or manuscript mutation; reload preserves cancelled state. Same-conversation readonlytask51f3fea0-ea4e-4c1c-a87f-a3e50a2fd001 completed; source unchanged/noJSerrors. Reportprism-v45-cancel.json/.png/.log; session24852terminal0. Current compile-diagnostic runnerprism-v45-compile.py started session57268 on isolatedfixture6ae64c143fb98b69218c6978. Actual failedcompile and expliciteditableprefill/noautosubmit passed; realmodel task underway, IDs persisted. Do not restart runner if taskIDexists; inspect/resume same task. Git7/8, overall incomplete.

Current compile assistance regression: old prompt forbids tools, but current harness requires file reads/edits to derive proposals. Actual taskcompleted with no proposals confirmed; sourcepromptfixed withtwo passing tests/lint, notdeployed. See task_plan latest and prism-v45-compile-task-status.json. Cancellationcurrentv45passed. Nextv46candidatebuild+realcompileacceptance; noactivejobs.

### v46 build live, acceptance preparation complete
Build session39759 verified live by write_stdin; logprism-v46-build.log shows dependency/link complete andwebpackrunning, no terminalfailure. Do not restartduplicate. Frozenmanifest includes203sourcehashes withonlycompile-diagnostics.ts changed; buildexplicitlinux/amd64 atopv45. Preparedprism-v46-verify.py,guardeddeploy.py/runtimecompose(withv45rollback),final-inventory.py andactualcompile.py. Python syntax passed. Newacceptancestateprism-v46-compile.json reuses retainedbrokenfixture6ae64c143fb98b69218c6978, no task yet. Runner selectsnewconversation, requiresactualnewUIprompt, capturesmodeltaskidentity, waits terminal beforeassertingproposal toavoidprevious180swaitaftercompletednoprop.
Candidate18081remainsv45/demo18080v41, noactivation. Nextpoll39759; uponterminalsuccessverifyimage203hashes,deploywithnoactivetask/Gitadmissionguards,loginreadiness,runactualcompileacceptance thenfinalinventory. Overallactive/Git7/8.

### v46 built, activated and actual diagnostic repair passed
Originalbuild39759terminal0:webpack98.086s/twobundlesizewarnings,image9825087be317fc42218a0cb3267a30e9925ab73cba46d04c165d7dc868b5ff1f.203imagehashesverified; guardeddeploy31854terminal0/noactiveAgentorGitapplication; initial502bootthenlogin200. Candidatev46/demo unchanged. Finalinventory203live/worktreehashespass,AgentPID23658.
Initialbrowser63966terminal1:messagesrejectedLocalagentbusy,no taskcreated; oldcompletedstatusbriefly causedtestKeyError. Preservedprism-v46-compile-busy.json; fixrunnerwaitactualsubmissionresponse, boundedexplicit429retry, requiresnewtaskidentity/terminal result. Successful50046terminal0 hadsingle201, task7c66cbb5-73fe-4ffd-99ff-3ae26bd5c711/conversation7c88d7f6-447d-4d2f-813b-9e883cc7cc8f. Actualprefillusesworkspaceinstruction; read/edit/compile_project/inspect_compiled_pdfcomplete; missingenddocumentrepairproposedwithoutlivechange. Explicitaccept preservesoriginalsentence;compile success/extractedPDFtextverified. FirstscreenshottooearlyforPDFcanvas; separatereadonlyreload77106terminal0 provesvisiblecanvas/textlayerandpersistedenddocument. Reportprism-v46-compile.jsonpassedtrue,renderedPdfAfterReloadtrue; screenshots/log/PDF retained. Sourcefixnowcandidateaccepted, notmerelyunittests. Currentbrokenfixture nowrepaired; donotrerunfirst-runseedacceptanceunchanged. Allforegroundjobs terminal. Git7/8/fullgoalactive; externalGitHub/Zoterogatesstillopen, finalcompatibility/handoffpending.

v46 prompt routing audit found nootherdocument-entrytoolban: JSON grammar channelintentionallytool-free; documentharness receivesinstructiondirectly.10taskmanager tests pass. Candidate handoffplan/prism-candidate-handoff.md recordsactualscopeandexternalgateswithoutsecrets. No codechangesornewmodeltask.

### External gate revalidated; blocked audit turn1
FreshauthenticatedcandidateZoteroGET200 connectedfalse/libraryIdnull (prism-external-gates.json;38781terminal0). No designatedmanuscriptGitHubtestrepo/branchreceived; worktreeoriginLapulatos/overleaf isimplementationrepo, notauthorizedtestdestination. Independentcurrentcancellation/diagnosticrepair/promptaudit/handoffnowdone; updatedremainingactionsinsteadrepeatingpassedtests. RequestedtestURL/branch+allowedtestwrites andZoterolibraryconnectionviaUI(nochatkey). Actualexternalacceptance/finaldemostillunproven. Firsttrueimpasseturntrackedinprism-blocked-audit.json count1; leavegoalactiveuntilthreeconsecutiveblockedturns. Noactivejobs/source/deploy/credentialchanges.

### User login session collision fixed and verified
Samebrowsercandidate18081loginpage→demo18080loginpage→candidatecredentialsPOST reproduced403/sessionerror withoneoverleaf.sid cookie (prism-session-before.json). Rootcause localports sharehostcookiejar whileapps haveisolatedsessions. Scopedconfigurationfix plan/git-candidate-runtime-settings.cjs sets cookieName overleaf.candidate.sid. Guardedcandidate-onlyrestart37347terminal0 afterAgentidle/noGitadmission; noaccount/password/sourceimagechanges. Samebrowsersequence57936terminal0 nowtwodistinctcookies,login200/projectredirect,nosessionerror (prism-session-after.json/.png). User should reloadcandidate/login oncefornewCSRFsession; nocookiepurge/passwordrotationneeded. Bugrepair3/3complete; wholegoalstillincomplete/externalgatespending. Priorblockedstreakresetbyactualuserbugfix.

### User-designated Gitee target and positive Zotero acceptance
Userexplicitlyauthorizedcommit/push/test/modifyonlyhttps://gitee.com/lapulatos/overleaf-repo-test branchrepo-test. Authorizationsavedprism-authorized-remote.json; noexternalwriteyet. Giteeisuserchosenprovider,replacesGitHub-specificacceptancetarget. ExistingcandidateallowlistGitHubonly; addedgitee.comtoisolatedruntime-settings,guardedrestart70734terminal0(noAgenttasks/noGitapplication),uniquecookieretained. Unauthenticatedls-remoterequirescredentials; projectedGitcredentialDBinitiallyempty. Createddedicatednativeproject6ae6a79ece5f0b9e3242f0b0 via guardedseed,fixtureprism-gitee-fixture.json. AskeduserasyncsaveaccesstokeninthisprojectGitpanel(nochatsecret).
Zoteroliveconnectedtrue/library9531967. Actualbrowsersearch/preview/reject/createbibliography/explicitaccept/reloadpassed45610; firstattempt56477hitstartup502/loginselectorbeforeanymutationandretainedstartup-failureartifacts. Currentprism-zotero-live.json passed: itemUWGTTAHGwithDOI, rejecttask0bd67605-a085-44b5-83da-0bdb85d05151,acceptedtaskc9d9b5e6-2d54-4287-ad4d-30932d2d857e. Testproject6ae6452c036df0304b4ac022 nowincludeszotero-acceptance.bib doc6ae6a80e930f773d84038224 (oldGitfixture4filesassumptionnowoutdated).
Paginatedreadonlylibraryquery40itemsfoundnoDOI. ActualnoDOIitemR277FHJP(SemCoder) search/preview/reject/appendexistingbib/accept/reloadbothentriespassed34449; acceptedtaskdc226f32-2e53-4891-bfab-67d157ce0a67. Exactpreviewbeforeprefixpreserved; noDOIfabricated; bothkeysvisibleinreloadednativeeditor; noJSerrors/manuscriptchanges. Reportsprism-zotero-no-doi.json andscreenshots. Zoterooriginalconnectionpreserved,nolibrarywrites,nodisconnecttestclaimed. No secretsprinted. Currentthree-stepconnection/Giteesync/Zoteroimportprogress2/3;Gitstable7/8awaitsauthenticatedexternalroundtrip. Noactivejobs.

### Actual Web-to-Gitee push passed with independent readback
Browser41676terminal0: initialremote main.tex chosenexplicitlyinreviewandapplied; webeditaddedonesentence; actualcommitdiffreview/checkbox/Pushreviewedcommit completedpushed. Commit36808b2b2f9c60cf6cdd65ff8febe74f50e21f81 onrefs/heads/repo-test. Independentproductiontransportfetchin separatebarecheckout45374terminal0 confirms exactremotecommit, websentence andinitialtextpreserved, onlyrepo-testremotehead. Reportsprism-gitee-web-push.json/.png andprism-gitee-web-readback.json/.log. Oldfailedselectorerror movedpreviousAttemptError, notcurrenterror. Do notrerunwebpushfirst-run scriptas-is nowpushed; itexpects prepared state. Noactivejobs. Next externalcheckoutedit+concurrentwebedit,automaticnotice/review/apply merge andconflict acceptance; wholeGitroundtripnotyetcomplete. Usercredentialnowvalid,no moretokenrequests.

### Gitee and Zotero external acceptance: 3/3 complete
Actual repo-test Web push and independent readback passed. External edit plus concurrent nonoverlapping Web edit: automatic remote notification before any write, reviewed merge, reload persistence and pre-merge recovery snapshot passed. Merged Web result pushed as 995ec809fbee8fae6cd31634400f8d53e352a92f. Same-line external commit e081bc783cbf6a960dd8f8728824fbee99a670ee detected conflict; UI omits Apply until resolution, backend canApply=false. Explicit manual resolution preserved both authors, applied and persisted on reload without page errors. prism-gitee-conflict.json passed; native recovery/readback prism-gitee-conflict-native.log confirms exact submitted resolution bytes and pre-merge snapshot retained (operation 3fa1e956-9ce9-49f5-88a0-ec3616d07f34). Test correction: absent Apply button is expected, not disabled; native helper requires /overleaf/services/web cwd. CodeMirror inner_text adds trailing blank lines in test input; exact resolved bytes checked against submitted textarea value, original content compared with trailing whitespace normalized. Conflict resolution remains in Web, not pushed; remote external commit preserved. Only authorized repo-test written. Candidate 18081 v47; demo 18080 unchanged. This completes the three external connection/Zotero/Git acceptance tasks, not a claim that every Prism requirement is complete.

### Current typecheck and Zotero disconnect verification
Previous current typecheck had16 errors:13 baseline plus3 new TS2769 errors in git-sync-panel.test.tsx (unsupported Testing Library exact option). Removed only those3 options;11 panel tests and scoped ESLint pass. Repeated tsc has13 diagnostics byte-identical to prism-zotero-typecheck.log:12 missing optional-module declarations and1 pre-existing nullable project access. Full typecheck is not green. Reports prism-current-typecheck-audit.json and prism-git-panel-typefix-tests.log.
Actual browser/server Zotero disconnect passed using a synthetic stored connection on fixed reviewer account and separate project6ae6aeea492c9e9b3b6e0d50. DELETE removes row, UI search disabled, search API409, idempotent DELETE200, reload disconnected, manuscript unchanged. Native verification proves owner library record byte-identical. No real credential copied or upstream request made; positive live library connection/import evidence remains prism-zotero-live.json and prism-zotero-no-doi.json. Evidence prism-zotero-disconnect-browser.json and prism-zotero-disconnect-verify.log. Initial native helper failed before mutation due fs.promises.readFile numeric fd; corrected to /dev/stdin then seed succeeded. Test connection is removed; no cleanup of user data.
3/3 current pass actions complete; goal active. Next audit remaining historical feature/runtime source boundaries and finalize original requirement matrix. No application source/runtime/image change, no repository push.

### User-reported project Git connection repaired
User URL18081/project/6ae64c143fb98b69218c6978 had no binding and no credential; authorized Gitee acceptance project6ae6a79ece5f0b9e3242f0b0 had both. Credential scope is project/user/repository, so prior test did not cover this project. Reused same owner same repository existing token via credential store without output; saved only if target credential absent. Actual browser Connect repository returned success, repo-test bound, manuscript unchanged. Evidence prism-user-project-git-bind.json. No merge/apply/push performed. Generic connection failure text remains a UX issue; no runtime source change in this fix.

### Git Settings/Commits tabs, branch discovery and merge demonstration delivered
User requested tabs, automatic branch listing and visible branch merge. v49 deployed on18081 after idle Agent/no active Git application guard; demo18080 unchanged.204 source hashes match image/live/worktree. Settings contains repository/branch/credentials/sync controls; Commits contains graph and historical diffs. URL changes trigger debounced authenticated ls-remote --heads; stale requests aborted/ignored, credential save retriggers list, manual branch typing retained only in existing New branch commit workflow. No automatic project-content merge. Connection failure differentiates absent credential, saved credential and history-only failure.
20 frontend tests (18panel/credentials+2picker),7transport tests pass; scoped lint passes after renaming test Promise parameter; tsc remains identical13 baseline. Actual served UI loaded real Gitee repo-test option (only initial status intercepted to display unbound form, no bind POST), tab isolation and true two-parent graph/diff passed at1440/1000/760, no page errors. Screenshots1440 visually inspected. Reportsprism-v49-browser.json,prism-v49-final-inventory.json.
Independent local-only project6ae6b190cbb0b09ff978bb75: main setup comment vs analysis robustness sentence from common base. Actual Web Review branch merge/Apply retained both; original unchanged before confirmation. Then local git merge --no-ff generated e219394f24f255108ef3cd3a680014b2997b01dd with two verifiedparents and exact same final text; fixture binding advanced to local merge commit. Not an actual remote push demonstration; no remote branch created/written. User can inspect Commits graph and first-parent diff. Native seed and merge persisted in candidate data volume; reportsprism-merge-demo-browser.json,prism-merge-demo-fixture.json.
Buildv48 completed but superseded beforedeployment; v49 uses it asbase. First v49 browser attempt saw server startup empty response, waited for login200 and reran read-only check successfully. First test/script generation attempts used wrong cwd and failed before writes; corrected. Current task4/4 complete, whole original goal remains active for final requirement reconciliation.

### Final original-scope delivery audit
All18 requirement groups mapped in prism-delivery.md and prism-delivery-matrix.json to inspected passing artifacts, with evidence hashes and explicit scope limits. Current v49 comments/history restore8browserchecks passed after5comment-relatedsourcechanges;133historicalfeaturefiles verifiedlive/current. Voice9/9, inline4/4 and history51/51 feature manifestfiles unchanged. Current targeted compatibility22backend+11frontend tests pass. Modelsmoke8loweffort replies retained, not all-effort certification. Wholefrontendtypecheck retains13 baselineerrors; do not call allrepo green. No remaining required implementation items found after original baseline, combined regression and subsequent UI/Git requests reconciled. Fixedcredentials retained. Final delivery18/18; no public release/sourcepush/PR.
Earlier entire-goal-incomplete and missing external credential statements are superseded by this final audit. Current handoff18081v49; original18080v41 preserved. User-scope Git merge demo is local-only, actualGitee roundtrip limitedauthorizedrepo-test.

## Branch merge user demonstration recheck
Current demo URL http://127.0.0.1:18081/project/6ae6b190cbb0b09ff978bb75 verified read-only. Merge e219394 has two parents; main setup comment and analysis robustness sentence coexist. Graph screenshot visually inspected. Web branch merge application and subsequent commit/push are separate actions; prior demo final Git merge commit was generated locally, not remotely pushed. Implementation GitPushPreparation passes pendingMerge source as second parent to GitCommitWriter commit-tree. Current browser checks pass; prior 238 backend test result is historical, not rerun here.

## Copy/timeout final evidence
Final browser regression41212 passed actualnativecompile,WebAgent completion,allcopyactions. FirstWebtest failed because singleAgent slot occupiedbybackgroundchecker; stoppedfailedbrowser74386 afterDBconfirmedterminalfailure, idle-guardedconfigconcurrency2, rerunpassed. Fontfailurefirstappearedmissingtcrm1000 but underlyingmktexpk directorywasread-only; project-compile nowroutesTEXMFVAR/TEXMFCONFIGto/tmp. Withthatpatchactual33filescompile evenwithoutcm-super; completedfontimagealso deployed. FinalallfilescompareafterWebtaskpassed. No privatechainofthought exposed; onlyexistingactivity/summary. RemainingnonblockingTeXwarnings preserved ratherthan manuscriptalteration.

## Git binding loss correction and historical audit
User clarified13:35binding was reconnection, invalidating prior inference from currentstate. QueriedMongooplog: oldest2026-10-30T11:49:06.414Z, coveringproject creation2026-11-01T03:40:26.924Z. Target6ae6b4aa00cfc6a2e2ed96b5 onlybindingop acrossnamespaces isinsert2026-11-01T05:35:57.648Z. No targetinsert/update/deleteearlier; no dropgitSyncBindings/dropDatabase/renamecommand foundcandidate/admin. PersistentMongo namedvolumepresent. Existingdifferentproject6ae64c143fb98b69218c6978bindingat03:18:29.206Zretained. CurrentprojectnamePYTHIA_Cybersecurity_OnlineLaTeX(3). Theseexcludeobservedbindingdeletioninretainedoplog,notproveuserdidnotconnect; priorattemptcouldfailbeforepersistenceorotherproject. No code/datachanges. Earliermongosh.projecterrorcorrectedusingfindprojection.

## Multi-author graph demonstration
UserwantedCommitgraphshowingmultipleauthorsacrossbranchesandmerges. ExistingMergeentryisSettingsselectSwitchbranchthenReviewbranchmerge;Commitstabread-onlyhistory. Createdlocaldemo10commits:Alice2mainchanges,Bob2results,Chen2discussion,2merges,initial,andBobunmergedfollowup. Fourrefs;threevisiblelanes;twoactualdoubleparentcommits. NamesAlice/Bob/Chenexplicitly(demo),notactualmultiloginacceptance. URLhttp://127.0.0.1:18081/project/6ae6db53b54b265c36e52534. Existinguserproject,credentials,Giteerepo untouched.

## Git Graph workspace upstream/reference
User screenshotmatchesmhutchie/vscode-git-graph, notearliergit-bahnterminaltool. Read-onlycloned/tmp/overleaf-git-graph-reference-20261101atd7f43f429a9e024e896bac9fc65fdc530935c812. LICENSEpermitsuse/copy/modifybutdeniespublish/distribute/sublicense/sellderivatives; sourceusesVSCodeWebviewPanel/messagebridge. No upstreamcodecopied. IndependentexistingReactimplementationextended:40pxselectedrows,largeaccessiblemodal,automaticfirstfilediff,metadata/fullmessage/numstat,Merge navigationentry. Existingreview/applypermissionspreserved.

Assistant resizing final: nested existing resizable panels with browser autosave; long conversation needs flex-basis0 and composer no-shrink (otherwise toolbar clipped). V57 served browser confirmsdrag/persistence/keyboard/longscroll/narrowcontrols. Git Graph modal source/layout tests and finalruntimebrowser passed. No externalcodecopied oruserdatamutations.

Git Changes workflow: Settings configurationonly, Changes localfile-selection vsincomingreview, Commitsgraph. Selection API bindswholewebfingerprint; serverbuildsbaseline+selectedpaths. Partialpendingmergesrejected. v58browser/nativeverifiedisolatedfixture6ae6f434ee9024c88117f6c5;no remote configured orpush. Reviewoperationfd8c2871-2750-4f6e-ba89-a223bb889b35 remainsunsentandretained. Existinguserprojectinitialreviewunchanged.

## Git / Literature acceptance (2026-11-01)
- Existing Zotero credentials successfully read library9531967; real browserLLMqueryreturned20results. Original genericerrornotreproduced; cannotclaimspecificcause. ConfirmedoldRefreshcitationdidnotrerunsearch. AddedactualRetrysearch,30stotaldeadline,one transportretry,distincterrors.
- v59 browserchecks passed Settings/Search separation,keybuttonrightplacement,realquery,Gitautooffonuserproject,Incomingcardsand900pxGit tabs. VisualreviewfoundsourceicontextoverlapcausedbyCSSspecificityandsearchbuttonheightmismatch; correctedselectpaddingselector,inputmarginand36pxbuttonheight. v60buildinprogress.
- Automatic sync controlledbrowserfixture passed: defaultoff,1minpersistedafterreload,timerwithclosedrail,all2filesselectedforrealretainedlocalGitcommit,one mockedremotepush,disablepreventsfurtherexecution. Mockscopeexplicitinplan/git-auto-browser.json. No actualremoteexecute/userpaperapply.
- Six GitGraph regressionchecks passonv59. Candidatehas10newproductionfilesrelativev58;manifestrecords exacthashes; no account/credentialchanges.

Finalv60visualfixverifiedanddeployed;liveZotero20resultsagain. SettingsiconnolongeroccludesMy;searchbuttonandinputequalheight36px. Narrow900pxLiteraturenooverflow,GitCommitsinsidecontainer. Complete4/4;deliveryplan/git-literature-delivery.md.

## Literature multi-select (2026-11-01)
- Extended existing Crossref/Zotero preview endpoints with mutually-exclusive arrays (1–50 identifiers), reusing current authorization and apply path. Provider reads bounded to5concurrent; no task created until all metadata succeeds. One versioned .bib proposal contains all new entries. Existing/intra-batch duplicates skipped with titles; all duplicates rejected. Apply rechecks every citation against project bibliographies.
- UI checkboxes, selectedcount,selectloaded(max50),clear and stickybatchpreviewbar. Loadmorekeepsselection; newsearch/source/disconnectclears; failedpreviewretainsselection; pendingproposalblocksnewimport.
- 12frontendtestsand61backendtestspass. ProductionESLintclean. Typecheckpending.6productionfilesinmanifest;v61buildpending. Actualimportwillusefreshlocalfixtureonly.

Batchacceptancecompleteonv62: freshlocalfixture6ae70166b49f4249dedb7859 containsreferences.bibwith2realZoteroreferences,eachonce. Repeatbatch409nochanges.7manifesthashesverified;titletypingfixremoves3previousLiteratureerrors,13unrelatedbaselineTSerrorsremain. Firstdeployguardrejectedbecausegeneratedscriptaccidentallychangedkeylengthassert64to74;correctedbeforeanyactivation/credentialmutation,subsequentguardeddeploypassed.

## Git push screenshot diagnosis
Exact commit71ec8e4667d4141ca2c2225cd7da3a1aea996618 mapsoperation873431e5-0399-4024-8b63-19cd96099dbd inlocalfixture6ae6f434ee9024c88117f6c5. Mongooperationstatusprepared,noattemptId; bindingrefs/heads/main hasrepositoryKeybutnoremoteUrl. It neverenteredpushdispatch. Fixturewascreatedforlocal-onlyselectivecommit tests; previousbrowserautopushtransportwasexplicitlymocked. Userfacingerrorwasgenericbecausepush-controlcatchdiscardedbackenderror. Fixruntimepreflightbeforeprepare/execute,UIlocal-onlybanner/disablefetchpushauto,showreasonanddurablestatusafterfailedrequest. Preserveunknownwriteguardandreconcilewithoutreplay.74frontend/4backendtests pass. Needv63deployandread-onlyrealGiteefetchcheck;neverremotepushthisscreenshotcommit.

Finalpushdiagnosticsv64accepted: explicit409missingremoteandunchangedoriginaloperation;realGiteeconnectionfetch200. Image3sourcehashesverified,75frontend/4backendtests. Originalcommitretained,nopushattemptcreated.

## Web automatic sync recovery, v65
Real project 6ae6b4aa00cfc6a2e2ed96b5 on authorized Gitee repo-test: 09:30 preparation returned HTTP409 (exact original body unavailable). At09:36 two browser clients prepared concurrently; operation002c9ef1-0e86-4b3f-85f1-9d3cd027effd pushed60be8a5d6eb12bea95418090d832d83efea9a113 while other preflight returned409 before dispatch. Sync now genuinely pushed two existing user changes; this alone is not a timer test.
V65: explicit allowlisted preflight400/409 defers to next fresh snapshot. Ambiguous network loss remains paused with original operation reconciliation. Stage/error diagnostics explain failures; independent incoming checks continue when outgoing is paused and rail closed. Incoming remains review-before-apply.79frontendtests and scoped lint pass;3productionhashesverified;deployed18081,v65sha256:23c0aa66c310d2bbac617c39bf888e1832b7fe5544d19a096b6bc7fbcb680e2f.
Actual one-minute timer and incoming detection/application now under acceptance using only a uniquely named disposable text probe; no manuscript edits intended. Remote helper guards exactly one changed probe path, expected remote head, durable attempt marker and no blind retries.

Liveacceptancecomplete: one-minute timer73.4s to confirmed464e99b0d0b6;incominga8ff67695294 detected51.7s then1/1reviewedapplyandeditorreadback;cleanup779fdfa2fafb detected52.0s then1/1revieweddelete. Sameisolatedprobeallstages;no manuscriptedits. Actualbrowsercontrolharnessfixesrecordedindelivery;production79tests/lintpass. Existinguserpausedpreferenceisnot silentlyreset;refreshandresumeonceaftercheckingoldoperation. Incomingonlyautomaticdetection,manualapplicationaspreviouslyrequired.

## Remove highlighted automatic-sync copy
User requested only red-box copy removal. Removed two direction headings and duplicated incoming explanation from automatic web synchronization card in git-sync-panel.tsx. Preserved separate remote-check area, toggles, intervals and synchronization behavior. Scoped ESLint passed; v66 build and read-only browser verification pending.
User additionally reaffirmed conflict decisions must be manual for Web/repository concurrent edits. Existing three-way merge only prepares preview; unresolved conflicts block application, and stale revision/content/binding/remote changes invalidate review. Verified43 backend tests acrossgit-merge-preview,git-sync-preview-service,git-conflict-resolution,git-apply-plan,git-apply-executor; allpass. No behavior changed for copy request. v66build/1sourcehashverified; guarded18081deploymentinitiated; no Gitremote mutations in this task.

## References workspace development
User clarified citation IDs as cao2024spiking (first-author surname + year + first title word), and requested books/library icon instead of code brackets. Implemented custom SVG library icon, References naming, Settings/Search/Check tabs, BibTeX paste/file import via existing review workflow, readable keys with collision suffixes. Existing keys unchanged to avoid breaking citations. Crossref imports preserve month/article-number/ISBN when provided. Two report-only checks use server-fetched Crossref metadata/abstract and available arXiv HTML, then selected Codex model; evidence gaps remain explicit. Selected BibTeX entries + citation contexts only are supplied, not full manuscript. Report-only tasks discard all model diffs. ACM option produces reviewable task preserving document class and existing keys. No user manuscript changes authorized/applied during development.
Research: Scholar help https://scholar.google.com/intl/en/scholar/help.html supports BibTeX export; user confirmed key example. ACM official instructions specify ACM-Reference-Format; metadata completeness depends on supplied fields. Other APIs: dblp https://dblp.org/faq/How+to+use+the+dblp+search+API.html ; arXiv https://info.arxiv.org/help/api/index.html ; Semantic Scholar https://api.semanticscholar.org/api-docs/snippets ; standardized BibTeX/RIS/CSL JSON https://www.zotero.org/support/kb/import_from_clipboard . Direct extra provider search remains research only; universal BibTeX import is implemented.
Tests so far65backend and18frontendpass; scopedlintcleanbeforeformatting. Typecheck13preexistingmissingmoduleerrors. Two test/script commands used repo-prefixed paths with services/web cwd; corrected without affecting implementation. New service tests verify scoped evidence, report-only behavior, macro uncertainty and fixed-origin source fetches.

FinalReferencesacceptance: v69,17hashes;66backend18frontendpasses. AgentmetadatarealCrossrefidentifiedDeep learning/2015/436–444 fromdeliberatelywrongfixture. Claimreportexplicitinsufficientevidencemain.tex:3,notfalseendorsement. InitialACMcompilemissingBSTledtoofficialbundleimmutableattachment(provenanceNOTICEpublicdomainSHA4342d274...). Actualnewformatproposalroot+hyperrefandBSTcompiledsuccess,1page50710bytes;acceptedonlyfixture6ae716d65b0553afe07b59c9. Sourceiconfirstlackedaccessiblelabel,fixedv68andbrowserroleReferencesverified. Finalapplyharnessinitialexactrootcomparisonwasoverstrictbecauselegitimatehyperrefdependency;inspectedexactdiffthenacceptedstylefirst/rootsecond. No userpaperwrites/noGitpushes. Primaryproviderresearchandlimitsindelivery.

BibTeX completion: current audit was report-only. Added deterministic DOI-backed completion proposal separate from AI audit. New import keys remain author/year/title; existing keys preserved to avoid dangling cites. Crossref live 3523727/3523445 provides venue, page, event location, publisher location, dates but no ISBN/abstract; preserve supplied fields and report missing evidence. HTML clipboard elements only skipped outside balanced BibTeX entries. Original unknown fields/macros retained. Tests60backend+15frontendpass; lintclean. Initial Python edit used wrong workdir and exited before writes; reran at repo root.

Completion browser verified real2DOIs, keynames,HTMLcleanup,correction/fillpreview andacceptedfixtureonly. Startupfirstloginattemptfailedreadiness;HTTP200thenretry passed. Scope remainsCrossrefavailablefields;missingISBN/abstractpreservedwhenprovided,notinvented. Sourcefiles andalltestsrecordedindelivery.

Compact reference task: added durable referenceReview on agent tasks, structured discrepancy/missing/unverified counts, collapsed field evidence and AI report, repair bound to audited doc+keys. Previous report-only tasks get collapsed legacy report. Import format detection supports BibTeX/RIS/EndNote tagged/CSL-JSON; explicit errors for unknown/binary/PDF. Optional DOI enrichment before normalized preview; original input fields remain when source missing and unknown tag warnings surfaced. Zotero official standardized-format docs consulted. Tests inprogress; first frontend regression found raw internal instruction in legacy collapsed report, fixed friendly title.

v71 deploy helper first halted before mutation because template replacement accidentally changed a key-length assertion from64to114; fixed helper to64 and retained stored credential unchanged. Guarded deployment then succeeded;11filehashesverified. Browser acceptance running after explicit login readiness.

Reference-files acceptance complete:RIS/CSLJSONacceptedonlyfreshfixture;EndNotepreviewrejected;actualAIauditreadonlyexistingtestfixture. Structuredsummary3differences7missing persistsafterreload. Allfileformats testedparser;actualbrowser3uploadflows;BibTeXexistingregressioncovered. Limit:EndNotetaggednotbinary/XML;PDFWordunsupported;onlineproviderCrossref,sourceomissionsunverified.

Reference actions: implemented snapshot-hash-bound apply endpoint taking only {taskId,fields:[{key,field}]}; all replacement values sourced from saved server evidence. Reuses version-checked existing writer, one bibliography update for whole selection. Subsequent result stores advanced snapshot hash and removes applied fields; old-task replay/stale edits rejected. Unknown source/title-only candidates/pending proposals blocked. Compact icons and short Chinese labels; model settings collapsed; matching fields omitted entirely; unknown existing information aggregate collapsed. Tests69backend19frontendpass;lintclean. v72build9files underway.

Actualv72browsercaughtstateadapterbug:singleyearwriteacceptedandold-audit409correct,butstore.finishfilterscompletedtasks,soremainingreviewwasnotstored. Fixedwithownedcompleted-task+accepted-proposalconditionalrecordReferenceApplicationmethod;unitteststorefinishnowmirrorsproductionguard. v73backend-onlylayer2files,manifest10filesverified;AgentControllerdiffcheckedagainstv72toexcludeunrelatedchanges. v72fixtureisolated6ae7411f19282d4866fb2252 onlyyearmodified;newfreshfixturewillverifyfullsequence.

Reference actions final: v75 complete; source-evidence field application uses version/hash guarded one-document batches; completed task metadata must use recordReferenceApplication, not finish. Crossref429 observed and safelyblocked; retrylater yielded real evidence. References model controls removed; uses dock project selection. Check UI/newreports English peruser. Poll retries503, confirmedbytest. Runtime/deployment/browser evidence in plan/reference-actions-*. Originalpapers untouched.

User correction: ACM means rich BibTeX metadata content, NEVER switching BST/style/template. v76 removes format agent path and oldformatUI; source-supported completion/import is bib-only. Existing keys/styles retained. Known pending wrongACMproposal rejected. 2DOIs liveverified9changes each; unavailablemetadata leftmissing. Deliveryreference-metadata-only-delivery.md.

Reference claims and Select all complete: v80/18081, 15 deployed hashes, 73 backend + 31 frontend tests. Final browser fixtures 6ae759246bb4389eeb1ce303 (single suggestion apply, stale409, restore) and 6ae7595d6bb4389eeb1ce383 (12 refs in10+2, cross-tab queue, restored reports). Original projects and18080 untouched. Details: plan/reference-claims-delivery.md.

Citation-source/reject findings: arXiv-only content fetch caused ACL references to receive metadata-only verdicts. Added fixed-host ACL PDF extraction with bounded size/time and abstract fallback. Citation contexts now focus on the cited sentence. Reject/undo choices are per-report browser storage and excluded from bulk apply. Pending combined previews previously blocked three levels (card, handler, backend); now permit protected field applications. ACL official source https://aclanthology.org/D19-1275/ verified accessible; source access is not proof that a manuscript claim is wrong.

Final v82 verified: pending preview fixture6ae762ef0a84c61720b768ea, ACL claim fixture6ae7631d0a84c61720b76945. Only fixture documents changed. ACL fulltext65453chars; validated effective→ineffective correction applied to one sentence. Reject/undo and persisted metadata rejection pass. 78backend14frontend tests pass; unchanged13baseline typecheck errors.

Automatic metadata verification: removed blanket no-DOI manual gate. Search candidates are matched by normalized title/authors/year and reloaded from their DOI record; ACL records additionally fetched as bounded official .bib from a fixed host. Verified identities enable source-supplied actions; source disagreements block only affected fields, with page-range conflicts propagating to derived page count. Missing/wrong DOI recovery and existing wrong DOI URL correction supported. Minor surname typos require agreeing official/registry records and matching coauthors. Same authors alone cannot verify an unrelated title. Existing GPT/Codex audit receives verification evidence; no extra model votes are treated as external evidence.

Live v84 automatic metadata verification passed: fixture6ae770e295c7cfaf513d4e69 taska3121783-84b4-41d4-acda-ad6f22abec98. Screenshot paper without DOI/URL matched Crossref+ACL;7visiblefieldactionsenabled,onlyaddressblocked;DOIapplied,mainunchanged. Initial exact-text locator failed on icon-containing paragraph; resumed same task with container text assertion,passed.

PMLR no-source root cause: DOI/title lookup failed and only explicit ACL/arXiv content adapters existed. Added official volume index discovery by exact normalized title, then author/year verification on official page before fetching its advertised same-host PDF. Official abstract fallback; bounded network/extraction; per-audit volume request cache. Source failures fall through providers. Card now shows filename and start/end line, open cited sentence, supported count/evidence, and Go to cited sentence through existing dock editor manager (exact passage selection, stale text rejected). PDF text uses reading order instead of preserving physical columns.

PMLR deployment preparation caught an assertion typo before activation: copied helper accidentally changed expected credential-key length64 to84 while changing file-count assertion. Restored64; key never read into output or changed.

PMLR live acceptance passed in fixture6ae7752706e3d13a320dd421 audit8c20c4c6-a7a1-4afd-b952-f01dd7624bd1: original user claims at29/77 supported; intentionally false claim at90 contradictedwithvalidateddiff. Cross-filelocation, rejectundo, single-sentenceapply, stale409andreloadpassed. No originalpaperedits.

### Local Git diff inspection
- Local changes API already lists modified/add/delete files and returns repository-before/web-after text. Existing UI lacked visible loading and placed diff below all rows.
- Inline expandable diff now lives directly below the clicked file, independent of commit checkboxes; changed context uses existing red/green line/word diff component.
- Text preview remains bounded by existing backend 64K limit; binary/oversized files explicitly report unavailable text preview.
- Frontend suite 16 pass; backend Git preparation/file review 3 pass; ESLint clean after fixing test hook style. Initial test-file creation used wrong cwd and was corrected before rerunning.
- User added field-level verification badges. Added server crossCheckedFields for matching fields across registry and official ACL export; green requires identity verified plus explicit field corroboration. Existing reports/single-source fields yellow, conflicts red; English text accompanies colors. Source/action policies unchanged.
- Batch-application root cause: whole-document baseHash rejected every report prepared before the first batch write. Removed global equality requirement; validate target old value and title/author/year/DOI identity (allow known source-backed changes), then use current document/version for atomic writer. Regression tests cover four reports, Apply all and individual fields, unrelated comments and identity conflicts. Combined reference backend suite 28 passed.
- Image verification helper initially had incorrect generated tag due string substitution; verification failed before deployment, corrected explicit v89 tag. No running service changed by failed verification.
- First browser run used a local-only Git demo whose controls are correctly disabled; adjusted controlled status fixture to include remote URL. Second run validated all UI cases. Reference badge mock used invalid task id and caused a polling validation error; replaced with valid UUID and controlled GET response, rerunning visual capture.
Leading verification icons: user replaced inline text-badge request with icon-only prefix and hover descriptions. Final source/CSS shipped v90; native title and role=img accessible label retained. Browser controlled fixtures passed; original project files and reference application behavior untouched.

### Plugin library
Account-owned Mongo library, pinned GitHub text Skill install, shared slash resolver injected into agent create, normal tool/runtime/review pipeline preserved. Real public frontend-design Skill fetched at ca45fc496a3436251f191354091d557da31c15b5 with LICENSE.txt and SKILL.md. Instruction packages only; scripts/tools explicitly listed unsupported. Test initially rejected normalized dot paths incorrectly; raw encoded path checks added. Frontend initial test path used wrong working directory; moved only newly created test and removed empty accidental directories. Rail icon type fixed using custom icon wrapper. API documentation:plan/plugin-library-api.md.
Plugin implementation checks:39backendtests and15frontendtests passed; frontend lintclean; TypeScript diagnostics unchanged from baseline. Core tasks retain original /command instruction for conversation display and record plugin id/command/commit, while daemon gets scoped expanded Skill text and read-only package assets. Existing project tool/runtime and apply review paths unchanged. Dedicated live browser script installs/removes only a uniquely named test plugin and runs a read-only task in a new fixture project.
Real browser functional acceptance passed on v92: GitHub frontend-design Skill installed under a unique test command, disabled invocation409, re-enabled/slash-selected, real conversation task c5528b3d-08f6-4536-b929-5d4eecf05b61 completed reading bundled LICENSE.txt and returning Apache2.0. No proposals or project changes. Test plugin removed. Fixture6ae788eb2fcb48013b05f79c. Initial browser failure exposed missing custom rail accessible name; fixed PluginRailIcon accessibilityLabel in v93 build. Async checkbox test now clicks then waits for persisted state rather than expecting immediate native toggling.

Plugin library final verification: v93 image sha256:86114d380c11f6b7d1e27e2ffff0b7c4a14a5e314bbda585a36b796a41e3072e active18081,14sourcehashesmatched. plugins-final-ui.json passed accessible tab/default width/draft preservation; prior real task activity confirms LICENSE.txt read. Final UI list was controlled test data; real GitHub installation and execution independently recorded in plugins-browser.json.

2026-11-02 v95 regression: reused plan/reference-actions-context contained9 stale additional files, including router/controller/reference code. Only2manifesthashes checked, missing accidental overlays. v96 uses new exclusive-created build context, v94 base,2intendedfiles;24criticalsourcehashesvalidated. Installed paper-repo-builder was never deleted, API404 hid it. Never reuse populated COPY contexts; compare all copied paths against manifest and regression-test adjacent plugin list/discover after deployment.

Goal feature validation: initial v98 live automatic fixture modified the title but then blocked. Reviewer incorrectly treated the pending snapshot as live project state and lacked a baseline for verifying unchanged surrounding content. v99 adds initial/current SHA256 fingerprints and accepted before/after hashes to immutable review evidence, explicitly distinguishes pending snapshots, and records recent progress. Test objective no longer forbids compilation because the existing project runtime requires compile verification. Fixture project 6ae831c4eeb9cf608c867537 was stopped after the blocked result; no user project touched.
User steering: goal is entered directly as /goal <objective>. Remove flag/setup action and goal picker entry; keep compact Automatic/Manual approval selector on detecting the prefix. Both review modes are explicitly requested by user.

Final v99 acceptance: plan/v99-composer-goals-browser.json passed (automatic background completion, human review gate, pause/resume/stop). v99-plugin-ui-browser.json confirms existingDescriptionRepaired and slashPickerRetained; GitHub discovery returned explicit rate-limit error. No duplicate install or user plugin deletion.

v100 root cause: GoalPanel was a sibling of paper-conversation-content, outside its flex/overflow boundary. Expanded task detail therefore consumed composer height. textarea additionally disabled on running. Moved GoalPanel inside scroll content, retained running send guard but enabled drafts, hid orchestration user prompt in goal task rendering. Timer excludes paused/waiting_review; /Resume Goal restarts fresh task, reset restarts time. Test setup corrected named fetch route and expanded dock before visibility assertions.

v101 final evidence: plan/v101-goal-history-browser.json passed,8applieddiffs15steps. First browser assertion selected a message step without command output; corrected to first actual command step. Standalone diagnostic initially omitted container-injected service environment and failed history authentication; rerun with /etc/container_environment.sh succeeded. Production authentication was unchanged. plan/v101-review-assets.log: image955156bytes,compile_project success40pages,0proposals. No original goal state/action changed by diagnostic.

v102 live timeline: previous frontend reordered message updates ahead of tool events and collapsed the full execution list. New list preserves daemon order; each command/output/edit renders in place. Document harness snapshots the validated workspace after command/fileChange completion and attaches per-step before/after deltas to the originating event, including shell edits. Public output/message deltas stream; private reasoning is ignored. Large previews/outputs are bounded and visibly marked. Goal service exposes active reviewer task as well as work task. Prior rounds auto-open details, with actual historical proposals still separately inspectable.

v103 real live acceptance passed: new fixture task6f1a52f8-aa4b-49ce-ba5f-10ddabe106e0 emitted activity+per-command diff while stillrunning; later completed with pending proposals only. v104 adds follow-latest because real screenshot showed transcript stayed at old top despite live DOM updates. Upward scrolling pauses follow; Jump to latest resumes. Per-task activity budget1MB; durable conversation activity stays64KB to protect50-turn Mongo document size. Oversized entries retain compact visible markers and do not suppress later events.

V105 complete: /goal (not /go) resets objective/time; slash resume/stop/pause replace card buttons; footer clock outside transcript. Existing file links open editor, pending creations open proposal, external links open new tab. Unified command/output typography and removed duplicated final summaries. Candidate18081 deployed;40image hashes verified;69backend+30frontend tests passed; lint clean;13baseline TS diagnostics. Real browser goal command and link tests passed; controlled follow/reading-position test passed. V102 real streaming test showed diff before completion. Original18080 and user manuscripts untouched. Delivery:plan/assistant-interactions-delivery.md.

V106 diagnosis: GoalService treated any changed summary text as new progress, reset noProgress, and forced verification after every proposal batch. Reviewer prompt required continue for pending proposals even when independently verified. Work history omitted review instructions. Fix uses stable reviewer checkpoints and accepted changes; preserves reviews in next-turn history; explicit blockers override continue; completed verified batches end after successful application. Regression16 goal tests passed. Markdown was already sanitized marked GFM in AssistantMessage, but goal reason/review used raw text; now shared renderer with richer typography and safe tags.9 message tests passed, lint clean. Live read-only search of candidate goal collection found no current reference-objective goal, so user's exact run is not independently identified; causal evidence is source code plus supplied transcript and regression fixtures.

V107: ordinary task result rendered before GoalPanel unconditionally. After a completed goal, new regular scoped work was followed by the old goal result at the bottom; automatic scroll therefore showed old accepted changes. Footer also always rendered GoalTimer. Fixed ordering based on active ordinary task and latest turn/goal timestamps; stable React keys retain panel state. Added current request progress footer with scope/action status, and hide stale goal timer for newer ordinary work.14 conversation tests passed including polling updates after completed goal. ESLintclean;13TypeScript baseline unchanged. Browser acceptance will assert actual viewport visibility before/after completion, not just attached DOM.

V108 sources/design: https://ccfddl.com/llms.txt identifies live allconf.json, separate abstract/paper events, AoE and PT DST ambiguity, derived conference opening (not submission opening). Live catalog normalization returned473 venue-round/journal rows, including6 curated author-guide entry points. Official JMLR author-info and authors-guide fetched; GitHub template metadata yielded actual zipball link and jmlr2e.sty. CCFDDL native pinned HTTPS first address timed out locally; fixed catalog URL uses bounded global fetch with redirect:error, while dynamic guide URLs retain DNS-pinned public IPv4 requests and redirect validation. Built-in Skill supplies live deadline-context.json; user click prepares a draft only. Registry API supports future providers. Source requirements use attributed excerpts and bold constraints, unknown fields explicit, no template/BST rewrite.16backend and20frontend tests pass,lintclean,TS13baseline unchanged. Production addscheerio runtime dependency (previously dev-only).

### V109 submission workspace
- Month calendar and dated timeline now share the catalog with list view. Registration/abstract/paper remain separate; no inferred mandatory gate or invented journal date.
- Official registration requirements extracted as attributed passages. Calendar uses local date and exposes original source timezone.
- Targeted tests: 17 backend, 24 frontend passed. Candidate image build underway; live browser verification pending.

### V110 independent conversion clarification
- User explicitly requires a NEW LaTeX ZIP and NEW Overleaf project, not modifications to the original. Discarded the unshipped in-place/conversation proposal approach.
- Added export-only server task flag and hard rejection in generic decide() to prevent original writeback.
- Snapshot packaging preserves source text/binary assets, validates diff bases/paths, refuses deletions and adds a non-colliding report file.
- Automatic new-project import uses a durable exclusive import lock and returns an existing project on repeat. An uncertain import is not retried automatically.
- 56 backend and 24 frontend tests pass; ESLint clean and no new TypeScript diagnostics. Build/browser archive import acceptance pending.

V110 acceptance: first fixture run failed because the test-created snapshot directory was root-owned; ZIP stream rejection also exposed a crash path. Fixed concurrent promise error handling and atomic record writes in r1; fixture runs as www-data. The subsequent real import passed, including archive/source byte comparisons and original-write rejection. Earlier failed evidence retained in plan/v110-browser-first-attempt.json.

### V111/V112 closeout
- Confirmed current source rank keys ccf/core/thcpl (N explicitly non-listed; absent remains unknown). Full area labels, multi-select chips and ranking menus; next-submission Window applies consistently to all views. Venue-level stars migrate old round IDs.
- Inspected ASE26-TAMARIS.zip read-only: main.tex holds section headings/labels and inputs; figures/*.tex wraps figures/src original assets. New conversion policy uses organization only, no scientific text/IEEE class/negative spacing copied.
- Added package-only relocation manifest validation. Runtime fixture exported figures/src/fixture.png, imported byte-identical package to a distinct project and rejected original Apply.
- Browser source refresh hit CCFDDL timeouts; filter/browser acceptance used controlled source data, explicitly recorded.

V114: recommendation summary eagerly renders all limitations before filters/results; inherited 90-day window can exclude recommendations. Add directly navigable names before collapsed context and explicit filtered count/reset.

V115: Toolbar stretched because recommendation control contained its activity details. Move activity to a portal target immediately below toolbar; unify controls at36px. Fit section spans both card columns. Overview buttons clear filters and focus/scroll matching card. Submission status uses Paper events only; later Decision/Rebuttal never reopens a closed round. Registration/Abstract elapsed is gated, not necessarily closed.
Metrics evidence: https://prod-www.acm.bloomreach.cloud/media-center/2026/july/impact-factors-2026 (ACM July1,2026 release) reports CSUR JIF30.4/rank1 Theory&Methods, TOSEM rank8 tied SoftwareEngineering. Checked2026-11-03. No inferred SCIE, EI, CAS or JCR quartile. Publisher page inaccessible403 on canonical acm.org; publisher hosted mirror readable. IEEE pages yielded no usable metrics. CAS sources unavailable/ambiguous; do not label an unverified newer scheme as CAS or latest.

V116: shared countdown component renders earliest future registration/abstract/paper in large tabular digits and independent per-cutoff remaining times. Reuses planner minute clock and UTC instants. Under1minute is explicit; at deadline becomes Closed. Later non-submission milestones remain neutral and labeled non-submission. Compact overview cards also show CCF/CORE/THCPL and full area. User-mentioned SAEA pending clarification; no fabricated mapping.

V117 deployed candidate18081. Editor segmented control verified equal22px/12px; recommendations layout browser passed; real PDF routes and default-off maintenance verified. CCF681/Xidian760 persisted with conditional rules. Repaired V117 image72hashes verified; read-only real-paper copy compiled21pages681818bytes using nested main.tex. Runtime activation and project main-file setting await explicit user confirmation; originals unchanged. See plan/v117-delivery.md.

V118/V119: candidate18081 deployed compact right-column timeline (24px countdown), then simplified AI maintenance. Real Codex diagnosed saved FROM sha256 failure; broker verified local tag beforebuild; isolated realbroker build andACMsmoke passed.12agent+1frontendtests, browser review/noPOST boundarypassed. Actualruntimeactivation andprojectroot remainunchanged awaitingUIconfirmation. See plan/v119-delivery.md.

V120 fixed Docker top missing PID activation failure; actual approved repair resumed andactive. PersistedAgentcompiler equalscandidateimage7db668ec. Realuserproject fse27-opt2 browserRecompile success21pages; paper/rootsetting unchanged.14tests pass. Agent self-busy diagnosis andmisleadingpermissionerror fixed; activationfailurelogs nowAIevidence. Seeplan/v120-delivery.md.

V121: system-owned Codex recovery loop deployed18081. Real isolated Docker fault injection confirms one authorization→actualPIDfailure→Codexuse-pid-column→brokerretry→activeimage matchingAgentcompiler. Firstproviderfailedattemptpreserved,secondpassed.16agent+1frontendtests; browserconfirmationboundarypassed. Newtasks max3autonomousrecoveryattempts; supportedcompileractions only. Seeplan/v121-delivery.md.

V122–124 deployed18081: independent AI Maintenance settings,13pxwrapped logs andsupportedsettingsglyph; sharedoriginaltoolbar inSubmissions with inertdocumentcontrols; closedstate dedup; Xidianmultiselect/sort.13venue+2maintenancefrontendtests passed; actualUI naturalmaintenancechat routesCodextool andrendersinlineauthorizationcard,sourceunchanged. Artifacts plan/v124-delivery.md,v123-browser.json,v122-settings-browser.json,v124-chat-browser.json.

## V125 generic conversion and requirement advice
- Actual FSE source contains 48 documents/23 attachments. The rejected count includes TikZ sources plus Makefile/Python support documents. Added editable tikz/pgf; preserve other document bytes in independent ZIP/report.
- Document Codex has network=false. Added DNS-pinned public-source tool for official pages, PDF text, text assets and bounded ZIP extraction; template staging excluded from proposals. Script/binary/encoding exclusions are reported, not executed.
- Official ACM guide and portal returned403. CTAN ACM and IEEE ZIP downloads work; IEEE legacy-encoded sample is skipped while class remains available. First real IEEE conversion downloaded separate class after ZIP decoding failure, preserved text, then correctly reported missing ptmr7t font in current compiler; no environment changed.
- Added per-requirement AI task/diff review. Length advice read-only. Successful compile evidence required for automatic import; unverified draft remains downloadable.
- Direct Docker snapshot probe lacked running-web JWT initialization and failed401; authenticated project ZIP capture succeeded and is used for isolated manuscript regression.

- Live endpoint additionally exposed522,693-character source > legacy500k limit. Snapshot now uses UTF-8 byte count and2MB cap consistent with document workspace. Live retry201:46documents+23assets+2preserved scripts; validation-only task canceled200; original71file hashes identical.
- Real Codex produced84 proposals/65 relocation entries. Server buildProposals+conversionFiles accepted all;86file ZIP recompiled successfully,684395-bytePDF;23binary/data assets and bibliography exact, original support documents intact. Existing source rules remain provisional due403.
- Browser controlled advice test passed actual diff rendering and untouched editor.10 frontend cases total across final targeted runs;35 regression+36 service tests. Final8file image hashes verified. PDF parser passed controlled22-page input; separate live PDF source fetch timed out and is not claimed successful.
- Deployment script's temporary key-length assertion typo was corrected before mutation. Browser login initially raced container readiness; rerun after readiness passed. No original18080 deployment or manuscript mutation.

## V126 retries, branches and Invalid project document
- Live failed task605a34f5-572f-4ed6-8ec3-e8f9f4cc68b0 had both CONVERSION-REPORT.md and conversion-report.md. Case-folded workspace validation rejected the project before Codex ran. Generated report name now avoids case-insensitive collisions; workspace error identifies both filenames.
- Project6ae962841a98503a472f07f6: renamed only server report to CONVERSION-SYSTEM-REPORT.md via authenticated rename API (204). All85filecontents identical. Backup plan/v126-before-report-rename.zip; verification v126-report-rename.json.
- Retry creates a child at the failed request, preserving original instruction/model/effort/scope/skills and retained images, obtaining a fresh snapshot. Stale selected text or expired image returns actionable409, never silently discards context. RequestUUIDdeduplicates repeated delivery.
- Branch from request prefills draft without execution; branch from reply freezes transcript prefix. Inherited proposals are not actionable and inherited task records are not polled. Parent remains intact; current manuscript is shared, not rolled back.
-75 backend/harness/service tests and16 conversation frontend tests pass; frontend lint clean. Build/deployment/browser validation in progress.

- V126 live retry completed through actual Codex;21-pagePDF compiled and inspected. Suggestions remain pending, official TOSEM pages403 means compliance unresolved. Browser created user/reply branches, returned to parent, reloadedchild; source hashes unchanged.
- Browser initial result-selector matched nested tool statuses; fixed test selector to direct reply header and resumed same already-running retry (no duplicate model task). Rename API returns204; verified applied rename from frozen backup without replaying the mutation.
- Deployed imagea3365a493940fffa373667f6599429d1a7069fae488f3a3dbf4bc29235991284;hostAgentPID91079;maintenancecomposepointsV126. Proofv126-browser.json andv126-report-rename.json.

### V127 findings
Existing conversion prompt mentions template checks but produces only prose; automatic import is gated only by compilation. Add a structured compliance artifact and conservative server validation. Unknown requirements remain downloadable drafts, never silently treated as verified. Page/word limits stay advisory per user instructions.

V127 real Codex sample produced all 10 audit categories and final hashes, correctly retained unknown venue anonymity/stage as unverified. IEEE test compilation failed on missing ptmr7t.tfm in the pre-existing test compiler image; no environment changes attempted. Raw result retained in plan/v127-real-audit.json, not a successful conversion claim.
V127 live API: completed legacy conversion returns compliance.ready=false; authenticated automatic import returns409 with unresolved-audit message. No project created. Artifact: plan/v127-api-check.json. All85manuscript files unchanged in live icon/branch browser check. R2 adjusts branch popover to fixed viewport positioning after screenshot showed clipping by short conversation scroll area.
R2 image built but failed immutable runtime verification with Docker "max depth exceeded"; not deployed. V127-r1 has124layers inherited from earlier candidates. Flattening a stopped, clean image container into a new app base preserves image config; original running app/manuscript volume excluded and retained. No compiler environment mutation.

V127 final r3 live browser passed, screenshot visually reviewed, hit-test confirms menu is not clipped.85projectfiles unchanged. Source hash manifest and deployment records in plan/v127-*.json; generated export tar removed after verified image import.

### V128 evidence and decisions
Live task9f31bb63-d88a-4428-919d-3af40204703e confirmed dynamicToolCall completion overwrites authoritative titles/status while retaining output. This caused403fetch to appearcompleted and lost Compile-prefix detection. Fix suppresses generic notifications for managed calls; new metadata preserves toolName/toolSuccess. Legacy compile proof uses actual subsequent PDF inspection, not genericcompleted alone.
Direct host retrieval: ISSTA2027page200andTBD; ACMproceedings/submissions/templateZIP403; maintainedREADME200. External web retrieval independently confirmed ACM403and2027TBD. Exact server access policy unknown; not a missing-template or general-network diagnosis. New errors retain URL/status/category and explain alternatives without bypassing access controls.
User authorized previous-year SAMEtrack official rules when currentyearTBD; per-check basis/year/source shownyellowprovisional, currentpublished rules takeprecedence. Originalmanuscript remains unchanged; model edits newpackage only.
31backendcases and15frontendcases passed before deployment. Fix copy18pxSVG/32pxbutton to override deadline-panel padding. Report uses numbered changeditems and priority-ordered audit rows with before/after, files, sources and requiredadjustment. Prior-yearcodepath realCodex test running.
V128 additional network root cause: host has proxy environment configured. curl through configured proxy retrieved2026page848KB/7.9s; direct curl timed out25s after partial583KB; old Node direct fetch timedout12s. New HTTPS CONNECT proxy transport honors environment/NO_PROXY, validates publicDNS first and pinsCONNECT to validatedIP with originalTLSservername. Repaired fetch retrieved2026CFP, including literal documentclass[acmsmall,screen,review,anonymous]{acmart}. ACM continues403 and response cf-mitigated=challenge; this is separate source access protection, not generalnetwork/templateabsence. Logs v128-proxy-fetch.log and v128-network-final.json.
User requested Settings proxy configuration: added owner-only Network tab, environment/direct/custom modes, private0600servercredentials, persistence, saved-settings publicURLprobe. Source settings only; no model/system/Docker proxy modification. Unit tests confirm secretsnotreturned, credsnotcarriedtonewproxy, nonownerdenied and reloadpersists.

V128: User clarified lowercase target names: tosem27-ref.bib and tosem27/ rather than FSE source directory. New conversion records bind sourceRootPath and target rootPath separately; export manifest may move root only to approved target. Naming failures remain red and prevent autoimport. Existing conversions preserve original records.72 backend tests pass. r4 candidate deployed; browser checking.

V129: Calendar footer previously rendered all journals plus undated conferences as wrapped buttons, duplicating dated journals and repeating Author guide. Replaced with undated-only journal/conference disclosure groups, six-item pages retaining upstream filter/sort order, full names/area/CCF metadata. Recommendation task output moved from standalone Working paragraph to collapsed activity summary; status remains in the same summary. 8 focused frontend tests and lint pass. Candidate build pending.

V130 implementation: independent /submission-deadlines/tracks endpoint, edition-scoped official links, Track requirements/dates/availability, no cross-track policy copying. Track references use parent ID + ::track:hash and resolve server-side for requirement skill, recommendation and conversion. No sourced LaTeX => UI conversion absent plus server422. Track recommendation reuses current AI harness; additional eligibility status separate from fit. Date-only source dates stay utc:null, not invented exact deadlines. Researchr review ranges split into starts/ends. Horizontal lane graph shares conference end when catalog provides it, defaults Main, hover/focus highlights branch. Settings source proxy now also serves read-only official guide fetching via authenticated Agent public-guide endpoint with public-IP validation and bounded response/concurrency. Real ISSTA2026 discovery:11 tracks, all retrieved; AE has5datepoints and2prerequisite excerpts, no LaTeX; tool demos3points andLaTeX evidence.36backend+18frontend tests pass, lintclean. Image built, deployment/browser pending.

V130 live API: current ISSTA2027 exposes Research Papers (7 date-only points, formatTBD), Journal-First and Workshops (no published dates/LaTeX evidence). No substitution from2026 in current Track source data. Screenshot fixture uses real2026 official extraction solely to test richer timeline interactions. UI defaults Main, hover isolates AE, no AEconvert, ToolDemo convert present. Server conversion on nonLaTeX currentTrack returned422 without starting an Agent task.

V131 corrections requested after live preview: exclude How to Submit/instructions (also non-submission sponsorship/keynotes), replace native title tooltips on both ordinary timeline and Track nodes with immediate portal tooltips, horizontal colored fork/merge paths instead of parallel same-color lines. Calendar loads Track sources in bounded batches of8 (two concurrent conference requests), shows child entries as conference/year · Track, uses date-only original day without invented times, navigates to exact Track and retains no-LaTeX conversion guard.22frontend and6track-backend tests pass; r131 image building.

V131 completed: child Track calendar labels and exact navigation verified in browser;22 frontend/6 targeted backend tests pass. Live software-engineering FSE2027 has7 Tracks excluding How to Submit. Candidate18081 updated; original18080 and manuscript files unchanged. Graph screenshot visually inspected; graph is horizontally scrollable in narrow editor panes. Full-manuscript Track conversion and AI recommendation were not run for UI validation. Evidence: plan/v131-browser.json, plan/v131-delivery.md.

V132 diagnosis: TrackGraph filtered out rows without dated events. ISSTA2027 saved live response has Research Papers7dates, Journal-First0, Workshops0; earlier multi-track fixture is ISSTA2026. Keep edition isolation; do not reuse prior-year dates as current dates. Added explicit undated/source-unavailable rows and per-card timeline with immediate tooltips. Five focused component tests and ESLint pass.

V132 deployed and browser verified: all Track rows retained, per-card timeline visible and screenshot checked. Live ISSTA2027 three Tracks. Original18080 and manuscript unchanged; evidence plan/v132-delivery.md.

V133: classification/metrics moved before detail actions; removed duplicate submission rows and future-status banner. Countdown cards share a wrapping row. Track card timeline now has ordinal columns, numbered points, Today, explicit non-proportional spacing. Recommendation overview ranks scoped Tracks with scores and eligibility; full rationale/context stays in collapsed details. Exact official prerequisites preserved in disclosure. Seven component tooltip/Track checks pass; detail regression pending.

V134 implements explicit section cards and sticky section navigation. VenueConversion now uses shared OLModal with focus handling and close-to-return; report hidden by default even when task ID restored. View conversion report/progress button opens history; start opens immediately. Removed obsolete bottom portal targets from parent/Track details.16 component checks pass including history open/close/reopen without POST; lint clean. Narrow Track grid explicitly uses minmax(0,1fr) so horizontal milestone scrolling stays inside card. V133 browser passed; V134 final image/browser pending.

V134 complete: four source files verified in deployed image,16 component checks and browser passed. Modal/history, grouped navigation, card widths and prior timeline/recommendation changes visually verified. Deployment guard caught existing Mongo OOM; restarted same database container without config/data changes; health restored. Details plan/v134-delivery.md.

V135 live ASE diagnosis: catalog has ASE2026 conference rankA and paper deadline2026-03-26 23:59:59 AoE, plus separate ASE journal rankB with no dated events. Direct allconf HTTP403, but authenticated application catalog read succeeded; saved v135-ase-catalog.json. Added kind suffix to displayed full names, preserved current-year editions. User clarified Calendar and Recommended venues are independent toggles; implemented three combinations, explicit adjacent rerun button and result updates that do not change active view.23 frontend and10 backend tests pass; controls rerun6 pass.

V135 deployed18081 and browser passed. Independently enabled Calendar/recommendations, explicit rerun and ASE2026 timeline/type distinction verified. Recommendation refresh in browser used fixtures only; no manuscript or classification-directory changes. Active runtime pointer updated. See plan/v135-delivery.md.

V136 user clarification: combined Calendar+Recommended shows calendar first AND recommendation cards underneath. Extracted reusable recommendation panel, mounted below calendar only in combined mode; recommendation-only retains top-level cards and Calendar-only hides them.10 focused tests pass, including DOM order and no extra AI calls. Source scope one frontend file plus test. Build/browser pending.

V136 complete: deployed18081,10 tests and browser pass. Both toggles render calendar before recommendation cards; screenshot inspected. No manuscript changes. See plan/v136-delivery.md.

V137: moved recommendation group after Ask AI to shortlist. Added optional iconOnly presentation to VenueRecommendations; global rerun uses bundled refresh glyph, title and aria-label, busy indicator and existing duplicate-click lock. Scoped Track analysis keeps text default.12 existing tests and lint pass. Build/browser pending.

V137 complete: recommendation toolbar after shortlist, icon-only refresh,12 tests/browser pass. User questioned redundant Ask AI to shortlist; explained prepare-chat vs direct-analysis and suggested removing entry, but current version retains it. See plan/v137-delivery.md.

V138: Shared filters were hidden by the recommendationView wrapper; toolbar switches also reset Window to all. Removed these conditions/resets, defaulted Window to90, applied filtered rows to recommendation cards. Removed shortlist/activity/notes and calendar undated directory. Type badges separate from full names; regular journals omit conference timeline/countdown in cards and details. 24 targeted frontend tests and ESLint passed. Candidate build in progress.

V138 complete: candidate18081 source hashes5/5, browser regression passed and screenshots inspected. Private maintenance compose pointer updated to v138. Original18080/manuscript source unchanged.

V139: Directory entry is a catalog fallback round label, not a submission rule. Suppressed synthetic directory rows and redundant lowercase raw kind in VenueCard; retained actual round names. VenueTypeBadge now gray parenthetical text; grouped with title to prevent flex space-between separating it from abbreviation. 5 focused tests and ESLint passed.

V139 deployed18081 and browser checked;2/2 immutable source hashes verified. Maintenance compose pointer updated; manuscript/18080 unchanged.

V140: Simplified Submission heading, removed calendar scope/help paragraph, moved count/tracking beside search label. Track loading status removed; bounded two-worker background queue replaces manual8-item paging. Legend moved below calendar.16 focused tests and ESLint passed. Type-label offset caused by generic recommendation spans margin-top4px plus vertical-align middle; reset margin and use centered flex title group.

V140 steering incorporated before final build: followed-only star after Timeline, no count, accessible label and toggle state.16 checks rerun passed and ESLint passed. Final build log v140-build-final.log.

V140 complete:18081 deployed,3/3 source hashes verified, browser regression passed and screenshots inspected. Maintenance compose pointer updated.

V141 pending: legend restored below timezone/above grid; muted-events sentence removed, existing past-date styles retained. User added English-only controls; Xidian filters/sort/card classification labels now English with original category keys and sorting retained.11 targeted tests passed. Frozen3-source build in v141-build-english.log.

V141 deployed18081;3 source hashes and browser regression passed, English filters/legend order/text removal confirmed. Private maintenance compose pointer updated.

V142 cause: only date-number button and more button selected day; blank td area had no hit target. Native date button now fills cell; event buttons above it remain individually interactive.0/1/2/3/5 event tests passed (10 total); real blank-cell and keyboard browser check pending.

V142 deployed18081;3 hashes verified,21 tests and browser passed. Whole-day blank clicks0/1/2/3/5, keyboard, event detail verified; four filters same row and inline SVG bounds checked. Maintenance compose pointer updated.

V143: Shared VenueSummaryCard removes native button vertical-centering differences via explicit flex-start. Selected-day cards group milestones by venue ID and include name/type/full name/classification/optional exact fit and local/source event times. Ranking details dismiss on outside pointer/mouseleave/focus departure, values persist; select chevrons inset12px with padding34px.23 tests and ESLint passed; frozen4-file build pending.

V143 complete:18081 deployed,4/4 hashes verified,23 tests/browser regression passed. Menu dismissal/retained checkbox, arrow inset, aligned title offsets and selected-day venue cards verified. Operator compose pointer updated.

V144 correction: V143 shared component still inherited different button font sizes from parent sections and suppressed countdown when dayEvents existed. Explicit12px shared font and unconditional conference compact countdown restore matching appearance. Day event metadata moved below status as plain footer.17 tests passed; browser will compare computed styles.

V144 deployed18081;2/2 hashes,17 tests and browser regression passed. Computed daily/recommended card font and countdown styles match. Operator compose pointer updated.

V145: Tab/page Venues better describes discovery/recommendation; search input inherited larger default font, now explicit12px including placeholder. ESLint passed. Frozen3-file candidate build pending.

V145 built but not deployed; included in V146. User restricted latest card changes to journals. Journal-only class removes empty right column; regular submissions/official link then badges/metrics/fit; journal star uses toolbar MaterialIcon. Source disclosures omitted only for journal list, available in detail. Conference glyph star/layout/disclosures unchanged. Added unverified EI label for journals, no inferred indexing.13 tests passed.

V146 complete:18081 deployed directly fromV144, incorporatingV145.5/5 source hashes,13 tests/browser passed. Journal-only boundary verified, naming/search size checked. Operator compose pointer updated.

V147 extends user scope to conference list: remove View requirements labels, source accordions, Track deadlines loader and milestone table. Shared toolbar star for both kinds. Native background button opens card while positioned interactive controls retain hit targets. Compact VenueAxis has category colors/legend; detail retains milestone table.24 targeted tests and ESLint passed; browser6-category tooltip/control checks pending.

V147 additional countdown request included;24 tests rerun passed. Browser will assert absence of secondary deadline blocks and full-width Manuscript fit. Build log v147-build-final.log.

V147 deployed18081;3/3 hashes,24 tests and browser passed.6 category colors, tooltip, primary-only countdown, full-width fit, card-background click verified. Maintenance compose pointer updated.

V148 progress 2026-11-04: raw live catalog 297 journal entries / 794 conference records. Unique full-name journals 293; unique conference name+year 633. TOMM, DKE, IPL, IJIS each occur in two areas (no deletion). Official bulk sources discovered from current landing links: IEEE September 2026 (2025 metrics released June 2026), Compendex August 7 2026. Independent Python and Node matching agree: 45 distinct IEEE JIF matches, 249 EI journals, 30 conference editions. LetPub attempted105 unique journals before rate limit,7 partial matches including one authenticated ASE; rate-limited queries stopped. ASE publisher official JIF3.9 overrides LetPub3.902. No paper-level EI claims from proceedings lists. User requires latest editions, official priority, cross-audit, frequent quantified updates and persistent method.

V153: Springer latest official catalog (2027 catalog, September 2026 revision) matched 53 journals; 49 explicit 2025 JIF records imported into persisted official snapshots. Live raw coverage297 journals: JIF97, JCR50, EI256;794 conference records:39 proceedings EI. Elsevier active journal catalog matched62 titles; ScienceDirect sample returned403, do not infer missing metrics. Unknown classifications and metrics hidden on shared card/detail components; Publisher first, edition-specific Conference Link first. Docker layer-depth limit required flattening unchanged V151 base before V153 build.

V155: unknown placeholders, primary-source link ordering, confirmed conference dates/place and toolbar metrics-button removal deployed18081. Non-Node focusout causes contains() TypeError in four shared dropdown handlers; reproduced failing test then28 passing after guard. User reports original blank-area crash persists: do NOT mark resolved without native browser reproduction. Clarification pending whether error boundary, hang, or unwanted dismissal. Passive error listener installed on local Chrome tab only; no errors captured yet.
V156: actual composer diagnostics: client84px vs scroll107px, toolbar bottom747.8px vs composer bottom732px. Fix adds flex textarea shrink and responsive assistant panel minimum160px(wide)/200px(narrow). Build pending, actual geometry check required.

V157/V158 location acceptance: 33 frontend and 4 backend tests pass. Standalone preview verified real OSM tiles and globe transition. Integrated browser found SettingsModalContext is scoped to the settings subtree, so the dialog shortcut was absent. V159 fixes the shortcut using existing ui.toggle-left-menu + ui.focus-setting events, as used by spelling settings; no duplicate settings provider. V158 adds local-map ripples and avoids closing rank menus on null/non-Node blur. Full candidate acceptance still pending.

V160 closeout: real editor CSP now allows only tile.openstreetmap.org images, geolocation policy self still gated by default-off setting/browser permission. Rejected Nominatim restaurant false positive using place/boundary categories and versioned cache key. 33 frontend+5 server tests; actual browser all3 reports passed, including full map tiles and error fallback, detail/day-card entry, four menu interior clicks, minimum composer at1400/950. Candidate18081 activated V160, operator compose pointer updated; original18080 image verified unchanged. Details: plan/v160-location-closeout.md.

V165 pending final build: combines visible top-right map return, global minZoom0, conference date/location icons, JIF/JCR sorts (unknown last; best verified quartile for multi-category), official overview extraction and detail metadata simplification. Detail GitGraph now branches from one trunk before each Track first node and rejoins after its last node; overlapping lanes spaced110px, non-overlapping intervals reuse lanes. Hover changes only selected Track nodes to milestone colors and switches legend. 44 frontend+19 backend tests pass; standalone graph preview confirms default/hover/leave states. No candidate deployment of canceled V161–V164 attempts. Full repository TypeScript remains affected by pre-existing errors; new production modules have no reported diagnostics. Fixed one new incomplete test fixture type.

V165 integration findings: return button was still outside viewport in a1500x700 modal after scrolling to controls; V166 aligns the map stage into view when opening. CAiSE2027 official homepage has only a Call for Papers link (no separate Tracks published); main-call fallback now recognizes it and extracts camera-ready/author-registration dates. Main Track date-only rows matching a known catalog cutoff are not double-counted. Contextual overview can use a research theme paragraph when page headings confirm conference identity. V166 tests45 frontend/21 backend pass; build in progress, baseV165. Operator still points to last fully validatedV160.

V169 final accepted on18081: user requested tighter GitGraph spacing; reduced110→72px and confirmed actual PLDI2027 geometry and hover behavior. V168 fixed overview abbreviation truncation; factual catalog summary remains fallback when no introduction is extractable. Operator pointerV169; original18080 unchanged. Evidence:plan/v169-closeout.md.

V171 accepted: legend above graph;48px lanes; Track title/category legend on one centered row; undated names in gray6px-radius background separated by commas.7 tests and real FSE2027/ISSTA2027 browser checks passed at1500/700 widths, no errors. Candidate18081 and operator pointerV171; original18080 unchanged. Evidence:plan/v171-closeout.md.

V174 accepted: Tracks navigation cards replace duplicate overview graph; analysis button removed. Next milestone/day countdown and deadline colors; revisions do not imply reopened submissions.17 tests and real7-card FSE2027 checks passed, including closed/open/repeated click navigation; no browser errors. Candidate18081 and operator pointerV174; original18080 unchanged. Closeout:plan/v174-closeout.md.

V175 accepted: correct subcard navigation, inline collapsed requirements, concise page/review/template fields, prerequisite colors, orange closed badge, centered solid timeline points and extended line, Track-local submission footers.20 frontend/8 backend tests and real FSE2027 browser passed;6 portals for7 Tracks, missing portal omitted. Candidate18081/operatorV175; original18080 unchanged. Closeout:plan/v175-closeout.md.

V177 accepted: AI requirement category cards and read-only draft findings; action row/template/conversion/check; right header submission links; explicit-stage column labels. Real AI completed4 categories/7 findings,46 manuscript files unchanged and0 proposals. TLS source failure handled with dated verified snapshot.19 frontend,41 agent,12 source/report tests passed.12 production files hash-verified; original18080 unchanged; operatorV177. Closeout:plan/v177-closeout.md.
V178 accepted: real saved check reopened twice with zero POST; explicit Recheck made one POST using mocked response. Joined button geometry verified. Initial browser attempt exceeded wait during source retrieval; retry completed against verified same-day Track snapshot. Original18080 unchanged. V179 implementation adds persistent report/finding IDs, batch investigation and status actions; pending production build/browser.

V181: persistent global report/issue IDs and sequential unresolved batch processing; reviewed proposals, evidence and concrete human blockers; green resolved/yellow unresolved; saved check reopening. Exact Track links/scope panels and cleaned venue heading/detail controls. Real7-issue batch investigated all7, no false resolution,1 unapplied proposal,46 unchanged originals. Artifact downloads bounded; live external fetches hit TLS failure, retained as blockers. Final browser, state guards and manifest checks passed. See plan/v181-closeout.md.

V183 source implementation: JournalProfile.mjs supplies exact-name AEI official description fallback, generic identity-checked profile extraction and existing Publisher homepage resolution. JournalDetail replaces blank conference wrapper with scope/article types/template resources/shared requirement workspace. TrackReviewController accepts journals via sourced detail snapshots; report IDs/auth remain unchanged. Added scope category. Publisher template guidance explicitly does not certify journal column/layout requirements. Local external TLS failures persist; cover failures hide without leaving gaps. Evidence:plan/v183-journal-sources.md. Tests26frontend+6journal/review+6issue passed. Existing full-tsc unrelated diagnostics persist; one new Track fixture type error corrected.
V184 browser accepted: journal source-backed content, title Publisher link, reusable checks/conversion, no empty Track/nav containers, narrow overflow0. Actual journal requirements AI task completed. FSE2027 status:Research Papers closed;6 other Tracks open. Initial browser attempt used stale h3 selector; second failed because FSE search also matched Fast Software Encryption and target card was offscreen (lazy loading). Corrected exact venue ID and scrolled target into view, passed. Cover pending-space fix verified; actual external cover remains inaccessible. Closeout and all exact file hashes inplan/v184-*; original18080 application unchanged.

V185: conference layout omitted because summary scanned only format excerpts. Scan explicit layout across sourced categories, excluding camera-ready/published-stage wording and ambiguous single/double claims. FSE2027 official /track/fse-2027/fse-2027-papers explicitly states single-column; cached profile receives exact-source evidence. Journal cover now in flex row aligned at bottom with introduction. Journal homepage resolver consults live Publisher metric snapshots, and journal registry has title/ISSN-matched harvested official pages. Snapshot data remains partial; no unknown metrics/layout inferred. Inventory evidence:plan/v185-inventory-check.json.

V187 evidence: live Nominatim full KIT query returned office/company and amenity/conference_centre (filtered intentionally). City fallback returned Amsterdam boundary/admin candidates. Saved raw responses plan/v187-location-{full,city}.json.7 location tests plus3 recommendation parser tests pass.22 frontend behavior tests pass including9 sequence tests,2 selection controls,2 scoped recommendation tests,4 journal and5 location permission checks. Sequential horizon is explicit12/18/custom1-36months; exact unknown review dates block downstream; no actual submission/withdrawal action.

V188/V189: shared Plan view is inline below area filters; Plan tab and Plan submissions icon shortcut synchronize. Recommend label/icon updated. Active-review selection searches entire venue catalog plus loaded official Tracks; selecting a conference loads its Track picker, which is required before deriving a review window. Active row precedes recommendations, with preparation gap after its outcome. Journal/unknown dates require explicit estimated outcome. Legacy withdrawal fields are ignored; no hidden release assumptions. Recommended conference candidates expand to exact official Tracks, preserving parent identity and per-Track dates. Plus adds one editor; selecting earlier chart row edits that choice and truncates following choices on change. Final icons use inline SVG rather than relying on font glyph availability.19 focused tests passed before final icon/loading refinement; finalrerun pending.

V190: scoped Track completed activity suppressed (active/error feedback retained), all ranked recommendations default-collapse together. Two compact columns show fit and unmet/unconfirmed bullet excerpts, max160chars, with original evidence in separate collapsed detailed analysis. NewAI prompt requests2-3concise reasons and up to3unmet/unconfirmed items; parser bounds/validates optional arrays, preserving legacy tasks. Existing reports use conservative sentence excerpts and prefer explicit unmet/unconfirmed clauses; no AI rerun or evidence deletion.11frontend+4backend tests pass.

V190 first image could not create a verification container: Docker max depth exceeded. No deployment occurred. Rebuilding identical40-file cumulative manifest on knownV185 base instead ofV189 avoids cumulative layer depth; preserve failed attempt build log and record image IDs.

V191 layout root cause: generic .deadline-panel input width100% stretched the checkbox; generic label margin-bottom6px offset the reset button relative to inputs. Scoped width/flex and baseline resets fix both. Review search/venue/date controls share a responsive row; redundant review-outcome banner removed. Timeline ticks are ISOYYYY-MM with minimum66px/month and horizontal scrolling, explicit type/Track names, complete known milestone dots/short labels with lane allocation and full hover/focus date readout, and separate type/milestone/horizon legends. Shared conference start is appended for display only, never substituted as review outcome.24frontend tests pass before final hover refinement; final rerun logged.

V194 accepted on18081: insert-between, drag/arrow reorder, visible conflicts, review-toggle preservation; all pending compact Track reports/icon/layout/milestone changes shipped.28frontend+4backend tests,production webpack,40imagehashes,actual browser planner and cached Track report pass. Original18080 unchanged; operatorV194. Fullrepo tsc unrelated failures; no changed planner-module diagnostics. Details:plan/v194-closeout.md.

V195 accepted: Recommend gates cached fit/Track result rendering; List renamed Card, responsive vertical multiple-column cards without miniature axes.28frontendtests,webpack,40imagehashes and actualbrowser3columns/toggles/narrowoverflow0 pass. Candidate18081/operatorV195; original18080 unchanged. Seeplan/v195-closeout.md.

V197 accepted on18081: quarterly planner, compact insert/left drag, Today/cross-row guide, alternate labels; journals default3calendar months, editable persisted endpoints/bar translation; light-red exact overlap Conflict bands.30tests,webpack,40hashes pass; live journal browser and isolated conference-fixture guide pass. Official conference source unavailable during browser check, explicitly recorded. Original18080 unchanged,operatorV197. Seeplan/v197-closeout.md.

V199 accepted on18081: full pending V198 refinements plus journal dates under name and full-name hover.32frontend+4catalogtests,build,40hashes,actualbrowser interaction/equalheight/narrowoverflow checks pass. Historical source editions retained; conference browser milestone fixture boundary recorded. Original18080unchanged;operatorV199. Seeplan/v199-closeout.md.

V206: CCFDDL allacc source has321series and exact conference_key, including separate SC/fse vs SE/fse. Software FSE reports2021,2023,2025,2026; no synthetic fill. Service endpoint independent from deadline cache; authenticated and exact edition-limited. Added frontend/server year-cutoff tests. User revised conference review bar to remain through final notification while fatal(red)/warning(orange) split at author response. 40frontend+11Track+3statistics tests pass. Seeplan/v206-closeout.md for final acceptance.

V210 final measured acceptance: conflict boundaries within0.016px, final-review bar alignment0px, row78px, insertiongap20px centered. Combined statistics plot and titlelink validated in real browser. All artifacts recorded inplan/v210-closeout.md; original18080 intact.

V211 rootcause verified: combinedsemicolonqueryreturned[];SanDiegocityqueryreturnedarea candidates. Candidatebrowser now resolves NeurIPS2025two and2026three sites independently, with2/3routes fromsyntheticorigin andalllocalmapsaccessible. Seeplan/v211-closeout.md.

V212 accepted on18081: five primary controls same row, Preparation (days),38px aligned heights; production build+47hashes+browser2400/1800/1400 passed. Narrow panels locally scroll. Original18080 unchanged. Seeplan/v212-closeout.md.

V213 AI-assisted source interpretation: official CAV2027 CFP lists Regular Papers18pages/doubleblind; Tool Papers18pages/singleblind/mandatory AE; Application-Industrial-CaseStudy10pages/singleblind. Shared Jan20AoE paper cutoff, Apr5-8 response, Apr23 notification. Artifact page has two distinct rounds. Generic explicit-list+heading extraction now preserves three categories, scoped evidence and source anchors; artifactrounds separated. LiveHTML fixtures stored under services/web/test/agent/fixtures/cfp.17tests passed. This is session AI-assisted implementation, not a new runtime LLM discovery service.

V213 first browser pass: live CAV source refresh yielded5 Tracks and complete dates. Picker test lacked saved recommendation-task setup, leaving candidate list empty; restored same recommendation fixture as prior accepted browser tests. No application error observed.

V213 final rerun hit30s catalog warmup timeout immediately after restart; increase test request timeout to180s (no product change) and rerun.

V213 accepted: four phases completed;17tests,48hashes, actualbrowser CAV3paper+2AErounds verified. Official timestamps/ranges and scoped requirements retained. Session AI-assisted interpretation documented; existing perTrackAI receives scoped evidence. OperatorV213;18080 unchanged. Seeplan/v213-closeout.md.

V214 findings: planner reset only wrote chosen:undefined and never invoked AI. Existing recommendation endpoint snapshots current editable manuscript at task creation (WritingAssistAgentService snapshot(projectId)) and uses reportOnly, with official catalog asset. Planner action now signals the existing single mounted recommendation component; fresh completion alone replaces plan, restored results do not reset, empty/error retains choices. Fit-first feasible selection receives AI scores.
Journal alternative false-unavailable caused by saved.windows keyed by venue and reused across choices. Alternatives now schedule fresh windows; selected current manual window preserved; insertion/replacement clears stale candidate dates. Unavailable list excludes rolling journals.
Legend grouped by four meanings with aligned24px icon slots and internal wrapping.42frontend tests passed, including delayed AI success, failure/empty retention, navigation during task, journal replacement and legend structure. Final cumulative build pending actual AI browser validation.

V214 accepted: all phases completed;42frontend regressions, production build,48hashes, actual AI task and browser validation passed. Suggest with AI reads current manuscript; failed/empty result retains plan; fit-first feasible suggestion. Rolling journal alternatives rescheduled,4legend groups aligned. OperatorV214;18080 unchanged. Seeplan/v214-closeout.md.

V215 accepted: selected-date legend enumeration removed; Clear selected dates and timeline toggles retained.42tests, build,48hashes and real browser2guide clear verified. Includes acceptedV214 actual AI10recommendations, rolling-journal scheduling and grouped legend. OperatorV215;18080 unchanged. Seeplan/v215-closeout.md.

V217 browser fixture correction: selecting removed first-row start also matches the surviving journal newly rescheduled to Today, so guide correctly remains. Select removed row end instead to verify orphan-date cleanup; no production change.
V217 fixture follow-up: both journals default to92days, so both endpoints also coincide after rescheduling. Give surviving journal37days for a genuinely orphaned selected end-date check.

V217 accepted: compact timeline and per-row trash complete.44tests, build,48hashes, actual browser deletion/persistence/geometry pass;0px guide alignment difference. OperatorV217, rollbackV215;18080unchanged. V216superseded without deployment. Seeplan/v217-closeout.md.

V218 diagnosis: cold startup catalog upstream failed;683directory-only venues, historical IDs FSE/CAV/EASE returned404. Retrieved live CCFDDL793902bytes via local proxy into plan/v218-live-catalog.json. Add durable successful catalog and stale Track fallback when parent unavailable. Existing backend failed-fetch fixture used a curated journal snapshot, so changed it to explicit refresh to test actual failure path.

V219 final backend-only layer: Docker FROM local sha256 parsed as registry tag and failed before any deployment; tagged the verified compiled image as v219-compiled and retried. Base image ID6215b2f9 remains recorded in build logs.

V220 follow-up during real browser validation: historical search was loading IDs alphabetically, delaying selected/latest editions. Prioritize current review and descending-year search matches. Return stored stale Tracks immediately and refresh in background, so slow official sources do not block MongoDB-backed selection.

V222 accepted: all V218-V222 user requirements complete. MongoDB Venue database and evidence import; real button-driven source/AI write verified; unified historical Track selector/default journal bar; duplicate journal instances; requested panels removed.27backend+39frontend tests,55hashes,final browser and DB restart retention passed. OperatorV222,rollbackV221,18080/manuscript unchanged. Deployment waited for running AI task. Seeplan/v222-closeout.md andplan/venue-database.md.

Bioinformatics: obsolete profile homepage and directHTTP403 both confirmed. Official current pages readable through web research tool; browser bridge unavailable, native Chrome observation timed out. Added sourced profile +5 concise requirements +JIF5.5/year2025/release2026 and CiteScore11.1/year2025 to MongoDB, backed up original record. Service readback passes. Signed cover URL not installed as durable cover. V245 seed image57hashverified, activation deferred because userAI task running; V244 layout deployed/browseraccepted.

V252 accepted. Icon registry unified Unicode across native selects and page components. New priority scheduler preserves quality for similar fit; verified old actual analysis now orders original branch TOSEM,TSE before ESE,ASE. /plan project=<id> supports requirements,current defaults,validated model settings,persisted status and automatic targetPlan navigation. Browser handoff1POST passed with model-result fixture; no new live AI run.

V253: selected Track details omitted ConferenceTrackCard entirely; now same shared card renderer is used by parent page and Plan detail. Parent ID is used for ancillary detail request. Nominatim duplicate city/boundary records are normalized at parse and cache-read, preserving distant same-label locations. Shared SVG paths replace emoji; native planner selects replaced with existing Downshift-backed Overleaf Select. /plan help now has project-ID and common requirement completions; flex shrink prevented.
Validation: 60 focused frontend tests + /plan completion test + 10 location tests pass. Broad composer suite has pre-existing /stop goal fixture with missing message content (issueClarifications undefined.replace); no unrelated production change. Initial test command used wrong cwd paths; rerun with correct paths.
V255 additions: area grouping passes selected-area state explicitly into both planner menus; other-area items remain enabled. No areas means no grouping/dimming. Removed emoji from option strings also fixes icon-driven alphabetical ordering. Quality selection now considers scored-fit >=70 before directory quality, rather than rejecting a suitable A venue solely for being >10 points below the highest fit. Explicit Prioritize quality recalculates old saved sequences (replaces custom target windows), without AI. Insert-result AI recommendation uses accessible SVG sparkle. Fatal red hatch versus solid amber warning also applies to legend.

V257: user requests supersede compact labels: restored plannerOptionName full title and one line. Opt-in portal menu for planner Select escapes workspace clipping, measures anchor, clamps to viewport, chooses up/down and scrolls horizontally for overlong labels. Generic Select behavior remains unchanged without menuPortalClassName. Quality control is now first persisted checkbox, checked by default, and toggles deterministic replan from cached scores. Unchecked mode sorts fit before speed; context sends preference to recommendation endpoint. 82 focused tests pass including both orders and no AI invocation.

V258 diagnosis: /plan bypasses conversation messages and only rendered a generic status. ConversationView ORed command.running into every busy/send control. Poll catch left pending running but stopped polling; completed/no-result polled forever. Fix displays backend tool/message activity via existing AgentActivity/UserMessage, stores current task, marks read errors checking-failed with same-task retry, handles no-result completion as terminal, and separates ordinary chat availability from planning status. 23 focused frontend tests passed, including real ConversationView follow-up while a running /PLAN fixture remains active.

V258 browser provenance: initial fixtures failed because empty-array route response was not serialized explicitly; subsequent message fixture GET returned stale empty turns after POST, corrected to preserve posted turns. These attempts were fixture failures, not acceptance evidence. Final browser pass recorded in v258-ui-browser.json. Console has unrelated /project/<id>/changes/users 404 and intentional simulated status503; zero uncaught page errors. No production change was made for the unrelated changes/users endpoint.

V259 counts before changes:venues3290,venueTracks2796,venueMetricSnapshots607,venueLocationCache22,acceptance0. Acceptance root cause: process-local cache plus15s directfetch; catalogresolve also waited on stale refresh. Both now database-first; acceptance snapshot321series/1227annualrows seeded from maintained GitHub release after ccfddl.com direct/proxy failures. Tested CVPR5years. Personal workspace/snapshots added with ownership/project permissions and noTTL; task rawdocuments not copied. Frontend temporary state remains local; saved plans/favorites/recommendations durable. Browser test used isolated project6aedeb380a2e9b60fb891783, then archived it; original project plans untouched.

V260 user regression evidence: nginx logs at15:25:41–15:25:49UTC show userChrome GET /venue-workspace200 followed by repeated POST400. Previous V259 test used only current-schema plan fields, so did not cover legacy browser migration. Exact user payload unavailable (browser connector unavailable); strict plan schema rejects unknown legacy properties. Changed plan validation to passthrough bounded legacy fields; migration makes an exact browser backup and returns usable local data with a sync warning if POST fails. GET failures remain distinct. Same-owner legacy favorites are retried after an earlier failure stamped owner.76focusedfrontend tests pass. No user browser data was deleted or overwritten by diagnostic commands.

V261 calendar export: shared ICS serializer + footer actions added to Plan (journals included), conference card, single/all Tracks, filtered views. Source URLs for Google/Apple import verified; external account import not tested. Browser downloads and compactSVGcontrols passed. 56focusedtests pass;25expandedpass/3oldviewfailures reproduced againstV260. Candidate accepted;original18080unchanged. Git dependency scope remains awaiting user reply.

V262: user requests paired centered provider buttons everywhere, labels exactly Google Calendar/iCloud Calendar, no separator, brand logos. Use downloaded Google SVG asset and iCloud SVG reproduction with provenance. All-Track export moved from ConferenceTracks bottom to ConferenceDetailTimeline bottom; individual cards unchanged in scope.18focusedtests pass. Candidate build/browser pending.

V263: inherited align-items:start shrank Card footer; V262 geometry assertion incorrectly compared button-group center only with footer center. Fix footer width100%+stretch; set rowgap8 and remove extra topmargin. Browser assertion now compares to entire card. Navigation now unique calendar/grid/timeline/checklist SVGs, single Submission Plan button. Refresh is not duplicate: lightweight DeadlineController.list(refresh=true) versus plugin VenueRefreshController database+AI job; label clarified to Refresh deadlines.20focusedtests pass.
