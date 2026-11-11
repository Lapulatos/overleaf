# Overleaf continuation and Prism baseline

## Goal
Verify whether prior work was finished; then implement Prism's basic scientific-writing capabilities on the existing Overleaf foundation. Do not treat the older daemon milestone as whole-product completion.

## Actions
- [x] P0 Audit tracked code, untracked work, historical plans, tests, and running services.
- [x] P0 Record verified completion and outstanding prior work in `plan/prism-baseline-audit.md`.
- [x] P0 Settle the unfinished Agent integration path before extending it: user chose finish old tasks first.
- [x] P0 Restore daemon source selectively from WIP; fix proposal-only execution and terminal-state handling.
- [x] P0 Finish backend protocol/configuration and authenticated deployment.
- [x] P0 Connect project-authorized Web task API and version-checked acceptance.
- [x] P0 Implement task rail UI, progress, preview, accept/reject and cancel.
- [x] P0 Verify the complete old Agent workflow with a real backend and browser before declaring it finished.
- [x] P1 Implement project-aware conversation and reviewed manuscript edits; isolated real-model/browser acceptance passed.
- [x] P1 Integrate literature search and reviewed citation import; isolated browser/PDF acceptance passed.
- [x] P1 Integrate compile-error assistance; real failure/repair/PDF acceptance passed.
- [ ] P1 Verify editing, compile, collaboration, configuration, authorization, and failure handling end to end.
- [x] P1 Accept image/equation conversion using actual model, browser and PDF.
- [x] P1 Accept local voice recording/transcription through reviewed manuscript edit and PDF.
- [ ] P1 Implement authenticated reference-library selection/import (Zotero), then complete combined compatibility regression.

## Decisions
- Preserve all pre-existing untracked files and dependencies; do not commit, deploy, or publish automatically.
- Official Prism product/help pages establish the comparison; local code and runtime establish implementation status.
- Existing `plan/task_plan.md` is historical evidence and remains unchanged.

## Status

Current checkpoint: user demo18080 v41 (Agent conversation bubbles and avatars); isolated reviewed-deletion candidate18081 v33;
frontend readback real-browser acceptance passed (plan/prism-readback-browser.json). Host Codex
daemon47068. Use the final chronological checkpoints and plan/prism-current-capabilities.md
for current evidence; older version/PID statements below are historical. Overall incomplete.

Old Agent core and independent grammar/selection workflows are accepted in the isolated environment. Prism project conversation, literature/citation import, compile-error assistance, printed-image conversion and local voice recording/transcription all passed their real model/browser/PDF gates. See the corresponding plan/*-acceptance-report.md files.

Current isolated runtime is v28 (sha256:23c1b2d5554410cb3ae68794c7f836d92469bd1f2756152a12ee26bc069e6abe; readonly grammar request/control restriction enabled), site http://127.0.0.1:18080. Host daemon PID16531 enables document harness and retains local speech; 98 Web source hashes match. Actual browser cross-file read/edit/failed compile/repair/successful compile/PDF inspection and reviewed writeback passed in v20. v21 adds accepted new-file creation and actual project PNG upload/compile gate: five checks passed in prism-browser-create-harness.json. Expanded-review composer remains visible in the deployed build; review screenshot inspected. Original installation/data unchanged.

174 backend tests, 39 account-deletion tests, eight literature frontend tests, four Python decoder tests and prior 19 voice/conversation frontend tests pass. Full typecheck retains 13 baseline errors. Actual Zotero invalid-key browser check passes four checks; positive connection/import is unverified without credentials.

Remaining: authenticated Zotero import, reviewed version-safe deletion, legacy history restore, broader comment lifecycle/permission checks and combined compatibility/cancel/recovery acceptance. Basic native comments passed create/peer-sync/reload; AI-edit history viewing passed three checks. Native migration plus API file restore passed on a synthetic fixture. v22 enables native controls and adds verified native migration before self-hosted restore; Native file-restore UI gate92903 passed four checks; legacy-project automatic migration and UI gate82491 also passed four checks. Read-only probe74239 confirms persisted ranges support. Whole-project restore passed four real UI checks; comment-preserving single-file restore and reply/resolve/reopen passed eight checks; unloaded documents retain readable comments. No flag-only migration is used. Normal editing/save/collaboration passed four checks. Overall goal active and incomplete. No commit, PR, push or public deployment.

## Errors encountered
- Sibling `*agent*` shell glob found no match; use bounded filename searches instead.
- Docker inspection failed: local Docker socket missing; no running service verified.
- Initial recovered daemon test run failed to import @anthropic-ai/sdk; resolved with package-local `npm ci --ignore-scripts --no-audit --no-fund`.
- Some initial test/source lookup paths and a working-directory-relative log read were incorrect; corrected using rg and repository-root paths.
- UI test initially used unavailable Chai `.text` assertion; changed to textContent; 3 tests now pass.
- Lint found runtime use of devDependency `diff` and forbidden void expressions; moved existing diff version to runtime dependencies and corrected expressions; targeted lint passes.
- Frontend type check initially found unsupported rail icon plus an older missing rewriteFidelity type; fixed both. 13 errors remain outside the new panel, mostly absent optional modules; full type check is not green.
- Web Vitest bootstrap initially lacked sinon-mongoose; restored version 2.3.0 from the existing Yarn cache without overwriting installed packages. It then fails because its Sinon peer range is 5–7 but installed Sinon is 9.2.4. DocumentUpdaterHandler suite has not executed; do not count its new tests as passing.
- Requested Docker Desktop startup with `open -a Docker`; first subsequent docker ps still reports missing socket. No container updated or recreated.
- `docker desktop status` could not retrieve daemon status; `docker desktop start --timeout 30` reported still starting / context deadline exceeded. This is an observation timeout, not proof the backend exited; inspect existing Docker process/socket on continuation rather than restart blindly.
- Subsequent log/process audit establishes startup failure: com.docker.build start request unexpected EOF, engine cancellation, monitor exit 150, no remaining backend process/socket. Investigate that component before retrying; do not reset data or infer license acceptance is required from unrelated warnings.

## Runtime change during build
Docker now runs Linux 7.0.14-linuxkit. Original Mongo image refuses this kernel;
original database untouched. Official MongoDB 8.0 notes identify 8.0.30 as lifting
the startup guard for fixed 7.0.14+. Updated ONLY isolated acceptance Compose to
mongo:8.0.34. Pull succeeded, isolated Mongo is healthy on the new kernel and Redis
is running. Original mongo:8.0 tag/config remain unchanged. Build session 80303
is live in production webpack; the acceptance Web service is not started.

Production webpack passed (187.092 seconds, two size warnings), but development
thread-loader workers delayed exit by ten minutes. Derived Dockerfile now sets
ENV NODE_ENV=production before the full compile pipeline; corrected build session
80303 completed successfully. Image sha256:32e46bb5fc4eee3285db02f7562087d02470deb80d80b36a0974dd301bb44791. Acceptance runner is starting Web. Prior successful compile output is preserved separately.

## Resumed old-work priority
Independent grammar/selection provider integration comes before further Prism
features. See plan/legacy-provider-plan.md. Image code is partially implemented;
124 backend tests passed, but image UI and real-model acceptance are pending.

## Legacy provider checkpoint (latest)
Explicit local Agent provider implemented; real Codex grammar correction and
LaTeX-preserving selection polish pass at service layer. Stale selection result
protection added. 138 backend + 20 frontend + 11 legacy tests pass; source lint
and diff checks pass. Typecheck still has 13 baseline errors.
v9 built but not deployed (predates stale protection); v10 final-source build
is running, log plan/legacy-final-image-build.log, manifest
plan/legacy-final-source-manifest.json. Browser/configuration/PDF acceptance
remains required. Overall goal active; image, voice, library and full regression
requirements remain open. See plan/legacy-provider-plan.md.

## Latest runtime and pending verification
Isolated runtime is now v11 (71 source hashes matched), daemon PID 69957.
Legacy browser testing found and repaired refresh cancellation and short busy
admission. It then found disabled automatic checks could still run and busy
errors were rendered as 500. Those final source fixes are in the LIVE v12 build
(exec 90607, plan/legacy-disabled-image-build.log). 143 backend tests pass, a new
disabled-config frontend test passes, source lint passes, and typecheck retains
13 baseline errors. Full legacy browser/PDF acceptance is still REQUIRED.
All earlier browser runs are terminal and their failures preserved. See latest
plan/legacy-provider-plan.md. Do not mark old work or the overall goal complete.

## Legacy acceptance final checkpoint
The v12 browser/PDF gate passed all seven checks; report
plan/legacy-writing-acceptance-report.md. Build 90607, deploy 28042 and browser
71612 are terminal. Image test sessions are also terminal; 148 backend tests and
three image UI tests pass. Next is actual image/formula acceptance, followed by
voice/library/final compatibility. Do not treat this phase as full goal completion.

## Image acceptance checkpoint
Seven browser checks and Mongo metadata-only storage audit pass; rendered PDF
visually matches printed formula. See plan/prism-image-acceptance-report.md.
All image test/browser sessions terminal. Overall goal remains active.

## Voice implementation checkpoint
Added voice-input.tsx and ConversationView integration: English/Mandarin, explicit start/stop, editable transcript and explicit insertion, provider disclosure, failure messages, abort and stale-callback guards. Five voice and six conversation tests pass. Source lint passes; full typecheck still reports 13 baseline errors. See plan/prism-voice-plan.md. Real speech recognition and isolated runtime rebuild are pending; deployed v12 remains unchanged. Overall goal incomplete.

## Voice real-service checkpoint
Real Chrome microphone and live-track probes produce no transcription; voice acceptance remains open. Draft preservation/overflow integration tests added. v13 build initially failed from missing amd64 platform; corrected build live session 81444 (plan/prism-voice-image-build-amd64.log), parser generation complete, webpack pending. Deployment/browser scripts prepared but not run. Original and isolated running installations unchanged. See plan/prism-voice-plan.md before continuing.

## Voice runtime update
v13 is now deployed in isolation and 72 source hashes match. Browser UI checks passed (including enabled Send and no auto-submit). Latest timeout/constructor-error source fixes pass 15 frontend tests but are not yet built. Real speech acceptance remains open; local-model probe session 6530 running. See plan/prism-voice-acceptance-report.md. v13 build/deploy/UI tests are terminal.

## Local speech backend checkpoint (2026-10-31)
Browser-native and local-model probes returned no transcription. Added project-local faster-whisper worker and bounded authenticated agent/Web proxy in source. 162 backend tests and four real decoder tests pass; 15 frontend tests remain passing. Real model download/probe LIVE session 12045 (plan/prism-speech-probe.log), last 23 MiB; poll before any restart. Browser MediaRecorder upload UI not yet implemented. Running v13 and daemon remain unchanged; current new backend and timeout code not deployed. See latest plan/prism-voice-plan.md. Goal remains incomplete.

## Voice end-to-end preparation
Actual English worker and Node service transcription passed; temp audio removed. Mandarin returns text with a homophone error. Recording UI source and four recorder tests added: 19 frontend tests pass, typecheck retains 13 baseline errors. v14 build LIVE 78059; target overleaf-agent-acceptance:20261031-v14, 6650-file manifest. Deployment and actual recording-to-reviewed-PDF script prepared but not run. Current runtime remains v13/daemon 69957. Next poll build, deploy guarded script, run prism-browser-local-voice.py. See plan/prism-voice-plan.md for exact evidence. Goal still incomplete.

## Zotero implementation checkpoint
Zotero per-user encrypted connection, browse/search, no-DOI conversion and reviewed import UI implemented in source. 174 backend + seven library frontend + 39 UserDeleter tests pass; typecheck remains 13 baseline errors. Live invalid key correctly rejected by Zotero. v15 build LIVE 57093 (6658 source files); deployment and real denial browser script prepared. Current runtime v14/daemon88311. Positive authenticated service/import/PDF acceptance needs a valid read key; connected desktop Zotero tool returned 502 and supplies no online key. See plan/prism-zotero-plan.md. Overall goal incomplete.

## Current continuation checkpoint
Zotero v15 is deployed. Late-status identity overwrite fixed in source; eight library frontend tests pass. v16 immutable build running, session 69954, log plan/prism-zotero-fixed-image-build.log. Deploy helper plan/prism-zotero-fixed-deploy.py reuses dedicated encryption key. Normal immediate-refresh/bidirectional collaboration browser test passed four checks on v15; beforeunload warning prevents abandoning an unsaved edit when cancelled. Real Zotero credentials and remaining combined acceptance are still pending.

## v16 deployed checkpoint
Build 69954 and deployment 95820 completed successfully. Isolated image sha256:84934afea3dc39c86466cef4a9e6aaf87c0e1a44a51507c5999a77c061112041; 82 relevant source hashes matched. Daemon remains PID88311. Actual invalid-key browser run 5574 passed all four checks; report plan/prism-browser-zotero-denial.json. Successful real Zotero connection/import still requires credentials. Save/collaboration four checks passed on v15. Initial comment regression could not open input via shortcut; failed artifacts retained with initial- prefix. Capitalized-key retry currently running session85661; poll before retrying. No complete-goal claim.

## Native comments source checkpoint
Native thread service/controller, route wiring, CE project feature mapping and comments-only UI wiring added in source. 180 backend tests and35 ProjectEditorHandler tests pass; full typecheck remains13 baseline errors. Runtime v16 unchanged. Must cover range/chat partial-failure retry, real protocol and browser acceptance before deployment/completion. See plan/prism-comments-plan.md. All test sessions terminal.

## User-directed UI repair and speech decision
User reported unattractive oversized assistant forms and inability to scroll to bottom. Added full-height flex assistant wrapper with independently scrolling bounded region, compact selected mode buttons and typography; collapsed optional voice/image tools and bibliography destination. Focused frontend19pass; source lint passes with explicit scroll-region tabindex allowance. User requested then CANCELLED Doubao API integration: do not request/use credentials or implement it; use external dictation in ordinary textarea.
Comments retry receipts and project cleanup added; backend183 and project71 tests pass. v17 build54067 completed but was NOT deployed because it predates UI fix. v18 immutable build32515 is live, log plan/prism-panel-image-build.log,6663files. Deploy plan/prism-panel-deploy.py expects currentv16 and reuses private key. Layout browser plan/prism-browser-panel-layout.py prepared; not run. Comments browser still pending. No whole-goal completion.

## Harness requirement clarified by user
User explicitly requires Codex-like document/tool execution, not a plain model API wrapper. Source audit confirms runtime Codex adapter is read-only, daemon cwd and snapshot-to-diff prompt; full isolated workspace and compile iteration are not yet implemented. Added plan/prism-harness-plan.md. Preserve this requirement in completion audit. UI scrolling fix v18 remains current build32515.

## Latest runtime and harness checkpoint
Current isolated runtime v19, image4d9f373bfbdf1bf5dd87c430722177d36b96705e3917efb602be152e6fea95a2,92sourcehashmatches,daemon88311. Build37871/deploy14711/browser79330 terminal. Panel width/no-overflow assertions and three real scrolling checks pass. Comment browser70934 terminal: creation and peer event pass; refreshed content exists but remains hidden even after selecting panel. Comments NOT accepted; investigate selected range/expand behavior before claiming persistence UI.
Harness project-workspace.mjs + five tests added, tests pass; not wired to Codex. Next implement isolated execution and compile/tool iteration, plus screenshot-requested bottom composer/model/effort controls. No complete-goal claim.

## Harness transport/compiler checkpoint
Added Codex app-server transport and pinned isolated Docker compiler primitives.8unit tests pass; real catalog8models; actual named-permission command probe allows projectwrite and denies outsidecanaryread; real compile produces30,730-bytePDF with expected text. No model turn executed and no harness backend switch yet. All probe sessions terminal; runtimev19 unchanged. See plan/prism-harness-plan.md for exact next gates.

## Harness execution progress
Real Codex multi-file read/edit/compile/fix and PDF inspection now demonstrated in disposable workspace; backend code integration is optional and not deployed. Binary assets, reviewed create/delete, model/effort UI and bottom composer remain open. Latest focused13tests pass. Do not equate this executable harness checkpoint with completed Prism product.

## Attachment/catalog progress
Project attachment collection/materialization and controlled compilation implemented; real PNG + separate class template compilation/PDF check passed. Actual catalog returns8models with efforts; authenticated/project-authorized metadata endpoints implemented. No runtime switch yet. UI controls, per-task selection propagation, create/delete review and browser acceptance remain.

## Bottom composer implementation
Bottom composer, real model/effort controls and per-task propagation implemented.206backend/9focusedfrontend pass;13baseline TS errors remain. v20 immutable build LIVE session39006; source manifest6704files. Existing v19 still live. Next poll build, run plan/prism-dock-deploy.py, then plan/prism-browser-dock-harness.py and inspect screenshots. Prepared scripts are not acceptance evidence until run.

## Verified build wait and comments
Continued same live v20 build39006 (production Webpack, no restart). v19 still serves. Corrected comment reload test race using aria-selected; actual browser creation/peer sync/reload3checks pass. Screenshot visually inspected. Comment source unchanged. Broader comments lifecycle still open. Prepared v20 deployment/browser scripts remain unexecuted until build success.

## v20 browser acceptance
Build39006/deploy55716/browser42358 all terminal success. Actual selected model task produced two reviewed edits and accepted project compiled expected PDF. Expanded review layout correction remains source-only; preview probe79294. Create/delete and remaining compatibility gates open.

## Reviewed new files
Creation proposals and explicit reviewed writeback implemented, collision/no-overwrite checks added; deletion still unsupported.209backend and27service tests pass. v21build68687 live,6704file immutable manifest. v20 remains live. Next poll build, deploy with prism-create-deploy.py, run prism-browser-create-harness.py (new folder/chapter plus actual PNG attachment and fixed dock layout).

## Active history restore work
- [x] Confirm native restore requires ranges support; identify existing official resync migration (no ad-hoc flag flip).
- [x] Run native migration only on owned synthetic acceptance fixture, verify history and restored content.
- [x] Implement capability/UI and existing-project migration behavior with appropriate failure handling (v22 deployed).
- [ ] Verify old-version restore and return to accepted content, including comments where applicable.

## Project and comment restoration acceptance
- [x] Restore whole synthetic project through native UI; verify later file removed and accepted file structure/content restored again (prism-browser-project-restore.json, four checks).
- [x] Verify reply/resolve/reopen and history restore of comment anchors on a current synthetic project (v24, eight checks plus unloaded-range probe).
- [ ] Verify comment permissions and cancellation/recovery independently before claiming complete Prism baseline.

## Review layout and permissions pass
- [x] Locate fixed viewport Review footer overlapping assistant dock; add editor-bottom variable to footer/empty-state/more-comments position.
- [x] Scope native Reopen visibility to comment-management permissions and use authoritative thread author with metadata fallback.
- [x] Build/deploy v25; four browser geometry cases prove Review footer avoids dock, screenshot inspected.
- [x] Verify readonly user can view/reply but cannot see Reopen or invoke management APIs (v26 real browser95136).

Native harness cancellation/recovery browser gate passed4checks on v24 (prism-browser-cancel-recovery.json). v25 full build2833 remains live; layout/readonly acceptance still pending deployment.

Readonly reply gate found frontend incorrectly disables comments for invited readers. Scoped native invited-member fix prepared; v26 fullbuild77653 live, deployment pending. Current runtimev25; lintpass/TS13baseline.

Controlled restart probe found frontend stops polling after transient unreachable response. Host daemon restarted safely as PID14849; missing task becomes failed on next authenticated refresh. Source poll retry added with10component tests passing; not yet deployed. v26build77653stilllive (readonly reply only); retry changes require later image.

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

## Fixed demo login — 2026-10-31
User requires stable credentials. Preserved existing owner and projects; saved login
in private ~/.local/share/overleaf-acceptance/demo-account.json (0600).
Policy: plan/demo-access.md; acceptance launcher marked disposable-fixture-only.
Verified fresh browser login reaches /project; live image remains v28.

## Deletion history preflight
- [x] Add read-only history readiness check before new/preparing deletion fencing.
- [x] Preserve fenced/committing retries without history migration.
- [x] Test unavailable/mismatched/resync history and recovery ordering.
Native legacy migration remains separate; never resync inside the structure lock.

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

## Cache-loss recovery in progress
- [x] Add atomic missing-cache reservation with Redis generation and ownership checks.
- [x] Verify on temporary Redis including restart, partial cache and changed snapshot.
- [x] Add operation-bound persisted snapshot reader and connect DU recovery.

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

## Pending-edit rejection notification
- [x] Notify native real-time clients when durable write guard fails before queue processing.
- [x] Verify queue untouched, lock released and no duplicate apply-error notifications.
Third-party delete enqueue currently swallows failures; durable retry integration remains pending.

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

## User priority: unified Prism-style composer
- [x] Place image/voice/model/effort/send controls inside one composer boundary.
- [x] Verify interaction and responsive rendered layout, then build/deploy UI update.
Existing v29 deletion candidate build session3274 remains separate and unchanged.

Composer source completed: unified border, internal attachment/mic actions, compact
model/effort selects and circular send. Expandable panels stay inside composer and
Escape closes them; drafts persist.11 conversation frontend tests pass; targeted lint
passes. Build v30 from v28 contains ONLY3 composer files (conversation-panel.tsx,
model-controls.tsx,agent-panel.css), preserving deployed feature behavior. Source
manifest prism-composer-source-manifest.json. Build live session57744, log
prism-composer-image-build.log. Do not restart on quiet webpack output.
Next after image completion: run prism-composer-deploy.py (verifies hashes and preserves
existing container agent/Zotero settings privately), then prism-composer-browser.py via
agent-browser-venv for1440/1000/760 screenshots. No model request is sent by that test.
Prior v29 image completed and verified43 hashes/41syntax checks; deletion candidate
remains undeployed. Evidence prism-deletion-image-verify.json. Do not merge deletion
candidate into the user-requested UI rollout.

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

## Restored-file persistence checkpoint
Fresh browser read of the restored document passed, with no JS errors. Native paths
endpoint proves file present at history version2 and absent at version3. Evidence:
plan/prism-deletion-restored-editor.json and prism-deletion-history-paths.json.
Initial join/leave timing failure remains uncorrected; fresh-open success is not a fix.
Next executable check: edit only restored synthetic document, observe edit in a second
browser context, reload both and verify persistence without compile. Keep demo18080 v30.

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

## Combined v31 build
Previous turn progressed: source join fix tested and candidate checker configured/verified.
Freeze source delta against v28 including deletion, current composer and join helper;
build v31 then verify source hashes. Deploy ONLY candidate18081 preserving volumes
and private env; run rapid-switch regression before any demo change.

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

## Real model deletion review acceptance
Previous turn progressed: immutablev31 and real-browser regressions passed.
Live daemon health confirms idle running0/max1. Reload updated backend with existing
private configuration and source-hash guard, then request deletion of two synthetic
files in candidate project. Verify proposal leaves files intact; reject one and
accept one through UI, inspect authoritative deletion/history. Demo gate stays off.

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

## Deletion stale-proposal integration
Create synthetic pending proposal, edit through native browser editor, observe peer
synchronization, accept old proposal through authenticated API and verify retained
content/tree after reload. Record response and task status separately: current
service maps all deletion exceptions to uncertain502, even snapshot conflict.

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

## Lost browser response acceptance
Previous turn progressed: conflict classification fixed/tested/deployedv32.
Use synthetic pending deletion; browser network route sends actual request then
drops successful response. Retry same proposal; read task and native deletion
receipt/history to prove no duplicate. This covers lost client response, not a
server crash between commit stages; keep those claims separate.

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

## Readback v33 runtime validation
Freeze delta from v28 including all prior candidate fixes, buildv33, hash verify
and deploy candidate18081 only. Generate fresh real model proposals, abort one
successful conversation decision response, verify UI accepted without a secondPOST.

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

## Permission revocation integration
Register/reuse fixed isolated reviewer, add native write membership in synthetic
project, seed pending proposal owned by reviewer. Login then change native privilege
to readonly; POST acceptance must403 before claim/reservation, content intact.
Restore write membership after verifying denial and original task remains pending.

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

## Native prepared-checkpoint restart
Stage synthetic owner proposal through retention claim, durable reservation and
actual DU prepare. Persist committing operationID before restarting candidate app
container (Web/DU/real-time); Redis and original/demo remain untouched. Browser
retry same task then authoritative verify committed/history and same operationID.
This covers persisted prepared checkpoint, not random mid-CAS crash injection.

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

## Permission recheck after preparation
Reuse pending reviewer task from prior permission fixture; claim and prepare natively.
Revoke write role; acceptance403 must retain applying task, expiryhold and same
committing reservation with live file. Restore role in finally then retry same
proposal and verify committed operationID unchanged. No real papers involved.

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

## Terminal reservation cleanup
Native permanent project expiration omits DocumentDeletionReservation cleanup.
Add project-scoped committed-only deletion AFTER native cleanup succeeds; preserve
unresolved fences and soft-deleted/restorable projects. Test success, activeproject
no-op and storagefailure. Unresolved account/project teardown remains separate.

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

## Native expiration integration
Load modified ProjectDeleter as isolated diagnostic module in candidate, no Web
source replacement. Create two explicitly named disposable lifecycle projects and
synthetic reservation rows; expire only those via native methods. Verify active
project preservation, target committed removal, unresolved/control retention and
cleanup of test-created artifacts. Never target existing demo/research projects.

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

## Unresolved expiration guard
Previous terminal-only cleanup still erased recovery tasks/project snapshot when
fenced operations existed. Add primary reservation preflight before ANY permanent
expiration side effect. Explicit409 code PENDING_DOCUMENT_DELETION retains metadata,
tasks and docs for all noncommitted states; lookupfailure also stops cleanup.
This is recovery preservation, not the unfinished-operation drain itself.

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

## Internal teardown recovery orchestration
Implement dependency-injected drainer under whole-project authorization and project
lock, validating task/proposal/fullsnapshot before resuming exact existingoperation.
No new acceptance or operation allocation allowed. Handle lostcommit response and
proven preparingconflict; tasksettlement and final reservation scan required.
Adapters/native project-deletion wiring and integration remain next work.

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

## Native teardown recovery adapter
Coordinator now supports existingOperationId: missing/different receipt rejects
before preflight/newreservation. Native teardown service uses primary task reads,
current admin-project authorization, outer project lock and existing-only coordinator
without nested lock; native DU/history/storage and taskretention adapters.
Not wired to project removal yet: durable admission/teardown boundary stillneeded.
Test adapter in isolated diagnostic module against native prepared synthetic task.

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

## Atomic project deletion admission
Persist deletion admission tickets and project-removal intent in SAME projectdocument.
Conditional Mongo update makes new admission vs close mutually exclusive independent
of finite lockTTL; preserve stable operationUUID and accepted snapshot binding.
Validate races in temporary Mongo collection, no live project mutations. Caller
authorization, taskclaim and native reservation integration remain separate work.

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

## Selection toolbar redesign — user screenshot
P0: unify popup into one restrained surface; keep labels single-line, collapse
rewrite/expand/condense controls until chosen, label inputs and actions; preserve
transform effect semantics. Verify UI interactions and three viewport widths.
Build frontend-only image from user demo v30, deploy18080 with preserved volumes
and credentials; do not include unfinished deletion lifecycle source.

## User expands UI request to complete review flow
Screenshots compare Prism selection, conversation, inline diff and expanded diff to
our plain underline review. Implement shared line diff with old/new numbers, +/-
backgrounds and word highlights, context folding, file cards and expanded modal;
use same renderer in selection preview. Separate user request/status/summary.
29 focused frontend tests pass (updated obsolete DEL/whole-text assertions to line
diff semantics); targeted diff/menu lint passes. v34 initial-menu build completed
but NOT deployed (superseded). v35 builds eight frontend files from demo v30 only.
Current plan: build v35, verify eight source hashes, deploy18080 preserving volumes
and fixed account, actual existing conversation read-only browser check at3widths
and selection-menu checks. Pending lifecycle source excluded.

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

## Source-position selection review
Implement non-mutating CodeMirror block widget below selected source, same line diff
and explicit accept/reject. Preserve stale-result invalidation on every document
change; widget React root disposal must not leak. Loading/errors remain tooltips.
Tests: preview renders inline without document writes; reject preserves; accept
changes exactly selected range and native undo restores; intervening edits discard.
Then frontend-only image and actual browser selection review.

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

## Conversation proposal source review
Add Review in editor on pending existing-document proposals; open by docId through
native editor manager, wait for matching source snapshot, then insert non-mutating
CodeMirror block at first changed line. Accept/reject call original conversation
proposal endpoint (never local document replacement). Invalidate on document edit,
conversation change, navigation, stale result or unmount; prevent double submits.
Keep creation/deletion in dedicated review cards. Test callback failure/lost state,
source preservation and exact decision route, then frontend build/runtimeacceptance.

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

## Resume deletion admission integration after UI release
Connect coordinator's new-operation creation to durable project ticket, preserving
its operationUUID and exact snapshot. Authorization/acceptedtask check precedes
admission; existing-only recovery never allocates. Validate malformed/stale ack,
preflight failure gap, response loss and closed gate. Add readAccepted for authorized
recovery after gateclosure without new admission. Nativecontroller/teardown wiring
and settlement cleanup follow after these transition checks; no demo rollout yet.

## Admission settlement transition verification
Extracted dependency-injected DocumentDeletionAdmissionSettlement.mjs; native
DocumentDeletionAdmissionService retains primary task reads and native adapters.
Six tests cover committed same-operation release, nonterminal no-op, incomplete or
wrong-operation retention, conflict requiring absent receipt, changed binding, and
lost cleanup response retry. Combined reservation/coordinator/teardown/settlement
45 tests pass; targeted ESLint passes. Evidence:
plan/prism-admission-settlement-tests.log, prism-admission-settlement-combined.log,
prism-admission-settlement-lint.log. No runtime deployment or real paper edits.
Next: native adapter acceptance and project teardown admission/drain integration.
Completion not claimed: project-lock TTL/late-worker races and ticket-before-receipt
recovery still require lifecycle fencing; these tests do not prove those invariants.

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

## User steering: remove redundant Discussion rail
Remove Discussion tab and jump-to-composer placeholder; rail directly opens Literature. Keep editor dock conversation intact. Build isolated v39 from v38 with only two UI source files, then verify actual browser and stable account. Backend deletion native probe deferred, no fixture created in that step.

## User steering: contextual Agent conversation and execution timeline
P0 Capture selected document/offset/text at send, validate against server snapshot,
show server-derived filename and line range on user message; no fabricated ranges
for old turns. P0 Persist and display bounded real tool/command/file/compile events
and public assistant commentary, excluding internal reasoning. P1 Render assistant
messages and expandable activity as a conversation with readable Markdown. Verify
selection staleness, event filtering/persistence, browser reload and real harness.
Prior UI v39 now deployed: direct Literature rail, no Discussion. Actual browser
passed direct opening, composer editing, unchanged document, no JS errors.
Build source formatting changed only lint directive position; final source hashes
verified. Initial browser started before readiness; later selector fixed button to
tab. Runtime check waited for active task completion before recreation.

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

## User steering: message bubbles and role avatars
Wrap assistant reply plus execution record in themed pale bubble; replace message-role text with accessible person/AI avatars in both current and historical turns. Preserve composer, source reference and diff cards. Build isolated v41 from v40, then read-only browser verification on saved conversation. Project deletion integration inspection paused before edits.

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

## Git synchronization and graph — user requirements 2026-10-31
- [x] Verify official GitHub synchronization behavior; it documents merge conflicts, not unconditional overwrite.
- [ ] Audit existing Git bridge, history APIs, document updates, and authorization integration.
- [ ] Implement repository/branch binding and remote-change detection without automatic application.
- [ ] Persist recoverable web snapshots and common base; preview three-way merge and conflicts.
- [ ] Apply only against revalidated document/tree versions; concurrent changes invalidate preview; journal recovery across multi-file writes.
- [ ] Implement explicit commit/push with remote-head checks and no force push.
- [ ] Implement isolated branch workspaces and real commit-parent graph with authors, branches, and file diffs.
- [ ] Validate concurrent edits, conflicting edits, rename/delete/binary conflicts, disconnect/retry, and comment preservation on disposable repositories.
Scope: new requested feature, not implemented yet. Preserve existing Prism work. No external repository binding/push performed.

### Git preview implementation checkpoint
Added GitSync/GitMergePreview.mjs and git-merge-preview.test.mjs. Seven tests pass, including real git merge-file clean and conflicting text. ESLint and Prettier pass. Null-vs-empty, delete/modify, add/add, binary and invalid UTF8 handled explicitly; snapshot SHA256 supplied for later apply validation. This is a single-path preview primitive only: no tree/rename planning, durable recovery snapshot, binding/authentication, UI, graph, or project writeback yet. Next: audit native update/version interfaces and implement tree planning plus durable synchronization operation state before exposing apply. No runtime deployment or remote Git mutation.

### Project tree preview checkpoint
Added GitTreePreview.mjs and git-tree-preview.test.mjs: deterministic full-tree content fingerprints, action list, real three-way per-file merge, structural file/directory conflict detection, path/size validation, no partial applicable tree on conflict.13 combined tests pass (plan/git-tree-preview-tests.log); targeted ESLint passes after replacing control-character regex with explicit character validation. Rename/edit is retained as explicit delete/modify conflict, not automatic rename pairing. No runtime or repository mutation. Next: persistent synchronization operation and recovery snapshots, repository adapter, authorized routes/UI.

### Real Git repository reader checkpoint
Added GitRepositoryReader.mjs with immutable commit resolution, bounded blob snapshots, branch refs, commit graph metadata/parents, and merge-base --all. Trusted server-owned local repository only; no network, checkout, push, or hooks. Rejects symlinks/submodules/LFS snapshots rather than importing pointer/link content. Integration fixture creates real divergent branches and a two-parent merge; snapshots feed existing merge preview and preserve both edits.14 combined tests pass (plan/git-repository-reader-tests.log), targeted ESLint passes. No user repository changed. Remaining: authenticated repository binding/fetch, durable snapshot operation, native project writeback concurrency/recovery, branch workspace isolation, browser graph and sync UI.

### Durable recovery storage checkpoint
Added GitRecoveryStore.mjs and git-recovery-store.test.mjs. Immutable private checkpoint directories contain SHA256-addressed source blobs and manifest with project/user/tree/document version identities. fsync files/directory, rename staging, fsync root before success; returned manifest hash must be retained by future operation journal. Reopen, corruption, wrong-project, invalid-version tests pass;17 combined Git tests pass (plan/git-recovery-store-tests.log), ESLint passes. Source checkpoints do not back up comments/ranges or restore a project; no automatic writeback route exposed. No runtime deployment. Next integration must capture coherent native snapshot, persist checkpoint reference and per-file operation status, and handle interrupted writes without reverting later collaborator edits.

### Recorded synchronization preview checkpoint
Added GitSyncPreviewService.mjs and GitSyncOperationStore.mjs: authorize before snapshot, pin base/remote commits, reject rewritten ancestry, save all three source checkpoints, recheck permissions/binding revision, durably insert compact operation metadata, reconstruct preview from checkpoints without repository access.20 combined tests pass (plan/git-sync-preview-service-tests.log). Targeted ESLint passes after fixing test const declarations. Native Mongo adapter probe passes reconnect/readback, project filtering, duplicate ID rejection; uses isolated UUID collection, dropped afterward, temporary module removed (plan/git-sync-operation-native.json/.py). Native web snapshot/binding/auth adapters and HTTP/UI are NOT wired yet. No project content mutation or image deployment. Next: native binding/coherent project snapshot adapters and preview endpoints, then journaled version-checked apply.

### Native project snapshot checkpoint
Added GitProjectSnapshot.mjs double-collect/version validation and GitNativeProjectSnapshot.mjs adapters for ProjectGetter, ProjectEntityHandler, DocumentUpdater and history blob streaming. All text documents plus binary assets included. Blob Git SHA1 integrity, total/per-file limits, tree identity and doc version/content checks fail closed.23 combined tests pass; targeted ESLint passes. Native candidate read-only probe passed on restored disposable project 6ae5a9739305e09f47bc2951 (main.tex, treeVersion3); source content unchanged. Evidence plan/git-project-snapshot-native.json/.py and git-project-snapshot-tests.log. Native binary streaming and true concurrent edit integration still unverified (unit streams/races tested). No HTTP routes or UI yet.

### Native Git API wiring checkpoint
Added GitSyncRuntime/Controller/Router.mjs and registered router; default gitSync configuration disabled with empty private storage roots. Four authenticated routes: status, graph, create preview, read preview. Native authorization reuses project read/write permissions; repository key is server-only UUID, realpath confinement prevents escape. Mongo gitSyncBindings and gitSyncOperations used lazily. Status explicitly reports local-cache remote knowledge until fetch exists. Native diagnostic validates disabled404, owner write access, outsider403, no-binding connected:false response, four login-gated registrations; native snapshot remains readable. Evidence plan/git-sync-api-native.json/.py. Targeted ESLint passes. Runtime image unchanged; routes not deployed to demo. Browser UI, binding creation, authenticated fetch/push and journaled apply remain incomplete.

### Integrated native preview and per-file review checkpoint
Added GitFileReview.mjs and authorized GET previews/:operationId/file?path=...; service returns pinned base/web/remote/result descriptions, explicit absent/binary/unresolved states and text truncation (64k UTF16 boundary-safe).26 Git tests pass (plan/git-file-review-tests.log), targeted ESLint passes. Native full preview diagnostic creates a temporary real Git repo from disposable native project snapshot, adds a remote commit, inserts scoped temporary binding, invokes actual status/prepare/read/file/graph controllers, verifies majority-persisted record and unchanged native project content/version, then removes only probe binding/operations/repo/checkpoints. Passed: plan/git-sync-preview-native.json/.mjs/.py. This is controller-level integration with real native storage, not HTTP/browser acceptance or external GitHub sync. No deployment. Remaining binding UI/authenticated remote transport, graph/review UI, apply/conflict decisions, push and branch workspaces.

### Git graph/review frontend checkpoint
Added features/git-sync commit-graph.tsx, git-sync-panel.tsx, git-sync.css; opt-in git-sync rail tab via ol-gitSyncEnabled meta and config. Panel calls status/graph/prepare/file endpoints, displays branch/commit parents/author/date, change list and existing red-green ProposalDiff, expandable base/web/remote sources and explicit binary/truncated/conflict output. No fake apply action. Five frontend tests pass (plan/git-sync-frontend-tests.log), targeted ESLint passes after icon/accessible-label/member-order/test-hook fixes. Full typecheck rerun pending at checkpoint (session30566, plan/git-sync-ui-typecheck.log); earlier run found unsupported history icon, replaced with SVG GitBranchIcon. No browser visual acceptance or image deployment yet. Next: inspect rendered panel and graph on isolated fixture, then binding/fetch and guarded apply work.

Typecheck completed:13 existing missing optional-module/nullability errors, none in new git-sync components or rail.tsx. Evidence plan/git-sync-ui-typecheck.log. Session30566 terminal exit2; no pending typecheck process.

### All-branch graph and browser visual checkpoint
GitRepositoryReader.graph supports allBranches; pins branch labels and immutable commit roots together, traverses all branch tips, caps1000 branches and preserves topo-order/dedup/truncation. Native graph endpoint enables it; frontend consumes labels from graph response. Real Git regression creates unmerged collaborator branch and verifies presence only in all-branch graph plus correct parent ordering/dedup.26 backend tests and native complete-preview probe pass. Browser component fixture rendered actual CommitGraph/ProposalDiff source at420/900px:6 commits,3 labels, no page overflow/errors.420px screenshot visually inspected, branch lines and diff readable. Artifacts plan/git-graph-visual/{index.html,entry.tsx,check.py,browser.json,graph-420.png,graph-900.png}; synthetic fixture, not deployed full editor. Production deployment and binding/fetch/apply/push still incomplete.

### HTTPS fetch and remote-check checkpoint
Added GitRemoteTransport: configured HTTPS host allowlist (default github.com), no URL credentials/query/fragment, no redirects/credential helpers/submodules, shell-free bounded fetch, atomic remote-tracking refs only. Transient token goes in child Git config environment, not argv/disk/errors. Native public fetch of user-provided https://github.com/git-bahn/git-graph succeeded:1 remote branch,10 commits read; temporary bare repo removed (plan/git-remote-fetch-probe.json/.mjs). Runtime POST /fetch checks write permission, repository confinement and binding revision; stores lastFetchedAt. UI Check remote updates refreshes cached graph/status, leaves existing preview and project untouched.29 backend tests/6 frontend tests pass, targeted ESLint and native API probe pass (6 login routes). No user remote push or deployment. Private credential storage/provider, binding workflow, automatic polling, writeback/push remain missing; runtime explicitly rejects credentialId until provider exists.

### Initial repository binding checkpoint
Added GitRepositoryProvisioner.mjs (private UUID bare repo, validated branch, fetch+resolve, clean failed provisioning). Runtime owner-only POST binding creates insert-only project binding after owner recheck; no replacement and duplicate conflicts. New bindings use state initial-review/baseCommit null, not fabricated synchronized ancestry. Preview compares empty baseline/web/remote: same-path differences are add/add conflicts, web-only files preserved, remote-only additions shown. UI URL/branch connect form enters initial-review without applying.32 backend/7 frontend tests and targeted ESLint pass; public provisioning smoke on git-bahn/git-graph passes; native API diagnostic passes7 registered routes. Entire owner-binding native controller/database flow and race gates still not tested; no deployment. Persisted private credentials, orphan storage cleanup, automatic polling, actual resolution/apply/push and editor browser acceptance remain incomplete.

### Native binding acceptance and conflict-decision checkpoint
Actual owner bind controller against public git-bahn/git-graph/master passed in candidate fixture: outsider403, owner201, persisted initial-review/null baseline, duplicate409, initial preview, web-only main.tex retained, actual refresh, native project bytes/doc versions unchanged. Temporary binding/operations/repository/checkpoints removed (plan/git-binding-native.json/.mjs/.py). Added GitConflictResolution.mjs, service resolve and POST resolutions route: explicit web/remote/edited text/delete choices rebuild preview, preserve structural conflicts, persist decisions with majority CAS revision/status.36 backend tests pass; native Mongo concurrent choice test proves exactly one revision0 update succeeds, revision becomes1. Native API checks8 login routes. Resolutions currently backend-only; UI choice controls and actual project apply remain pending. No deployment.

### Conflict review UI checkpoint
Added ConflictControls.tsx with explicit web/remote/manual/delete choices; edits saved only to preview and use displayed file revision returned by readFile. Updated panel to save/reload decisions and list saved choices; manual edit disabled for truncated/binary inputs, empty web text preserved.11 frontend tests and36 backend tests pass; targeted ESLint passes. Browser actual component fixture at420/900px selects manual option, edits and saves choice, no overflow/errors;420px screenshot visually checked (plan/git-graph-visual/conflict-420.png, browser.json). No actual project writeback or production deployment. Full editor/HTTP acceptance and guarded apply still pending.

### Apply preflight checkpoint
Added GitApplyPlan.mjs and service.planApply: requires exact ready revision, clean reconstructed merged tree, unchanged binding/base/remote head, matching web fingerprint/tree version/document IDs+versions, verified recovery source. Validates final merged-tree bounds and builds per-file create/modify/delete steps with before/after hashes, doc ID/version, existing document/asset type, result text/binary type and recovery reference.39 backend tests pass (plan/git-apply-plan-tests.log); targeted ESLint passes. Native complete-preview probe now verifies main.tex execution-plan version against native snapshot and project unchanged (plan/git-sync-preview-native.json). This remains READ-ONLY preflight, not a write lock/executor or apply endpoint. Next: durable operation claim/per-step journal and native coordinated write/receipt recovery; then actual apply UI.

### Durable apply journal checkpoint
GitApplyJournal.mjs passes targeted ESLint. Native Mongo probe plan/git-apply-journal-native.py/.json verifies exactly one concurrent operation claim and step start, ordered steps, duplicate receipt rejection, uncertain state persistence across reconnect, project scoping, and rejection of premature finish. Synthetic receipts only: no native project writes; journal is not a document write fence. Temporary collection/module removed. Actual apply executor, native idempotent receipts and concurrent document/tree coordination remain required before enabling apply; no deployment.

### Atomic document version check checkpoint
DocumentDeletionFence.runWrites/batch now accept an optional expectedVersion and check it inside the Redis Lua script before any mutation. RedisManager.updateDocument supplies the version it read, closing the read/write race when a lock lease expires. Native Redis primitive probe passes concurrent/stale/missing-version checks (plan/git-version-fence-native.{cjs,py,json}). Extended native RedisManager diagnostic deliberately pauses two writers after both read version12: exactly one writes version13 and exactly one operation enters history.14 native checks, including existing30 rename/delete races, pass (plan/prism-deletion-native-fence-probe.json/log). Diagnostic modules and synthetic keys removed. No live service replacement/deployment. Still required: native writeId receipts, project tree/auth coordination, multi-file recovery, actual apply endpoint and browser acceptance. This is a mutation-boundary guard, not complete Git synchronization.

### Native cache receipt checkpoint
DocumentDeletionFence now optionally stores a per-document writeId receipt in the same Redis Lua execution as content/ops updates; duplicate IDs reject before mutation and receipts have no TTL. RedisManager.updateDocument accepts an optional internal expectedWrite descriptor, validates project/doc/version/result SHA256 and one applied operation, and supplies a cache-applied receipt. getWriteReceipt scopes identity; ordinary writes remain compatible.16 native Redis/Mongo checks pass, including receipt mismatch refusal, later collaborator edit preserved on duplicate-ID retry, no extra history operation, cross-project receipt refusal and receipt surviving document-key eviction. Targeted explicit-config ESLint passes. Diagnostic copies removed; no deployment. IMPORTANT: this is cache-applied evidence only, not docstore/project-history durability, and not yet wired from DocumentManager/HTTP. Need propagate trusted request identity through native OT path, durable admission/receipt settlement across Redis restart, and coordinated tree writes before actual Git apply.

### Reviewed write identity propagation checkpoint
Added ReviewedWriteRequests.js with validated immutable WeakMap association on server-created OT update objects. DocumentManager.setDoc/setDocWithLock accept optional internal expectedWrite; setDoc attaches it only after version check and rejects malformed/no-op reviewed requests. ShareJS UpdateManager and HistoryOTUpdateManager forward the association to RedisManager's atomic receipt writer. Ordinary calls retain seven writer arguments; serialized JSON/client metadata cannot forge authority or carry the writeId to broadcasts/history.122 focused Mocha tests pass, including both DocumentManager engine paths, ShareJS forwarding, actual history-ot TextOperation application with stubbed storage, immutable authority/JSON-forgery checks, and prior normal edit/lock tests. Targeted ESLint passes (plan/git-reviewed-write-{unit,lint}.log). No HTTP exposure, live deployment or full native pipeline acceptance. Next: durable request admission and docstore/history receipt settlement/recovery, then guarded Git executor and actual browser apply; project tree coordination still required.

### Durable reviewed document admission checkpoint
Added ReviewedWriteStore.js (majority insert-only request identity, primary read, executionId/status CAS settlement) and ReviewedDocumentWriter.js (validated snapshot copy, admission inside native update lock, no replay of existing requests, native OT write+cache receipt+persisted doc readback). mongodb.js registers documentreviewedwrites. States deliberately distinguish executing/recovery-required/conflict/document-persisted; history is NOT confirmed. Native adapter exists internally, no HTTP route. Actual Mongo probe passes concurrent single admission, identity reuse denial, reconnect readback, lost response/missing receipt/stale persistence no-replay, conflict persistence, and uncertain admission acknowledgement no-replay. Document/cache adapters in this probe are injected test doubles, not full native end-to-end proof. Targeted ESLint passes. Evidence plan/git-reviewed-durable-native.{cjs,py,json}, git-reviewed-durable-lint.log. Temporary collection and probe directory cleaned. Next: full native pipeline acceptance and recoverable settlement/history delivery, then tree coordination and Git apply integration; no deployment.

### Full native reviewed text pipeline acceptance
Created dedicated candidate project6ae5bd020f286a4cf18bc6e8/doc6ae5bd020f286a4cf18bc6ec (Git reviewed pipeline fixture; fixture JSON preserved). Ran current DU source as temporary diagnostic copy, no service replacement. Actual native lock+OT+Redis+Mongo admission+web/docstore write completed version0→1; exact persisted content verified; same-writeId retry preserved version1; a new stale-version request persisted conflict and did not change text/version. Separate native HistoryManager flush/read reconstructed main.tex with exact current document content hash. Evidence plan/git-reviewed-pipeline-native.json/.log, git-reviewed-pipeline-history.json/.log, reusable runners and fixture. Diagnostic directories removed; synthetic project and receipts retained for reproducibility. Initial API reads failed because docker-exec lacked WEB_API_USER/WEB_API_PASSWORD; runner now loads those names privately from container environment files before imports. No sensitive values printed. This proves the actual text write path on one disposable fixture, not full Git apply or automatic history confirmation/recovery. Next: durable recovery reconciliation, web guarded apply integration/tree operations and end-to-end UI; keep demo feature disabled.

### Read-only interrupted write reconciliation
ReviewedDocumentWriter.reconcile now checks stored request identity under native update lock, requires matching cache execution receipt and exact persisted version/hash, then majority-CAS confirms document-persisted through ReviewedWriteStore.confirmRecovered. It never replays or restores document text, and leaves missing-proof/newer-version cases unresolved. Full native fixture test now injects lost response AFTER actual native setDoc persistence: reconciliation confirms without version increment; matching content without receipt stays executing; later actual collaborator edit remains intact and delayed recovery stays recovery-required. Latest fixture version3→4 normal,5 recovered,6 interrupted,7 collaborator; history latest-content matches version7. Native Mongo admission regressions also pass; targeted ESLint passed. Evidence plan/git-reviewed-pipeline-native.json, git-reviewed-pipeline-history.json, git-reviewed-durable-native.json. No live service deployment. Still incomplete: recovery when cache evidence is lost, history settlement automation, tree lifecycle coordination, actual web Git apply and branch/push acceptance.

### Internal HTTP and web adapter acceptance
Added opt-in ReviewedWriteController.js execute/read/reconcile endpoints, mounted in DU app.js; default reviewedWritesEnabled=false in DU settings. Strict identity/user/version/hash/line validation, size limit, no-store compact responses,202 for unresolved states and409 for execution conflicts. Added applyReviewedDocument/getReviewedDocumentWrite/reconcileReviewedDocumentWrite to web DocumentUpdaterHandler with identity/status response checks;409 apply queries same record; transport errors remain ambiguous, never retries with new ID. Native fixture runner now starts temporary loopback Express server using real controller/native writer, verifies default404/invalid400/not-found404 and actual persisted HTTP write/query/reconcile/idempotency. A separate actual web-module child process calls the temporary server, verifies duplicate/status/reconcile and conflict handling. Native finalversion17; history content matches. Artifacts plan/git-reviewed-pipeline-native.json/history.json. Targeted lint passes; app.js/default settings syntax pass (web ESLint tsproject excludes app.js). No live service replacement or public web apply endpoint; diagnostic server/copies cleaned. Next: Git operation executor with project/tree lifecycle coordination and UI acceptance, still no production enablement.

### Git apply executor source checkpoint
Added GitApplyExecutor.mjs and GitDocumentApplyAdapter.mjs. Executor prevalidates ALL operation kinds/content before claim, requires injected project coordinator, journals each write before dispatch, confirms matching native persisted receipts before next step, and stops with recovery-required on uncertainty. Reconciliation inspects only the ambiguous step, never replays or silently continues. Adapter handles existing text modifications via native web HTTP bridge and checks response project/doc/writeId/version/actual afterHash. Controller compact response now includes stored afterHash (never synthesize receipt hash from expected input).43 Git backend tests and targeted lint pass;4 new tests cover ordered two-file execution, all-or-nothing preflight rejection, second-file interruption/reconciliation, identity/hash/version mismatch rejection. These executor tests use test journal/adapters; native full executor not yet accepted. Actual native HTTP+web adapter+history regression also passes, fixtureversion22. Source remains unwired to runtime/public apply until project-tree/lifecycle coordinator, remaining create/delete/binary adapters and safe resume are implemented. Full Git requirement unchanged; no deployment.

### Partial application resume guard checkpoint
Added GitApplyProgressGuard.mjs validateTextApplyProgress: verifies pinned binding/base/remote head, recovery fingerprint/tree version, ordered confirmed receipts, expected per-file content/docID/version for both completed and pending files, and untouched files. Detects collaborator edits including version-only changes, added files and replacement IDs. GitApplyPlan now records baseCommit. Executor.resume preserves attempt/write IDs and re-enters mandatory coordination with progress record; requires no unresolved in-flight step and rechecks journal cursor inside coordinator before advancing.47 Git backend tests pass; targeted lint passes (plan/git-resume-tests.log/lint.log). New tests cover guard divergence cases and three-file interruption→reconcile→resume writing only final remaining file. These remain source/unit-level; native project coordinator not yet wired, so no public apply/resume endpoint. Existing text-only adapter scope is interim, not final requirement; create/delete/binary coordination remains pending.

### Project structure admission checkpoint
Added GitProjectApplyAdmission.mjs: majority CAS against exact tree version, owner/collaborator/token-access identity, absent Git ticket/deletion closure/pending deletion history and empty document deletion tickets. Persistent no-TTL gitSyncApplication ticket; release requires exact operation+attempt, caller must settle all workers first. Added schema field and atomic absent-ticket condition to native ProjectEntityMongoUpdateHandler structure mutations. DocumentDeletionProjectAdmission admit/close now mutually exclude Git ticket. ProjectDeleter includes Git enablement/existing ticket in deletion-drain path and selects ticket field. Actual Mongo40 forced admission races (20 project closure,20 document deletion) each admit one side only. Native fixture rename rejected while ticket held, unchanged name/tree version; deletion closure rejected; stale version/outsider/wrong-attempt release rejected. Ticket/temp collection removed.53 focused regression tests and lint pass. Evidence plan/git-project-admission-native.json/log and regression.log. Scope: atomic admission/structure guard and deletion closure helper; not complete ProjectDeleter lifecycle acceptance or mixed-configuration deployment. Coordinator integration/transactional journal+ticket settlement remain required before enabling apply. No deployment.

### Atomic Git admission/finish lifecycle checkpoint
Added GitAtomicApplyLifecycle.mjs. begin atomically admits exact project tree/actor and claims reviewed operation in one Mongo transaction; stale review throws and rolls admission back. finishFiles atomically confirms all journal steps and releases exact project ticket; ownership mismatch rolls completion back. GitApplyJournal and GitProjectApplyAdmission support injected same-client sessions (transaction-level write concern); executor passes approving user into begin. Actual Mongo replica-set transactions on disposable collections prove concurrent single winner, stale-review rollback, premature/uncertain gate retention, ownership-mismatch rollback, paired completion/release and denied actor rejection. Original native journal concurrency checks and53 regression tests pass; lint passes. Evidence plan/git-atomic-apply-native.json/log, git-atomic-apply-regression.log. Native file receipts are synthetic in lifecycle test; full coordinator/runtime integration remains pending. No live deployment or user document changes.

### Integrated native Git text apply checkpoint
Added GitApplyService.mjs combining preview reconstruction, native project lock, exact durable ticket ownership, pinned binding/remote check, recovery snapshot, current project snapshot, progress validation and executor/adapters. Executor now requires validateProgress and runs it before each remaining write and before finish. Actual native integration creates local Git baseline+remote edit from dedicated fixture, prepares preview, uses same-client Mongo lifecycle with real project, applies through web adapter→temporary HTTP→native DU/docstore, confirms one receipt and releases ticket atomically. Fixture finalversion28; native history readback matches. Evidence plan/git-apply-service-native.json/.mjs and pipeline/history artifacts.54 focused tests and lint pass, including stop between files when progress validation detects new edits. Temporary Git repo/recovery/operation collection/server/code cleaned on success; failure path deliberately retains admitted recovery data. This acceptance covers one existing text file only; source service not exposed in production runtime/UI. Required next: safe cancel for unapplied remainder, multi-file native acceptance, creation/deletion/assets, runtime routes/UI and deployment; full objective remains incomplete.

### Safe stop of unapplied remainder
GitAtomicApplyLifecycle.stopRemaining transaction reads exact attempt/cursor, rejects in-flight or recovery-required writes, validates confirmed receipt prefix, changes status to cancelled/partially-applied/files-applied and releases matching project ticket atomically. Late startStep calls fail against terminal state. Completed content is never rolled back. GitApplyService exposes internal authorized stopRemaining with idempotent terminal readback; no public route/UI yet. Actual Mongo tests prove running/uncertain refusal, partial receipt preservation, stop-before-first-write fencing, and20 concurrent start/stop races with exactly one winner.54 regression tests and lint pass; native receipts in transaction test remain synthetic. Evidence plan/git-atomic-apply-native.json and git-stop-remaining-regression.log. No services or native project documents changed this checkpoint. Next: multi-file native apply/partial-stop acceptance then remaining file operation adapters/UI.

### Native multi-file apply and collaborator interruption acceptance
Extended the isolated native Git pipeline fixture with notes.tex and applied an actual two-file Git preview through the project gate, transactional journal, web HTTP adapter, native document updater and docstore. Both writes returned persisted receipts. A second two-file preview applied main.tex, then injected a real collaborator edit into notes.tex; the progress guard rejected the remaining Git write. stopRemaining preserved the completed main.tex change and the collaborator's notes.tex change, returned partially-applied idempotently and released the project gate. Native history flush/readback matches both current documents (main.tex version35, notes.tex version2). Evidence: plan/git-apply-service-native.json, plan/git-reviewed-pipeline-native.json, plan/git-reviewed-pipeline-history.json and corresponding scripts/logs. This checkpoint changes diagnostic scripts and the dedicated synthetic fixture only, not production source or running services. Public apply routes/UI, creation/deletion/assets, binding settlement/push and branch workspace isolation remain incomplete; no full Git-sync completion claim.

### Next executable checkpoint: application service endpoints
- Wire the verified native coordinator into the runtime behind a separate default-off application flag.
- Add authenticated apply/status/reconcile/resume/stop endpoints with bounded request validation and allowlisted public progress fields.
- Verify status privacy, read/write permissions and route registration; keep runtime deployment disabled until full lifecycle acceptance.

### Application runtime and HTTP entrypoint checkpoint
Wired createGitApplyService into GitSyncRuntime using the verified same-Mongoose-client transaction lifecycle, native structure lock, project admission and DocumentUpdaterHandler promises. A separate gitSync.applyEnabled flag defaults false. Added five login-protected endpoints under previews/:operationId/application: GET status, POST apply (required nonnegative integer review revision), resume, reconcile and stop. Service read authorizes before project-scoped journal access. New GitApplicationResponse allowlists operation status/revision, counts and per-file confirmed/unconfirmed/pending state; excludes snapshots, recovery paths, internal receipt IDs and document bodies. 56 focused backend tests and targeted ESLint pass. Native candidate diagnostic proves13 login routes, default404 on all five application actions, outsider403 on all five with application enabled, and exact sanitized owner status from a temporary operation. Temporary record/code copies removed; fixture tree remains main.tex/version3. Evidence plan/git-sync-api-native.json/log, git-application-api-tests.log and git-application-api-lint.log. This is runtime wiring/status/auth acceptance, NOT actual full HTTP write or browser acceptance. No service replacement. Remaining: UI controls, full HTTP write/recovery acceptance, create/delete/assets, lifecycle/mixed-config audit and binding/push settlement before production enablement.

### Application controls UI checkpoint
Added frontend/js/features/git-sync/application-controls.tsx and panel integration: explicit reviewed-revision apply, scoped status read, receipt reconciliation, continue/stop controls, confirmed/unconfirmed/pending file rows and terminal explanations distinguishing local file save from remote push. Failed mutation responses query the same operation without replay. If status also fails, only status checking remains available and parent prevents replacing the preview. Mutating controls are hidden for unconfirmed writes; resume/stop require observed progress. Parent disables conflict decision controls after claiming and blocks new previews while applying. Connected status exposes only default-off applicationEnabled and activeApplicationId so reopening finds the retained project operation. 15 frontend tests and targeted ESLint pass; native13-route permissions/default-off/status probe passes. Evidence plan/git-application-ui-tests.log, git-application-ui-lint.log and git-sync-api-native.json. Initial repeat test invocation used repo root and failed bootstrap module lookup; rerunning from services/web passed. No deployment, full browser visual acceptance or actual HTTP application acceptance yet. Existing create/delete/binary and push/settlement requirements remain open. Next: complete native HTTP/controller write and recovery acceptance, then browser inspection before enablement.

### Recovery entry and browser component acceptance
GitSyncView now retains an active-operation recovery entry even if preview reconstruction fails; its journal status remains queryable independently of recovery snapshots. Added a frontend regression proving status/reconcile remain accessible without starting new writes. Initial binding response now carries applicationEnabled so controls do not require panel reopening after connect.16 frontend tests and targeted lint pass. Actual ApplicationControls bundled into an isolated browser fixture with simulated transport passed420/900px status→reconcile→stop interactions, no page errors/overflow. Screenshot inspection found status wrapping under a long filename; fixed flex sizing and reran both widths, then visually inspected420px again. Artifacts plan/git-application-visual/{browser.json,uncertain-420.png,stopped-420.png,check.py,entry.tsx,requests.ts}. System Python lacked Playwright; uv run --with playwright used the available package environment successfully. Scope is real component DOM/browser with simulated HTTP, not production editor/native HTTP apply acceptance. Changed panel/runtime response/CSS/tests plus fixture artifacts and planning records; user documents/services unchanged. Next remains actual full controller HTTP writes/recovery, structural adapters and combined acceptance before enablement.

### Next checkpoint: controller HTTP native application
- Reuse the dedicated two-document fixture and native DU loopback bridge.
- Drive the actual web controller through loopback HTTP with fixture sessions and injected real application service.
- Verify stale revision/outsider/duplicate rejection, two persisted writes, collaborator interruption and explicit stop, then native history readback.
- Distinguish this from live login/router/browser acceptance; retain recovery artifacts on uncertain failure.

### Native web-controller HTTP application acceptance
GitSyncController now exposes createGitSyncController(runtimeProvider) while its production default still uses getGitSyncRuntime. Extended the existing dedicated two-file native fixture probe to mount actual controller handlers on a temporary127.0.0.1 Express server, injecting the real application service and fixture sessions. HTTP apply rejects outsider403 and stale revision409, saves both files with two confirmed native receipts, returns an allowlisted status identical to GET, and rejects duplicate apply409 without extra document versions. A second HTTP apply detects a real collaborator edit after its first confirmed file; HTTP stop returns partially-applied idempotently, preserves both completed Git content and the collaborator edit, and releases admission. Native history flush/readback matches main.tex version42 and notes.tex version4. Artifacts plan/git-apply-service-native.json, git-reviewed-pipeline-native.json, git-reviewed-pipeline-history.json and associated logs/scripts. Default-runtime13-route authorization/status regression and controller lint also pass. Scope: real web controller→HTTP adapter→native DU/Redis/Mongo/docstore/history; fixture session injection means production login/CSRF and full browser/deployed-runtime wiring are NOT qualified. Temporary servers/code/repository/operations/checkpoints cleaned on success; only dedicated fixture text and durable receipt/history records retained. No live service replacement or real user document edit. Remaining full objective: native create/delete/assets, base/push settlement, credentials/polling/branch workspace behavior, lifecycle mixed-config acceptance and combined Prism qualification.

### Next checkpoint: atomic reviewed baseline settlement
- Record whether merged tree retains local differences from the reviewed remote.
- CAS binding identity/revision/branch/old baseline in the existing finish transaction; never mark pushed/synchronized.
- Verify actual Mongo rollback on changed binding and exact once advancement, with partial stop leaving baseline unchanged.

### Atomic reviewed-remote baseline settlement
Added GitBindingSettlement.mjs and runtime lifecycle wiring with the bindings collection on the same Mongo client/session. After all receipts are confirmed, finishFiles atomically CAS-updates binding ID/revision/branch/old base to the reviewed remote commit, increments binding revision, records last applied operation/time and hasLocalChangesAtApply, completes journal and releases admission. State is review-applied, never a claim of push/current synchronization. buildApplyPlan computes retained local differences against the remote tree fingerprint. stopRemaining only settles when every planned receipt is confirmed; partial/cancelled operations keep the old baseline. Native disposable Mongo tests prove changed-binding rollback, exactly-once revision/base advance and partial-stop baseline preservation.57 backend tests and source lint pass. Updated real two-file HTTP pipeline uses actual Mongo binding settlement instead of manually advancing its test binding; after first apply baseline/revision/state and no-local-difference flag match, subsequent interrupted application preserves previous base/revision. Actual history readback matches main.tex49/notes.tex6. Evidence plan/git-atomic-apply-native.json, git-apply-service-native.json, git-reviewed-pipeline-history.json, git-baseline-settlement-tests.log/lint.log. Diagnostic fixture only; no service changes. Existing text-only limitation, structural adapters, push/private credentials/branch workspace isolation and combined browser/deployment gates remain incomplete.

### Next checkpoint: reviewed snapshot commit construction
- Build immutable Git blobs/trees/commits from a copied, fingerprint-checked project snapshot without changing branch/index/worktree.
- Preserve first-parent executable modes and ordered merge parents; reject unsupported LFS/symlink trees.
- Test binary bytes, additions/deletions, author metadata, repeat determinism and unchanged native Git refs/index.
- Keep push and durable commit/ref settlement as separate pending requirements.

### Reviewed snapshot Git commit construction
Added GitCommitWriter.mjs: validates/copies the full fingerprint-matching file snapshot plus author/parent inputs, creates blobs with no filters and nested trees via mktree, preserves first-parent executable modes, creates deterministic commits with explicit timestamp/author/message and up to two ordered parents, then reads back and verifies the complete tree. No branch/index/worktree writes or external push. Rejects invalid metadata/parent IDs, unsafe trees and LFS; parent snapshot reader rejects symlinks/submodules. Real Git tests cover nested Chinese/space paths, binary bytes, additions/deletions, executable mode retention, author identity, merge parent order, deterministic retry, asynchronous caller mutation isolation, untouched refs/index/worktree, empty bare root commit and invalid-input rejection.59 focused backend regressions and targeted lint pass (plan/git-commit-writer-regression.log, git-commit-writer-lint.log; dedicated initial test log git-commit-writer-tests.log). Temporary test repositories removed. This is a commit construction primitive, not connected Web commit/push: durable operation binding/object retention, guarded ref/push, credentials and UI remain required. Native create/delete/assets application and full Prism acceptance remain open; no deployed changes.

### Next checkpoint: exact-head guarded push transport
- Add explicit commit/branch/expected-head validation and ancestry check before push.
- Use a remote exact-head lease and one explicit refspec, with separate read-only reconciliation after ambiguous results.
- Verify actual Git push races against disposable local bare remotes through the transport test seam; never contact user remotes.

### Exact-head guarded push transport
GitRemoteTransport now provides explicit push and inspectPush primitives. Validates full refs/heads destination, immutable commit IDs and explicit expected head (null means branch creation); copies request before awaits, verifies source resolves to that commit and expected head is its ancestor. Push uses one refspec, exact --force-with-lease branch:OID (empty for creation), --atomic, no tags/submodules/hooks and existing HTTPS host/credential confinement. Despite lease syntax, ancestry guard forbids rewriting reviewed history. Any transport failure is unconfirmed, never automatic retry; inspectPush reads only exact remote ref and reports confirmed/unchanged/changed. Actual Git tests use a test-only HTTPS→temporary local bare repo transport substitution: validate lost success response then read-only confirmation without second push, collaborator advancement injected after ancestry validation but before push rejection, non-descendant rejection, create-only branch refusal to overwrite, and invalid input without Git execution. Initial fixture setup tried update-ref before transferring peer object; corrected to real peer push, then injected it at the race window.61 backend regressions and lint pass (plan/git-guarded-push-regression.log, git-guarded-push-lint.log). All test repos removed; no external push. Not yet connected to public routes/UI; durable push intent/journal and object pinning, credential provider, authorization and binding settlement still required. Full create/delete/assets native application and Prism/deployment gates remain open.

### Next checkpoint: retained commit and persistent push intent
- Pin commits under immutable per-operation local refs before preparing push intents.
- Add majority-write push journal with single-winner claim, no takeover/replay, and exact remote confirmation.
- Verify actual Git ref retention and Mongo reconnect/concurrent claim behavior; keep public push disabled.

### Retained commits and durable push journal
GitCommitWriter.retain now creates an immutable refs/overleaf/pushes/<operation UUID> ref with update-ref expected-zero CAS. Repeated same-commit requests read back successfully, different-commit replacement is rejected. Real Git test verifies retained commit survives gc --prune=now without moving normal branches. Added GitPushJournal.mjs: allowlisted insert-only intent (no credentials), majority writes/primary reads, scoped project identity, idempotent same-intent preparation, single prepared→pushing claim, no TTL/takeover, exact attempt+branch+commit confirmation and read-only remote observations. Unchanged/changed remote does not reopen a push; unconfirmed state persists across connection loss. Actual Mongo disposable-collection native test proves concurrent single winner, reconnect persistence, no replay, mismatched confirmation rejection and credential exclusion. Evidence plan/git-push-journal-native.json/log, git-retained-commit-tests.log, git-push-journal-lint.log. Tests use synthetic commit IDs in Mongo; real Git retention tested separately. Public push service/executor still unwired; pin/journal composition, credentials, current-user authorization and binding lifecycle settlement remain next, along with existing native structural apply/Prism gates. No remote push, deployed change or user manuscript edit.

### Next checkpoint: push executor composition
- Require project/binding coordination, fresh trusted context and current actor permission before dispatch.
- Compose retained Git commit, majority journal and exact-head transport; reject actor/binding/retained-ref changes.
- Validate native Mongo plus disposable real Git lost-response recovery without replay, keeping production routes disabled.

### Push executor native composition checkpoint
Added internal GitPushExecutor.mjs requiring authorization, project/binding coordinator and fresh trusted context resolver. Checks approving actor, binding ID/revision/branch/base and retained commit before claim and dispatch; rechecks permission immediately before transport. Existing non-prepared attempts return original state rather than dispatch again. Exact transport acknowledgement confirms journal; unknown errors are sanitized and marked unconfirmed. Reconcile only inspects the same remote commit and never starts a write.64 focused regressions and lint pass; unit cases cover concurrent/repeated dispatch, wrong approving actor, lost response, binding/retained commit changes and permission loss after claim. Extended native Mongo probe to compose actual CommitWriter+retained ref+PushJournal+PushExecutor+RemoteTransport with two disposable bare repos. Real push succeeds but injected response loss persists unconfirmed; a new executor does not replay, read-only reconciliation confirms pushed and remote ref equals approved commit. Evidence plan/git-push-journal-native.json/log, git-push-executor-regression.log/lint.log. Native authorization/coordinator remain fixture injections, NOT production lock/identity acceptance; no external push. Production prepare service, native binding/push lifecycle coordination, credentials, baseline settlement and UI remain required. Structural apply/combined Prism gates still open. Test-only lint declaration errors fixed before successful rerun. No deployed service or user document changes.

### Next checkpoint: atomic push project lifecycle
- Store reviewed tree version in push intent and pass approving actor into claim.
- Atomically claim push plus existing native project admission, then confirm remote commit plus binding baseline plus admission release.
- Verify real Git/Mongo composition and binding-mismatch rollback on disposable project collections; public runtime wiring remains gated.

### Atomic push admission and binding settlement
Added GitAtomicPushLifecycle.mjs using same-client Mongo transactions, existing native project admission and push journal session support. Push intents now require reviewed treeVersion; executor passes approving user to claim. Claim verifies immutable approving actor, binding and exact project tree/access then commits project ticket and pushing state together. Remote confirmation CAS-updates journal plus binding base/revision/last-push metadata and releases exact ticket atomically; stale binding or ticket ownership rolls confirmation back. Confirmed read-only observations use the same settlement; uncertain outcomes retain protection. Native Git/Mongo probe now uses this real lifecycle on disposable project/binding collections: lost successful push retains ticket, read-only confirmation updates base and releases it, wrong actor never claims, changed binding rolls back confirmation with gate retained.64 regression tests and lint pass (plan/git-atomic-push-regression.log/lint.log, git-push-journal-native.json). This does not qualify production runtime/user-auth/CSRF or actual native project deletion integration: probe authorization/coordinator remain injected and collections disposable. No external push/deployed change/user file edit. Still required: server prepare/context/credential provider and push-specific status routing, full lifecycle coordination audit, browser workflow and structural Git apply/remaining Prism gates.

### Next checkpoint: server-side push preparation and immutable review
- Capture coherent project snapshot against established fetched baseline; reject unreviewed incoming changes.
- Resolve author server-side, create and retain immutable commit, then persist intent after fresh binding/access checks.
- Reconstruct file diff from retained commit/parent so later web edits cannot silently change the approved push.
- Verify real Git preparation/readback with no remote dispatch before public runtime wiring.

### Immutable push preparation and review service
Added GitPushPreparation.mjs: requires established binding baseline, rejects cached incoming commits, captures coherent project snapshot, computes full add/delete/modify diff, resolves author via trusted server callback, builds and retains immutable commit, then persists intent after rechecking binding/access. No remote push occurs during preparation. Review/file endpoints are internal service methods reconstructed from pinned commit+parent with fingerprint verification and bounded text/binary/absent display; later project edits do not alter approved commit. Real Git test covers server-supplied author, binary/add/delete paths, immutable readback, permission refusal, initial sync refusal and incoming-change refusal.65 backend tests and lint pass. Native Mongo/Git pipeline now starts through this preparation service (fixture project snapshot/author/auth/coordinator callbacks), reconstructs reviewed file then executes actual local-remote push, lost-response reconciliation and transactional settlement. Evidence plan/git-push-preparation-regression.log/lint.log and git-push-journal-native.json. Preparation currently creates a fresh review ID per explicit request; retained unjournaled commits on ambiguous failure require later retention cleanup. No public runtime/routes/UI wiring or credentials yet; no external push/service update/user document changes. Remaining native structural application/complete Prism gates unchanged.

### Next checkpoint: isolated encrypted Git credentials
- Avoid the existing assistant development-key fallback; require dedicated32-byte key.
- Encrypt per project/session-user/normalized repository using AES-GCM authenticated context.
- Verify isolation, tamper/key rejection, redacted status and removal before adding runtime endpoints.

### Isolated encrypted Git credential provider
Added GitCredentialStore.mjs with mandatory dedicated32-byte key, AES-256-GCM/random96-bit IV and authenticated context [version, project, session user, normalized HTTPS repository]. Tokens are scoped to project+user and exact repository with no shared-owner fallback. Save/load/status/remove require current write authorization; status returns configured boolean only. Ciphertext shape/version/key/tampering failures return generic errors. No development-key fallback; existing WritingAssistEncryption's dev default/truncation/padding was deliberately not reused.67 backend regressions and lint pass, including cross-user/repository isolation, randomized encryption, ciphertext transplant rejection, wrong key/denied actor rejection and removal. Actual Mongo probe with synthetic token proves no plaintext persistence, decrypt after client reconnect and removal; native Git/push pipeline regression still passes. Evidence plan/git-credential-store-regression.log/lint.log and git-push-journal-native.json. No real credential collected, configured or logged; provider not yet wired to public settings/runtime. Remaining integration includes explicit key config/rotation handling, own-credential routes/UI, private bind/fetch/push, user/project deletion cleanup and revoked-user self-removal policy. Also discovered integration mismatch to resolve before push runtime: existing bound refs use refs/remotes/origin/* while push intents require refs/heads/*; preserve tracking ref separately from destination branch. No deployment/external push/user document changes.

### Next checkpoint: tracking and push branch identity
- Persist separate destinationBranch derived only from validated binding tracking ref.
- Keep binding CAS against tracking ref; match push acknowledgements against destination head.
- Run native full prepare/push/reconcile using actual refs/remotes/origin binding namespace and verify no tracking ref is pushed remotely.

### Tracking ref and push destination integration
Added GitBranchIdentity.mjs to derive only refs/heads/<name> from validated refs/remotes/origin/<name> or existing heads bindings, preserving nested/Unicode names and rejecting other remotes/tags/unsafe refs. PushJournal now persists destinationBranch separately; binding CAS continues using original tracking branch, while transport requests/receipts/observations match destinationBranch. Executor rejects destination tampering; preparation validates binding namespace early. Native prepare→real local-remote push→lost-response reconcile→atomic baseline settlement now uses refs/remotes/origin/main binding and verifies remote contains no refs/remotes namespace.68 full backend regressions passed; subsequent targeted branch/executor tests and native pipeline pass; lint issues in ref validation were fixed and lint passes. Evidence plan/git-branch-identity-regression.log/tests.log/lint.log and git-push-journal-native.json. No external push/deployment. Runtime still must refresh/CAS-update tracking cache after successful push before next comparison; public push/context/credential endpoints and browser integration remain pending, as do structural apply and complete Prism gates.

### Next checkpoint: runtime credential endpoints
- Require explicit hex-encoded32-byte GIT_SYNC_CREDENTIAL_KEY; bind/fetch resolve only current actor token.
- Add authenticated own-token status/save/remove endpoints with allowlisted boolean responses.
- Verify actual controller/Mongo roundtrip and unauthorized rejection using ephemeral key and synthetic token; avoid external authenticated fetch.

### Runtime own-credential endpoints and fetch integration
GitSyncRuntime now lazily builds GitCredentialStore only with explicit64-hex GIT_SYNC_CREDENTIAL_KEY (default empty). bind/provision and refresh/fetch resolve only current authorized user's repository-scoped token; no shared-owner fallback. Provisioner forwards transient token to transport without persisting it. Added16-total login routes including own credential GET status, POST save and POST remove; controller uses session actor, bounded body/query and allowlisted configured boolean. Native controller/Mongo probe with ephemeral key and synthetic token verifies missing-key503, save/status/resolve/remove, ciphertext storage, body userId ignored, outsiders403; test record/key removed and fixture document unchanged.68 backend regressions and lint pass; targeted provisioner test verifies token arrives at transport but not bare repo config, plus defaults syntax passes. Evidence plan/git-sync-api-native.json, git-credential-api-regression.log/lint.log, git-private-provision-tests.log. No real token/private remote request or deployed service change. Still required: credential UI, lifecycle cleanup/key rotation/revoked-user removal policy, production push runtime/status routes and full native/browser acceptance. GIT_SYNC_CREDENTIAL_KEY has not been configured on running services.

### Next checkpoint: own-credential browser controls
- Add collapsible password input/status/save/remove for selected repository outside binding form.
- Clear token on submit/close/repository switch; never persist browser storage or replay failed save.
- Test session-only request payload, redacted status, removal and stale-response isolation; keep live credentials unconfigured.

### Own-credential frontend controls and browser acceptance
Added CredentialControls.tsx to Git panel outside repository-binding form. Collapsible selected-repository status/password input/save/remove; no browser storage, no saved-token echo, token cleared before POST and on close/repository switch. Unique request symbols invalidate stale fetch/save responses so old repository state cannot overwrite current UI; unknown mutation response is not automatically retried. Connected status and bind response expose normalized remoteUrl for own-credential management.19 frontend tests and targeted lint pass; native16-route credential/auth/status regression passes. Browser fixture using real component with simulated transport passes420/900px save/remove, password type, empty input after submit, no plaintext body/overflow/errors. Screenshot inspected; panel details rule initially overrode padding, fixed selector and reran/inspected. Artifacts plan/git-credential-visual/{browser.json,saved-420.png,check.py}, git-credential-ui-tests.log/lint.log, git-sync-api-native.json. Initial command mixed root-relative paths with services/web cwd and failed test creation; corrected before verified run. Ref cleanup warning fixed with unique request symbols, descriptions added per lint. No live service/key/token configured, no actual private remote request. Still pending production push runtime/HTTP/UI, retention/credential lifecycle, structural apply and full Prism acceptance.

### Next checkpoint: default-off native push runtime
- Compose native snapshot, user identity, own credentials, confined repository and atomic lifecycle under project lock.
- Read retained commit without creating refs; distinguish push versus apply project tickets for recovery routing.
- Expose authenticated sanitized prepare/review/status/execute/reconcile routes behind separate pushEnabled=false.
- Verify default denial, real session authorization and response fields without contacting any remote.

### Default-off production push runtime and HTTP entrypoints
GitSyncRuntime.getPushService composes native project snapshot/structure lock, same-Mongoose-client atomic push lifecycle, actual UserGetter author identity, confined repository writer/reader and current actor encrypted credentials. Added readRetained UUID-only read to verify pinned commit without creating refs. Dedicated pushEnabled=false default; six authenticated routes prepare/review/file/status/execute/reconcile with publicPush allowlist. Project admission ticket now records kind apply/push; status returns activePushId separately from activeApplicationId. Native candidate controller diagnostic verifies22 login routes, all push actions default404, enabled status sanitized, all outsider calls403, plus credential/application regressions.68 backend regressions and targeted lint pass; retained-ref read/path rejection test and native actual Git/Mongo push lifecycle regression pass after changes; defaults syntax checked. Evidence plan/git-sync-api-native.json/log, git-push-runtime-regression.log/lint.log, git-retained-commit-tests.log, git-push-journal-native.json. This verifies runtime load/status/permissions, not complete production-context HTTP push or login/CSRF/browser. No service changes, external push or real credentials. Pending tracking-ref cache update after push, public UI and production-context prepare/push acceptance, credential/lifecycle cleanup, structural apply and full Prism gates.

### Next checkpoint: confirmed-push tracking cache
- CAS origin tracking ref from expected pre-push head to confirmed commit only; never rewind an intervening fetch.
- Require matching settled binding/operation and current write permission; cache failure cannot change confirmed push receipt.
- Test actual Git concurrent/ref-stale behavior and native Mongo+push+cache integration.

### Confirmed push tracking-cache maintenance
GitCommitWriter.advanceTracking validates origin tracking namespace and immutable descendant commit, then update-ref --no-deref with exact expected old head. A changed/deleted/locked ref is not unconditionally overwritten; exact already-current commit is idempotent, otherwise refresh-required. Added GitPushCacheUpdater requiring current permission and exact settled binding identity/revision/base/last-push operation. Runtime execute/reconcile runs cache maintenance after confirmed remote receipt; failure preserves pushed status and public response exposes only bounded trackingCache result.69 regressions and targeted lint pass, including actual Git stale cache/newer fetch preservation, no heads mutation, no backward ancestry, permission/binding mismatch and failure classification. Native complete preparation→Git/Mongo push→reconciliation→settlement now advances actual origin tracking cache and verifies next preparation detects no duplicate changes. Evidence plan/git-push-cache-regression.log/lint.log and git-push-journal-native.json. No external push/deployment/user document changes. Cache is not a live remote truth; new remote updates still require fetch. Remaining public push UI and production-context HTTP/browser acceptance, lifecycle cleanup/key handling, structural apply and full Prism gates remain open.

### Next checkpoint: reviewed push frontend
- Add commit-message preparation, immutable per-file diff and explicit review checkbox before push.
- Keep operation identity on errors, query outcome without replay and restore active push on reopen.
- Disable conflicting apply/review controls during push, distinguish confirmed push from cache refresh.
- Verify interaction tests and isolated browser flow before any deployment.

### Reviewed push frontend verification
PushControls now supports commit-message preparation, immutable per-file red/green diff, explicit review checkbox, execute, status and read-only remote reconciliation. Parent disables remote refresh/new merge/application while a push is active. Lost mutation response triggers same-operation status lookup, never execute replay; unknown outcome hides push and never claims nothing was pushed. Active-operation restoration failure leaves recovery available. Project/operation lifecycle resets pending/activity/input/review state and ignores stale responses. Added4 interaction regressions; all23 Git frontend tests and scoped ESLint pass. Real component/simulated transport Chromium420/900 fixture passes diff/approval/lost-response/reconciliation with no page errors or horizontal overflow; review420 screenshot inspected. Evidence plan/git-push-ui-tests.log, git-push-ui-lint.log, git-push-visual/browser.json and screenshots. Initial test creation used incorrect cwd-relative path and failed before writing; corrected and reran actual new tests. One inspection referenced nonexistent CSS filename; actual git-sync.css used. No service deployment, external push, real credentials or user-document writes. Production-context HTTP push/login/CSRF/editor integration, structural apply, failed-push recovery lifecycle, branch workspaces and remaining Prism qualification remain open.

### Next checkpoint: known pre-dispatch rejection
- Separate final local preflight failure from possibly-dispatched push failure.
- Atomically mark never-dispatched attempts rejected and release exact project ticket without advancing baseline.
- Verify native Mongo rollback and UI recovery; do not unlock ambiguous network outcomes.

### Known pre-dispatch rejection settled
GitPushExecutor separates final context/permission preflight from transport invocation. Failed preflight after claim calls internal rejectBeforeDispatch; GitPushJournal CAS marks exact pushing attempt rejected; GitAtomicPushLifecycle settles rejection and releases exact project gate in one transaction without touching binding baseline. No endpoint permits callers to assert that a dispatched push did not execute. Transport errors/timeouts still remain unconfirmed and protected. PushControls explains stopped-before-sending and permits a fresh review, without replaying old operation. Native Mongo/disposable-local-Git probe verifies exact gate release, mismatched gate transaction rollback, rejected operation cannot confirm, unchanged binding revision, actual executor permission failure before dispatch, and all prior lost-response protections.69 backend regressions,24 frontend tests and scoped lint pass. Evidence plan/git-preflight-regression.log, git-preflight-ui-tests.log, git-preflight-lint.log, git-push-journal-native.json. No real user documents/remote credentials/deployed services modified. A process crash after claim or network-dispatched uncertainty still requires conservative recovery; this checkpoint does not solve all failed-push lifecycle cases. Remaining complete native HTTP/browser integration, structural apply, automatic remote prompting/branch workspaces and full Prism gates remain active.

### Next checkpoint: push controller HTTP pipeline
- Run all six real push controller actions on loopback against existing real Git/Mongo fixture services.
- Prepare and inspect immutable review through HTTP, simulate lost push response, query/reconcile same operation, verify duplicate requests do not replay.
- Check session actor isolation, validation and public response fields; explicitly retain fixture-session/native-runtime limits.

### Push HTTP controller pipeline verified
Extended plan/git-push-journal-native.mjs and .py to exercise all six actual GitSyncController push endpoints over ephemeral loopback Express HTTP with real preparation, repository reader/writer, Git transport, Mongo journal and atomic project/binding lifecycle. POST preparation produces retained commit; GET review/file returns actual immutable content; invalid empty message400 and missing review file404; body userId cannot replace session actor; all six outsider actions403 through fixture access service. Lost-successful-push response gives502 then unconfirmed status; repeated execute does not dispatch; reconcile confirms exact commit and status, further execute remains idempotent. Responses no-store on valid preparation and exclude retained refs, attempt IDs and private temp paths. Native probe passes including previous pre-dispatch rejection/transaction rollback/cache regressions. Diagnostic subprocess explicitly exits after cleanup because controller imports initialize application clients. Evidence plan/git-push-journal-native.json/log and git-push-http-run.log. Scope remains fixture sessions/authorization/coordinator/snapshot and composed service; not production runtime composition or real login/CSRF/browser/editor acceptance. No source service changes or deployment this checkpoint, no real user document or external remote writes. Next production-context runtime/snapshot acceptance and browser integration, plus structural apply/branch workspaces/full Prism remainder.

### Next checkpoint: native runtime commit preparation
- Use existing synthetic project read-only, actual authorization/user identity/document-updater snapshot and Redis project lock.
- Seed only a temporary local Git baseline and UUID-owned binding; run prepare/review/file/status via default runtime controllers.
- Verify Git commit content/author, permission denial and unchanged project versions; remove only probe-owned records/storage.

### Default runtime native commit preparation verified
Added plan/git-push-runtime-native.mjs/.py. Actual default GitSyncRuntime and controller HTTP preparation now run against existing synthetic project6ae5a9739305e09f47bc2951 using native authorization/UserGetter/Redis structure lock/document-updater snapshot, real Git and Mongo. Temporary UUID repository/binding contains a deliberately different local baseline; prepare creates immutable commit matching actual project files byte-for-byte and persisted actor matches session, commit email matches native user record despite forged request fields. Review/file/status APIs return actual content; outsider prepare/read/file/status403. Snapshot before/after identical (treeVersion3), no project gate left, binding baseline unchanged. Finally removes operation records by exact probe binding UUID, binding by exact project+UUID, temp repository and diagnostic module. Follow-up native API probe confirms unbound project, unchanged tree/file count, default-off push/application,22 authenticated route declarations and permissions. Evidence plan/git-push-runtime-native.json/log, git-runtime-post-cleanup.log, git-sync-api-native.json. No external network/push, no service restart/deployment, no real manuscript writes. Session/login/CSRF/browser/editor integration and actual production-runtime transport dispatch remain unverified; earlier fixture-service Git push tests cannot establish those. Broader structural sync, branch workspace/automatic prompting, lifecycle and Prism requirements remain open.

### Next checkpoint: automatic incoming-change notice
- Check connected repository every60seconds only while Git panel is visible and browser online; user may disable checks.
- Pause during merge review, prepared push review, mutations or unknown outcomes; no automatic prepare/apply/push.
- Show incoming-change notice and test timer/visibility/overlap/unmount behavior plus panel endpoint behavior.

### Automatic incoming-change notifications implemented
Added use-remote-checks.ts minute interval with visible-browser/online checks, non-overlap guard, callback freshness and cleanup. GitSyncView enables it for connected visible panels only, exposes opt-out checkbox and incoming-change notice; refresh calls fetch/status/graph only, never preview/apply/push. Pauses on merge review, prepared push review (new optional PushControls onReview callback), busy/active/unknown operations. Rail uses unmountOnExit=false; identified this and wired actual rail isOpen/selectedTab plus layout history visibility into view, so hidden mounted panels stop polling.27 Git frontend tests and scoped lint pass including hidden/offline/pause/unmount, request overlap, current callback, panel fetched-new-change notice, opt-out, hidden panel and active review blocking. Evidence plan/git-auto-check-tests.log/lint.log. No native source changes, deployment, credentials or project writes. Remaining live browser/editor/runtime acceptance, all structural sync actions, branch workspaces, review dismissal/resumption ergonomics and broader Prism completion gates remain open. Automatic polling is scoped to open Git panel, not an always-on server watcher.

### Next checkpoint: safe review dismissal
- Allow closing ready/conflict or terminal merge review to restore automatic checks.
- Allow closing unsent or terminal commit review; never hide busy/unknown operations through this control.
- Verify dismissal sends no mutation and unknown-result recovery remains visible.

### Safe review dismissal and check resumption
Added Close merge review for explicit ready/conflict/files-applied/partially-applied/cancelled statuses only, hidden for unknown or ongoing outcomes and disabled during requests. Clears local preview/file only; next periodic fetch resumes. Added Close commit review for prepared/pushed/rejected, hidden while result unknown and disabled during requests; clears local view/approval only, does not cancel or delete retained server operation. Tests verify no mutation on close, polling resumes only as fetch, recovery-required merge cannot be dismissed, ambiguous push cannot be dismissed, and review callback releases pause.28 frontend tests/scoped lint pass. Updated real PushControls simulated-transport Chromium420/900 fixture verifies close→prepare fresh review→explicit push→lost response→non-dismissible recovery→reconcile; no page errors or overflow, screenshot inspected. Evidence plan/git-review-close-tests.log/lint.log and plan/git-push-visual/browser.json/review-420.png. No deployed changes or manuscript writes. Remaining source-only integration/native browser/login-CSRF, structural sync actions, user branches and full Prism qualification unchanged; retained discarded-review cleanup is still pending.

### Next checkpoint: structural asset identity
- Preserve native asset IDs/blob hashes through snapshot and recovery metadata.
- Bind apply steps to exact asset identity and reject same-byte entity replacement or missing identity.
- Extend partial text-apply guard to protect unchanged assets while structural adapters are implemented.

### Native asset identity carried through reviewed synchronization
GitProjectSnapshot now returns native assetId/blob hash alongside source bytes. GitSyncPreviewService persists identities in web checkpoint only, clearing native identities from Git-source checkpoints. GitRecoveryStore freezes/retains asset metadata and validates path/entity uniqueness plus Git blob hash against stored bytes on both save/load; old document-only manifests remain readable. GitApplyPlan checks asset identity equality, records assetId/expectedBlobHash per step, and rejects asset modifications from legacy checkpoints lacking identity. Partial text-progress guard also rejects unchanged asset replacement despite identical bytes/tree version.72 backend regressions pass; subsequently added focused malformed/collision/hash recovery regression passes. Scoped lint passes. Native actual-runtime preparation still passes with snapshot field addition; project unchanged version3. First checkpoint roundtrip test caught RecoveryStore allowlist dropping assets; fixed storage validation/persistence and reran suite. Evidence plan/git-asset-identity-tests.log/lint.log, git-asset-recovery-tests.log and git-asset-native-runtime.log. Structural create/delete/binary application adapters are NOT yet implemented; this is required identity groundwork, not a claim of full structural synchronization. No deployed services or manuscript files changed. Next native journaled tree mutation/history receipts plus structural progress coordination, alongside remaining Prism acceptance.

### Next checkpoint: native document tree commit
- Add internal-only transactional existing-folder document insertion tied to exact apply ticket and in-flight reviewed step.
- Persist tree receipt in same Mongo transaction; replay must match original identity and never duplicate insertion.
- Validate paths, entity limits, collisions and membership; test real Mongo rollback before wiring docstore/history stages.

### Internal document tree insertion transaction
Added GitDocumentTreeCommit.mjs internal-only primitive for text document creation in an existing native folder. It requires caller's verified docstore stage, native lock and authorization; rechecks membership, exact apply ticket/in-flight step/writeId, path safety/native top-level reserved names, document identity uniqueness, expected project version, entity limit and destination collision. Project insertion/version increment and dedicated tree receipt share one Mongo transaction. Matching retries return persisted receipt; changed intent rejects. It leaves apply in-flight and project gate intact, receipt state tree-committed explicitly not document-persisted/history-confirmed. Native disposable Mongo probe verifies concurrent duplicates insert once, receipt failure rolls back insertion, identity/path/permission/version/limit/collision guards, replay and preservation of pending history/apply. Scoped lint passes. Evidence plan/git-document-tree-native.json/log/run.log and git-document-tree-lint.log; new probe scripts .mjs/.py. Existing running services/documents untouched. Not exposed via HTTP or wired into apply adapters yet. Next docstore staging/deduplication, durable structural history confirmation, missing-folder support and partial tree progress guards before enabling creation; deletion/assets/full Prism gates remain outstanding.

### Next checkpoint: reviewed new-document storage staging
- Allocate a stable server-side document ID in a majority journal before docstore POST.
- Inspect original ID/version/content after success or lost response; existing attempts never replay POST.
- Keep storage-only receipts separate from tree/history completion and validate immutable reviewed intent on every access.

### New-document storage stage implemented
Added GitDocumentStorageStage.mjs internal stage with mandatory authorizeStep contract, server-allocated docId and majority write-intent journal before any docstore POST. Exact reviewed UTF8 bytes/hash bounded, frozen before awaits; only acknowledged insert winner dispatches once. Duplicate/ambiguous/restarted attempts inspect original ID via peek and verify version0/rev/content hash before storage receipt; missing/mismatch stays unresolved without replay. Final pre-dispatch and pre-receipt checks compare immutable intent again, not just permission. No HTTP/runtime adapter wiring yet and stored is not tree/history-complete. Five targeted tests cover concurrent/restarted staging, lost successful response, no-content/mismatch, ambiguous journal insertion, changed bytes/intent and final review change; full78 backend regressions and scoped lint pass. Evidence plan/git-document-storage-tests.log/lint.log. This uses simulated collection/docstore; actual native docstore storage and tree/history integration still pending. No real document writes/deployment. Next native docstore acceptance, stage-backed tree commit contract, durable structural history receipt and full creation adapter; other structural/Prism requirements remain active.

### Next checkpoint: real docstore staging and storage-backed tree commit
- Require exact stored receipt inside tree insertion transaction; reject unconfirmed or mismatched storage identity.
- Run actual native DocstoreManager against disposable random project/doc IDs, inject lost-success response, verify one POST and exact readback.
- Clean only newly allocated test project docstore data and disposable Mongo collections; keep user projects untouched.

### Real docstore storage-to-tree integration verified
GitDocumentTreeCommit now requires exact confirmed storage journal row in its insertion transaction (project/actor/operation/attempt/writeId/docId/rev/version0/path/hash/state). Unconfirmed or mismatched content cannot enter tree even if caller passes plausible fields. Added plan/git-document-storage-native.mjs/.py exercising real native DocstoreManager HTTP with majority Mongo staging journal, injected lost successful POST response, fresh stage instance/retry, exact native rev/content readback, then real Mongo tree commit and deduplication. One POST only; history/apply remain pending. Disposable random project/doc IDs, isolated project/operation/receipt collections; cleanup uses docstore destroy solely for freshly allocated project and verifies exact document peek404, then drops isolated collections. Native tree regression updated to include storage prerequisite and still independently exercises path/membership checks by matching storage intent. Both native probes and scoped lint pass; logs plan/git-document-storage-native.json/log/run.log, git-document-tree-native.json and git-storage-tree-lint.log. No real manuscript or deployed service changes. Scope excludes real project admission/coordinator callback (fixture in these probes), history/notification stages, creation apply adapter or browser endpoint. Next durable structural history receipt and progress guard, then runtime wiring; broader Prism/structural tasks still active.

### Next checkpoint: stable creation-history events and retry handling
- Build creation event only from matching stored/tree receipts and hash-verified original bytes, with fixed ID/version/timestamp.
- Deduplicate exact tagged creation retries in history processor and skip already persisted retry before ordering checks.
- Reject conflicting tagged payloads; retain ordinary event ordering errors and test native processor suite.

### Stable creation history payload and processor deduplication
Added GitDocumentHistoryPayload.mjs requiring matching stored/tree receipts and exact original UTF8 bytes/hash; emits stable creationWriteId, doc/path, treeVersion.0, original committedAt and actor, no caller-chosen history payload. Added reviewed creation handling to project-history UpdatesProcessor: deduplicate only exact same-ID payload within batch, reject mismatched identity/content/version/timestamp and disguised text/delete events, filter already persisted tagged retry before ordinary ordering checks. Ordinary ordering behavior remains covered. Actual UpdatesProcessor unit suite43 passes, full Git/deletion admission backend suite80 passes. Web lint passes; project-history default ESLint parser rejected preexisting ES module imports, reran with explicit ecmaVersion2022/sourceType module and scoped lint passes. Evidence plan/git-creation-history-{processor-tests,processor-lint,payload-tests,payload-lint,regression}.log. No queue endpoint/runtime wiring or native persisted-history proof yet; no service deployment/documents changed. Next immutable receipt-backed queue delivery plus history-version confirmation before creation adapter can acknowledge. Structural asset/deletion/folder support and remaining Prism requirements remain active.

### Next checkpoint: durable creation-history outbox delivery
- Persist immutable hash-verified event before queue call; retries must match original payload.
- DU reads event by project/write ID only and verifies exact project ticket/version/history identity before enqueue.
- Test lost queue response replay and mismatch rejection; queued remains distinct from persisted history.

### Durable creation outbox and DU queue reader
Added GitDocumentHistoryOutbox.mjs: current in-flight authorization, immutable receipt/content-derived event, majority insert, exact readback/deep comparison, reauthorization then queue by project/writeId only. Returns queued, not history-complete. Added DU gitSyncCreationHistoryEvents collection and queueReviewedCreation internal method: validates event IDs/content SHA256/payload digest/project history/version and exact project apply ticket before queueOps. Tests cover lost queue ack with byte-identical retry, changed durable event, unconfirmed storage, ambiguous insert, changed DU project gate.83 backend regressions and25 DU history Redis manager tests pass. Web scoped lint passes. DU repository has no ESLint config; default invocation failed, explicit no-config ES2022/Node/Mocha parser plus no-unreachable check used instead (not full repository lint). Evidence plan/git-creation-outbox-{tests,regression,lint,du-tests,du-lint}.log. Queue callback/DU method not yet joined by service HTTP endpoint; no native Redis/history persistence proof yet. No deployment/manuscript writes. Next internal gated queue endpoint and actual native queue/history confirmation, then runtime creation apply adapter; full objective remains open.

### Next checkpoint: gated creation-history service endpoint
- Add internal DU queue route disabled by default; accept only validated project/write ID, ignore caller event bodies.
- Add web client method requiring matching acknowledgement identity.
- Test default denial, invalid input and queue failure before native transport acceptance.

### Creation history endpoint checkpoint and collaborative-sync constraint
Confirmed native queue probe passes: actual web client/internal DU HTTP controller/Mongo outbox/isolated Redis, default-off denial, invalid identity, byte-identical retry, mismatched acknowledgement and stale gate rejection. Targeted DU suites136 passing. Web lint and DU explicitly scoped parser/no-unreachable check logs show no findings. Evidence plan/git-creation-queue-native.json and corresponding logs. This is queue delivery only, NOT history consumer persistence or complete creation apply. No deployed service or user manuscript changed. Full goal remains open.
User emphasizes no loss of concurrent collaborators' edits. Acceptance requires recoverable snapshots, base/local/remote merge review, application-time version checks, explicit conflict decisions, and preservation or explicit blocking for annotations/review ranges. Git staging alone is not an adequate backup. Next creation-history persistence confirmation and complete structural apply integration remain required before enabling Git sync.

### Next checkpoint: creation history persistence confirmation
- Verify exact history identity and structural version after outbox delivery.
- Read the immutable history snapshot at that version and compare created document bytes with the durable event.
- Reauthorize before persisting a majority confirmation receipt; test stale versions, mismatched bytes and lost persistence acknowledgement. Keep full apply acknowledgement separate.

### Creation history confirmation stage
Added internal GitDocumentHistoryConfirmation.mjs: requires current in-flight authorization, receipt-backed outbox enqueue, exact persisted history ID/structure version, immutable snapshot at reported history version, native Snapshot parsing and exact created UTF8 content/hash comparison. Reauthorizes before majority immutable proof write, reads proof back, never claims full apply completion. Six focused tests cover queue-only evidence rejection, missing/changed snapshot content, changed authorization, lost receipt acknowledgement recovery and changed identity/conflicting proof. Full89 Git/deletion-admission regressions and scoped web lint pass. Initial changed-content fixture used invalid raw file format; strengthened status assertion exposed it and corrected to native File.toRaw(), then reran all tests successfully. Evidence plan/git-creation-confirmation-{tests,regression,lint}.log. Dependencies for history service/authorization remain injected; no native end-to-end persisted history acceptance, runtime creation adapter or deployment yet. Next actual history consumer persistence probe and native adapter integration, structural progress guards; full Prism/Git goal remains active.

### Next checkpoint: native immutable history reader
- Read a snapshot by the confirmed history ID/version, avoiding a second mutable project-to-history lookup.
- Compose timeout-bounded native history HTTP reads for the confirmation stage.
- Validate with actual history services on the existing synthetic fixture; keep read-only evidence separate from new-event consumer acceptance.

### Native immutable history reader and internal service composition
Added GitDocumentHistoryReader.mjs with timeout-bounded native project-history version and history-v1 snapshot reads; snapshot URL takes confirmed immutable history ID directly rather than re-resolving project mapping. Confirmation now passes that ID; test asserts it. Added GitDocumentHistoryService.mjs composing actual DU queue client, durable outbox, reader and confirmation while requiring caller's exact authorization/receipt readers/project lock. Not wired into public apply runtime. Native probe plan/git-history-reader-native.mjs/.py copied into UUID isolated candidate directory and read existing synthetic fixture: real history version3, structure3.0, parsed editable main.tex. First probe lacked private staging auth initialization and returned401; initialized existing private env without printing, rerun passed. Scoped lint and89 backend regressions pass. Evidence plan/git-history-reader-native.json, git-history-reader-regression.log, git-history-reader-lint.log. No manuscript edits/deployment. This verifies actual read transport, NOT consumption/persistence of a newly queued creation event; that full native pipeline plus structural progress/runtime integration remains next. Full goal active.

### Next checkpoint: native creation event processing
- Allocate disposable history storage and invoke current native history processor on a stable creation event.
- Verify actual stored snapshot bytes/version and replay without another history change.
- Delete only the allocated history and exact synthetic sync metadata; keep scope distinct from complete web apply.

### Native Redis creation consumer persistence acceptance
Added plan/git-creation-consumer-native.mjs/.py. Probe copies current project-history code to UUID directory, allocates fresh history ID, namespaces all history Redis keys, seeds stable creation JSON, invokes actual processUpdatesForProject (native lock/read/parse/compress/blob upload/history append/queue removal), reads persisted snapshot bytes/structure version and retries duplicate event. Duplicate same batch and later retry leave history version1 unchanged. Cleanup deletes only allocated history and exact synthetic metadata/keys; /latest/history returns404 afterwards. Native report passes; JS/Python syntax checks pass. First auth attempt lacked V1_HISTORY_PASSWORD initialization (separate from STAGING_PASSWORD); corrected private environment before module import. Cleanup test initially expected404 from /latest/content, but that endpoint propagates missing-chunk as500; verified source and used /latest/history which explicitly maps missing chunk to404. Runner removes stale report before every run. Evidence plan/git-creation-consumer-native.json/log/run.log. This is real Redis consumer-to-history persistence, but queue seeded directly; DU outbox enqueue + confirmation + native project creation must still be joined into one acceptance run, and creation runtime/progress adapters remain incomplete. No production manuscript/deployed service changes; full objective remains active.

### Next checkpoint: composed creation apply adapter
- Carry operation/attempt identity to apply adapters and recovery inspection.
- Compose storage, tree insertion and history confirmation; require matching durable receipts before acknowledging.
- Recovery inspection only reads receipts, never creates a document or replays a mutation. Keep runtime disabled until structural progress guard is integrated.

### Composed creation apply adapter
Added GitDocumentCreationAdapter.mjs composing storage.stage, transactional tree commit and history confirmation. It validates matching durable storage/tree/outbox history proof, identity/path/content hash/docId/rev/tree/history versions before normalizing to document-persisted receipt. inspect only authorizes and reads receipts, never invokes storage/tree/history writes; incomplete creation remains unresolved. GitApplyExecutor now passes operationId/attemptId to apply and inspect. Five adapter tests plus executor identity test cover stage ordering, history failure, lost final response, read-only recovery, changed bytes/attempt/proof/payload.95 backend regressions and scoped lint pass; logs plan/git-creation-adapter-tests.log/lint.log. Adapter not registered in native runtime: requires concrete authorizeCreation/current tree-version context and structural progress guard; no complete native composed apply acceptance yet. No deployed services/manuscripts changed. Next native coordinator/progress integration and joined acceptance, then remaining structural operations and full Prism requirements.

### Next checkpoint: structural progress for text creation
- Reconstruct expected documents and tree version from confirmed creation receipts while retaining existing text-modification checks.
- Persist created document identity and history/tree versions in apply journal.
- Reject missing/mismatched creation receipts and collaborator edits; keep default text-only guard until native creation coordination is ready.

### Structural progress validation for document creation
GitApplyProgressGuard now exports opt-in validateDocumentApplyProgress for text modification plus text creation. Reconstructs expected file bytes/document IDs/version0 and increments expected tree version only from confirmed creation receipts; rejects unexpected files, path collisions, collaborator edits, changed document IDs/versions, missing history proof or incorrect tree receipt. Existing validateTextApplyProgress remains strict text-only and is still runtime default. GitApplyJournal validates and preserves creation docId/version/treeVersion/historyVersion rather than dropping structural evidence. Tests cover pending/completed creation, read-only snapshot preservation, concurrent edits and incomplete receipt rejection.98 backend regressions and scoped lint pass (plan/git-creation-progress-tests.log/lint.log). Initial journal test stub returned modifiedCount only, but implementation uses matchedCount; corrected fixture to native Mongo result shape; lint declaration split fixed. No deployment or manuscript changes. Next concrete creation authorization/coordinator and opt-in runtime registration with joined native acceptance; remaining folders/assets/deletions/Prism tasks unchanged.

### Next checkpoint: native creation authorization
- Validate exact project, actor, operation, attempt and in-flight write identity against native records.
- Derive expected directory version from confirmed preceding creation steps and distinguish before/after current tree commit.
- Recheck native permission and reject changed gate, lifecycle state or receipt before any stage can continue.

### Native-record creation authorization and service composition
Added GitDocumentCreationAuthorization.mjs checking exact actor/project/operation/attempt/in-flight write, immutable supplied step, preceding confirmed creation receipts, project admission gate/lifecycle and expected directory version before and after current tree commit. Rechecks native authorization after reads. Five focused tests cover recovery, changed actor/gate/step/lifecycle, mismatched tree history and prior receipt counts; full103 backend regressions and scoped lint pass. Added GitDocumentCreationService.mjs connecting this authorization to storage, transactional tree insertion, receipt-backed outbox, history confirmation and adapter, with caller-provided native I/O and same-client collections. Service imports and lint pass; composed service does NOT yet have joined native execution acceptance and is not runtime registered. Evidence plan/git-creation-authorization-tests.log/lint.log and git-creation-service-lint.log. Initial service write used root-relative path from web cwd and failed without changing files; corrected path. No deployment or manuscript writes. Next joined native service acceptance, then opt-in runtime integration and remaining structural/Prism work.

### Next checkpoint: joined native creation service acceptance
- Exercise composed service with real docstore, same-client Mongo transaction and isolated Redis/history consumer.
- Confirm durable receipt after immutable history readback; inspect without replaying writes and reject stale gate.
- Explicitly record fixture authorization and direct queue adapter scope; clean allocated storage only.

### Joined native creation service and journal acceptance
Added plan/git-creation-service-native.mjs/.py and git-creation-service-worker.mjs. Uses actual composed creation service, Mongo collections isolated by UUID, real native DocstoreManager HTTP (injected lost successful response), same-client transaction, durable outbox, isolated Redis queue and current project-history consumer/blob/history write, immutable snapshot readback and durable history proof. Exactly one docstore POST; inspect returns receipt without replay; unrelated tree increment rejected. Actual GitApplyJournal rejects incomplete history receipt then persists complete creation identity/tree/history version and clears in-flight/advances nextIndex. Native probe passes, JS/Python syntax checks pass. Fresh docstore and history IDs cleaned and readback404 verified; isolated collections/Redis keys/code copies removed. Evidence plan/git-creation-service-native.json/log/run.log. Explicit limits: test permission callback, isolated project collections, direct outbox-to-Redis queue adapter; DU HTTP, browser/CSRF and complete native apply executor/project-lock integration not covered. No deployed services or user manuscript changes. Next register guarded native creation dependencies, ensure recovery runs under native project lock, exercise full executor/DU route, then missing folders/assets/deletion/Prism acceptance. Full goal remains active.

### Next checkpoint: guarded runtime creation wiring
- Add default-off creation adapter registration using native Mongo/docstore/DU/history dependencies.
- Select structural progress validation only with creation adapter and lock recovery queries.
- Verify disabled behavior and recovery lock coverage; keep candidate flags off pending joined HTTP/browser and notification acceptance.

### Default-off native creation runtime registration and locked recovery
GitApplyService accepts explicit creationAdapter, selects structural progress validator only when registered, and wraps reconcile in native project lock through inspection/journal confirmation. GitSyncRuntime composes creation service with native Mongo collections/transaction/auth/docstore, reviewed content reader, DU queue client and immutable history reader when gitSync.creationEnabled=true. Added setting default false; running services unchanged. New tests prove lock covers recovery and creation without adapter rejects before journal claim.105 backend regressions and scoped lint pass. Actual copied-runtime/API native probe passes default denial, native owner/outsider checks,22 login routes, sanitized status/credential controls; original synthetic fixture unchanged treeVersion3/main.tex. Evidence plan/git-creation-runtime-tests.log/lint.log/native.log. Native probe does not enable creation or execute creation HTTP; remaining gates include native creation through DU HTTP and full executor, realtime file-tree notification, missing-folder creation, structural asset/delete support and overall Prism acceptance. No deployment or user manuscript changes; full goal active.

### Next checkpoint: creation realtime visibility
- Emit native reciveNewDoc only after full durable creation proof, including recovery inspection.
- Make frontend create events idempotent by entity ID without overwriting later rename/move state.
- Test event payload and failed-publish recovery; keep delivery acknowledgement distinct from client receipt.

### Native creation notification and frontend replay protection
Added GitDocumentCreationNotification.mjs emitting native reciveNewDoc envelope (folderId, docId/name/rev, source, actor) only after adapter verifies complete durable receipts. Creation adapter publishes after apply and on successful inspect; publication failure leaves operation recoverable and inspect re-emits without storage/tree/history writes. Service/runtime pass native EditorRealTimeController publisher. Frontend createEntityInTree now deduplicates entity ID across whole tree, preserving later rename/move state instead of appending duplicates.107 backend tests, one focused frontend test and scoped lint pass; evidence plan/git-creation-notification-{tests,frontend,lint}.log. This tests payload/retry and actual frontend mutation helper; no real socket/browser delivery acceptance yet. Redis publication is not browser receipt acknowledgement. Default creation flag remains false; no deployment/user manuscript changes. Next full native DU/executor and live browser notification acceptance; other structural and Prism requirements remain open.

### Next checkpoint: joined native creation through DU HTTP
- Replace direct Redis seed in joined probe with actual web client and gated DU controller.
- Route DU Mongo reads and Redis keys to isolated test records while retaining real services.
- Verify native history confirmation/journal and clean subprocesses and allocated data.

### Joined native creation now traverses web client/DU HTTP and realtime publisher
Extended plan/git-creation-service-native.mjs/.py and worker.mjs; added git-creation-service-du.cjs. Isolated DU subprocess uses current actual HttpController/ProjectHistoryRedisManager, fixture Mongo collections and same namespaced Redis keys as history worker. Actual copied DocumentUpdaterHandler calls loopback HTTP; DU validates durable event/gate and queues it; native history consumer drains it, persists snapshot and confirmation/journal succeeds. Native EditorRealTimeController now invoked by joined service and independent Redis subscriber verifies exact project reciveNewDoc folder/doc payload on apply and recovery. Both passes retain exactly one docstore POST and stale-tree rejection. Probe report plan/git-creation-service-native.json passes; allocated docstore/history cleanup404 and collection/subprocess/code cleanup complete. JS/Python syntax checks pass. No deployment/user manuscript changes. Limits remain fixture permission, isolated project records, no full apply executor native lock/claim/binding settlement or actual browser websocket reception. Next full executor and editor acceptance; overall Prism/Git feature scope remains active.

### Next checkpoint: native apply executor for creation
- Run GitApplyService with actual atomic lifecycle, project lock and creation adapter against isolated native records.
- Exercise structural progress reads, final baseline settlement and gate release.
- Reject stale second application without another document write; preserve explicit fixture preview/auth boundary.

### Native creation through complete apply service/executor and recovery
Added plan/git-creation-executor-native.mjs/.py derived from joined service probe. Runs actual GitApplyService/executor, atomic admission/journal/binding settlement and native sequentialProjectStructureUpdateLock. Uses actual creation service, docstore, DU HTTP, Redis consumer/history snapshot confirmation and realtime publisher. Native progress reader checks actual stored document/version and project tree. Success advances baseline in same transaction as terminal status/gate release, with exactly one docstore POST; stale second apply rejected without a remaining gate. Recovery variant injects failure after notification publish: operation recovery-required, gate retained, baseline unchanged; reconcile confirms durable receipt under lock; resume completes and releases gate, still one POST. Both pass; artifacts plan/git-creation-executor-native-success.json and git-creation-executor-native.json/log/run.log (latter recovery variant). Syntax checks pass. Fresh native data cleaned with404 verification. Scope retains fixture permission/review/recovery-source and isolated project/binding collections, not live browser or actual Git repository-derived review. No deployment/user manuscript change. Next real editor/browser and repository preview acceptance plus missing folders/assets/deletion and full Prism requirements. Goal remains active.

### Next checkpoint: real Git preview to native creation
- Replace synthetic preview/recovery with a disposable real Git repository, immutable object reader and on-disk recovery store.
- Prepare native review/apply plan, execute through actual service chain, verify baseline and snapshot retention.
- Keep repository local; no external remote or manuscript writes.

### Real Git repository preview to native creation acceptance
Added plan/git-creation-repository-native.mjs/.py. Replaces synthetic plan/preview/recovery from executor probe with disposable local Git repository (empty baseline commit then new.tex commit), actual GitRepositoryReader, GitSyncPreviewService, Mongo operation store and private on-disk GitRecoveryStore. Actual plan derived from preview proceeds through native apply service/executor/lock/atomic lifecycle/creation/DU HTTP/Redis/history/notification. Confirms remote commit identity, original empty recovery snapshot, exact committed bytes, settled baseline and stale replay rejection. Both normal and lost-notification recovery variants pass with one storage POST, final gate release and cleanup404. Artifacts plan/git-creation-repository-native-success.json and git-creation-repository-native.json/log/run.log; JS/Python syntax checks pass. Scope still fixture permission, isolated project/binding records, local Git only; no live editor/browser or external GitHub. No running-service deployment or user manuscript changes. Next native browser/project authentication acceptance and unresolved directories/assets/deletion/Prism features. Goal remains active.

### Next checkpoint: atomic missing-folder creation
- Insert missing ancestor folders and document in one native tree transaction and preserve generated IDs in receipt.
- Count new folders against entity limit and reject ambiguous/file-occupied ancestors.
- Notify parent folders before document; verify rollback and concurrent replay on real Mongo.

### Missing ancestor folders created atomically with document
GitDocumentTreeCommit now creates absent ancestor folders in the same transaction as the document and receipt, stores stable createdFolders IDs/parent order, counts them against entity limit and rejects occupied/ambiguous ancestors. Existing folders reused; one project version increment for this atomic document/path addition. GitDocumentCreationNotification emits native reciveNewFolder parent-first then reciveNewDoc; frontend existing ID dedupe protects replays. Real Mongo probe extended for two missing levels, rollback leaves no folders, limits and concurrent retry insert once.108 backend tests/scoped lint pass. Real Git repository probe now supports CREATION_NESTED=1 and recursively reads native docs; nested tex/sections/new.tex plus lost-notification recovery passes entire preview/executor/DU/history/settlement with one storage POST. Evidence plan/git-document-tree-native.json, git-folder-creation-tests.log/lint.log, git-creation-repository-native.json/log/run.log. Runtime still disabled; no deployment or manuscript edits. Browser/auth acceptance, binary/deletion synchronization and remaining Prism work stay open.

### Next checkpoint: native project authorization acceptance
- Use a fresh real projects record and original stable test owner with native AuthorizationManager.
- Deny an outsider before preparing review or writing; run nested creation/recovery under actual permission checks.
- Cleanup exact newly allocated project ID only; never drop shared projects collection.

### Native project records and authorization in repository acceptance
Repository probe now supports CREATION_REAL_PROJECT=1: allocates a fresh real projects record owned by stable test owner, uses actual AuthorizationManager on prepare/apply/recovery/resume, and DU reads real project gate while event/operation/binding collections remain isolated. Native owner accepted; outsider prepare403 with no operation inserted. During injected lost-notification recovery, temporarily change only fresh project's owner: original actor recovery403 and state stays recovery-required; restore owner, reconcile/resume succeeds. One docstore POST, gate/baseline settlement and nested directory/history checks remain passing. Native report plan/git-creation-repository-native.json marks nativeProjectPermissionVerified/revokedPermissionBlocksRecovery true. Exact created project deleted by ID+unique test name and verified absent, never drops shared projects collection; other newly allocated data cleaned. JS/Python syntax pass. No existing project/account/deployed-service changes. Still no live editor/browser or external GitHub; operations/binding collection isolation and other structural/Prism requirements remain. Goal active.

### Next checkpoint: live editor receives Git creation
- Keep a real temporary project open in authenticated Chromium while native repository synchronization runs.
- Verify nested folders/document arrive without reload and document opens with exact content.
- Hold cleanup until browser assertions finish, then remove only allocated project/data.

### Live authenticated editor sees repository-created document without reload
Added plan/git-creation-repository-browser.py and browser gates to native repository probe. Chromium logs in with unchanged private stable credentials, opens fresh real project before apply, stays open through actual Git preview/native apply/DU/history/notification, sees tex/sections/new.tex without reload, opens document and checks exact source text. Screenshot plan/git-creation-repository-browser.png inspected; JSON/log/run.log passed. Browser uses existing candidate UI (not new Git panel), apply is driven by native test orchestrator, not browser Git route. Normal path only: current candidate frontend lacks newly added dedupe, so repeated-notification browser recovery is not claimed. Fixed cleanup after first successful run: close page before gate release, native DU DELETE shutdown=1 flush/delete cache before docstore destruction; rerun passes. Exact prior probe project6ae5e55d11d0b679675c54f0 cache also cleared after verifying project absent; no shared collection deletion. Final cleanup verifies docstore/history404 and project absence. JS/Python syntax checks pass. No production deployment or user manuscripts/accounts changed. Remaining native Git UI/CSRF/button acceptance, frontend dedupe deployment, binary/deletion sync and full Prism scope still active.

### Current checkpoint: preview application availability
- Expose server-derived unsupported file operations before apply; preserve native execution guards.
- Recalculate availability after conflict resolution and show file-specific reasons.
- Verify backend classification and frontend disabled action; structural support and full Prism acceptance remain open.

### Preview availability before application
Implemented GitPreviewAvailability from immutable preview bytes and native document identities. Runtime supplies actual apply/creation flags; prepare/read/resolve controller responses expose only canApply/reason/blocked paths, never native metadata. UI lists unsupported deletes, binary writes, attachment replacements and disabled creation before applying; revised previews recalculate and keep native execution guards. Added classifier coverage using real tree merge/resolution, component no-submit/revision-update check, and panel wiring check. Backend110 and frontend30 tests pass; scoped eslint passes. Evidence plan/git-preview-availability-tests.log, frontend.log and lint.log. No deployment, account changes or manuscript changes. This is advance disclosure, not structural support; binary/delete adapters, browser Git route acceptance, branch collaboration and full Prism scope remain unfinished.
Changed: GitSync/GitPreviewAvailability.mjs (new), GitSync/GitSyncPreviewService.mjs, GitSync/GitSyncRuntime.mjs, GitSync/GitSyncController.mjs; frontend git-sync/application-controls.tsx and git-sync-panel.tsx; test/agent/git-preview-availability.test.mjs (new), frontend git-sync/application-controls.test.tsx and git-sync-panel.test.tsx. Paths rooted in services/web/app/src/Features, services/web/frontend/js/features, services/web/test as applicable. Planning/notes appended only.

### Current checkpoint: deletion confirmation and partial progress
- Define strict native deletion receipts including original identity/version/hash, resulting tree version and persisted history version.
- Extend opt-in structural progress validation for deletion followed by other file changes.
- Reject partial/forged receipts and collaborator changes; keep runtime deletion unavailable until native adapter and lifecycle integration pass.

### Deletion confirmation and partial progress foundation
GitApplyJournal now rejects delete confirmations without native document-deleted state, exact original docId/version/beforeHash, null afterHash, expected cumulative structural version and persisted history version. Saves those fields in majority-confirmed journal receipt. Creation tree-version counting includes preceding deletions for mixed plans. Added opt-in validateStructuralApplyProgress: reconstruct confirmed deletion effects on document identities/files/tree version, preserve archived snapshot, reject missing/unconfirmed deletion, recreated paths and collaborator changes. Existing text/creation validator remains strict; runtime has no deletion adapter and UI still blocks deletes. Tests cover pending/confirmed deletion, corrupted proof, absence without confirmation and collaborator edits;113 backend tests pass. Evidence plan/git-deletion-progress-tests.log and scoped lint log. Changed only GitApplyJournal.mjs, GitApplyProgressGuard.mjs and tests git-creation-journal.test.mjs/git-apply-progress.test.mjs plus planning records. No real files deleted, no deployment or credential changes. Next native deletion adapter must bind Git operation to native reservation/history/atomic lifecycle and executor; not yet implemented. Full Git and Prism objective remains active.

### Current checkpoint: executor deletion receipt and recovery
- Distinguish native document deletion confirmations from text persistence.
- Register deletion adapters only explicitly, select structural progress validation, keep runtime disabled.
- Test mixed plans and lost-response reconciliation with no replay, then run backend regression.

### Executor recognizes deletion confirmation and non-replaying recovery
GitApplyExecutor uses action-specific receipt validation: delete requires document-deleted plus exact doc/version/beforeHash, null afterHash and valid structural/history versions; normal modifications still require document-persisted. Both apply and reconcile reject incomplete receipts and retain uncertain status. GitApplyService optionally accepts deletionAdapter and chooses structural validator only when explicitly registered. Runtime does not register one, flags unchanged, preview still blocks deletion. Added mixed deletion/modification, lost deletion response/reconcile/resume with one deletion and one claim, and incomplete receipt tests.116 backend tests and scoped eslint pass; logs plan/git-deletion-executor-tests.log and git-deletion-executor-lint.log. Changed GitApplyExecutor.mjs, GitApplyService.mjs, git-apply-executor.test.mjs plus plan/notes. No native deletion, deployment, manuscripts or credentials changed. Next implement native deletion adapter authorization/reservation binding and atomic lifecycle integration; existing WritingAssist coordinator is task/proposal-specific and cannot be invoked by inventing task IDs. Overall goal active; complete Git and Prism acceptance still open.

### Current checkpoint: native deletion source identity
- Add explicit Git operation/attempt/write/review identity to reservations, without synthetic AI task/proposal records.
- Preserve legacy reservation compatibility and reject cross-source reuse.
- Extend recovery identity comparisons in web and DU, verify legacy and Git reservation tests.
- Native Git admission/commit lifecycle remains required before enabling deletion.

### Explicit Git source identity in native deletion reservations
DocumentDeletionReservations now validates discriminated source=git-sync with gitOperationId/gitAttemptId/gitWriteId/gitReviewRevision and original document snapshot; legacy taskId/proposalId bindings unchanged. Mixed source fields/unknown sources invalid, cross-source reservation reuse rejected. DocumentDeletionReservation schema supports Git source with conditional fields. Web recovery and DU missing-cache recovery compare all Git source fields across storage reads. Added Git reservation lifecycle/source-isolation and recovery identity-change tests.188 combined deletion/Git backend tests and21 DU deletion-manager tests pass, scoped web lint passes. Logs plan/git-deletion-source-tests.log, git-deletion-source-du.log, git-deletion-source-lint.log. Changes: DocumentDeletionReservations.mjs, DocumentDeletionRecovery.mjs, models/DocumentDeletionReservation.mjs, DU DocumentDeletionManager.js, document-deletion-reservations.test.mjs, document-deletion-recovery.test.mjs, plan/notes. No native deletion requests, deployment or user files changed. This adds identity representation only, not authorization: next Git admission must atomically verify exact in-flight step/gate before creating native reservation; native commit/settlement/teardown integration still open. Runtime deletion remains unregistered/default blocked. Full goal active.

### Current checkpoint: transactional Git deletion reservation start
- Verify immutable Git in-flight step and preceding structural receipts.
- Write both operation and project in the same transaction before native reservation insertion, including native membership and lifecycle checks.
- Validate document ID/path against native tree and test refusal/rollback boundaries; runtime remains unregistered.

### Transactional Git deletion reservation admission
Added GitDocumentDeletionStart.mjs: validates explicit Git binding, exact active reviewed delete step/in-flight attempt/revision and prior structural receipts; verifies document identity/path against native tree; checks project gate/version/member/lifecycle in transaction; writes operation and project counters in same session before native reservation begin. Stable native operationId is gitWriteId. No AI task is fabricated. Unit tests cover identity binding, changed step/version/path/attempt, project query rejection, duplicate/moved native doc and operation CAS miss. Tests use isolated adapters, not real Mongo transaction proof. No runtime wiring or actual document deletion. Next native transaction rollback/concurrency acceptance, then Git commit/settlement integration. Changed new source and git-deletion-start.test.mjs plus plan/notes; full objective remains active. Evidence plan/git-deletion-start-tests.log and git-deletion-start-lint.log.

### Current checkpoint: native Mongo deletion start acceptance
- Exercise exact current admission source in UUID-isolated collections using existing candidate Mongo replica.
- Inject reservation failure and verify both operation/project writes roll back.
- Check real query denials and concurrent same-operation retry; clean allocated collections and copied code.

### Native Mongo deletion reservation admission acceptance
Added plan/git-deletion-start-native.mjs/.py. Executes current GitDocumentDeletionStart and current DocumentDeletionReservations in an isolated candidate subprocess against actual Mongo replica with snapshot/majority transactions and UUID collections. Dependency import relocated only in copied probe source. Injected reservation failure rolls back project and operation counters;8 permission/gate/lifecycle/terminal-state denials leave zero reservations. Revoking owner after transactional project read causes conflict/retry then409, with no reservation or operation counter committed.8 concurrent retries converge on one stable native reservation and8 committed counters. Native project tree/version unchanged; no actual deletion performed. All allocated collections removed and verified absent, copied code removed. JS/Python syntax pass. Report plan/git-deletion-start-native.json/log. No service deployment, account/manuscript change. Next actual Git-bound commit/history/settlement adapter integration remains required; runtime deletion still unavailable. Full Git and Prism objective active.

### Native deletion adapter contract and read-only reconciliation
Added GitDocumentDeletionAdapter.mjs and git-deletion-adapter.test.mjs. Adapter derives explicit Git reservation identity from exact step and authorized context; apply delegates native execution, then independently reads proof. Confirmation requires committed matching reservation, exact native project receipt/history identity/version, soft-deleted storage, absence from tree and live cache absence. Reauthorizes after proof read. inspect never calls executeDeletion, even after a lost response; confirmed notification may be re-emitted. Tests cover incomplete/wrong proof, revoked access, replacement bytes, lost response and no replay.195 combined backend tests and scoped lint pass; logs plan/git-deletion-adapter-tests.log and git-deletion-adapter-lint.log. Important integration finding: existing WritingAssist inspectDeletion re-runs cache cleanup, so cannot be reused as a read-only Git proof reader. Native readProof/authorization/execution composition and cache inspection endpoint still needed; adapter is not registered in runtime. No real deletion/deployment/user files changed. Overall goal active.

### Current checkpoint: read-only Redis deletion cleanup proof
- Add atomic read-only Lua check for exact deletion marker and all document cache keys removed by native cleanup.
- Preserve server-generation checks; missing/wrong protection must not be interpreted as success.
- Exercise current primitive on actual isolated Redis keys including partial cache leftovers and no mutation.

### Read-only native Redis deletion cache proof
DocumentDeletionFence now exposes inspectClearedCache within existing generation-bound operation context. Single Lua execution requires exact deletion marker and absence of all11 document cache keys removed by native cleanup; missing/wrong marker returnsfalse, generation mismatch errors. Never loads documents, writes markers or evicts residual keys. Added plan/git-deletion-cache-native.cjs/.py using random synthetic native Redis document keys, verifying11 leftover cases, missing/wrong marker, generation change and state preservation. Native proof passes, cleanup verifies keys absent, copied modules removed. Existing native version-fence concurrency probe also passes;21 DU manager unit tests and JS/Python syntax pass. Evidence plan/git-deletion-cache-native.json and git-deletion-cache-du.log. Only DU fence source, new probe artifacts, plan/notes changed; no deployment or manuscripts/account change. Next DU read-only manager/HTTP+web client and Git native proof composition remain required; primitive alone does not prove deletion or authorization. Full goal active.

### Current checkpoint: read-only deletion inspection API
- Share native durable cleanup prerequisites between cleanup and inspection; inspection only reads Redis proof.
- Add gated internal GET route and bounded web client with exact identity/boolean validation.
- Test read-only manager, HTTP gate and client response validation.

### Read-only deletion inspection manager and internal API
Refactored DU cleanup prerequisites into shared checkDeletionCache; new manager.inspect holds native doc lock/generation context, validates durable reservation/project history/tree absence/storage soft deletion, then only calls fence.inspectClearedCache. Cleanup behavior retained. Added default-off GET /project/:project_id/doc/:doc_id/deletion/:operation_id with no-store/allowlisted response and web DocumentUpdaterHandler.inspectDocumentDeletion using bounded GET and strict identity/boolean checks. False remains unconfirmed; private response fields discarded. Tests assert inspection never reloads/evicts/writes markers, gates refuse by default, URL operation used, client handles true/false and rejects malformed identity/status.136 DU manager/controller tests,69 web handler tests, scoped web eslint and DU syntax pass. Evidence plan/git-deletion-inspection-{du,web,lint}.log. Changed DU app.js/HttpController.js/DocumentDeletionManager.js and their two test files; web DocumentUpdaterHandler.mjs/test; plan/notes. No running service deployment or user content mutation. Native HTTP end-to-end probe and Git proof-reader/commit/lifecycle composition still required before enabling; full goal active.

### Current checkpoint: Git native deletion proof reader
- Read scoped reservation, native project receipt/tree, soft-deletion metadata and DU read-only cache status.
- Re-read durable state after HTTP observation and reject changes/missing proof.
- Join reader to adapter tests; native commit/authorization/runtime composition remains open.

### Git native deletion proof reader composed with adapter
Added GitDocumentDeletionProof.mjs: validates scoped explicit Git reservation, committed state, native project receipt/history/version, soft-deleted document metadata and no reappearing doc ID/path; invokes bounded DU read-only inspection; repeats durable snapshot and rejects changed receipt before returning proof. No document content loads or mutations. Added git-deletion-proof.test.mjs including actual adapter+reader composition, missing/mismatched state before HTTP and mutations across HTTP read.198 combined backend tests and scoped eslint pass; logs plan/git-deletion-proof-tests.log/lint.log. Source reader is dependency-injected and not yet wired in runtime; tests use isolated collection/HTTP adapters, not native end-to-end deletion. No deployment/user data changes. Next actual Git deletion authorization and native tree/history/storage/cache commit composition, then native HTTP integration; full Git/Prism goal remains active.

### Current checkpoint: native Git deletion authorization
- Verify exact active deletion plan and project admission before and after tree removal.
- Validate native receipt and current history identity; allow only own pending deletion history.
- Recheck actor permissions after reads and exercise mismatches/recovery stages.

### Git deletion authorization before and after native tree commit
Added GitDocumentDeletionAuthorization.mjs accepting adapter args. Validates current native permission twice, exact active plan/step/in-flight attempt/review, preceding creation/deletion receipts, original gate and current tree version. After native removal accepts only matching deletionReceipts entry/current history and own deletionHistoryPending; unrelated pending work/teardown/admissions rejected. Returns original expectedTreeVersion and reviewRevision to adapter before/after deletion. Added git-deletion-authorization.test.mjs for recovery stages, wrong snapshot/actor/receipt/history/lifecycle, revocation and prior deletion history proof.202 combined backend tests/scoped lint pass; evidence plan/git-deletion-authorization-tests.log/lint.log. No runtime registration/deployment/user file changes. Next wrap native DocumentDeletionProjectCommit in same-client transaction with operation/project mutation checks and this authorization; then compose native execute/history/storage/cache and proof reader. Full goal active.

### Current checkpoint: transactional native Git deletion tree commit
- Wrap native project deletion commit with current Git authorization and same-session project/operation writes.
- Validate rollback after removal, concurrent retry and unchanged persistent Git admission using isolated real Mongo collections.
- Do not claim storage/history/cache completion from tree removal alone.

### Transactional native Git deletion tree commit accepted on Mongo
Added GitDocumentDeletionCommit.mjs wrapping existing native DocumentDeletionProjectCommit with same-client transaction, explicit Git binding, pre/post-tree authorization, operation/project mutation counters and native member predicate. Native reservations must already be committing/committed. Added plan/git-deletion-commit-native.mjs/.py based on admission probe using UUID isolated Mongo collections. Verified unprepared refusal, injected failure after native $pull rolls back tree/receipt/counters,5 concurrent commit retries remove once/increment project version once, rootDoc clearing, same pending-history operation and Git gate retained, and post-commit permission revocation rejects with counter rollback. Admission8 concurrent retries checks retained. Native result passes; collections/code copies cleaned, syntax/scoped lint pass. Report plan/git-deletion-commit-native.json/log, git-deletion-commit-lint.log. Scope is real Mongo tree commit with simulated DU preparation; no actual docstore/history/cache deletion qualification. No production/shared project edits or deployment. Next compose real DU prepare, history preflight/confirmation, soft-delete and cache cleanup, mark committed, then adapter/proof/runtime acceptance. Full goal remains active.

### Current checkpoint: native deletion execution sequence
- Compose stable reservation, history readiness, DU preparation, transactional tree commit, persisted history, soft-delete and cache cleanup.
- Reauthorize before mutations, validate acknowledgements, keep uncertain stages recoverable under same identity.
- Test stage failures and resumable same-operation execution; runtime enablement remains gated on native acceptance.

### Native Git deletion execution sequence
Added GitDocumentDeletionExecution.mjs composing explicit reservation/authorization, readiness preflight, DU prepare + persisted state readback, transactional tree receipt, history proof, native soft-delete, cache cleanup, live read-only cache proof, and reservation committed/readback. Exact identity checked at every acknowledgement and permissions rechecked before mutations. Errors leave state for explicit same-operation recovery; completed retries do not mutate. Added git-deletion-execution.test.mjs covering stage order, lost successful prepare acknowledgement without new admission, failures at history/storage/cache/proof, wrong acknowledgements and completion suppression.206 combined backend tests and scoped lint pass; logs plan/git-deletion-execution-tests.log/lint.log. Tests use substituted services, not native full-chain proof. No runtime registration/deployment/user deletions. Next compose real service dependencies + adapter/proof reader, explicit recovery wiring and native integration acceptance. Full goal active.

### Current checkpoint: deletion service composition
- Assemble authorization, reservation admission, tree commit, native history preflight/confirmation, execution and proof reader.
- Verify bound input against current plan on every stage; preserve read-only inspect.
- Validate composition against real Mongo with isolated external service adapters before native HTTP qualification.

### Git document deletion service composition accepted with real Mongo
Added GitDocumentDeletionService.mjs composing current authorization/admission/transactional commit, native reservation store, native history preflight/confirmation, execution sequence, read-only proof and adapter. authorizeInput independently scopes current plan/binding at every stage. Added plan/git-deletion-service-native.mjs/.py: uses real UUID Mongo project/operation/reservation/doc-metadata collections, real service/tree/history-confirmation/proof code; DU, history HTTP and docstore calls deliberately simulated. Validates completed receipt, one call per mutation stage, read-only inspect, committed reservation, cleared history pending and retained Git gate. Report explicitly nativeHttpServicesSimulated=true; not end-to-end native deletion proof. All isolated collections/copied code cleaned. Native report plan/git-deletion-service-native.json/log; syntax and scoped lint pass. No deployment or user data changed. Next real DU HTTP/history consumer/docstore/Redis probe, then runtime opt-in registration and explicit uncertain-deletion continuation; full Git/Prism goal remains active.

### Current checkpoint: actual deletion inspection HTTP chain
- Replace proof-query test doubles with current web client, loopback DU controller/manager and actual Mongo/Redis.
- Use isolated records and keys; check default-off, false/true cache states, identity and durable-proof rejection.
- Full mutation/history-consumer integration remains next.

### Actual HTTP deletion inspection chain accepted
Added plan/git-deletion-inspection-native.cjs/.py. Runs exact current web DocumentUpdaterHandler in subprocess via loopback HTTP to copied current DU controller/manager/fence, actual Mongo and Redis. Uses UUID-isolated collections and prefixed Redis key schema. Validates default-off, missing marker false without repair, valid cleared true, leftover docLines false without eviction, mismatched HTTP acknowledgement rejection, soft-deleted metadata prerequisite and no-store409. All seeded collections/namespace Redis keys and copied modules cleaned; JS/Python syntax pass. Report plan/git-deletion-inspection-native.json/log. Scope explicitly seeded committed deletion records and read-only query only, not actual prepare/delete/history consumer chain. No service deployment or user documents/accounts changed. Next real DU preparation/docstore/history consumer integration into Git deletion service acceptance; full objective active.

### Current checkpoint: actual DU deletion preparation
- Exercise native web client/HTTP/DU manager against isolated Mongo reservations and clean Redis document cache.
- Check stale version rejection preserves content and exact request enters committing/fenced state once.
- This checkpoint deliberately excludes unflushed persistence/history execution until next integration.

### Actual native DU preparation from clean cache accepted
Added plan/git-deletion-preparation-native.cjs/.py, reusing isolated current-source DU HTTP and actual current web client harness. Real Mongo project/doc/reservation records and namespaced native Redis cache; no deletion receipt preseeded, native tree contains test doc. Default-off verified. Cache version4 vs reviewed3 rejects with409, removes only preparing reservation, leaves exact content/version and no Redis marker; reinsert reviewed reservation and version3 prepares through actual UpdateManager/DocumentManager/Redis fence to committing; same-operation retry preserves state/content. No storage soft-delete or file-tree mutation performed. Report plan/git-deletion-preparation-native.json/log; code/namespace records cleaned, syntax passes. Scope explicitly clean seeded cache: flush unmodified path skips persistence HTTP; dirty-cache flush and full native history/deletion execution still unverified. No deployment/user files/accounts changes. Next full native service chain with real storage/history and pending-edit behavior; overall goal active.

### Current checkpoint: Git deletion history provenance and consumer
- Fix native producer to attribute Git deletions correctly and verify current Git gate/order.
- Run actual history consumer on disposable creation/deletion events, inspect latest and prior snapshots, verify replay deduplication.

### Git deletion history provenance and native consumer verified
Fixed DU ProjectHistoryRedisManager.queueReviewedDeletion: explicit Git source validates operation/attempt/write/review identity, rejects mixed task fields, checks current project gate/version/history before enqueue, emits git-sync provenance instead of writing-assist. Legacy source behavior retained. Added producer regression;26 producer tests pass. Added plan/git-deletion-consumer-native.mjs/.py running actual copied UpdatesProcessor, Redis and history storage on disposable history. Creates original document then consumes duplicate deletion events; latest snapshot lacks file, old immutable snapshot retains exact content, later duplicate replay adds no history version. History/Redis/synthetic metadata removed; report plan/git-deletion-consumer-native.json/log. Scope queue seeded directly, not joined DU producer or full Git apply. Syntax checks pass; no deployment or user documents changed. Next joined Git service with real producer/consumer/docstore/DU preparation+cleanup and explicit recovery/runtime integration. Full objective remains active.

### Current checkpoint: creation after confirmed deletion
- Previous status-only turn made no implementation progress.
- Support prior confirmed native document deletion in creation authorization with exact identity/hash/version/history receipts.
- Test mixed structural progress, incomplete deletion and concurrent project changes; retain runtime defaults and full native-chain work.

### Creation authorization after confirmed native deletion
Fixed GitDocumentCreationAuthorization.mjs to accept preceding document deletion only with document-deleted receipt, exact document identity, original version/hash, null after content, cumulative tree version and persisted history version. Missing receipt now yields controlled409. Existing lifecycle/pending-history and second permission checks retained. Added3 regression tests: before/after creation commit and recovery following deletion,15 incomplete/corrupt/pending-state cases, and interleaved delete/create/create tree counting.209 combined Git/native deletion Node tests pass; scoped ESLint exits0. Evidence plan/git-mixed-creation-authorization-tests.log. Changed only creation authorization and its agent test plus task_plan.md/notes.md/log. No runtime settings, deployment, user documents or credentials changed. This closes one mixed-operation authorization gap, not full native deletion or browser acceptance. Next remains joined native deletion service/DU/history/docstore proof, explicit interrupted-stage recovery, runtime integration, binary support and full Git/Prism acceptance. Goal active.

### Current checkpoint: joined native creation and deletion acceptance
- Reuse actual creation/docstore/history fixture, then delete through current Git deletion service and native DU HTTP.
- Isolate project/admission collections and Redis namespace; verify storage metadata, history receipt and cache proof; remove disposable data.
- Keep clean-cache/fixture authorization limitations explicit; no deployment.

### Joined native creation then deletion verified
Added plan/git-deletion-joined-native.mjs/.py and git-deletion-joined-du.cjs. Copies current Git/native deletion dependencies, DU and history consumer into UUID subprocess paths in existing candidate (no deployment/restart). Real creation allocates docstore doc and history. Then explicit Git deletion service performs native DU HTTP preparation, transactional tree removal, real DU history producer/consumer, real docstore soft-delete, native Redis cleanup and read-only proof; committed reservation and journal confirmed. Latest immutable history snapshot lacks file; original snapshot retains exact text. Stable inspect returns identical completed receipt. Final successful rerun report plan/git-deletion-joined-native.json/log. Cleaned namespace cache, isolated Mongo collections, actual disposable docstore/history and copied modules. JS syntax checks pass. Initial harness failures: web-side cache schema lacked pathname; then web/DU cache configuration mismatch caused persistence fallback. Resolved by seeding clean cache within isolated DU sidecar; removed misleading parent cache assertion. Scope: fixture authorization and resync readiness, isolated project collections, clean seeded cache; no dirty-cache flush, browser, full apply settlement or deployment qualification. User manuscripts/credentials/settings untouched. Next explicit partial-deletion continuation and lifecycle/runtime integration, dirty-edit acceptance, binary support, full Git and Prism scope remain active.

### Current checkpoint: native deletion lost-response recovery
- Inject response loss after real prepare/history/storage/cleanup stages in isolated joined probe.
- Verify inspect leaves partial operation untouched and permission revocation blocks mutation; explicit continuation reuses original identities and produces one tree/history change.
- Keep public recovery routing and dirty-cache qualification open.

### Native deletion lost-response recovery matrix passed
Extended plan/git-deletion-joined-native.mjs/.py with --lose-response prepare|history|storage|cleanup. Each case first executes real stage then injects lost acknowledgement, verifies reservation committing/original write identity, inspect returns null without mutation calls, revoked fixture authorization rejects continuation, restores permission and explicitly reapplies same service operation in recovery-required state. All4 cases pass. Prepare invoked once in all; history requeued only after lost history acknowledgement (2 calls, unchanged persisted history version); storage PATCH repeated after storage/cleanup loss; cache cleanup repeated only after cleanup loss. Final tree version3, one reservation, completed replay adds no mutation calls, native journal confirmation succeeds, original history content remains exact. Reports/logs plan/git-deletion-joined-native-{prepare,history,storage,cleanup}.{json,log}; matrix plan/git-deletion-recovery-matrix.json. JS/Python syntax checks pass; disposable data removed each run. No production source/settings/deployment/user project/credential changes. This verifies underlying same-operation service continuation, not executor/controller/UI exposure. Reviewed GitApplyExecutor: reconcile only inspects; resume refuses unresolved inFlight. Next explicit native deletion continuation needs coordinated partial-state validation and lifecycle/public API integration. Clean seeded cache/fixture resync readiness and fixture permission remain limitations; dirty-edit handling and full Git/Prism objective remain open.

### Current checkpoint: partial deletion project validation
- Add explicit validator for an in-flight native deletion, distinguishing pre-tree and committed-tree states without fabricating completion/history receipts.
- Compare entire reviewed project and repository state; reject unrelated edits, wrong native receipts and other uncertain operations.
- Test before wiring executor recovery.

### Whole-project progress validation for partial deletion
Added validateDeletionRecoveryProgress to GitApplyProgressGuard.mjs. Explicit opt-in accepts only exact active in-flight native document deletion in applying/recovery-required, with explicit null native tree receipt before removal or exact write/doc/path/version/hash/resulting-tree receipt after removal. Reconstructs expected full project from immutable snapshot plus prior confirmed receipts and the pending tree mutation; does not invent history completion, append journal receipts or advance progress. Existing text/creation/structural validators still reject uncertain writes. Added3 tests covering both stages, collaborator content/version/identity changes, remote/binding drift, wrong active step/native receipts and disappearance without proof.212 combined Git/native deletion tests pass; scoped ESLint passes. Evidence plan/git-deletion-recovery-progress-tests.log. Changes limited to guard/test and task_plan.md/notes.md/log. This is an internal prerequisite, not recovery API wiring; caller must read native receipt and authorize exact reservation under project lock and retained admission. Next executor/service continuation needs this validator plus native stage authorization and explicit mutation endpoint/UI. No runtime enabling/deployment/user files/account changes; full Git/Prism goal remains active.

### Current checkpoint: explicit executor deletion continuation
- Add opt-in recovery coordinator dependency that must hold native lock and validate partial project state.
- Re-read exact attempt/step inside coordination, continue only original deletion, confirm journal and stop.
- Verify no retry through reconcile, no new claim, no following writes, and failure/changed-state rejection.

### Explicit executor continuation for interrupted deletion
GitApplyExecutor now offers continueDeletion(projectId, operationId, userId), gated by explicit coordinateDeletionRecovery dependency. Ordinary executors reject by default. Validates active uncertain native document deletion, authorizes before/inside coordination, rereads exact attempt/index/inFlight/plan/prior receipts, invokes original adapter with null content and same write/attempt identity, requires full deletion receipt and journal confirmation, then stops without advancing remaining files. Exceptions mark same step uncertain. Reconcile remains inspection-only. Added4 test groups for identity/no extra claim/no following writes, absent coordinator/collaborator rejection/revoked access, durable state races, and repeated failure/incomplete proof/journal rejection.216 combined Git/native deletion tests and scoped ESLint pass; evidence plan/git-deletion-continuation-tests.log. Changed executor/test plus task_plan.md/notes.md/log only. Not wired into GitApplyService/controller/runtime/UI: native coordinator still must read partial deletion receipt/reservation and apply whole-project recovery guard under project lock. No deployment/settings/user files/credentials changed. Next service coordinator, recovery route/UI and actual endpoint acceptance; dirty-cache/binary/full Git and Prism objective remain open.

### Current checkpoint: native recovery context and service coordinator
- Read exact native reservation/tree receipt under authorization, without mutations.
- Wire explicit apply-service continuation under project lock and full recovery-progress validation; retain disabled runtime.
- Test coordination and native context in isolated lost-response probes.

### Apply service deletion recovery coordination
GitDocumentDeletionService now exposes readRecoveryContext: verifies native Git authorization, exact bound reservation/write, reads native tree receipt on primary, reauthorizes and rejects stage/context changes. Read-only, no replay. GitApplyService registers executor continuation only for an adapter with this method, holds withProjectLock, verifies apply gate owner/attempt/original tree, reads exact context, preview/repository/recovery snapshot/current full project, uses validateDeletionRecoveryProgress, then executes same deletion and journal confirmation under lock. Exposes internal continueDeletion method; no controller/runtime/UI activation. New git-deletion-continuation-service.test.mjs covers both structural stages and rejection of collaborator edits, tree drift, wrong owner/kind/attempt, missing context and remote changes before adapter mutation.218 combined tests pass. ESLint initially flagged3 multi-variable declarations in new test; fixed declarations and scoped ESLint/retest pass. Extended joined native probe to verify real readRecoveryContext before/after removal and denied permission without mutations; prepare/history lost-response native reruns pass, disposable data cleaned. Logs plan/git-deletion-recovery-service-tests.log and updated git-deletion-joined-native-{prepare,history}.{json,log}. Changed GitDocumentDeletionService.mjs, GitApplyService.mjs, new service test, joined harness, task_plan.md/notes.md/reports. No deployment/settings/account/user document changes. Scope limitation: service coordinator test uses substituted snapshots/lock; native probe tests deletion service context rather than actual GitApplyService/native snapshot route. Next full native coordinator and HTTP/UI integration, lifecycle teardown and dirty-cache handling; full Git/Prism objective remains active.

### Current checkpoint: explicit deletion recovery API and controls
- Add authenticated POST action and allowlisted availability from actual registered service capability.
- Show separate continue-deletion button only for supported uncertain document deletion; never auto-replay.
- Verify backend response and frontend interaction/error behavior. Runtime deletion stays unregistered pending native coordinator/lifecycle qualification.

### Deletion continuation API and frontend control
Added authenticated POST /project/:projectId/git-sync/previews/:operationId/application/continue-deletion using existing controller UUID/session/no-store/public response path. GitApplyService exposes deletionContinuationEnabled only when native adapter recovery context exists. Public response advertises canContinueDeletion only for that capability plus active unconfirmed native document deletion; default response shape unchanged. ApplicationControls shows separate Continue interrupted deletion button only on server capability plus matching uncertain file/status, uses explicit POST, and queries same-operation status after failure without replay or resuming later files. Added public response capability tests and3 frontend interaction cases.219 combined backend tests (see git-deletion-recovery-api-tests.log),33 Git frontend tests, scoped ESLint pass. Initial attempt used Vitest frontend filter and ran0 tests; corrected to NODE_ENV=test TZ=GMT npx mocha --timeout5000 --exit --require test/frontend/bootstrap.js test/frontend/features/git-sync/*.test.tsx and confirmed33. Changed GitApplyService.mjs, GitApplicationResponse.mjs, GitSyncController.mjs, GitSyncRouter.mjs, application-controls.tsx, git-application-response.test.mjs, application-controls.test.tsx plus planning/log. No deployment/settings/user documents/credentials changed. Native runtime still registers no deletion adapter, so capability remains false and new button hidden in live candidate. HTTP/session/CSRF integration and full native snapshot coordinator acceptance not yet run for new endpoint; these remain required along with teardown/dirty-edit/binary support and full Git/Prism goal.

### Current checkpoint: native apply-service recovery coordination
- Extend isolated joined probe to invoke GitApplyService continuation under native LockManager and native snapshot reader/DU HTTP.
- Check both pre-tree and post-tree interruption, journal advancement and no following execution.
- Keep synthetic repository/review and clean-cache scope explicit.

### Native apply-service coordinator: post-tree passes, pre-tree gap reproduced
Extended plan/git-deletion-joined-native.mjs/.py with --coordinator and test-side DU GET document route. Recovery now invokes actual GitApplyService/GitApplyExecutor under native sequentialProjectStructureUpdateLock, reads isolated native Mongo tree using current createProjectSnapshotReader, actual web DU HTTP document client, actual deletion service/storage/history/Redis and journal. Fixture repository/review/recovery map/permission/resync readiness remain substituted. Post-tree history-response-loss case passes: one native project lock, original deletion confirmed once, no next-file execution, second continuation rejects, exact historical original retained, disposable data removed. Evidence plan/git-deletion-joined-native-coordinator-history.json/log. Pre-tree prepare-response-loss case FAILS before mutation: ordinary snapshot GET enters DocumentManager.getDocAndRecentOpsWithLock -> DocumentDeletionFence.withOperation and returns DOCUMENT_DELETION_FENCED. Evidence plan/git-deletion-joined-native-coordinator-prepare.log; no success report. This contradicts broad pre-tree service qualification from substitute-only tests; retain disabled runtime. Correct next fix is operation-bound read-only cache snapshot verification for the exact reserved deletion, not relaxing normal deletion fence or trusting archived bytes as live state. Need enforce native reservation/project identity, Redis generation/marker and doc lock, no load/flush/cache mutation, then scoped snapshot-reader override for only that doc. JS/Python syntax pass; failed probe finally removed synthetic data. Changed only3 joined probe files and task_plan.md/notes.md/reports. Full HTTP/login/CSRF, dirty cache, lifecycle/binary and Git/Prism completion remain open.

### Current checkpoint: reserved document read-only snapshot primitive
- Add atomic Redis read validating operation marker, project, document version/path and captured server generation.
- Never reload or mutate cache; fail when evidence is missing or differs.
- Verify real Redis rejection cases and unchanged keys before connecting durable authorization/HTTP/snapshot reader.

### Atomic reserved-document snapshot read primitive
Added readReservedSnapshot to DU DocumentDeletionFence.js with read-only Lua. Within captured operation generation, atomically requires exact deletion marker, raw document version, project identity, matching pathname (native leading slash supported) and present serialized lines; returns serialized snapshot without SET/DEL/load/flush. Rejects invalid input and missing operation context. Caller still must validate exact durable reservation and project authorization under native doc lock. New plan/git-deletion-snapshot-native.cjs/.py passes actual Redis exact-content and8 missing/wrong identity/cache cases, verifies all keys unchanged on success/rejection, simulates generation mismatch and confirms no mutation. Report plan/git-deletion-snapshot-native.json. Existing11-key cleanup inspection regression rerun passes (git-deletion-cache-native.json); JS syntax passes. Isolated UUID keys and copied code removed. Changed fence primitive/new native probe and task_plan.md/notes.md/reports only. No HTTP route/native manager authorization/snapshot-reader integration yet; this primitive alone does not fix pre-tree GitApplyService recovery. Next add exact-reservation authorized snapshot manager and private endpoint, web client/scoped reader, then rerun previously failing native coordinator case. No deployment/account/user data changes; full goal active.

### Current checkpoint: durable authorization for reserved snapshot reads
- Add doc-lock protected Git-only snapshot read with exact reservation, current project gate/membership/tree and live storage metadata checks.
- Validate cached text/hash and recheck durable state before returning; no document mutation.
- Test denial and concurrent state changes before HTTP integration.

### Durable reserved snapshot authorization in DU manager
Added DocumentDeletionManager.promises.readSnapshot. Validates Git-only fenced/committing reservation and exact IDs/write/review/content binding, holds native document lock and captured fence generation, checks current apply gate and member access, absence of deletion tree receipt/teardown/pending history, unique matching native doc path/identity and nondeleted storage metadata. Calls atomic readReservedSnapshot, parses bounded native text representation, verifies SHA256 against reservation, then rereads durable state/membership and rejects any signature change. Does not use document loader, flush, cache mutation or reservation writes. New ReservedSnapshotTests.js adds17 cases incl success,14 pre-cache denial states, malformed/changed text and mid-read revocation/binding change; all40 manager tests pass; Node syntax passes. First attempt to insert tests used repository-relative path with DU cwd and failed before write; corrected by creating new test file from repository root and reran real new tests. Changed DU DocumentDeletionManager.js, new manager test and task_plan.md/notes.md only. No private HTTP/web client/scoped project snapshot wiring yet, so pre-tree coordinator failure remains pending. Next expose default-off internal read endpoint, validate web acknowledgement, scope snapshot override to exact doc/operation and rerun native coordinator prepare case. No deployment/user data/accounts changed; full goal active.

### Current checkpoint: connect reserved snapshot read to native recovery
- Add default-off private read route and bounded validated web client.
- Scope project snapshot override to the exact reviewed deletion doc/write; other docs use normal reader.
- Run unit checks and rerun previously failing native pre-tree coordinator.

### Reserved snapshot HTTP/client/scoped reader integration fixes pre-tree recovery
Added default-off private DU GET /project/:project_id/doc/:doc_id/deletion/:operation_id/snapshot. Uses readSnapshot authorization, no-store, allowlisted result and sanitized identity/generation/conflict errors. Web readDocumentDeletionSnapshot validates exact identifiers, text/size/version/path/SHA256 and returns allowlisted fields with bounded request timeout. createProjectSnapshotReader accepts optional internal deletionRecovery doc/write context and configured reserved reader; only matching doc uses it in both snapshot passes, all others normal. Native project reader registers actual web client. GitApplyService supplies context only for active authorized pre-tree deletion; post-tree reads remain ordinary. Extended isolated DU/probe and reran real native coordinator: previously failing prepare-loss case now PASSES with1 project lock,2 reserved document reads,1 call each prepare/history/storage/cleanup, confirmed journal and preserved original history. Post-tree history-loss regression also passes. Disposable data removed; report git-deletion-joined-native-coordinator-{prepare,history}.json/log.220 backend tests,155 DU manager/controller tests,71 web-handler tests pass. Scoped ESLint initially flagged3 test declaration styles; --fix resolved them, exit0; DU syntax passes. Changed DU app.js/HttpController.js, Web DocumentUpdaterHandler.mjs, GitProjectSnapshot.mjs/GitNativeProjectSnapshot.mjs/GitApplyService.mjs,3 tests (DU HttpControllerTests, web handler test, git-project-snapshot),2 joined probe files plus task_plan.md/notes.md/logs. Native probe still uses fixture repository/review/recovery map, permission/resync readiness and clean cache; not live login/CSRF/UI or dirty-edit qualification. Runtime deletion remains unregistered/default-off. Next lifecycle teardown/dirty-cache and full authenticated Git interface acceptance; binary/branch collaboration and full Prism goal still open. No deployment/user manuscripts/credentials changed.

### Current checkpoint: Git deletion records during project teardown
- Separate Git records from AI task-based drain logic.
- Permit only committed Git deletions whose original operation is terminal and journal/native history/storage evidence matches; unfinished Git operations remain blocked.
- Add service integration and regression tests without executing project removal.

### Git deletion settlement proof during whole-project teardown
Added GitDeletionTeardownProof.mjs read-only verifier: committed exact Git binding, original operation terminal files-applied/partially-applied with no inFlight, same attempt/review, matching reviewed deletion and confirmed journal proof, no active project Git gate, matching native tree/history receipt, old doc absent from tree and storage soft-deleted. DocumentDeletionTeardown handles Git rows separately and requires verifier/current committed binding, reauthorizes removal, never calls readTask(undefined), resumes Git work or settles fabricated AI tasks. Native TeardownService wires primary Mongo evidence reads. Unfinished/mismatched Git deletion blocks removal. Added teardown dispatch regression and proof tests;223 combined tests/scoped ESLint pass (plan/git-deletion-teardown-tests.log). Joined native coordinator history-loss probe now verifies proof false while apply gate retained, finishes files using actual AtomicApplyLifecycle snapshot/majority transaction, then proof true. Does not actually remove a user project; repository binding settlement omitted in synthetic fixture. First probe failed because new verifier imported stale container reservation module; extended isolated dependency relocation glob, rerun passed and synthetic data removed. Report plan/git-deletion-joined-native-coordinator-history.json/log. Changed new GitDeletionTeardownProof.mjs, DocumentDeletionTeardown.mjs/Service.mjs,2 tests, joined probe mjs/py and planning/evidence. No runtime enable/deployment/user manuscripts/accounts changed. Native whole-project deletion route itself remains to qualify; dirty-cache, full authenticated Git UI, binary/branches and full Prism goal still open.

### Current checkpoint: reject newer unflushed edits in native Git deletion
- Seed a newer unflushed editor snapshot after immutable review in isolated real docstore/history fixture.
- Execute real deletion service/DU preparation; require rejection, original tree/storage and newer cache content preservation, retained Git admission.
- This tests pending cache representation, not browser edit generation or successful dirty flush.

### Native deletion rejects newer unflushed editor state
Extended isolated joined probe with standalone --stale-edit. Real creation first produces actual docstore/history and reviewed Git delete at version0; test-only DU cache seed then writes newer text/version1 and unflushed timestamp. Actual Git deletion service + native DU HTTP preparation returns409 before flush/tree/history/storage/cleanup. Verified reservation preparing row removed, original native doc still in tree/version2, original Git admission retained, no deletion history pending, ordinary native DU read returns exact newer text/version1, docstore still exact original/version0/nondeleted, history version unchanged. Stage calls prepare1/history0/storage0/cleanup0. Report plan/git-deletion-joined-native-stale-edit.json/log passes, disposable records/storage/history/cache/copies removed. JS/Python syntax pass. Changed only joined probe mjs/py/DU helper and task_plan.md/notes.md/report; no production source/deployment/user data/accounts changed. Scope explicitly seeded dirty cache, not browser-generated OT edit or successful dirty flush. Inspected actual persistence path: DU flushDocIfLoaded -> PersistenceManager POST -> private DocumentController.setDocument -> ProjectEntityUpdateHandler.updateDocLines -> Docstore. Next positive dirty-flush qualification needs real native project visibility through that private web path, without replacing it with direct storage mocks. Full Git/Prism goal active.

### Current checkpoint: native reviewed dirty-cache persistence
- Previous status-only turn made no implementation progress; resume pending positive flush qualification.
- Use one fresh named native project so real private Web persistence can resolve it.
- Seed reviewed dirty version, verify stored exact bytes after prepare before tree deletion, then recover same operation.
- Cleanup only fresh project ID/name; never drop shared projects. Browser OT generation remains outside this probe.

### Native reviewed dirty-cache flush and retained bytes qualified
Extended plan/git-deletion-joined-native.mjs/.py and joined-du.cjs with --dirty-flush --coordinator --lose-response prepare. Creates fresh UUID/name guarded native projects record, all operation collections/cache namespaces isolated. Seeds reviewed changed version1 while stored original is version0, invokes actual DU preparation -> PersistenceManager -> authenticated native private Web endpoint -> Docstore. First run failed401 because subprocess lacked service credentials; load existing WEB_API_USER/PASSWORD privately from container environment before settings, pass only to child environment, never log credentials. No production configuration change. Verified exact reviewed bytes/version persisted while native tree still contains document, lost successful prepare response, exact reserved snapshot reads under native project lock, same-operation continuation, one call each prepare/history/storage/cleanup, journal confirmation and atomic gate settlement. Added final include_deleted peek verifying exact reviewed version1 remains recoverable after soft deletion. Original creation history content remains exact. Final probe passes and removes fresh project by ID+name (never drops shared projects), isolated storage/history/cache/collections/copies. Evidence plan/git-deletion-joined-native-dirty-flush-coordinator-prepare.json/log; JS/Python syntax checks pass. Inputs current native service code; changed only three probe files plus task_plan.md/notes.md and evidence. No user manuscripts, stable account, production sources or deployments changed. Limit: seeded dirty cache, fixture repository/permission/resync, no browser OT generation or new-edit history event. Next actual OT/browser concurrent editing and full authenticated Git UI/runtime qualification; binary and branch collaboration remain open. Full Git/Prism goal not complete.

### Current checkpoint: native OT edit before reviewed deletion
- Previous turn made verified progress on dirty persistence. Add actual UpdateManager locked text edit and drain native history queue.
- Verify edited history snapshot, dirty-cache persistence and retained bytes; keep browser/session acceptance distinct.

### Native OT edit and exact history before Git deletion passed
Extended three joined probe files with --native-edit requiring --dirty-flush --coordinator --lose-response prepare. Fresh named project starts from original clean cache; release fixture creation admission, invoke actual UpdateManager.promises.lockUpdatesAndDo/applyUpdate with ShareJS delete+insert op, document identity, version0 and user metadata. Verify actual DU HTTP snapshot version1, then drain native namespaced history queue using current UpdatesProcessor and check edited history snapshot exact text at history version2. No edited cache bytes or history payload are synthesized after applyUpdate. Subsequent reviewed deletion validates actual dirty cache, flushes through private native Web endpoint, recovers lost prepare response under project lock, confirms original identities/journal, preserves reviewed soft-deleted docstore bytes and original history. Report plan/git-deletion-joined-native-native-edit-dirty-flush-coordinator-prepare.json/log passed, disposable data removed; JS/Python syntax pass. Initial failures were test harness mistakes: callbackified UpdateManager instead of promises; missing getDocument fromVersion caused NaN range (not actual cache inconsistency); missing update.doc rejected by history translator. Corrected all without weakening native guards. Changed only probe mjs/py/DU helper, planning and evidence, no production sources/settings/accounts/manuscripts. Still seeded initial cache and fixture repository/authorization/resync; browser/session and simultaneous-user OT acceptance remain incomplete. Next actual concurrent edits/browser Git acceptance and runtime capability registration, then binary/branch requirements. Full objective active.

### Current checkpoint: opt-in native deletion runtime wiring
- Prior native OT/persistence/history acceptance passed; connect native deletion service behind new default-off deletionEnabled flag.
- Register real primary collections, bounded history resync reader and realtime removeEntity notification.
- Preview permits only native documents when capability enabled; binary attachments stay explicitly blocked. Validate tests and syntax without enabling deployment.

### Opt-in native document deletion registered in Git runtime
GitSyncRuntime now registers createDocumentDeletionService only when gitSync.deletionEnabled===true; default settings explicitly false. Uses same-client projects/operations/docs/documentdeletionreservations collections, native transaction/auth/DU/docstore, bounded native history readiness/version reader, and realtime removeEntity event tagged git-sync. Cross-checked actual DU mongodb collection is lowercase documentdeletionreservations (corrected initial camelcase wiring before qualification). Runtime passes deletionAdapter to apply service and publishes deletion capability; preview permits only native document paths with exact true flag, blocks attachment deletion and disabled cases. DocumentHistoryReader adds validated bounded resync-pending GET; local real HTTP test verifies false/true/503 and invalid identity rejection without request. Added preview capability test, updated service registration comment. Combined backend224 passed before added HTTP test; focused final4 tests pass in git-deletion-runtime-capabilities.log, scoped ESLint and syntax pass. Changed production files GitSyncRuntime/GitDocumentHistoryReader/GitDocumentDeletionService/GitPreviewAvailability and settings.defaults.js, two agent tests and planning/logs. No deployment or user data/account changes. Registration is now present but default-off, requires matching DU reviewedDeletionEnabled. Native service probes already passed, but actual authenticated runtime/CSRF/browser acceptance and notification behavior remain to verify before enabling any demo. Full Git/Prism completion remains unproven; binary and branch workspace features open.

### Current checkpoint: browser live Git deletion notification
- Prior runtime registration progressed; verify real login/file tree consumes native git-sync removeEntity without reload.
- Use fresh named fixture, no open document to avoid mixing browser live DU cache with isolated DU namespace.
- Keep full Git UI action and open editor closure qualification separate.

### Logged-in browser receives Git deletion file-tree event
Added plan/git-deletion-joined-browser.py based on isolated joined runner and existing creation browser flow; uses stable private test account, Playwright via uv run --with playwright, fresh named native project owned by fixed test owner, interactive ready/deleted gates. Joined native harness emits actual EditorRealTimeController removeEntity(docId, git-sync), same event as runtime registration. Browser opens project, asserts new.tex exists, waits without navigation/reload, asserts file disappears and captures screenshot. Native coordinator dirty-flush/lost-prepare proof passes as before and fresh project/storage/history/cache/collections/copies cleaned. Report and visually inspected screenshot plan/git-deletion-joined-browser-dirty-flush-coordinator-prepare.{json,png}; log same prefix. System Python lacked playwright; used existing uv package environment, no global install. Changed joined native mjs/new browser py and planning/artifacts only; no production deployment/user manuscript/account changes. Browser deliberately never opens document, avoiding mixing production DU cache with isolated DU cache; screenshot confirms no selection/empty tree. This proves authenticated socket delivery and live file-tree removal, not clicking Git panel apply, real repository review/auth/CSRF, open editor closure, or browser concurrent edits. Next native runtime/controller/full Git browser integration remains. Full goal active.

### Current checkpoint: real Git deletion preview and recovery archive
- Extend joined native coordinator with actual local commits, preview service, immutable recovery store and atomic admission.
- Preserve same-operation native recovery checks; verify review plan is generated from repository instead of fixture fingerprints.

### Real repository deletion review/archive/settlement passed
Joined native runner now supports --repository with coordinator: creates isolated local Git baseline containing reviewed bytes and a second commit deleting new.tex, actual createRepositoryReader/createSyncPreviewService/createSyncOperationStore/createRecoveryStore, native live project snapshot reads, generated delete plan/doc identity and immutable archived bytes. Atomically claims native admission and journal under project lock, uses journal-generated write ID, runs same native deletion lost-prepare/continuation checks against real preview/archive/ref. Adds isolated binding record and passes bindings into actual AtomicApplyLifecycle finishFiles; verifies baseCommit advanced to plan remoteCommit and revision2. Combined run --repository --native-edit --dirty-flush --coordinator --lose-response prepare passes, preserving original and edited history, dirty bytes before/after deletion, exact step identity, one call per deletion stage, cleanup of temporary repo/project/storage/history/cache/collections. Report plan/git-deletion-joined-native-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Initial failure was old global read-count assertion (8 vs2 because preview/planning reads are now real); fixed assertion to measure recovery-only read delta2, retaining total8 in report. Syntax checks pass. Changes two joined probe files plus planning/evidence only, production/default-off deployment/accounts/manuscripts unchanged. Scope: actual local Git review/archive and atomic claim/settlement, initial execution invokes deletion service directly before actual apply-service continuation; authorization and resync readiness still fixture, not full runtime HTTP/login/CSRF or external GitHub. Full requested Git/Prism goal remains active.

### Current checkpoint: normal apply-service entry for native deletion
- Previous repository/archive probe passed. Add full apply option letting executor claim/start/mark uncertain; continue same operation and finish via resume.
- Inspect checkedContent normalization: missing merged deletion becomes explicit null already; no production fix needed there.

### Normal Apply/Continue/Resume with native permissions and history readiness passed
Joined native runner --full-apply requires --repository; skips test-side begin/startStep and invokes actual GitApplyService.apply using prepared review revision. Executor generates attempt/write IDs and marks recovery-required after injected successful prepare response loss; probe reads these durable identities rather than inventing them. continueDeletion confirms original step; normal resume validates post-deletion project and calls actual atomic lifecycle/binding settlement/gate release. Also replaced fixture project authorization with actual AuthorizationManager for native project (stable existing test owner, no account change), verifies unauthorized random user gets403 before preview. History resync readiness now uses actual bounded native /resync-pending endpoint via DocumentHistoryReader; history consumption remains isolated current-code worker. Final full run --full-apply --repository --native-edit --dirty-flush --coordinator --lose-response prepare passed,3 native project locks/12 snapshot reads/one mutation per stage, original and edited history/store bytes preserved, repository baseline revision2. Evidence plan/git-deletion-joined-native-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Changed two probe files/planning/evidence only; no production code/settings/deployment/user manuscripts/credentials. Initial inspection of deletion content dispatch confirmed checkedContent already normalizes missing merged paths to null; no speculative source fix made. Scope remains real local repository and native service orchestration with isolated operation/cache/history collections; not runtime HTTP/session/CSRF/frontend Apply click or external GitHub. PermissionRevocationChecked remains injected refusal, distinct from native unauthorized-user test. Full Git/Prism goal active.

### Current checkpoint: real HTTP controller over native apply service
- Prior full service probe passed. Add isolated loopback Express server with native requireLogin/controller and injected test sessions.
- Verify anonymous401, outsider403, malformed IDs rejected, response allowlist/no-store, apply interruption/status/continue/resume requests.
- Session injection is test-only; real cookie/CSRF acceptance remains separate.

### Loopback HTTP controller native deletion workflow passed
Added --http requiring --full-apply to joined native runner. Isolated Express loopback server uses current createGitSyncController with actual application service and native AuthenticationController.requireLogin; test-only session middleware injects actor from a probe header. Real HTTP POST Apply with forged body userId still acts as session owner, injected successful prepare loss yields500 then GET status200/no-store/strict public key allowlist/canContinueDeletion. POST continue-deletion200 confirms step and hides continuation; POST resume200 finishes files and atomic repository baseline settlement. Anonymous GET401, native nonmember403, invalid operation UUID404 (matches native InvalidParamsError mapping). Test error handler maps native validation classes but is not full application error middleware. Initial harness errors corrected: static controller import initialized settings before private environment loading (history401); native401 is text not JSON; InvalidParamsError maps404 rather than400. Final command --http --full-apply --repository --native-edit --dirty-flush --coordinator --lose-response prepare passed and all disposable data removed. Evidence plan/git-deletion-joined-native-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Changed2 probe files/planning/evidence, no production code/settings/manuscripts/accounts/deployment. Scope explicitly injected session, loopback endpoint composition rather than production GitSyncRouter/global CSRF/session store; no browser Apply click or external GitHub. Next cookie/CSRF/full runtime and GUI integration; full goal active.

### Current checkpoint: real login cookie and native CSRF
- Previous HTTP probe passed with injected sessions. Add optional Playwright login and transport cookie privately over stdin.
- Use native Redis session store/session secret and Csrf middleware in isolated HTTP probe; reject missing/bad CSRF before mutations.
- No credential values in logs/argv; full production runtime/router and GUI remain separate.

### Actual login cookie/native Redis session/CSRF workflow passed
Added --session requiring --http --dirty-flush. Python Playwright logs in existing fixed account on18081, keeps cookie only in memory and sends JSON via subprocess stdin (not argv/log/files). Node loads existing CRYPTO_RANDOM privately before settings (actual settings.js sessionSecret uses OVERLEAF_SESSION_SECRET||CRYPTO_RANDOM), uses express-session with actual cookieName/secret and native CustomSessionStore/UserSessionsRedis plus Csrf.middleware. No actor injection in session mode. Anonymous/corrupt-cookie GET401, invalid UUID404; missing and wrong CSRF POST403 leave operation ready. Authenticated read-only probe token endpoint supplies req.csrfToken; valid token then drives actual controller Apply/interruption/status/continue/resume and native repo/OT/archive/settlement flow. Final uv run --with playwright python plan/git-deletion-joined-native.py --session --http --full-apply --repository --native-edit --dirty-flush --coordinator --lose-response prepare passes; realLoginCookieAndCsrf=true, injectedSession=false. Report/log plan/git-deletion-joined-native-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare. Initial failures missing SESSION_SECRET file/secret resolved by inspecting only configuration key expressions; no secret values printed. Broad grep encountered service filesystem traversal and was stopped by exact owned command match; terminal143 verified. Fresh disposable project/repo/data cleaned; ordinary test login session uses native expiry, not claimed removed. Changed two harness files and planning/evidence only, no production deploy/account changes/manuscripts. Still isolated HTTP route composition with runtimeProvider service injection and isolated history/cache; production GitSyncRouter registration and browser Apply controls not yet exercised together. Full Git/Prism goal active.

### Current checkpoint: production route registration in cookie/CSRF probe
- Use unchanged GitSyncRouter.apply against loopback server, substituting controller service dependencies only within test subprocess.
- Preserve actual route login middleware rather than a global test login gate.
- Verify POST-only recovery endpoint, invalid review body and no mutation on rejected requests; rerun native workflow.

### Unchanged production GitSyncRouter registration passes real session workflow
Replaced hand-built4 HTTP routes in joined probe with unchanged GitSyncRouter.apply. Temporarily assign factory controller handlers to default exported object during synchronous registration, restore object immediately; service dependencies remain isolated test runtime, production source unchanged. Removed global login gate so route's actual requireLogin is tested; native Csrf runs globally and token helper has own login. Added GET continue-deletion404 (POST-only), valid-token negative review revision400 with operation still ready. Full actual-login/cookie/native-session/CSRF/repository/native-OT/apply/continue/resume run now passes and report productionGitRouterRegistration=true. Failure investigation: anonymous requests now cause CSRF session save, uncovering missing cookie-parser in test composition; CustomSessionStore.set needs sess.req.signedCookies. Added native cookieParser(settings.security.sessionSecret), matching cookie options and15s per-request AbortSignal. First unbounded request hit outer90s subprocess timeout and left actual Node/DU alive; verified PIDs12783/12799 and exact prefix git_joined_a224c103365540a2a3a1de8f7c16234a before stopping them. Scoped cleanup plan/git-deletion-interrupted-cleanup.mjs removed fresh project6ae602d7934a50eeddbc29af/docstore/history/prefixcollections; sidecar SIGTERM cleared its cache. Recovery manifest ownership verified before removing /tmp/git-deletion-repository-VwnhyG. Later bounded failed run exited cleanup normally, final run passed and disposableDataRemoved true. Evidence updated plan/git-deletion-joined-native-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log. Changes harness/planning/cleanup artifact only; no live deployment/account/manuscript changes. HTTP routes now actual production registration, but runtime provider still assembled service, no browser Apply control click/external GitHub. Full goal active.

### Current checkpoint: prevent loss of annotated documents during Git deletion
- Previous route/session probe passed. Current Git recovery archive contains text/version only, not comments/tracked ranges.
- Block Git deletion during native preparation if current ranges contain comments or changes; remove only preparing reservation, preserve cache/document/history.
- Test annotated states and unchanged legacy behavior; preview-specific feedback/annotation-preserving archive remains open.

### Git annotated-document deletion guard added
Inspection found Git recovery snapshot/archive currently stores text/doc versions without annotation ranges; native deletion preparation had no Git annotation-specific gate. DocumentDeletionManager.prepare now checks current snapshot.ranges.comments/changes after draining outstanding edits under native doc lock, before flush/fence/tree mutation. Git rows with nonempty annotations reject409 with actionable error; only preparing reservation removed, fenced recovery record retained. Legacy AI deletion behavior unchanged. Added4 unit cases (comments, changes, fenced recovery, empty ranges) verifying no flush/fence/update and preservation;159 DU manager/controller tests pass in plan/git-deletion-annotations-tests.log. Complete real-login/CSRF/production-router/full-apply/native-OT/local-repository recovery regression rerun passes, temporary data removed. Changed DU manager and unit test plus planning/logs, no deployment/user data. Initial edit command used wrong cwd and wrote checkpoint to service-local task_plan.md; verified exact newly created content, moved to root canonical plan and removed only that accidental file, then edited actual sources and ran tests. Scope: guard for current native snapshot at initial/fenced preparation. Existing committing receipts and missing-cache fenced recovery aren't newly qualified for annotations; full annotation-preserving archive and early preview feedback remain open. This restriction prevents newly reviewed annotated documents from being deleted without recovery support, not a claim of full annotation synchronization. Full Git/Prism goal active.

### Current checkpoint: annotation-aware Git deletion preview
- Record boolean annotation presence in immutable document metadata without exposing comment text.
- Detect presence changes during snapshot/plan validation and block annotated deletion before claim.
- Show per-file preview reason; retain native under-lock guard for later races.

### Annotated deletion is blocked at preview and planning
GitProjectSnapshot records optional hasAnnotations:true from comments/changes, rereads presence in optimistic second pass and rejects annotation-only presence races even if text/version unchanged. GitRecoveryStore validates optional boolean metadata, keeping old snapshots compatible without archiving annotation text. GitApplyPlan includes presence in reviewed document identity and rejects deleting annotated documents before journal claim; GitPreviewAvailability emits per-file reason even when deletion capability enabled. Existing ApplicationControls displays blocked reasons and disables Apply, so no frontend source change needed. Added snapshot metadata/privacy/race, apply-plan rejection/stale-review and preview reason tests.228 combined Git/native-deletion backend tests pass (plan/git-annotation-preview-tests.log); scoped ESLint passes. Changed4 Git modules and3 tests plus planning/logs. No deployment/user manuscript/account changes. Native under-lock guard still protects later races. Full annotation-preserving archival/restoration not implemented; text modifications continue existing native OT handling, not newly qualified here. Actual full-runtime/browser UI acceptance, binary support, branches and overall Git/Prism goal remain open.

### Current checkpoint: actual ApplicationControls against native HTTP
- Bundle current component with actual fetch-json, no simulated transport.
- Serve component from isolated authenticated probe; Playwright forwards requests to actual container HTTP endpoint and clicks Apply/Continue/Resume.
- Keep full editor/runtime-provider and external GitHub limitations explicit.

### Real ApplicationControls browser clicks drive native session HTTP workflow
Added plan/git-application-native-ui/entry.tsx bundled with actual ApplicationControls, git-sync.css and fetch-json (no simulated responses), plus plan/git-application-native-ui.py interactive runner. Current joined native HTTP server serves authenticated component fixture, browser obtains CSRF from native middleware. Playwright logs in fixed account; same cookie travels privately over stdin; browser traffic relayed via Docker fetch to actual isolated HTTP port because Mac host cannot directly reach container loopback. Relay preserves method/body/CSRF/cookie, returns actual response without synthesizing state. Browser clicks Apply reviewed changes; injected native prepare acknowledgement loss returns failure, real component auto-GETs same-operation status and enables Continue interrupted deletion; clicking confirms1/1; Continue remaining changes finishes native lifecycle/binding settlement. Browser pageErrors=[], screenshot visually inspected at1000x800. Full native repository/archive/OT/history/persistence checks and cleanup pass. Evidence plan/git-application-native-ui/run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json/log and completed.png. Added ui gating to joined native mjs and current component bundle/runner; no production frontend logic changes/deployment/user manuscript/account changes. Existing generic report scope says no full UI action; specifically this now qualifies actual application-controls actions, still not full editor GitSyncView or getGitSyncRuntime factory/full live collection setup or external GitHub. Source report now includes browserScope to clarify future runs. Full goal remains active; branch workspaces/binary/other Prism requirements still open.

### Current checkpoint: production Runtime deletion capability qualification
- Prior actual component/native HTTP passed. Update existing guarded native API probe for23 routes and new continuation endpoint.
- Instantiate actual getGitSyncRuntime with default/off/on deletion flags; verify public capability follows real adapter registration.
- Keep native manuscript read-only; only UUID-scoped test operation and existing synthetic credential probe records, cleanup in finally.

### Actual Git Runtime factory capability and authorization qualification passed
Updated guarded existing plan/git-sync-api-native.py for23 native routes and continueDeletion. Uses actual getGitSyncRuntime (no factory replacement): verifies apply disabled404; apply on/deletion off gives no registered continuation or public deletion capability; deletion true registers native deletion service and advertises exact supported uncertain delete; toggling off removes public continuation; internal write IDs/recovery paths stay absent. Route exactly POST. Probe found actual nonmember continuation returned409 before auth when capability disabled. Fixed GitApplyExecutor.continueDeletion to await project write authorization before capability check, without reading journal. Added regression asserting403/no read. Executor15 tests and scoped ESLint pass; native runtime probe now passes all owner/nonmember/flag/publicresponse/credential and push checks. Artifact plan/git-sync-api-native.json/log and git-runtime-authorization-tests.log. Fixture manuscript6ae5a9739305e09f47bc2951 read-only; test UUID operation and existing synthetic credential scoped records cleaned in finally. Runtime settings toggled only in subprocess; live deployment/account unchanged. Changed executor/test/native API probe and planning/evidence. This proves actual Runtime registration/config, not that full native mutation chain has run through getGitSyncRuntime with production collections; previous component chain still uses isolated service provider. Full Git/Prism goal active, binary/branch and full editor integration open.

### Current checkpoint: full GitSyncView native browser acceptance
Previous status-only turn made no implementation progress. Continue safe local work: replace isolated control fixture with actual GitSyncView; supply real local repository reader/preview services through native controller; assert graph and file diff before apply/recovery. Keep production deployment disabled and full editor/GitHub/branches limitations explicit.

### Full GitSyncView native browser acceptance passed
Replaced ApplicationControls-only fixture with actual GitSyncView. Native controller provider now supplies actual isolated repository reader and preview service plus current prepared operation. Browser verified real two-commit graph, new.tex review, line diff and removed rows, then Apply -> lost prepare acknowledgement -> Continue interrupted deletion -> Continue remaining changes. Native login/CSRF/router, OT edited bytes, recovery archive/history/storage and final baseline settlement checks pass. pageErrors empty; disposableDataRemoved true. Screenshot visually inspected at plan/git-application-native-ui/review.png; report plan/git-application-native-ui/run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json. First run uncovered query-string loss in test HTTP relay, fixed before passing rerun; no production bug claimed. Changed fixture entry/bundles, runner, joined native provider and records only. Existing user data/account/deployment untouched. Still isolated panel/service provider with local Git; not full editor/runtime factory mutation or external GitHub sync. Binary files, branch workspaces and remaining Prism requirements stay open.

### Current checkpoint: distinguish saved merge decisions from draft choices
Use no default decision for automatic merge; restore explicit saved decision and merged text when revisiting; mark unsaved choices and require explicit choice before saving. Verify with focused controls/panel tests.

### Saved merge decision UI corrected and native roundtrip passed
ConflictControls no longer selects web by default for automatic merges (which could actually delete file). Requires explicit draft choice, labels unsaved choice as not yet affecting Apply, restores saved resolution and uses actual merged text instead of replacing it with web text. GitSyncView supplies typed saved choice and result text; keyed revision remount reflects successful save. Added two regression cases; all35 Git frontend tests and scoped ESLint pass. First test invocation from root failed module alias resolution; corrected cwd services/web, no source workaround. Native full-panel browser now saves web choice, verifies zero changed files/No changes, then saves remote deletion, verifies selected saved choice and deleted-line diff, applies and recovers interrupted native deletion. Report savedWebThenRemoteDecisionVerified true, no page errors, all isolated native cleanup passed. Changed production conflict-controls.tsx and git-sync-panel.tsx, corresponding tests, fixture runner/bundle and records. No deployed service/account/manuscript changes. Full editor integration, GitHub roundtrip, binary support, branches and remaining Prism scope are still incomplete.

### Current checkpoint: protect unsaved merge decisions
Block apply and review navigation while a merge decision is unsaved, add explicit discard, and verify saving/discarding restores actions. Re-run native saved-decision flow.

### Unsaved merge decisions block stale preview application
ConflictControls reports dirty state, provides explicit discard resetting to saved choice/merged text, and clears dirty state on revision/file unmount. GitSyncView disables application, push, review refresh/prepare/close and file switching while unsaved; Save remains available. Added panel regression verifies blocked buttons cause no application request and discard restores prior preview.36 frontend tests and scoped ESLint pass. Real native browser rerun asserts Apply disabled after selecting web choice, saves web then remote decision, and successfully applies/restores interrupted deletion with archive/history/baseline checks. pageErrors empty, disposable data removed. Changed two Git UI modules, panel test, browser fixture runner/bundle and records. No deployment/user content/account changes; overall objective incomplete. Next substantial step remains full editor/runtime integration, not further treating isolated panel acceptance as completion.

### Current checkpoint: native Runtime preview path
Qualify actual getGitSyncRuntime preparation/read/plan against fresh native project and standard Git collections before broadening mutation. Use same copied native DocumentUpdaterHandler with isolated DU endpoint, owned UUID binding/repository and scoped cleanup.

### Actual Runtime native project preview and apply-plan qualification passed
Verified rail GitSyncPanel and production runtime/routes are already wired but gated off. Extended native UI probe to exercise actual getGitSyncRuntime service.prepare/readFile/planApply with fresh real project, standard gitSyncBindings/gitSyncOperations collections and UUID repository under configured root. Runtime/native snapshot test copies only relocate DocumentUpdaterHandler import to identical copied handler bound to isolated native DU endpoint; no function mocks for preview path. Assertions prove native OT-edited reviewed bytes/version, deletion result, exact docId and one-step apply plan. Temporary standard-collection records removed by projectId/bindingId in finally. Existing complete browser/native apply recovery still passes; runtimePreviewVerified true, pageErrors empty, disposableDataRemoved true. Changed plan/git-application-native-ui.py and plan/git-deletion-joined-native.mjs plus evidence/records; production code/deployment/user data unchanged. Initial Python edit matched nested dependency loop causing syntax error before any execution; repaired scoped block, final run passed. This qualifies actual runtime preview/plan only; mutation still assembled isolated service. Next: execute actual runtime application on owned disposable fixture with standard reservation/history collections, then full editor UI. No claim of overall completion.

### Current checkpoint: actual Runtime text mutation
Before existing deletion scenario, apply a real repository text change using getGitSyncRuntime and native reviewed-write controller; assert durable text/version, baseline and admission release. Then use resulting revision as deletion baseline.

### Actual Runtime text modification persisted and settled
Extended native joined fixture with real local repository text commit before deletion scenario. Actual getGitSyncRuntime.service.prepare and getApplicationService().apply use standard gitSyncOperations/bindings and native project collections, unchanged reviewed-write controller/writer and native docstore. Assert files-applied, exact changed cached and durable text, document version +1, binding baseline equals incoming commit, and project application admission released. Then resulting content/version feeds existing native deletion/UI recovery scenario, which still passes. Sidecar routes native ReviewedWriteController and isolates its receipt collection under fixture prefix; cleanup drops only prefix receipts, deletes standard Git rows by fresh project ID/binding UUID, destroys only owned project/history/storage. First attempt404 exposed missing reviewedWritesEnabled on isolated sidecar; added flag there only. Final report runtimeTextApplyVerified=true, runtimePreviewVerified=true, pageErrors=[], disposableDataRemoved=true. Changed plan/git-deletion-joined-native.mjs and plan/git-deletion-joined-du.cjs plus evidence/records, no production deployment or user manuscript changes. Runtime handler imports still relocated to identical copied handler bound to isolated DU; runtime deletion mutation remains assembled service, browser still standalone GitSyncView. Full editor and external GitHub/binary/branch/Prism scope remain incomplete.

### Current checkpoint: actual editor reads runtime-written document
Open fresh native project in existing deployed editor after runtime text apply, assert new.tex content via CodeMirror state, close page and evict only that project from live DU cache before continuing isolated deletion tests.

### Deployed editor reads actual Runtime-written text
Added editor gate after actual runtime text apply. Playwright opens a separate authenticated page on deployed18081 project URL, checks actual file tree/new.tex and CodeMirror state text exactly equals runtime-written manuscript, captures plan/git-application-native-ui/editor.png (visually inspected). Closes editor before continuing; native harness evicts only fresh project from deployed DU using normal DELETE project cache endpoint, also guarded in finally, then continues full isolated review/deletion recovery. Final report deployedEditorReadsRuntimeContent=true and prior checks pass; disposableDataRemoved true. Initial attempt used Browser.new_page implicit context, which forbids a second page; changed to explicit shared browser context. That failed attempt still ran scoped cleanup; final run passes. Changed plan/git-deletion-joined-native.mjs and plan/git-application-native-ui.py plus evidence/records only. Deployed files/config, fixed credentials and user manuscripts unchanged. This is reopen/read integration with actual editor, not live cross-client synchronization or in-editor Git-panel mutation; compilation not asserted (fixture is plain text). Remaining full goal unchanged.

### Current checkpoint: live editor delivery
Use shared native document cache for fresh UUID project in UI acceptance so real editor and isolated DU coordinate on same version/locks. Keep history queue and receipt collections isolated; evict only owned project cache in cleanup. Open editor before runtime apply, verify broadcast without reload and reload persistence.

### Live editor receives actual Runtime text update without reload
UI acceptance now shares native document-updater cache/locks for freshly allocated project/doc IDs; history queue and receipt collections remain fixture-isolated. Before actual runtime apply, open deployed editor/new.tex and assert current unflushed revision. After runtime apply, same open CodeMirror document receives exact incoming text without navigation/reload; subsequent reload retains content. Browser/native deletion-recovery regression still passes. Report deployedEditorUpdatedWithoutReload=true and disposableDataRemoved=true. Scoped cleanup evicts only fresh project cache via native DU endpoint (also finally), then destroys owned storage/history/project; no global key scans beyond isolated prefixes. Changed plan/git-deletion-joined-du.cjs, plan/git-deletion-joined-native.mjs, plan/git-application-native-ui.py and evidence/records; deployment config/code and user projects unchanged. This qualifies single open editor delivery plus persistence, not simultaneous edits or Git UI inside full editor. Remaining GitHub push/pull, branches, binary files and Prism objective incomplete.

### Current checkpoint: intervening browser edit rejects stale review
Open two real editor pages, append peer note after native Runtime preview, assert old apply409 without content/baseline mutation, then reprepare and explicitly merge both contents; verify both open pages and reload. Same authenticated user across two sessions, not multi-user ACL proof.

### Intervening browser edit refuses stale Runtime apply; explicit merge preserves both
Two real editor pages (same authenticated account) open fresh project after runtime preview. Peer inserts note through actual keyboard/OT; first page observes it. Native Runtime apply of old preview rejects409; exact peer text, old Git baseline and absence of application ticket verified. Fresh preview explicitly resolved to incoming Git text plus peer note; actual runtime apply persists both, increments current version, settles baseline, updates both open pages without reload, and survives reload. Existing deletion/UI recovery chain passes. Initial run reached these assertions but cache eviction failed because test sidecar and deployed editor produced separate history queues; now UI mode uses native shared history queue/cache/locks for owned project, worker preserves shared history state between calls, teardown removes only project-specific history keys/records. Final report staleBrowserReviewRejected=true, peerBrowserEditPreserved=true, disposableDataRemoved=true. Earlier failed fixture6ae6182ab1946cde7b02af1b verified absent; scoped history state removed. Changed four plan harness files (joined-native, joined-du, history worker, UI runner) and evidence/records, no production code/deployment/user data. Still not different-user permission proof, arbitrary concurrent schedule proof, in-editor Git panel operation, GitHub roundtrip or full objective completion.

### Current checkpoint: build current full-editor frontend for isolated browser integration
Deployed v43 assets do not contain Git rail entry. Build current frontend into separate plan/git-editor-assets directory, leaving deployed assets untouched. Use manifest to serve current editor assets only to acceptance browser before testing actual rail.

### Current full editor Git rail integration passed with test-served assets
Deployed v43 asset scan lacked Git rail code. Built current full frontend into plan/git-editor-assets using project webpack config, no minification, preserved hidden source maps (resolve-url-loader requires them), no copying unchanged vendor assets. Build passed. Added plan/git-editor-native-ui.py: serves current manifest assets only to acceptance browser, retains CSP nonce and ensures Socket.IO loads before new bundle, injects Git feature meta only in test HTML, forwards Git API requests unchanged to native isolated controller. Uses actual full editor rail tab to execute graph/file diff, explicit web/remote resolution, apply, uncertain deletion continuation and resume; all prior native/runtime/two-browser stale-preview checks pass, pageErrors empty, disposableDataRemoved true. Fixed production GitBranchIcon accessible title so tab has name; scoped ESLint and full build pass. Diagnostics plan/git-editor-load-probe.py read existing fixture only (editor may auto-compile), did not edit manuscript. Initial full-page attempts stuck on CSP then socket script ordering; corrected harness, no production bypass. Evidence editor-run JSON/log and full-editor-review.png. Screenshot visually exposes narrow inherited file-tree rail width (~150px), poor wrapping of decisions; next fix panel width/layout before considering usable delivery. Production services/assets/config/account unchanged. Backend deletion path still assembled isolated service; external GitHub, branch workspace, binary support and remaining Prism scope unfinished.

### Current checkpoint: readable Git sidebar layout
Give Git review a wider initial rail size, retain manual resize, wrap header/content in bounded flex column so bottom actions scroll within viewport. Assert actual panel width and bounds in editor browser regression.

### Git rail width and bounded scroll corrected
Git tab now starts/expands to36% rail size instead of inheriting15% file-tree width, retaining normal resize controls and existing28% literature behavior. GitSyncPanel wraps header/content in bounded flex column; content flexes below header with internal scroll and stable scrollbar gutter. Full editor acceptance asserts panel>=320px at1000px viewport and bottom within viewport, then repeats real runtime/two-session stale-edit preservation and sidebar diff/resolve/apply/recovery. Build and scoped ESLint pass; native browser passes with no pageErrors, cleanup true. Visually inspected full-editor-review.png: ~345px rail, readable decisions and line diff. Changed rail-context.tsx, rail-panel.tsx, git-sync-panel.tsx, git-sync.css plus browser assertion/records/build artifacts. Deployment/user projects unchanged; full GitHub/branches/binary/remaining Prism goals still incomplete. Plain-text fixture intentionally does not qualify PDF compilation.

### Current checkpoint: inspect changed files from commit graph
Add bounded read-only commit detail endpoint with first-parent comparison (root commit against empty tree), wire graph selection to accessible file list, verify real Git and frontend interactions. No branch switching or writeback implied.

### Click commit graph entries to inspect changed files
Added bounded immutable commitDetails reader using diff-tree NUL-delimited paths, no rename guessing, first-parent comparison for merges and empty-tree comparison for root. Validates full commit ID, UTF8 paths/status/count/output limits; no checkout/filter/project mutation. Added authenticated read endpoint /commits/:commitId (24 total routes), native read authorization and404 for unbound project. Graph subjects now accessible buttons; CommitDetails displays author/date/shortID, explicit comparison basis and changed file statuses, with abort on selection switch and error/empty distinctions. Tests: real Git initial+merge details and invalidID assertions pass;38 frontend tests pass; scoped ESLint passes after correcting Mocha hook syntax; full webpack build passes. Full editor/native browser clicked real remove-document commit, verified new.tex deleted, closed details and completed previous merge/apply/recovery chain. Actual runtime API probe verifies new endpoint nonmember403/unbound404 and24 routes; existing native checks pass. Changed reader/controller/router, commit-graph/panel/CSS, new commit-details component and tests, native probes/planning. UI failure wording clarified to close/reopen before retry. Deployment/accounts/manuscripts untouched. Commit per-file historical diff, branch workspaces/switch, GitHub roundtrip, binary support and full Prism objective remain unfinished.

### Current checkpoint: historical file diff
Read only requested changed file blobs from immutable commit/first parent, with literal path matching and size/type bounds. Add file selection and existing line-diff renderer; binary/unsupported/truncated content explicitly labeled. Verify real Git paths and browser.

### Historical file diffs wired into commit details
Added read-only /commits/:commitId/file?path endpoint with native authorization and25 total routes. Reader accepts only paths changed by selected immutable commit, reads exact literal Git tree path and bounded blobs from first parent/current commit, returns text/absent/binary/unsupported/too-large descriptors and modes. No working tree access or mutation. Commit detail file buttons load existing line/word diff; binary, symlink/submodule, size limit and truncated preview are explicit, and mode changes shown. Tests:39 Git frontend passing; real Git tests cover initial file, first-parent merge, special bracket/space literal path, binary, symlink and unknown path; scoped lint and full frontend build pass. Actual runtime API verifies new endpoint outsider403/unbound404 and25 routes. Full editor acceptance clicks real historical deletion file and verifies removed-line diff, then completes prior sync/recovery/two-session checks; no pageErrors, cleanup true. Changed reader/controller/router, commit-details component, tests and native browser/API harness plus records. Existing deployment/user content unchanged. Branch create/switch/workspaces, actual GitHub roundtrip, binary sync (distinct from preview) and remaining Prism objective remain unfinished.

### Current checkpoint: stabilize before user demo
User requests continued fixes and no demonstration until a stable version. Defer preview deployment. P0: qualify real Git HTTPS fetch/push and remote race handling using isolated local repositories and a temporary authenticated HTTPS Git backend; verify stale lease rejection, remote outcome inspection, authentication failure, and cleanup. Keep external GitHub qualification distinct. P1: use failures to fix production transport and rerun focused tests before returning to remaining integration work.

### User-visible Git stable-release milestones (2026-11-01)
User requires bracketed progress at each milestone completion: [当前任务：…｜已完成：N/8]. Denominator is Git stable release only, not all Prism work; disclose any scope/count changes.
1. DONE: real authenticated HTTPS Git transport/lease/outcome test using local temporary TLS endpoint.
2. DONE: backend regression checkpoint, 230 tests passing in plan/git-stability-backend-tests.log.
3. TODO: actual runtime factory mutation chain for text/create/delete and interrupted recovery.
4. TODO: branch creation/switch/merge workflows.
5. TODO: binary asset synchronization.
6. TODO: distinct-user concurrent editing and permissions acceptance.
7. TODO: stable candidate deployment and web regression.
8. TODO: full acceptance including actual GitHub roundtrip, then demonstration.
Current 2/8. Re-run earlier checkpoints when later changes invalidate them; passing current tests does not establish stable delivery.

### HTTPS transport qualification checkpoint complete
Added services/web/test/agent/git-https-transport.test.mjs using actual Git http-backend behind authenticated temporary HTTPS server, generated one-day localhost certificate, verification enabled. Test-only run seam maps validated no-port localhost URL and scoped auth config to ephemeral port, supplies fixture CA; no production URL policy weakening. Actual fetch/push/ls-remote prove initial fetch, successful push with lost acknowledgement, read-only confirmation, stale lease rejection after peer advances, peer bytes retained, ref refresh, wrong-token rejection without changing fetched refs. Temporary repositories/server/certificate removed in finally. Scoped ESLint passes. Combined Git/native-deletion backend tests230 pass. This does not qualify GitHub service behavior, production deployment or full browser roundtrip. User requests continued stabilization before demo; no deployment performed.

### Runtime structure acceptance in progress
Extended existing full-editor native probe after successful real-runtime text apply: enable actual factory creation/deletion adapters, add then remove extra.tex through real repository previews/application, assert native tree/docstore/baseline and preserved original doc. Test DU sidecar can switch receipt collections to production names only for its generated idle fixture; standard receipts cleaned by exact projectId. Later deletion expectations now use observed starting tree version. Running existing full editor/native acceptance; this milestone remains incomplete until result and interrupted-runtime coverage verified.

### Actual runtime text/create/delete and interrupted deletion verified
Full editor/native acceptance now passes with runtimeStructureApplyVerified=true and runtimeDeletionRecoveryVerified=true. Actual getGitSyncRuntime factory creates extra.tex, verifies native tree/docstore, then deletes it with injected lost native prepare acknowledgement. Factory reconcile retains recovery-required, explicit continueDeletion confirms one receipt, resume finishes; final tree retains original doc, tree version4, admission released, binding baseline equals reviewed HEAD. Existing actual editor stale-edit/two-session text preservation, graph/historical diff, later browser-driven deletion recovery and full fixture teardown also pass; pageErrors empty. Fixed harness collection lifetime issue (captured native reservation collection) by using standard reservation collection consistently for generated UI fixture, cleanup by exact projectId. Changed plan/git-deletion-joined-native.mjs, plan/git-deletion-joined-du.cjs, plan/git-editor-native-ui.py and records/evidence only; deployment/user content/accounts unchanged. Evidence plan/git-runtime-structure-browser.log and plan/git-application-native-ui/editor-run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json. Node syntax checks pass. Python report scope string enhanced for future runs; current JSON flags are authoritative for added runtime checks.
Milestone remains2/8: next implement/qualify explicit continuation for partially persisted native document creation, since current adapter inspect is read-only and incomplete storage/tree/history receipts cannot be resumed through current executor. Do not claim stable milestone3 complete based only on happy-path creation and deletion recovery.

### Current checkpoint: explicit creation continuation
Add read-only native creation recovery context and whole-project progress validation (pending creation absent or exact committed identity/content). Add explicit coordinated continuation, separate from read-only reconciliation, immutable content verification, and same-attempt journal checks. Expose capability/route/button only when actual adapter supports it. Verify missing/corrupt receipts, collaborator edits, permission changes and native interrupted-history flow. Existing ambiguous unpublished storage intent must never re-POST; remains unconfirmed until exact original document can be read.

### Milestone 3 complete: runtime lifecycle and explicit interrupted-creation continuation
Added createDocumentCreationService.readRecoveryContext with native authorization/receipt consistency; validateCreationRecoveryProgress validates whole-project state before or after exact pending tree commit, rejects changed document IDs/versions/content, unrelated files/assets, binding/head drift and forged receipts. GitApplyService/Executor now expose coordinated explicit continueCreation: retain attempt/write identity, verify immutable merged bytes, re-read durable state after lock, execute only pending creation, confirm receipt and stop before remaining files. Reconciliation remains read-only. New POST /continue-creation, capability allowlist and explicit UI action; authentication and no-store behavior preserved. Original ambiguous storage intent is inspected, never blindly reposted; absent/unconfirmed outcome stays safely pending (no claim of automatic repair for unavailable storage).
Validation: 235 Git/native-deletion backend tests passed,40 frontend tests passed, scoped ESLint passed, full frontend webpack build passed. Actual runtime native/browser fixture injects creation history failure after native storage/tree commit, verifies read-only reconciliation remains recovery-required, explicit continuation confirms existing file, one storage receipt only, resume settles baseline. Native deletion lost-prepare recovery, text writes, two-session stale edit preservation, browser Git review and cleanup continue passing. Report runtimeCreationRecoveryVerified=true, runtimeDeletionRecoveryVerified=true, runtimeStructureApplyVerified=true, disposableDataRemoved=true, pageErrors=[]. API probe26 authenticated routes verifies new action access/default-off behavior. UI button verified component-level; full candidate deployment/click acceptance remains milestone7/8, no user demo yet.
Changed7 Git modules (creation service, progress guard, application service/executor/response, controller/router), application-controls.tsx,3 backend test files, frontend application test, native runtime/browser/API probes and planning/evidence. Existing deployment, accounts, real repositories and user manuscripts untouched.
Git stable-release checklist now3/8: milestones1-3 DONE; next4 branch creation/switch/merge;5 binary assets;6 distinct-user concurrency;7 candidate deployment/web regression;8 full acceptance including actual GitHub roundtrip. This does not complete full Prism goal or claim all possible storage failures self-heal.

### Current checkpoint: reviewed branch switch
Implement switch previews against current baseline/web state and selected existing branch. Preserve immutable web/base/target archives; target must be named in fetched branch list. Carry target ref through durable apply plan/journal; recheck target head during apply/recovery; change binding only in final receipt settlement transaction. Initial unreviewed bindings cannot switch. This is switch-with-local-edits, not a merge commit between branch histories; branch creation and true merge remain separate work under milestone4.

### Reviewed branch switch implemented and verified; milestone4 remains open
Added targetBranch/comparison to immutable preview with selected existing branch snapshot, preserving current baseline and complete web recovery snapshot. Initial sync/same/invalid/missing targets rejected. Apply plan carries target, journal claim matches it, progress coordinator rechecks target head, and settlement changes branch+baseline only after all file receipts in original transaction; operation/plan target mismatch rejected. Sidebar selector requests a review, disables branch switching during existing review, and updates branch display only on files-applied. Public preview exposes target ref without storage internals. API adds authenticated POST /branch-switch/previews (27 total routes).
Validation: actual divergent local Git fixture proves independent web/branch edits combine, target branch advance invalidates old plan, initial/same/missing branch rejected, final binding update targets original revision and selected new branch.236 backend tests/41 frontend tests pass; scoped lint/full webpack pass; native runtime API outsider403/unbound409 checks pass. Full native/browser scenario now also switches actual binding to same-content review branch through zero-step apply while retaining web-local edits; runtimeBranchSwitchVerified=true; creation/deletion interruption recovery, browser diff controls and teardown still pass, pageErrors=[]. Evidence plan/git-runtime-branch-switch-browser.log, plan/git-branch-switch-tests.log, plan/git-branch-switch-frontend.log. Native divergent-content branch apply/browser selector end-to-end remain additional acceptance coverage; component and real Git tests cover those pieces separately.
Changes:7 Git modules (preview, plan,journal,application service,binding settlement,controller,router), git-sync-panel.tsx, new git-branch-switch.test.mjs, frontend panel test, native probes, planning/logs/build artifacts. Existing services/deployment/accounts/manuscripts untouched. No external repository pushes. Remaining milestone4: actual branch creation/commit publishing with absent-ref lease and real merge commits; current switch is checkout-style carry-over, not merge ancestry. Overall3/8, full Prism goal active.

### Current checkpoint: publish reviewed web snapshot to a new branch
Extend existing retained commit/push lifecycle with explicit new-branch intent. Record source baseline separately from null destination expectedHead; require absent destination and exact source binding at claim. Push uses absent-ref lease, settlement atomically switches binding to new origin tracking ref only on confirmed remote commit. Keep immutable author/snapshot and manual review. Test local repositories only, no actual external push.

### New-branch reviewed commit and guarded publication implemented
PushPreparation accepts optional newBranch, validates branch syntax/fetched-name absence, creates author-attributed retained snapshot commit with current baseline parent (also permits unchanged snapshot for new branch). Journal records explicit newBranch/sourceCommit and null destination expectedHead. Executor pins source binding and retained commit while remote transport uses absent-ref lease. Atomic lifecycle switches binding to new origin tracking ref only after exact remote confirmation, in same transaction as baseline/revision/admission settlement. Cache updater handles new tracking ref with compare-and-swap zero old OID; collisions never overwrite. UI optional branch field explains switch-on-confirmation, preserves explicit review/approval, updates parent branch display only on confirmed new branch. Current snapshot remains immutable despite later edits.
Validation:237 combined backend tests pass;42 frontend tests pass;scoped production lint and full webpack pass. Real HTTPS Git fixture creates branch and rejects attempted overwrite. Added plan/git-new-branch-native.mjs/.py with isolated Mongo records and real local bare remote, actual preparation/journal/executor/atomic settlement/cache chain; simulated transport response loss confirms binding stays on old branch until reconciliation, then moves exactly once/releases admission; remote same-name race rejected and original branch/content retained. No actual GitHub push. Native report passed/disposableDataRemoved=true. Evidence plan/git-new-branch-native.json/log, git-new-branch-tests.log, git-new-branch-https.log, git-new-branch-frontend.log.
Changed9 Git modules (branch identity, preparation,journal,executor,atomic lifecycle,cache updater,commit writer,response,controller), push-controls.tsx/git-sync-panel.tsx,3 backend test files/frontend push test,native harness and planning/evidence. Existing deployed images/accounts/user content unchanged. User-visible milestone remains3/8: branch creation/publishing and reviewed switch now implemented, true two-parent branch merge workflow still required to complete4; native full editor new-branch push remains final acceptance coverage. Next implement source branch merge preview, persist pinned merge ancestry through apply, then prepare a two-parent reviewed commit; do not label checkout-style switch a merge.

### Current checkpoint: pinned branch merge ancestry
Add merge preview from unique common ancestor, with destination head equal current baseline and pinned source head. Apply keeps current branch/baseline and records pending two-parent ancestry atomically; push preparation uses both parents even when file bytes are unchanged. Reject new merge/switch while pending ancestry exists; incoming destination updates require safe follow-up integration rather than overwriting. Preserve source/destination head checks through recovery. Verify actual Git parent graph and native settlement; do not equate switch with merge.

### Milestone4 complete: branch create/switch/merge functional paths
Implemented true merge preview for named fetched source branch using one common ancestor, rejecting unrelated/multiple-base histories and already-contained sources. Destination head must equal baseline; source/destination heads pinned and rechecked before apply/recovery. Durable plan/journal carries merge intent; settlement keeps current branch/baseline and atomically records pendingMerge. Incoming ordinary reviews carry pending ancestry and advance its destination baseline safely; new branch merge/switch blocked until pending merge committed. Push preparation builds retained author-attributed two-parent commit even when file content unchanged. Push journal/executor/atomic lifecycle pin pending source/destination and clear ancestry only with confirmed remote commit. UI adds Review branch merge, explicit merge/pending status, preserves current branch, clears pending state on push confirmation.
Verification:238 combined backend tests,43 frontend tests,scoped ESLint and full webpack pass. New real Git git-branch-merge.test.mjs covers conflict refusal, clean web+destination+source merge, source drift, incoming destination changes after merge application, exact two-parent graph and unchanged branch before push. Native Mongo/local bare Git push probe confirms two-parent publication and atomic pending-merge clearance; no actual external push.28-route native API verifies merge outsider403/unbound409. Full editor/native acceptance passes runtimeBranchMergeVerified/runtimeBranchSwitchVerified and prior text/create/delete/recovery/session checks, pageErrors=[], disposableDataRemoved=true. Native merge specifically exercises zero-file ancestry settlement; divergent content graph proof and UI merge action have separate real Git/component coverage, not a claim of a complete GitHub browser journey.
Changed11 Git modules,2 frontend components,real Git merge test/frontend panel test,native/API probes and planning/evidence. Deployment/accounts/user manuscripts untouched. Evidence plan/git-branch-merge-tests.log,git-branch-merge-frontend.log,git-new-branch-native.json,git-runtime-branch-merge-browser.log,git-sync-api-native.json.
User-visible checklist now4/8:1 HTTPS transport,2 backend regression,3 native lifecycle/recovery,4 basic branch create/switch/merge DONE. Next5 binary file synchronization;6 distinct-user concurrency;7 stable candidate deployment/browser regression;8 full acceptance incl actual GitHub roundtrip and demo. Recursive multi-base merges explicitly unsupported; full Prism/Git objective still active.

### Current checkpoint: immutable binary blob staging
Native assets reference Git-compatible SHA1 blob hashes in history-v1. Implement bounded hash-verified blob staging with durable operation/asset identities and authorization rechecks; native upload/read adapter uses private temporary files and immutable hash-addressed history API. Repeated/lost-response uploads may retry only identical reviewed bytes at the same content address. Verify actual native history upload/read with a disposable history project before adding tree/history/admission integration. No feature flag enablement until full asset lifecycle passes.

### Recovery-before-tree regression checkpoint
Binary storage foundation is present; verify its reports before claiming lifecycle completion. Found document tree admission accepts applying only, excluding explicit recovery-required continuation after confirmed storage and before tree insertion. Add real Mongo regression including cancelled/mismatched write rejection, reproduce failure, allow the exact in-flight recovery state, then rerun native transaction and backend tests. Asset tree/history integration remains pending; milestone stays4/8.

### Asset storage foundation verified; recovery-before-tree fixed
Implemented GitAssetStorageStage.mjs and GitNativeBlobStore.mjs with immutable history-v1 Git SHA1 blobs, SHA256 reviewed content, durable asset identity, bounded reads, private temporary uploads, authorization rechecks and same-address lost-ack confirmation. Native disposable history/Mongo probe verifies actual uploaded bytes, lost acknowledgement, retry identity, bounded read, cleanup, and caller-buffer mutation isolation. Fixture authorization only; no asset tree/history-event publication or runtime registration yet.
Found and reproduced Document creation is not the active apply step when explicit recovery resumes after storage but before tree commit. GitDocumentTreeCommit now admits recovery-required with the same exact in-flight write/index/attempt checks. Real Mongo regression confirms cancelled/mismatched operations reject, concurrent recovery inserts once, rollback and ACL/path/entity limits remain effective. Native probe passed after failing on original implementation.
Validation:242 combined Git/native-deletion backend tests pass in plan/git-asset-foundation-backend-tests.log; scoped ESLint passes. Evidence plan/git-document-tree-native.json and plan/git-asset-storage-native.json. Changed production tree commit and native blob adapter, asset staging module/test plus native probes and records. Existing deployments, account credentials, real repositories and manuscripts untouched. Checklist remains4/8: asset tree/history/admission integration, distinct-user concurrency, candidate deployment and actual GitHub acceptance remain outstanding. Next inspect native file structure-history payload and implement asset tree commit with transactional receipts before enabling asset runtime.

### Current checkpoint: transactional asset tree stage
Implement asset creation/replacement with confirmed blob receipt, exact old asset identity/hash, native admission/ACL/tree-version guards and atomic tree+receipt transaction. Preserve old immutable blob and record old file identity/revision for history; nested folders must commit atomically. Test real Mongo rollback, concurrent replay, recovery and stale identities before connecting history/runtime.

### Transactional asset creation/replacement stage verified
Added services/web/app/src/Features/GitSync/GitAssetTreeCommit.mjs. Confirmed immutable storage receipt is required; history identity, reviewed size/hash, operation/attempt/write, native project gate, ACL, tree version and document-deletion fences are checked in one Mongo transaction. Creation atomically adds missing folders and native fileRef with fresh asset identity. Replacement checks old asset identity/blob hash, advances rev, clears linked-file metadata like native upload, and records old identity/hash/rev without deleting old content. Tree mutation and durable receipt commit together; exact replay returns one receipt.
Real Mongo plan/git-asset-tree-native.mjs/.py passes creation, replacement, concurrent replay, before-tree recovery, stale blob rejection, permissions/path/entity limit checks, deletion fences and injected receipt-failure rollback. Extended plan/git-asset-storage-native.mjs joins actual history-v1 upload/lost-ack confirmation to isolated native-shaped project tree, then reads exact bytes via published file hash; replay adds no second entry. Both native JSON reports passed; fixture data removed. Scoped ESLint for new production module passed. Prior242 backend result remains prior checkpoint, not rerun this turn; new stage is not yet registered in runtime.
Milestone stays4/8. Remaining asset work: native history event/outbox/confirmation, create/replace/delete runtime adapter and explicit recovery, asset-aware progress validation, binary classification including textual asset formats, actual web acceptance. Existing deployments, credentials, manuscript projects and external repositories unchanged.

### Current checkpoint: immutable asset history event groups
Native replacement requires delete-old then add-new, with project structure versions N.0 and N.1. Build receipt-verified event groups and durable outbox; test exact ordering and lost-ack retries. Do not queue in runtime until the native consumer validates/deduplicates each tagged event and confirms the final snapshot/blob.

### Asset history producer/outbox/confirmation implemented; native consumer pending
Added GitAssetHistoryPayload.mjs deriving an immutable ordered event group from matching storage/tree receipts and exact blob bytes. Creation emits add-file at N.0; replacement emits old-identity removal at N.0 and new-identity add at N.1. assetWriteId/assetEventIndex/assetEventCount identify the retry group. Native original code confirms rename-file then add-file behavior. No binary bytes embedded in event; history references verified Git blob hash.
Added GitAssetHistoryOutbox.mjs: majority durable group admission, immutable payload digest, exact retry comparison and authorization recheck before queue callback. Callback contract requires atomic append of whole group. Added GitAssetHistoryConfirmation.mjs: requires final group version/history identity, exact Snapshot file hash, bounded blob read with SHA1/SHA256/size verification and authorization recheck before durable immutable proof. Queue acknowledgement and partial replacement version cannot confirm.
Four new git-asset-history.test.mjs tests cover binary creation/replacement ordering, mismatched receipts/content/identity refusal, lost-ack same-group retry/tampered outbox rejection, final snapshot/hash/blob proof and permission revocation.246 combined backend tests pass in plan/git-asset-history-backend-tests.log; scoped ESLint passes. These are producer/outbox/confirmation component tests with stubbed native queue/snapshot callbacks, not real history persistence acceptance. Native queue endpoint/consumer validation/deduplication still must be implemented, followed by native history fixture, runtime lifecycle and web checks. No runtime flag/deployment/user content/account changes. Checklist remains4/8.
Next: add separate durable asset event collection and native queue adapter (not reuse doc-only creation endpoint); consumer dedup must key each asset event by writeId plus index, allow exact repeats across queue batches, preserve N.0/N.1 ordering, and reject conflicting variants. Continue with asset deletion and runtime integration after real history-worker verification.

### Native asset queue/consumer checkpoint
Add default-off reviewed asset endpoint and independent durable event collection. Validate complete ordered groups and project gate before one atomic Redis append; consumer deduplicates writeId/index, preserves second replacement event across batch boundaries, rejects conflicting groups. Verify focused DU queue and project-history ordering suites before real native history probe.

### Native asset history queue and consumer verified separately
Added default-off reviewedAssetEnabled and /project/:project_id/reviewed-assets/:write_id/history internal endpoint, queueReviewedAssetHistory web client/controller, separate gitSyncAssetHistoryEvents Mongo collection. DU queue validates durable payload digest, ordered index/count/version, old/new file identity shapes, history identity and native project admission/version before one queueOps call atomically appends both replacement events. Request body never supplies payload. Project-history consumer validates tagged events, deduplicates by writeId/index, rejects conflicting groups, and filters already persisted events so replacement can resume after its removal event crossed a batch boundary.
Validation:47 native UpdatesProcessor tests,29 ProjectHistoryRedisManager tests,119 HttpController tests pass. Real web-client→HTTP DU→Mongo→Redis probe passes default-off, invalid identity, exact ordered-group replay, mismatched ack and stale gate rejection (plan/git-asset-queue-native.json). Separate actual Redis→processor→history-v1 probe uploads real binary blobs, verifies creation snapshot hash, processes removal separately then retries full replacement group, confirms final hash/version2.1 and no extra version on later replay; disposable history/Redis/state removed (plan/git-asset-consumer-native.json). This is separate queue and consumer integration evidence, not yet a single web apply lifecycle.
Web handler scoped ESLint and native source syntax checks pass. Direct native ESLint invocations could not qualify lint: document-updater lacks discovered configuration; project-history default parser rejects existing ESM imports. Logs retain these tooling failures; no unrelated lint reconfiguration performed. Initial test command used root cwd with service-relative log path and failed before running; rerun in correct service cwd passed.
Changed native DU app/controller/queue/Mongo/config and tests, project-history processor/test, web DU handler, new asset queue/consumer probes and planning/evidence. Existing deployment/settings on disk, account credentials and user manuscripts untouched. Native probes use copied code under UUID directories and isolated fixture IDs/Redis keys, removed afterward. Milestone4/8 remains: next wire actual asset creation/replacement service and history stages, deletion support, recovery/progress validation and runtime browser acceptance. No active test sessions remain.

### Joined asset mutation service checkpoint
Compose native authorization, storage, tree transaction, history outbox and persisted snapshot confirmation for asset create/replace. Adapter receipt must bind exact step/old identity/new blob/tree/history proof. Read-only inspect never mutates storage/tree/history. Verify interrupted stages and stale/mismatched receipts before runtime registration; remaining prior-step authorization/progress consumers need asset support before multi-step apply.

### Joined asset creation/replacement service verified
Added GitAssetMutationAuthorization/Adapter/Service.mjs composing existing immutable blob staging, transactional tree commit, durable history event group, native queue and snapshot/blob confirmation. Authorization pins active step/attempt/old asset identity/blob/size, current admission and cumulative tree version; checks native permissions before/after reads. Adapter emits asset-persisted receipt only after complete matching history proof; inspect never stages/commits/enqueues, recovery context reads existing asset tree receipt. Prior confirmed document lifecycle and asset create/modify receipts are recognized by the new asset authorization only; other executor/journal/progress modules still require extension before registration.
Actual composed native fixture plan/git-asset-service-native.mjs/.py (new DU sidecar, existing history worker) passes real history-v1 binary upload with injected lost upload ack, Mongo tree commit, injected interruption before history queue, read-only inspect returning null, explicit same-identity retry, real web client→DU HTTP→Redis→processor→history confirmation, then binary replacement with new asset ID/rev1 and final history3.1/blob byte readback. One upload per mutation; stale tree version rejected; all own disposable data/copies removed. Fixture permission callback and isolated project collections are explicit limits; no browser/realtime/runtime executor qualification.
First joined run exposed authorization receiving storage intent extras (historyId/path/afterHash) and comparing them as tree receipt identity. Service now normalizes authorization input to the five operation identity fields, while storage recheck separately verifies history/path/hash intent. Re-run passed. Nine asset authorization regressions cover pre/post tree recovery, gate/actor/version/history mismatches, permission recheck, prior structural progress and replacement old identity/hash/size.
Validation:255 combined backend tests pass in plan/git-asset-service-backend-tests.log; scoped new-module ESLint passes; joined native report plan/git-asset-service-native.json passed. Changed3 production modules,1 test,new native service probe/wrapper/DU sidecar plus records; existing running deployment/config/credentials/user papers/external repositories unchanged. Checklist remains4/8. Next implement native asset deletion with history, notifications and runtime journal/progress/adapter registration, then full editor acceptance. No live sessions remain.

### Reviewed asset deletion checkpoint
Verify original immutable blob against archived bytes and persist retained receipt before removing fileRef. Extend transactional tree stage for exact old asset identity/hash deletion, preserving original blob and receipt. Verify rollback/replay/stale content and actual retained blob readback; history deletion event and runtime wiring remain subsequent required work.

### Retained asset deletion tree stage verified
Added GitAssetRetentionStage.mjs: validates exact delete intent, archived original bytes (SHA256 and native Git SHA1), reads existing immutable native blob, rechecks authorization, persists one majority retained receipt. It never uploads or deletes blobs. Extended GitAssetTreeCommit for delete: requires matching retained receipt/old asset identity/hash/current admission and tree version, atomically removes fileRef with tree receipt, keeps previous blob/hash/rev and beforeHash for recovery. Duplicate identity or stale references reject; receipt failure rolls back tree removal.
Three new git-asset-retention.test.mjs tests cover exact replay/receipt tamper, unavailable or altered blob/archive refusal, permission revocation before receipt. Real Mongo tree probe verifies delete missing-retention rejection, receipt-failure rollback, concurrent replay, preserved original hash/rev. Real history-blob plus tree probe now creates then retains/deletes fixture asset, verifies zero fileRefs and exact original blob readback afterward. Its auth callback is fixture-only; deletion history not yet queued. Reports plan/git-asset-tree-native.json (retainedDeletionAtomicAndReplaySafe) and plan/git-asset-storage-native.json (deletedAssetOriginalBlobRetained); own data cleaned.
258 combined backend tests pass in plan/git-asset-retention-backend-tests.log; scoped ESLint passes. Re-ran actual composed create/replace native service after tree-stage changes: passed, including interrupted history retry and original one-upload-per-mutation behavior (plan/git-asset-service-retention-regression.log). No active sessions remain. Changed retention module,test,tree commit,two native fixture sources/reports and planning records; user content/deployment/credentials/external repositories untouched. Checklist4/8 unchanged.
Next: extend asset history producer/outbox/consumer/confirmation for a single deletion event (distinguish it from creation and replacement group), confirm missing path in native persisted snapshot while original blob remains readable. Then authorize/adapter/service deletion flow, runtime journal/progress and frontend notifications/acceptance. Full Prism/Git goal remains incomplete.

### Asset deletion history checkpoint
Add an explicit single-event assetDeletion tag distinct from creation and replacement, derive it from retained/tree receipts and original bytes, validate/queue/deduplicate it natively, confirm path absence plus retained blob bytes. Extend the composed adapter only after the protocol validates, and test actual create→replace→delete history including interrupted deletion.

### Composed asset delete/history/recovery verified
Extended GitAssetHistoryPayload/Outbox/Confirmation for explicit assetDeletion=true single removal event at N.0, derived from retained original bytes and tree receipt. Confirmation requires path absence in exact native snapshot plus successful retained blob SHA1/SHA256/size readback. Outbox carries action/beforeHash. Native DU queue validates deletion identity/tag/action; project-history validates and deduplicates standalone deletion separately from the two-event replacement group.
Extended GitAssetMutationAuthorization/Adapter/Service to delete: reads original bytes via server readContent callback (not caller null after-content), invokes retention instead of upload, removes tree reference, confirms deletion history, returns asset-deleted receipt with beforeHash/original assetId/blob/rev. Read-only inspect remains non-mutating. New asset authorization handles prior asset deletion receipts, but other existing executor/journal/progress readers still need asset-aware integration.
Real composed plan/git-asset-service-native.mjs now tests create→replace→delete through native history blob/Mongo/web-client/DU-HTTP/Redis/processor/storage. Injected deletion failure before history enqueue after tree removal; inspect returned null; same operation resumed under recovery-required, confirmed history4.0 absence and original blob byte readback, no extra upload (2 uploads for create+replace only). Existing interrupted creation and stale-tree guard pass. Fixture auth and isolated project collections remain explicit limitations; no runtime executor/browser/realtime integration claimed. Own data cleaned, report plan/git-asset-service-native.json / run log plan/git-asset-deletion-service-run.log.
Validation:260 combined backend tests,48 native consumer tests,30 DU queue tests pass; scoped Git asset module ESLint passes. Added2 focused history deletion tests for exact retained event and rejection of still-present snapshot/corrupt retained bytes; consumer/queue tests reject malformed deletion tags. Changed6 Git history/mutation modules,DU queue,history processor,3 tests,native service probe and records. Existing deployment/user manuscripts/credentials/external repositories untouched. No active test sessions remain. Checklist stays4/8. Next: native file-tree notifications, asset receipts in journal/progress guards and native runtime registration, explicit recovery endpoint/UI, textual asset classification, full browser validation.

### Asset-aware journal and whole-project progress checkpoint
Add canonical asset receipt validation and count asset replacements as structural mutations. Extend opt-in progress guards to replay confirmed asset create/replace/delete and exact pending tree receipts while preserving whole-project byte/identity/version and remote/binding checks. Keep runtime registration off until mixed document/asset native authorization and recovery paths are qualified.

### Asset journal and opt-in whole-project progress guards verified
Added GitAssetReceipt.mjs shared isAssetStep/changesProjectTree/validAssetReceipt helpers. GitApplyJournal now validates and retains complete asset-persisted/asset-deleted receipts, original beforeHash for deletion, new identity/blob/rev/history proof, and counts asset modifications as tree-version increments; subsequent document creation/deletion expected tree counts include replacements. Invalid asset-shaped modify intent cannot silently fall through normal text receipt handling.
GitApplyProgressGuard adds opt-in validateAssetApplyProgress and validateAssetRecoveryProgress. Replays confirmed asset create/replace/delete with SHA256 reviewed contents, Git blob hashes, identity uniqueness, exact tree versions, and pending tree receipt identity checks. Final comparison covers all document versions/IDs, all asset IDs/hashes, all file bytes, binding and remote baseline. Existing text/document guard modes remain restrictive. Four new git-asset-progress tests cover every prefix of mixed asset+document plan, unrelated collaborator edits/identity changes, invalid receipts, pre/post-tree recovery, and journal retention.
Validation:264 combined backend tests pass (plan/git-asset-progress-backend-tests.log). Real composed native service now calls actual journal.confirmStep for create,replace,delete and rejects missing historyVersion before recording each result; nativeAssetJournalVerified=true plus existing interrupted creation/deletion and retained bytes pass (plan/git-asset-service-native.json / plan/git-asset-journal-native-run.log). Native permission callback and isolated fixture project collections remain explicit limitations; full runtime/browser still pending. Scoped ESLint initially flagged three multi-const declarations in new test; --fix split declarations, then passed. Production modules passed scoped lint. No test sessions remain.
Changed shared receipt module,journal,progress guard,new test,native joined fixture and planning/evidence; existing deployment/config/account credentials/user manuscript/external repos unchanged. Checklist4/8. Next: doc creation/deletion native authorization must accept preceding asset receipts; DU text native write gate and structural counting need review; doc recovery guards must opt into mixed assets when runtime enabled; add native notifications, asset coordinator/adapter registration and explicit continuation API/UI before browser qualification.

### Mixed native authorization checkpoint
Reuse canonical asset receipt validation in document creation/deletion and asset authorization so prior confirmed asset mutations advance tree version exactly once. Add opt-in asset-aware document recovery guards without broadening default coordinators. Verify mixed prior create/replace/delete evidence and reject missing history or wrong identity. Inspect native text write path for structural assumptions before runtime registration.

### Mixed document/asset authorization and native notifications verified
Document creation/deletion authorization now recognizes preceding confirmed asset create/replace/delete receipts through shared GitAssetReceipt validation; asset authorization uses the same validator. Missing history and incorrect tree versions still reject. Document creation/deletion recovery guards accept an explicit allowAssets option, default false, to validate mixed prior asset progress only when a coordinator opts in. Tests cover all3 prior asset actions and pre/post-tree document recovery following assets, including collaborator identity changes.
Added GitAssetNotification.mjs with native reciveNewFolder/reciveNewFile/removeEntity publication: replacement removes original identity before publishing new identity, deletion removes only original identity, payload keeps hash/rev/created and native argument order. Validates all identity/folder/event data before emitting. Unit tests verify ordered events, exact retry payload, invalid identity/date/hash refusal. Native composed service now subscribes to real editor Redis channel and verifies6 notification groups across apply+inspect for create/replace/delete, alongside prior blob/history/journal/recovery proofs. nativeAssetNotificationsVerified=true in plan/git-asset-service-native.json; no browser delivery claim.
Reviewed native ReviewedDocumentWriter.js: it binds document version/write receipt and delegates project authorization/tree coordination to web; it does not independently count structural plan steps. No DU text change needed for asset tree increments at this layer; full runtime coordinator qualification remains required.
Validation:269 backend tests pass in plan/git-mixed-assets-backend-tests.log; native service+Redis notification probe passes and removes own fixtures (plan/git-asset-notifications-native-run.log); scoped lint passes after splitting one multi-const test declaration. During edits a generated else lacked if, caught by node --check and fixed before tests. A lint-fix attempt used root-prefixed path while cwd was services/web; failed without editing, corrected to service-relative path. No active sessions remain.
Changed3 authorization modules,progress guard,new notification module,4 tests,native joined probe and planning/evidence. Existing runtime/deployment/config/credentials/manuscripts/external repositories untouched. Milestone4/8 unchanged. Next add assetAdapter/runtime flag and native readContent selection (before recovery archive for delete, merged bytes otherwise), progress/recovery routing, explicit continueAsset endpoint/UI, then actual factory/browser mixed-file test. Textual new assets such as SVG still require classification support before binary milestone completion.

### Runtime asset registration and continuation checkpoint
Register composed native asset service behind assetsEnabled=false by default. Use immutable merged bytes for create/replace and original recovery archive for deletion. Add whole-project asset-aware coordination and explicit continueAsset path reusing original step/attempt identity, re-read journal after lock, then stop before remaining files. Add allowlisted capability/API/UI, test recovery and native endpoint authorization before actual runtime browser fixture.

### Asset runtime/API/UI continuation checkpoint verified
Registered composed asset service under default-off assetsEnabled, wired asset-aware progress/recovery coordination and continueAsset executor/service/controller/POST route/public capability. Runtime deletion source uses immutable recovery archive; create/replace source uses reviewed merged bytes. UI now exposes explicit Continue interrupted asset change only after server capability and active unconfirmed status; unknown network outcomes query status without replay. Preview availability respects assets flag for binary creation and existing attachment replacement/deletion, while binary conversion of native documents stays blocked.
Validation:273 backend tests pass (plan/git-asset-runtime-backend-tests.log),46 Git frontend tests pass (plan/git-asset-controls-tests.log), scoped runtime/backend ESLint passes (plan/git-asset-runtime-lint.log), editor webpack build exits0 (plan/git-asset-editor-build.log). Executor regressions cover create/modify/delete same-attempt/write continuation, no following-file execution, changed unrelated reviewed content, permission denial, absent coordinator, durable identity change and missing history proof. Public capability and browser-control tests cover default-off/terminal states, explicit click, lost response/status-only recovery. Native API probe passes29 routes including continue-asset, default-off/enabled runtime registration, nonmember denial and unbound operations (plan/git-sync-api-asset-native-run.log). This validates registration/API, NOT actual mixed asset runtime execution or browser delivery.
Current milestone remains4/8. Next extend actual factory/editor fixture for mixed asset+document creation/replacement/deletion and interrupted recovery. Before asset milestone completion, fix new textual attachment classification: GitApplyPlan currently classifies by UTF8/NUL only; native Uploads/FileTypeManager.isEditable also applies filename extensions, max_doc_length and surrogate restrictions. Need one consistent native classification decision shared with preview availability, preserving existing native doc/asset identity. Distinct-user collaboration, candidate regression and actual GitHub roundtrip still pending. No live test processes remain. Existing running deployments, fixed account credentials, user manuscripts and external repositories unchanged; only source/tests/local fixtures/build artifacts and records updated.

### Native attachment classification implementation checkpoint
Use shared GitContentKind for plan and preview. Runtime injects native FileTypeManager.isEditable, respecting filename/size/surrogate rules; existing documents skip filename restrictions to preserve native upload behavior. UTF8 attachments use immutable asset storage despite textual bytes. Verify native settings integration and unchanged fixture behavior before mixed-file runtime acceptance.

### Native mixed asset runtime verified; browser asset-specific acceptance pending
Shared GitContentKind now used by apply plan and preview availability. Runtime injects native FileTypeManager.isEditable through preview service/internal capabilities; new SVG is asset, existing documents retain identity independently of extension. Native API29-route probe verifies native SVG/TEX/surrogate/invalidUTF8/max-length policy (plan/git-native-classification-api.log).
Extended plan/git-deletion-joined-native.mjs and DU sidecar with actual getGitSyncRuntime asset service enabled on disposable project, real PNG/SVG/TEX mixed creation, interruption before asset history enqueue and explicit same-operation continuation, remaining document creation, two asset replacements and mixed asset/document deletion. Exact snapshot bytes/new replacement IDs/absence and final treeVersion12 verified. Existing browser peer-edit preservation, stale review refusal, branch switching/merge, deletion recovery and Git graph/diff controls still pass. Report plan/git-application-native-ui/editor-run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json: runtimeAssetApplyVerified=true, passed=true, disposableDataRemoved=true, pageErrors=[]; log plan/git-asset-runtime-editor-run.log.
Two real integration defects found and fixed: (1) history materializes UTF8 assets as StringFile with getHash=null; GitAssetHistoryConfirmation now computes exact UTF8 Git blob hash when needed, while retaining independent blob SHA1/SHA256/size verification. Regression includes Chinese/CRLF SVG and incorrect text/blob/version/identity/access. (2) GitDocumentDeletionStart's transactional admission omitted prior asset receipts despite outer auth supporting them. It now validates canonical asset receipts and counts create/replace/delete once; regression rejects missing history proof before reservation. Unit total277 passes (plan/git-native-classification-tests.log); new/changed modules scoped ESLint pass (plan/git-native-classification-lint.log, plan/git-asset-history-materialization-lint.log, plan/git-mixed-asset-deletion-start-lint.log). No live processes remain.
Changed production: GitContentKind(new), GitApplyPlan, GitSyncPreviewService, GitSyncRuntime, GitPreviewAvailability, GitAssetHistoryConfirmation, GitDocumentDeletionStart. Tests: git-apply-plan, git-preview-availability, git-asset-history, git-deletion-start. Probes: git-sync-api-native.py, git-deletion-joined-native.mjs, git-deletion-joined-du.cjs and generated local evidence. Temporary diagnostic wrapper edits removed. Notes records shell wildcard/diagnostic indentation failures. Existing deployed services/config, fixed credentials, user manuscripts, external repositories unchanged.
Checklist stays4/8: actual runtime mixed assets now proven, but asset-specific browser file-tree delivery and continue-asset button using live endpoint still need qualification. Next extend UI gates around asset creation/replacement/deletion (including reload and realtime checks) and HTTP asset continuation. Then distinct users/ACL milestone6, candidate full regression7, actual GitHub acceptance8 and original Prism goal audit. Do not claim actual GitHub, live asset UI, or overall goal complete.

### Asset browser acceptance checkpoint
Extend disposable actual-runtime fixture with a loopback production router/session/CSRF listener and UI gates before asset writes, during recovery, after add/replace/delete. Browser must click continue-asset and resume, verify native doc/file types and replacement IDs, real-time removal and reload persistence. Production deployment remains untouched. Current probe running; discovered native rail label is File tree, corrected next-run selector from Files.

### Milestone 5 complete: actual browser asset recovery and realtime file tree
Final run passed with production Git routes over disposable loopback listener, native sessions/CSRF and actual runtime provider. Browser loaded in-flight operation, explicitly clicked Continue interrupted asset change, confirmed1/3, then Continue remaining changes. PNG/SVG/TEX appeared without reload; DOM doc/file kinds and native IDs checked. Replacement changed both asset IDs and removed old IDs; reload retained replacements. Mixed deletion removed all3 paths in realtime and after reload. Existing full editor text/peer edit, stale review refusal, branch switch/merge, Git graph/diff and interrupted document deletion UI still pass. Test process exited0, report passed=true,assetBrowserRecoveryVerified=true,assetRealtimeTreeAndReloadVerified=true,runtimeAssetApplyVerified=true,pageErrors=[],disposableDataRemoved=true. Evidence:plan/git-asset-browser-run.log and plan/git-application-native-ui/editor-run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json. Added/replaced screenshots visually inspected; fixture is deliberately plain-text and arbitrary binary, NOT PDF compile/image decoding qualification.
Changed this turn: plan/git-runtime-http-probe.mjs(new),plan/git-deletion-joined-native.mjs,plan/git-editor-native-ui.py,planning records/generated evidence. Two earlier probe failures were selector errors (Files vs File tree, then toggling already-selected pane), fixed and full run repeated successfully. Syntax checked; no production source changes this turn. Existing277 backend/46frontend results remain previous checkpoints, not rerun this turn. All own data removed; no active processes. Deployment/config/fixed credentials/user manuscripts/external repositories untouched.
User-visible stable Git checklist is now5/8:1 HTTPS transport,2 backend regression,3 native lifecycle/recovery,4 branches,5 attachments DONE. Remaining6 distinct-user concurrent editing/access boundaries,7 candidate deployment/full regression,8 actual GitHub roundtrip/final acceptance/demo. Overall Prism goal still incomplete; no external push/PR/deployment approval inferred. Next6 verify real owner/collaborator sessions and write/read-only/revoked/outsider roles, preserve simultaneous edits and reject stale apply; stable accounts must not rotate passwords.

### Milestone6 distinct-user acceptance implementation checkpoint
Reuse existing permission-reviewer.json unchanged; independent browser context logs into fixed reviewer account. Fresh fixture includes that actual user as collaborator. Verify peer edits propagate to owner, stale apply rejects, read-only user can read but cannot prepare/apply, a preview prepared before revocation cannot claim/write afterward, removed user cannot read operation/project, and restore membership only on own disposable project before remaining regression. Credentials and existing project memberships untouched. End-to-end run pending.

### Milestone6 complete: distinct authenticated collaborator and access changes
Reused existing fixed permission-reviewer.json (no account creation/password rotation). Owner and reviewer logged into separate browser contexts; disposable fixture explicitly added actual reviewer ID as collaborator. Reviewer browser edited manuscript, owner received realtime update; stale owner Git preview refused, fresh resolution preserved peer text, and both distinct browsers received final text without reload.
Actual runtime/native AuthorizationManager checks: reviewer could prepare a preview while writable; after changing only disposable project to readOnly, read remained allowed but write/prepare/apply returned403; no application claim/admission appeared and manuscript bytes stayed unchanged. After removing reviewer from fixture, project and preview/application reads and writes returned403. Finally restored fixture membership for remaining run. Existing other projects/user records/credentials untouched. This proves stale preview cannot retain revoked authority, not an arbitrary stress/load claim.
Full joined browser/runtime regression exited0:distinctUserAccessVerified=true,distinctAuthenticatedEditorsVerified=true,peerBrowserEditPreserved=true,staleBrowserReviewRejected=true,assetBrowserRecoveryVerified=true,assetRealtimeTreeAndReloadVerified=true,passed=true,pageErrors=[],disposableDataRemoved=true. Evidence plan/git-distinct-users-browser-run.log and plan/git-application-native-ui/editor-run-session-http-full-apply-repository-native-edit-dirty-flush-coordinator-prepare.json. Existing attachment lifecycle, branches, graph/diff, session/CSRF and interrupted document deletion still passed. Node/Python syntax checks pass. This turn changed only plan/git-deletion-joined-native.mjs,plan/git-editor-native-ui.py and records/evidence; no production source/deployment change, no new backend unit run. No active processes.
Stable Git checklist now6/8. Next7 build isolated candidate containing current Git/native DU/history code and run full regression from its own served assets/services (remove reliance on module-copy/browser asset relay for release qualification). Keep user demo18080 and fixed accounts unchanged until stable. Then8 actual GitHub roundtrip/final acceptance/demo; full original Prism scope remains active and must still be audited.

### Milestone7 candidate build checkpoint
Live candidate18081 confirmed v43-deletion; demo18080 v41. Scoped source inventory compares201 current modified/new production paths against actual candidate hashes:139 differ (Git runtime/frontend/native DU/history plus previously tested Prism UI and deletion guards). Freeze these into plan/git-candidate-v44-context with SHA256 manifest and base v43; build v44-git including its own production webpack assets. No node_modules/runtime data/private settings copied. Existing base95 layers, host51GiB available. Build only first; verify image files before isolated candidate activation and direct-service regression. Preserve demo, fixed accounts and manuscripts.

### Candidate build running; activation not performed
Source delta frozen139/201 files. Docker build session49579 remains live; dependencies completed, production webpack running. Resume by polling same handle and reading plan/git-candidate-v44-build.log; no failed/terminal build evidence, do not duplicate. Prepared candidate-only runtime compose/settings, immutable image verifier and guarded deploy script (syntax checked). No activation or credential key creation occurred. Next: terminal build result→verify201 source hashes/image ID→guarded isolated candidate activation→direct HTTP/assets/native-service regression. User stable checklist remains6/8; original Prism/Git goal active.

### v44 built, source verified and isolated candidate activated
Original build session49579 exited0; production webpack compiled with2 warnings in368507ms. Image overleaf-agent-acceptance:20261101-v44-git sha256:71ef785bea1849496d47503f67523a002d229470d82199419f9ff4f1cd658994; all201 source hashes verified by plan/git-candidate-verify-image.py (plan/git-candidate-image-verification.json). Guarded deployment checked zero active agent/Git operation, retained existing tokens and fixed accounts; generated/reused private0600 Git credential key. Candidate18081 now v44 with Git/native reviewed writes enabled. Demo18080 remainsv41 and HTTP200. Candidate initially502 during ordinary runit startup, then login200. Rollback old compose/image recorded in plan/git-candidate-deploy.json; no external publication.
Prepared plan/git-candidate-fixture.mjs and plan/git-candidate-direct-browser.py for direct installed-module/native-service/served-asset test with valid LaTeX + PNG/SVG/notes, actual Git graph/diff/apply and PDF text/reload. Syntax checked; fixture avoids relay/module overrides and preserves created project identity on failure. Direct test live session8055, log plan/git-candidate-direct-browser.log. No success claimed yet; stable checklist6/8. Build process terminal; next inspect direct test handle/report, fix evidence-backed failures, broaden candidate regression before milestone7 completion.

### Direct v44 candidate HTTP/assets/native services and PDF acceptance passed
Direct script plan/git-candidate-direct-browser.py exited0 after fixing fixture-only filesystem ownership: root-run seed created private Git dirs root:root700, deployed web is www-data. Corrected only /var/lib/overleaf/git-sync and repositories parent ownership plus exact fixture checkout de7244d5-9299-4d49-8d99-ad8bf1b6a59d; seed helper now uses /var/lib/overleaf uid/gid recursively for its new checkout, rejects symlinks. No production source/image change required. Initial graph HTTP500 was EACCES, not missing API; original fixture resumed without recreation.
Real candidate project6ae63d842901c3da7121eb14 (Git candidate direct acceptance fc2a0270-7e60-47ee-8a0e-06b5d12de04f) now has main.tex,notes.tex,diagram.svg,pixel.png; native snapshot verifies exact main text and2assets. Browser used served production assets and actual installed Git router/DU/history services, no page.route/HTTP relay/module copies. Graph and line diff displayed; user apply button completed all4 files; native gate cleared; text/file tree/reload correct; actual compile success and downloaded PDF text contain reviewed update. Report plan/git-candidate-direct-browser.json passed=true,pageErrors=[],pdfVerified=true,reloadVerified=true. PDF/text/screenshot under plan/git-candidate-direct.*. Fixture deliberately retained for continuation, identity recorded in git-candidate-direct-fixture.json; no duplicate seed on retry. Both fixed accounts unchanged; demo18080 untouched. Image/build and test processes terminal; no active sessions.
Milestone7 remains in progress: direct creation/text/PDF passed, but extend candidate-own-services checks for branch operations, replacement/deletion/recovery and assistant compatibility before stable acceptance. Then milestone8 real GitHub roundtrip/final review; full original Prism requirements still require final audit. Do not mark whole goal or milestone7 complete from this single candidate scenario.

### Candidate rendered PDF acceptance in progress
Previous user-format-only turn made no implementation progress. Revalidated running v44 candidate. Next run a repeatable browser check on retained fixture: fixed-account login, actual served editor text/tree, compile, wait for visible PDF canvas and rendered text, reload and verify rendering again. No injected assets/routes or fixture recreation. Then continue candidate lifecycle/branch/assistant coverage; checklist remains6/8.

### Direct rendered PDF regression found (milestone7 still6/8)
plan/git-candidate-rendered-pdf.py ran against installed v44 and retained fixture, no injected assets. First compile success and actual canvas617x872 with958 dark pixels plus textLayer supporting material verified. Immediate reload then failed90s canvas wait; UI displayed previous compile still running. Report plan/git-candidate-rendered-pdf.json passed=false, afterCompile proof retained; screenshot/log saved. No page JS errors. Session19940 terminal exit1. Live process inspection afterward showed no latex/tex processes, only service node processes; this alone does not prove lock leak. Investigate compile request ordering/423 and frontend automatic reload compilation, distinguish transient overlap from persisted state before fixing. No production files changed; demo and fixed credentials unchanged. Overall goal active.

### Rendered PDF sequencing evidence and normal reload acceptance
Trace run29013 terminal exit1 reproduced refresh compile-in-progress: two observed responses success then compile-in-progress ~1.9s apart. Original script clicks Recompile immediately after editor text appears, before initial automatic compile settles; expect_response can match that automatic request rather than the manual one. This does not prove a leaked CLSI lock. Updated plan/git-candidate-rendered-pdf.py records request/response sequence and waits initial actual PDF render before manual compile. Sequenced run75158 exited0: auto_compile=true success, manual success, reload auto_compile=true success; three canvases617x872 with958 dark pixels and expected supporting-material text. Screenshot visually inspected: right-pane PDF fully rendered. Evidence git-candidate-rendered-pdf-sequenced.json/.log/.png, earlier failed original/trace artifacts preserved. No production fix claimed; immediate overlapping compile/reload behavior remains separate unresolved UX coverage. No test session live. Candidate milestone7 still6/8; next attachment replacement/deletion and branch direct regression, then assistant compatibility/full Prism audit and actualGitHub milestone8. No demo or credential change.

### Direct candidate attachment lifecycle plan
Use retained fixture only; guard exact project/name/binding and repository head. Capture native asset IDs/bytes before change. Create a local fixture commit replacing SVG and PNG; review/apply through served candidate browser, verify exact Git bytes and replacement IDs plus cleared admission, then refresh tree. Follow with reviewed deletion of fixture attachments/notes. Keep lifecycle state on disk to resume without duplicate commit; no external remote or user manuscript touched.

### Direct v44 attachment replacement and deletion passed
Added guarded fixture-only plan/git-candidate-lifecycle.mjs/.py, persisted git-candidate-lifecycle-state.json for resume. Local checkout commit0c498b1ae6c92a7ab4f513ce4bf02a80aa7bcf7a replaces SVG+PNG; actual served Git UI reviewed/applied. Native snapshot all bytes exactly match Git, assets have new assetId/hash, no application admission remains, main.tex unchanged, tree/reload passed. Initial47039 exited1 due test-only row.id versus actual row.assetId; corrected assertions, inspected applied binding before resuming, no duplicate write. Resume28838 completed both phases: subsequent local commitfd399696f37b5b8b82a1d197b3772092b0650e1b deletes SVG/PNG/notes via actual review/apply. Native snapshot onlymain.tex matchesGit; tree removals and reload pass, pageErrors[]. Files git-candidate-lifecycle.log/-native.log/-state.json and replace/delete/latest screenshots. No module relay, no production edits, no external GitHub push, fixed accounts/demo unchanged. Retained fixture nowonlymain.tex; old direct-create verifier expects4files so do not rerun it unchanged. Next candidate branch switch/merge and assistant compatibility; checklist6/8, original goal incomplete. Early compile/reload overlap remains separate follow-up.

### Direct branch acceptance executable plan
Retained lifecycle fixture is main-only at fd399696. Guard binding/name/head/no application, create only local candidate-review with changed manuscript and candidate-identical at same base. Browser review/apply switch to feature, back main, then identical (zero-file branch transition); native verify branch/base/text and reload. Persist fixture preparation/results; preserve original manuscript and external repositories. Branch merge is subsequent coverage.

### Direct candidate branch switch acceptance complete
plan/git-candidate-branches.mjs/.py created guarded local candidate-review commit6235ffee09086e79a0d96759d554f8b2c456063e and candidate-identical at mainfd399696. Actual candidate browser review/apply switched to feature, backmain, then identical branch (no text difference). Native binding branch/base and exact main.tex checked after each; reload text persisted, no JS errors. First run77960 exited1 after first phase due test clicking already-open Git tab and hiding graph; script now checks aria-selected before clicking, resumes completed phases. Run23797 exited0. Evidence git-candidate-branches-state.json/.log/-native.log/-latest.png. Current fixture binding refs/heads/candidate-identical atfd399696; main.tex unchanged from original reviewed text. Local checkout HEAD remainsmain; branch reader uses refs. No production edits, demo/credentials unchanged. Next candidate branch merge and agent compatibility; milestone7 still6/8, overall goal active.

### Direct candidate merge review plan
Use existing candidate-identical destination and candidate-review source in retained fixture. Browser reviews actual line diff, applies merge, verifies exact merged text with unchanged destination ref/base and persisted source/destination/base ancestry. Reload must retain merge status and prevent starting another branch transition until commit. This local no-origin fixture cannot qualify actual remote push or two-parent publication; preserve distinction and pending merge for follow-up.

### Direct candidate branch merge review/application passed
Added plan/git-candidate-merge.mjs/.py using guarded retained fixture. Actual v44 served UI reviewed main.tex line diff and applied candidate-review into candidate-identical. Native verification proves exact merged manuscript, destination binding/ref/base remainfd399696, pendingMerge stores source6235ffee, commonbase/destinationfd399696 and operation20dce307-f52c-495e-aee7-a4be2071dece; application admission cleared. Browser reload retains manuscript and pending-merge notice, branch switch control absent until commit; no JS errors. Session80665 terminal exit0. Evidence git-candidate-merge-state.json/.log/-native.log/-latest.png. pushVerified=false explicitly: fixture has no remote, no two-parent commit or publication claimed by this test. Prior localHTTPS/two-parent evidence remains narrower than actualGitHub. Current retained fixture merged text differsGitdestination and haspendingMerge; do not rerun branch/lifecycle verification assuming cleanbinding. Next actualmodel assistant read-after-Git compatibility using fixed account and this mergedmanuscript; then broader combined regression. Originalplan still has authenticated Zotero and end-to-end gates incomplete. No production edits/demo/credential changes. Progress6/8.

### Actual assistant compatibility after Git merge
Run plan/git-candidate-assistant.py on retained merged fixture using fixed account and actual served UI/model. Ask filesystem read of main.tex, exact paragraph+line, no edits/compile. Persist task/conversation IDs immediately to avoid duplicate request on resume. Require actual command activity, correct merged phrase, completed status/no proposals, bubbles/avatars, native exacttext/pendingMerge unchanged before/after. No mocked model/routes. Do not treat this readback check as all remaining Prism acceptance.

### Actual candidate assistant compatibility failed: newly injected CUA connection
Actual browser taskada3b766-66b1-4208-991c-05be9c53f171 did not execute model tools. Direct authenticated task GET (statusprobe25557 exit0) proves failed: Document task has an unexpected external tool connection; activity0. Browser53722 terminal exit1 after completed-onlywait; its initialreport stayedrunning because listener excluded conversationpollURLs. Fixed test capture to include conversations and fail promptly on terminalfailure, no retry task submitted. Existing conversation/task IDs preserved. Daemon47291 livehealthstatusok/running0.
Independent real Codex app-server initialization using current DOCUMENT_CONFIG_OVERRIDES reproduces: configured MCP names all disabled/toolcount0, but auto-added cua_repl connected/toolcount3. No model turn started in diagnostic. Feature overrides browser_use_external=false,in_app_browser=false,browser_use_full_cdp_access=false did not remove it (62528 exit0 diagnostic stillconnected); reverted ineffective production additions. Explicit thread mcp_servers.cua_repl.enabled=false rejected thread/start -32600 (diagnostic terminal1). Current diagnostic script retains this failing experiment; original statusreport contains connectedserverevidence. Do NOT relax assertDisabledMcpServers, restart daemon blindly, or claim repaired. Next inspect CLI internal CUA configuration/schema/plugin origin or task-scoped process environment; fix isolation with real runtime proof, unit regression then guarded daemonactivation and repeat actualbrowser request. All test sessions terminal. No production changes retained; demo and credentials unchanged. Updated prism-current-capabilities.md to v41/v44 observedstate and currentGit evidence; historicaltests explicitly notcurrentfullacceptance. Progress6/8, overallgoal active.

### Plugin isolation repaired; actual assistant after Git merge passed
Runtime inventory now includespluginId: cua_repl came from unified-computer-use@openai-bundled, not config.mcp_servers. Task-specific plugins map with enabledfalse for every effectiveconfiguredplugin removes plugin-providedconnections. Implemented disabledPluginConfiguration in services/agent/src/document-harness.mjs; thread/start disablesbothMCPandplugins, copyingonlyenablebits, no globalconfigedit. assertDisabledMcpServers unchanged/failclosed. Tests verify plugin settings notcopied and unknownactiveconnections stillreject. Focused5 and all117Agenttests pass (git-candidate-plugin-isolation-tests.log,git-candidate-agent-regression.log). Real CLI diagnostic passes sameguard:5configuredserversdisabled/toolcount0,no cua_repl. CurrentgeneratedAPI schema underplan/codex-cua-schema isdiagnostic only.
Controlled existing restartscript confirmedrunning0/expectedPID73960; sharedtestdaemon now23658 withdocumentHarness/speechhealthy. This restarts assistant backend for both18080/18081; webimages andfixedcredentials unchanged. Firstbrowserretry55872 selectedoldfailedtask because responsecaptureaccepteddefaultconversationGET; correctedcaptureonlynewmessagePOSTor matchingknownTaskId, preserved oldfailure archive. Realnewtaskec628b1d-9bbe-49c2-84ad-67bf5d25c751 passedsession2340 exit0: actualfilesystemcommand,3activityentries, exactmergedparagraph andline4, noeditproposals, bubbles/avatars/Executionvisible, noJSerrors. Native before/after exacttext+pendingMergeequal. Evidence git-candidate-assistant.json/.png/-native.log; oldfailed task retained before-plugin-fix.json/status.json. No live tests. Candidate checkliststill6/8: remainingcombinedregression andactualGitHub/finalacceptance plusfullPrismopenrequirements. Do notclaim117unittests orreadbackcoversallfeatures.

### Actual edit-after-Git combined compatibility plan
Use retained synthetic merged project: actualmodel reads main.tex, appends one exact sentence before enddocument, compiles via controlledtool, returnsproposal. Beforeaccept nativebytes/mergeancestry must remainunchanged; browserlinediff andexplicitaccept thenexactnativeexpectedtext/reload/PDFtext. Task/conversation andacceptedstate persisted forresume. ExistingGitpendingMerge must surviveAIedit. No externalpush or realmanuscriptmutation. Script plan/git-candidate-assistant-edit.py.

### Actual AI edit after Git merge plus reviewed application/PDF passed
Task8f7b4606-3898-4876-82fe-207a60a6add1 used actualfilesystemcommands, compile_project and inspect_compiled_pdf; returnedone main.tex proposal appendingexactsentence beforeenddocument. Nativebeforeaccept exactmergedtext/pendingMergeunchanged. Browserlinediff andexplicitAcceptchange passed; nativeafter matchesexactexpectedtext andsamependingMerge; reloadeditor andrenderedPDFtext includeavailableforreview. Bubbles/avatars/Executionvisible,noJSerrors. Firstsession79305 modelcompleted buttestcloseddefault-openreview; correctedtestopencheck,resumedsameconversation/proposalwithnonewmodelcall. Resume45099terminalexit0. Reportgit-candidate-assistant-edit.jsonpassedtrue,acceptedtrue,renderedPdfVerifiedtrue;2commands/6activityentries. Currentfixturemain.tex nowcontainsadditional sentence; earlierreadonly/mergeverifiers expectingoldtext mustnotberununmodified. Noimagechangeorcredentialrotation, noexternalpush. Candidate7 stillrequires own-services collaborator/access/recovery confirmation andfinalcombinedaudit; overallgoalactive, checklist6/8. Alltestsessionsterminal.

### Direct candidate collaboration and authorization plan
Two existing fixedaccounts/separatebrowsercontexts on retainedfixture. Addrevieweronlytofixture, edituniquesyntheticcomment inpeerbrowser, observeownerrealtime+peerreload. DowngradefixturepeerreadOnly: statusread200/previewwrite403; removepeer: reads/writes403. Removeexactmarkerthroughownereditor andverifyfinalnativebytes matchAIeditedfixture. Alwaysremovefixturepeerrolefinally, nootherprojectmembershiporcredentialchanges. Actualv44HTTP/services, no relay.

### Direct candidate distinct accounts/realtime and ACL passed
plan/git-candidate-collaboration.py/.mjs session71352 exited0, reportgit-candidate-collaboration.jsonpassedtrue,pageErrors[]. Existingfixedowner/reviewer separateauthenticatedbrowsercontexts. Revieweredituniquemarker propagatedlive toowner andsurvivedpeerreload. Nativefixture-onlyrole downgrade: GitstatusGET200 andpreviewPOST403; removal: both403. Ownerremovedexactsynthmarker, nativeexactmain.texmatchespriorAIeditedtext. Reviewerremovedfromfixturefinally, originalothermemberships/credentialsuntouched. Currentfixturecontentandpendingmerge retained, noapplicationgate, noexternalpublication. ThisprovesdirectcandidateHTTP/nativeaccessandcollaboration, notstressload. Nextdirectcandidateinterruptedresponse/recoverycheck andmilestone7coverageaudit; actualGitHubmilestone8andoriginalPrismrequirementsremain. Checklist6/8, noactivetests.

### Direct candidate lost-success-response acceptance plan
Use separate disposablefixture/state git-candidate-recovery-fixture.json because retainedcombinedfixturehaspendingmerge. ActualservedGitUI/nativeapplication; PlaywrightforwardsoriginalPOSTunchanged, thenabortsitsresponseafterserver200. RequireautomaticGETsameoperation, exactlyonePOST,noimplicitreplay, confirmed4nativefiles/clearedgate, correcttree/reload/PDF. No productionmoduleorassetrelay. Persistcreationidentitybeforecontinuation, noexternalremote.

### Direct lost-success-response recovery passed; candidate coverage audit
Session56098 exited0: actualv44POSTapplied4files thenbrowserrouteabortedits200response. FrontendGETsameoperationconfirmedfiles-applied; exactly1mutation/1readback, noautowritereplay. Native4files/2assets/exacttext/gatecleared, tree/reload/PDFpass,pageErrors[]. Evidencegit-candidate-recovery-browser.json/.log/.pdf/.png,fixture6ae6452c036df0304b4ac022 checkout e6f33aa6-44b2-407e-b710-e6231f9e8fec retained. Actualroutesandservices; interceptiononlydiscardsresponse, nomockapplicationormodulecopy. Originalcombinedfixtureandpendingmergeuntouched.
Compiledcurrent9evidencegroups in git-candidate-combined-audit.json; this is a coverage index, not independent rerun of all scenarios. Milestone7stillincomplete: earlymanualcompile/reload overlap requires request-correlated diagnosis, and finalsource/runtime inventory must include hostAgentpluginfix. Nextfinishtheseconcretegapsbefore7/8claim. ActualGitHubbelongs8, fullPrism/Zoteroopenrequirements unchanged. Allsessions terminal, noexternalwrite/democredentialchange.

### Early compile/reload request correlation
Run originalearlyclickscenario onseparate recoveryfixture with requestIDs/query/timestamps andreloadtimestamp. Detectbusyerrorimmediately; ifpresentverifyexplicitRecompile recovery insteadwaiting90s. Thisdiagnosticdistinguishes wrong-responsecapture fromproductunrecoveredbusyUI; manualrecoveryisnotautomaticrecovery. NoDOM/HTTPinjection orsourcechanges.

### Compile reload failure reproduced and bounded retry implemented; v45 build running
Request-correlated earlyclickrun73058passed sequentially(firstObservedResponseId2); strongerinflightreload87465failed: initialauto1success, manual2sent, reload0.001safterrequest2, newauto3returnedtoo-recently-compiled andUIstayedServerError/noPDF90s. Evidencegit-candidate-compile-inflight.json/.log/.png; thisisactualtransienterrorhandlinggap, notprooflockleak. Addedcompile-with-retry.ts andwiredcompiler.ts: onlyisAutoCompileOnLoad retriescompile-in-progress/too-recently-compiled after1/2/4s, max4requests, cancellableAbortSignal; manual/nontransientnotretried. Sevenmeaningfultests pass includingcancelpendingtimer,bothstatuses,exhaustion/manual; scopedESLintpassed. No runtimefixclaimuntilcandidateacceptance.
Beforeedits finalinventory82712verified201livev44/worktree/buildhashes andAgentPID23658; inventorydescribesthen-currentv44, nowcompilerchangesintentionallypending. Frozenv45context2changedfrontendfiles,203totalmanifesthashes in git-candidate-v45-manifest.json. Dockerbuildsession75238live, loggit-candidate-v45-build.log. Do notduplicate/restartbuild; resumepollsamehandle. Candidate18081stillv44, demo18080v41, noactivation. Afterbuildsuccessverify203imagehashes, guardedcandidate-onlyactivation (noAgenttasks/Gitadmission), rerunexactinflightreloadscenario expectingautomaticrenderwithoutmanualretry, thenupdateinventory/7audit. Overallgoalactive,6/8.

### Build observation correction
Session75238actuallyterminalexit1: defaultApplehostarchitecture causedBuildKitpull ofamd64-onlylocalbasetag andregistrydenied. Liveinspect confirmsv44linux/amd64. Retriedonlyafterterminalfailure usingexplicit--platformlinux/amd64; newbuildsession99164, loggit-candidate-v45-build-amd64.log. This supersedespreviouslive75238note. Poll99164; noactivation ornewsourcechanges.

### v45 build continuation and acceptance preparation
Repolledbuild99164live; dependenciesfetchcompleted,linkrunning. Preparedv45-onlyverify/deploy/compose preservingv44rollback andexistingprivatekeys. Guardeddeployrequiresimage203hashverification/noactiveAgent/noGitadmission. Preparedgit-candidate-v45-compile-inflight.py reproducesreloadimmediatelyaftermanualrequest, requiresautomaticPDFwithoutmanualretry andboundedrequestcount. Python syntaxpassed; scriptsnotexecutedyet. Runtimecandidatev44unchanged. Continuepollsamebuild99164/loggit-candidate-v45-build-amd64.log; donotrestartbecausequiet.

### v45 build still live; strengthened recovery evidence gate
Repolled99164live, webpackquietafterstartupwarning84s, nofailure/terminalresult. Preparedv45finalinventoryscriptfor203hashes+hostAgentPID. Tightenedinflightbrowseracceptance: mustobservetransientbusy/recentresponseafterreload thenfinalsuccess+renderwithoutmanualretry; nooverlap meansnotcovered, notpass. Noimageactivation. Remainingwork unchanged.

### Milestone7 complete: v45 build/deploy and actual automatic compile recovery
Originalbuild99164terminal0. Webpack317656ms with2sizewarnings; imageoverleaf-agent-acceptance:20261101-v45-compile sha256915c1b5a6a4867ac85fcdd7a291ac3425918136b742edb80954f2cd51a22ad8a. Image203hashesverified; guardeddeploy73274terminal0, noactiveAgent/Gitoperation, retainedkeys/volumes, rollbackv44compose. Candidateinitial502normalbootthenlogin200; demo18080login200stillv41. Finalinventory90274terminal0 compares203live/current/frozenhashes, hostAgentPID23658.
Actualv45inflightreload66037terminal0: initialauto1success; manual2sent; reload0.029saftermanualrequest; newauto3returnedcompile-in-progress; automaticretry4success~1safterbusyresponse; PDFcanvas617x872/darkpixels958+expectedtextvisible, noJSerrors, nomanualretry. Reportgit-candidate-v45-compile-inflight.json automaticRecoverytrue. Confirmsfixedbehaviorwithobservedtransient, notmerelyquietsequentialpass.
Combinedauditgit-candidate-combined-audit.jsonnowcompleteformilestone7 only,11evidencegroups. EarlierGit/Agentcasesv44; v45deltaonly2compilefiles, unchanged201sourcehashesverified,currentbehaviorchecked. StableGitchecklist7/8. Milestone8actualGitHubroundtrip/finalacceptance open; originalPrismZotero/fullobjectivealsoopen. Onlyprivategitcredentialencryptionkeyexists,no designatedGitHubtestrepo inacceptanceconfiguration. AskeduserasynchronouslyfortestGitHubURL/branch; noexternalpush/repo creation authorizedbyguessing. WhileawaitingcancontinueoriginalPrismaudit/read-onlyprep. Allbuild/deploy/tests terminal; noactivehandles.

### Original Prism remaining requirements audit resumed
Gitmilestone8awaitsdesignatedtestrepo; continueindependentoriginalPrismwork. CurrentZoterocodeimplementsauthenticatedconnect/search/import, positiveexternalcredentialgate historicallyunverified. Runv45fixedownerstatusGET plusliveCrossrefsearch/preview/reject inrecoveryfixture; ensurepreview/rejectdonotcreatebibliographyoraltermanuscript. NoexistingZoteroconnectionmutation, nofakecredentialattempt. PositiveZoterostatusmustbeverifiedlivebeforecallingblocked. Scriptprism-v45-literature.py; Gitprogressremains7/8separatelyfromwholePrism.

### Current v45 literature gate and actual missing connection confirmed
OriginalPrismworkcontinuedwhileGitHubtestrepoquestionpending. v45fixedownerZoteroGET200 reportsconnectedfalse/libraryIdnull (live, nothistoricalassumption). RealCrossref DOIsearch10.1038/171737a0, importpreview201/task287738ea-9385-4fe6-b643-d8e6611c1043, explicitReject allpassed; bibliographylistunchangedemptyandmanuscriptunchangedbefore/after, noJSerrors. Scriptprism-v45-literature.py first5938failedobsoletePaperAssistanttabselector; updatedtoactualLiterature, rerun59037terminal0. NoZoterocredential/configmutation, noactualbibliographywrite. Reportprism-v45-literature.json/.png/.log. AskeduserwhichZoterolibrarytouseandtosetdedicatedreadonlykeyinUI, notchat. GitHubURL/branchquestionalsopending; noexternalwrite. Gitchecklist7/8unchanged; positiveZoteroandfullPrismfinalauditremainopen. Furtherindependentactualcurrentfeatureauditcancontinue; notwholegoalblocked.

### Current image conversion compatibility plan
Afterpluginisolationfix, testactualPNGattachment/modelworkspaceedit/controlledcompile/reviewaccept innewdisposablev45imagefixture. Preserveexistingtextbeforeaccept; verifytranscribedintegralLaTeXandPDFafteraccept; savedconversationattachmentmetadataonly. ReuseknownprintedequationPNG, fixedowner. Persistproject/taskIDs toresumewithoutduplicatecreation/modeltask. NoGitHuborZoterocredentialsneeded.

### Current v45 actual image-to-equation acceptance passed
Newdisposableimagefixture6ae64a3f1405fb5e5615293c; realtaskfd3664a8-f16a-41e2-a9bd-1fbe220be848. PNGattachedthroughintegratedcomposer, actualworkspaceeditproducedone main.tex proposal with integral0to1x²dx=1/3. Toolactivityprovescompile_project andinspect_compiled_pdf completed. Originaleditorunchangedbeforeexplicitaccept; afteraccept/reloadcorrectLaTeXandrenderedPDFvisible,preservedsentence,noJSerrors. Savedconversationattachmentsmetadataonly(no data). Inputandfinalscreenshotsvisuallyinspected, formula matches. Session43168terminalexit0; evidenceprism-v45-image.json/.png/.log, fixtureseedrecordretained. Strengthenedscriptassertionsfortoolcompletion; recordedexistingactualactivityproof,noextra modelcall. NoGitHub/Zoteroconfiguration/realmanuscriptmutation. Gitprogress7/8unchanged; userinputsremainpending, fulloriginalgoalstillactive.

### Current v45 review layout acceptance plan
Previous turn only acknowledged progress formatting (no product progress). Continue full-objective audit with current candidate saved actual AI edit: three viewport widths, avatars/bubbles, execution details, line diff and expanded modal bounds, scroll reachability, unchanged manuscript and zero proposal writes. Reuse retained accepted conversation without model calls. Historical UI evidence alone does not prove current layout. Git checklist remains7/8; GitHub and positive Zotero external inputs remain open.

### Current v45 saved review UI acceptance passed
plan/prism-v45-review-browser.py reuses actual accepted assistant-edit conversation on candidate18081, without new model call. Three widths1440/1000/760 passed addition-line/number rendering, viewport-bounded expanded diff, closing and unchanged editor, zero proposal POSTs/noJSerrors; saved assistant/user avatars, bubble and execution disclosure visible. Report prism-v45-review-browser.json passedtrue. Narrow expanded screenshot visually inspected: green added line, old/new line numbers, accepted state and close button clear. This addition-only proposal does not test removed-line coloring, nor every scroll interaction. Initial systemPython failed missingplaywright before browser; reran existing uv package environment, session28087terminal0. Updated current capability table; no production code/deploy/account changes. Git checklist7/8 unchanged, full Prism acceptance still incomplete.

### Whole-scope acceptance audit consolidated
Read baseline/combined plan/current lifecycle source and concrete native JSON evidence. Corrected stale top-level deletion status: ProjectDeleter recovery/admission integration and native archive/restore are present and passed. Added plan/prism-final-acceptance-audit.md preserving full objective, historical-vs-current evidence, current external gaps, and actionable cancellation/diagnostic-repair checks after plugin isolation change. Candidate live inspect reportsv45-compile/running. Previous turn was progress (actual current layout acceptance); this turn audit changed next-action priority and removed misleading incomplete-implementation claim. No source changes, model calls, publication or credentials mutation. Next real current cancel→reload→newtask check; then compile-diagnostic repair. Git7/8, overall incomplete, not at impasse.

### v45 cancellation and recovery execution
Reuse disposable image acceptance project with a new conversation, preserving exact current text. Persist task/conversation IDs from actual messages response. Wait for running sleep command in task activity before cancel; verify cancellation/no proposals/unchanged editor and reload, then same-conversation readonly recovery task. No acceptance writes or daemon restart. Existing image evidence/conversation untouched.

### Current v45 cancellation passed; diagnostic repair in progress
Actual sleep90 command observed running; taskba3b44a8-98e4-404d-9e67-c38b3ac2f4ef cancelled via UI in0.10s. No proposals or manuscript mutation; reload preserves cancelled state. Same-conversation readonlytask51f3fea0-ea4e-4c1c-a87f-a3e50a2fd001 completed; source unchanged/noJSerrors. Reportprism-v45-cancel.json/.png/.log; session24852terminal0. Current compile-diagnostic runnerprism-v45-compile.py started session57268 on isolatedfixture6ae64c143fb98b69218c6978. Actual failedcompile and expliciteditableprefill/noautosubmit passed; realmodel task underway, IDs persisted. Do not restart runner if taskIDexists; inspect/resume same task. Git7/8, overall incomplete.

### Current compile-diagnostic incompatibility found and source fixed
Session57268terminal1 after waiting for proposal. Independent authenticated status45322terminal0 proves taskbd0b1939-5f58-44c4-b38f-89d669bc0339 completed with zero proposals. Actual UI-generated instruction says Do not run tools or commands; current filesystem harness therefore cannot inspect main.tex and returns only an explanation/request to paste source. This is a real current capability regression, not model timeout. Evidence prism-v45-compile.json/.log/-failure.png/-task-status.json; conversation240a2bcf-c074-43fb-beae-758250802aee, fixture6ae64c143fb98b69218c6978 remains broken intentionally and unchanged.
Changed compile-diagnostics.ts instruction to read workspace files, make smallest repair in isolated workspace, compile_project verification where available, return actual file changes for explicit review; no direct live-project write. Added assertions in existing compile-diagnostics.test.ts. Initial edit used wrongcwd and failed beforemutation; oldtests50855 notfixevidence. Correctededit, actualupdatedtests2pass/scopedESLintclean session86854terminal0; logs prism-compile-harness-prompt-tests.log/-lint.log.
Fix is SOURCE ONLY, candidate stillv45; no build/deploy yet. Next freeze/buildv46 atopv45 with thisfrontenddelta, verifyimage/source, guardedcandidateactivation, then rerunactualUI-prefill/realrepair/reviewaccept/PDF on retainedbrokenfixture. Preserve old task evidence and create a newconversation only after updatedUIverified; runnercurrentlyguards existingtaskId and needs explicitresume/newstate adaptation. Do not rerunoldtaskorclaimrepairpassed. Fullgoalactive, Git7/8 unchanged, noactiveforegroundjobs.

### v46 diagnostic prompt build
Frozen one frontenddelta compile-diagnostics.ts atopv45; remaining203manifest sources checked unchanged except intendedpromptentry. Newmanifestprism-v46-manifest.json andcontextprism-v46-context. Preparedimageverification/guardeddeployment/rollbackv45 scripts, notactivated. Buildexplicitlinux/amd64. Existingv45compilefailuretaskterminal, noforegroundacceptancetasks. Nextwaitoriginalbuildthenverifyimage/deploycandidateonly/realUIregression.

### v46 build live, acceptance preparation complete
Build session39759 verified live by write_stdin; logprism-v46-build.log shows dependency/link complete andwebpackrunning, no terminalfailure. Do not restartduplicate. Frozenmanifest includes203sourcehashes withonlycompile-diagnostics.ts changed; buildexplicitlinux/amd64 atopv45. Preparedprism-v46-verify.py,guardeddeploy.py/runtimecompose(withv45rollback),final-inventory.py andactualcompile.py. Python syntax passed. Newacceptancestateprism-v46-compile.json reuses retainedbrokenfixture6ae64c143fb98b69218c6978, no task yet. Runner selectsnewconversation, requiresactualnewUIprompt, capturesmodeltaskidentity, waits terminal beforeassertingproposal toavoidprevious180swaitaftercompletednoprop.
Candidate18081remainsv45/demo18080v41, noactivation. Nextpoll39759; uponterminalsuccessverifyimage203hashes,deploywithnoactivetask/Gitadmissionguards,loginreadiness,runactualcompileacceptance thenfinalinventory. Overallactive/Git7/8.

### v46 built, activated and actual diagnostic repair passed
Originalbuild39759terminal0:webpack98.086s/twobundlesizewarnings,image9825087be317fc42218a0cb3267a30e9925ab73cba46d04c165d7dc868b5ff1f.203imagehashesverified; guardeddeploy31854terminal0/noactiveAgentorGitapplication; initial502bootthenlogin200. Candidatev46/demo unchanged. Finalinventory203live/worktreehashespass,AgentPID23658.
Initialbrowser63966terminal1:messagesrejectedLocalagentbusy,no taskcreated; oldcompletedstatusbriefly causedtestKeyError. Preservedprism-v46-compile-busy.json; fixrunnerwaitactualsubmissionresponse, boundedexplicit429retry, requiresnewtaskidentity/terminal result. Successful50046terminal0 hadsingle201, task7c66cbb5-73fe-4ffd-99ff-3ae26bd5c711/conversation7c88d7f6-447d-4d2f-813b-9e883cc7cc8f. Actualprefillusesworkspaceinstruction; read/edit/compile_project/inspect_compiled_pdfcomplete; missingenddocumentrepairproposedwithoutlivechange. Explicitaccept preservesoriginalsentence;compile success/extractedPDFtextverified. FirstscreenshottooearlyforPDFcanvas; separatereadonlyreload77106terminal0 provesvisiblecanvas/textlayerandpersistedenddocument. Reportprism-v46-compile.jsonpassedtrue,renderedPdfAfterReloadtrue; screenshots/log/PDF retained. Sourcefixnowcandidateaccepted, notmerelyunittests. Currentbrokenfixture nowrepaired; donotrerunfirst-runseedacceptanceunchanged. Allforegroundjobs terminal. Git7/8/fullgoalactive; externalGitHub/Zoterogatesstillopen, finalcompatibility/handoffpending.

### Prompt routing audit and candidate handoff prepared
Searched remaining tool/command bans across Webwritingentrypoints+Agent. Taskmanager no-tools instruction is limitedto writing-assist-json; AgentProvider submits supplieduserMessage to thistext-onlychannel. Codexdocumentbranch bypasseslegacybuildPrompt andpassesopts.instruction/currentworkspace to runDocumentHarness; noadditionaldocument-entrycontradictionfound. Existingtaskmanagertests10pass (prism-v46-prompt-routing-tests.log), no productchange. Addedprism-candidate-handoff.md withfixedcredentiallocations(no secretcopy),candidate/demo distinction,version-scopedevidence,rollbackguardand remainingrealGitHub/Zoterogates. Prior turnwasprogress(actualv46repairacceptance). Thisturncompletedfollow-upentrypointaudit/handoffdocument; noactivejobs/newmodelcalls. Fullgoalstillincomplete; do notexpandtestscopejusttoavoidexternalinputgate. Nextreviewremainingcombinedrequirementmatrixagainstthishandoff; ifonlyexternalgatesremain,revalidateconnections andbeginblocked audit ratherthanrepeatpassedtests.

### External gate revalidated; blocked audit turn1
FreshauthenticatedcandidateZoteroGET200 connectedfalse/libraryIdnull (prism-external-gates.json;38781terminal0). No designatedmanuscriptGitHubtestrepo/branchreceived; worktreeoriginLapulatos/overleaf isimplementationrepo, notauthorizedtestdestination. Independentcurrentcancellation/diagnosticrepair/promptaudit/handoffnowdone; updatedremainingactionsinsteadrepeatingpassedtests. RequestedtestURL/branch+allowedtestwrites andZoterolibraryconnectionviaUI(nochatkey). Actualexternalacceptance/finaldemostillunproven. Firsttrueimpasseturntrackedinprism-blocked-audit.json count1; leavegoalactiveuntilthreeconsecutiveblockedturns. Noactivejobs/source/deploy/credentialchanges.

### External blocker audit turn2
Authenticated status rechecked by process58840terminal0:Zoterodisconnected/libraryIdnull. No user response designatingGitHubtestrepo/branch orZoterolibrary. Sameexternalconditionpersists, noactivejobsorindependentrequiredimplementationstepavailable aftercurrentaudits. Priorgoalturnclassifiedno-progress/externalblocked, notverifiedprocesswait. Count2;goalremainsactiveuntilthreshold3. No code/deploy/accountchanges.

### External blocker audit turn3 — threshold met
Thirdconsecutivegoalturnwithsamegenuineexternaldependency. Authenticatedstatus42147terminal0 confirmsZoteroconnectedfalse/libraryIdnull; no designatedGitHubtestrepo/branch userresponse. Noactivejobsorindependentrequiredworkavailable; previousgoalturnno-progressblocked, notliveprocesswait. Fullscope remainsincomplete; requestblockedstatusnow. Resumewhenuserprovidestestdestination/branchscope andlibraryconnection; keepv46candidate/fixedcredentials/evidence.

### Resumed external blocker audit, second goal turn
User reactivated goal; fresh count replaces prior blocked run. First resumed check51292 confirmed disconnected; user then requested and received fixed login credentials. Current second resumed check3875 terminal0 again reports Zotero disconnected and no designated GitHub destination received. No new implementation/acceptance evidence or independent required work; account information alone does not resolve external dependency. Goal active, fresh blocker count2; no deployment/manuscript/credential changes.

### User-reported login session error — active repair
New user screenshot supplies independent actionable bug; external-gate blocked audit no longer applies. Reproduce two local ports sharing a browser cookie jar, inspect cookie names without values, isolate candidate cookie if collisionconfirmed, restart only candidate after idle guards, rerun same browser sequence. Fixedcredentialsunchanged. Three steps: reproduce,fix,verify.

### User login session collision fixed and verified
Samebrowsercandidate18081loginpage→demo18080loginpage→candidatecredentialsPOST reproduced403/sessionerror withoneoverleaf.sid cookie (prism-session-before.json). Rootcause localports sharehostcookiejar whileapps haveisolatedsessions. Scopedconfigurationfix plan/git-candidate-runtime-settings.cjs sets cookieName overleaf.candidate.sid. Guardedcandidate-onlyrestart37347terminal0 afterAgentidle/noGitadmission; noaccount/password/sourceimagechanges. Samebrowsersequence57936terminal0 nowtwodistinctcookies,login200/projectredirect,nosessionerror (prism-session-after.json/.png). User should reloadcandidate/login oncefornewCSRFsession; nocookiepurge/passwordrotationneeded. Bugrepair3/3complete; wholegoalstillincomplete/externalgatespending. Priorblockedstreakresetbyactualuserbugfix.

### Cookie isolation editor compatibility passed
Read-only samebrowsercrossportacceptance90815terminal0: candidate login200, native editor opens retainedsyntheticproject; login to demo insecondtab; candidateGitstatusGET200; editorreloadexacttextunchanged; assistantModelenabled. Evidence prism-session-editor.py/.json/.png. No manuscript/modeltask changes. Follow-up2/2complete: authenticatedproject/APIaccessandreload afterotherinstancelogin. ExternalGitHub/Zoterogates remain; previoususerbugrepairwasprogress, no blockedthresholdcountfromoldrun. Currentcandidatev46+uniquecookie config.

### External dependency after completed login repair — turn1
Previousgoalturnmadeprogress: actualsamebrowsereditor/Gitaccess/reloadverification. Currentauthenticatedstatus10571terminal0 stillZoterodisconnected; noGitHubtestdestination/branchreceived. Independentrepairworkcomplete; noactivejobs. Freshconsecutiveblockedcount1, goalactive. Candidate andcredentialsunchanged.

### Post-login external dependency audit turn2
Authenticatedcheck1958terminal0 confirmsZoterodisconnected/no library. No newGitHubtestdestination/branchdesignationreceived. Sameexternalcondition; noindependentrequiredworkorlivejobs. Previousgoalturnno-progress, freshcount2, goalactive. No project/config/accountchanges.

### Post-login external dependency audit turn3
Third consecutive turn after login repair with identical external blocker. Authenticated check52022terminal0 confirms Zotero disconnected/libraryIdnull; no designated GitHub test repository/branch supplied. No independent remaining step or running job. Mark goal blocked, not complete. Preserve v46, cookie isolation, fixed credentials and all acceptance evidence.

### User supplied external acceptance target
Authorized Gitee https://gitee.com/lapulatos/overleaf-repo-test branchrepo-test commit/push/test/modify. Zotero userreportsconfigured. Resetblocker; verifyconnectionlive. Three tasks:connection/config,realGiteeroundtrip,realZoteroimport. CandidateallowlistcurrentlyGitHubonly; addscopedGiteesupportaftertransportreview. Neverwriteotherbranches/useimplementationorigin.

### User-designated Gitee target and positive Zotero acceptance
Userexplicitlyauthorizedcommit/push/test/modifyonlyhttps://gitee.com/lapulatos/overleaf-repo-test branchrepo-test. Authorizationsavedprism-authorized-remote.json; noexternalwriteyet. Giteeisuserchosenprovider,replacesGitHub-specificacceptancetarget. ExistingcandidateallowlistGitHubonly; addedgitee.comtoisolatedruntime-settings,guardedrestart70734terminal0(noAgenttasks/noGitapplication),uniquecookieretained. Unauthenticatedls-remoterequirescredentials; projectedGitcredentialDBinitiallyempty. Createddedicatednativeproject6ae6a79ece5f0b9e3242f0b0 via guardedseed,fixtureprism-gitee-fixture.json. AskeduserasyncsaveaccesstokeninthisprojectGitpanel(nochatsecret).
Zoteroliveconnectedtrue/library9531967. Actualbrowsersearch/preview/reject/createbibliography/explicitaccept/reloadpassed45610; firstattempt56477hitstartup502/loginselectorbeforeanymutationandretainedstartup-failureartifacts. Currentprism-zotero-live.json passed: itemUWGTTAHGwithDOI, rejecttask0bd67605-a085-44b5-83da-0bdb85d05151,acceptedtaskc9d9b5e6-2d54-4287-ad4d-30932d2d857e. Testproject6ae6452c036df0304b4ac022 nowincludeszotero-acceptance.bib doc6ae6a80e930f773d84038224 (oldGitfixture4filesassumptionnowoutdated).
Paginatedreadonlylibraryquery40itemsfoundnoDOI. ActualnoDOIitemR277FHJP(SemCoder) search/preview/reject/appendexistingbib/accept/reloadbothentriespassed34449; acceptedtaskdc226f32-2e53-4891-bfab-67d157ce0a67. Exactpreviewbeforeprefixpreserved; noDOIfabricated; bothkeysvisibleinreloadednativeeditor; noJSerrors/manuscriptchanges. Reportsprism-zotero-no-doi.json andscreenshots. Zoterooriginalconnectionpreserved,nolibrarywrites,nodisconnecttestclaimed. No secretsprinted. Currentthree-stepconnection/Giteesync/Zoteroimportprogress2/3;Gitstable7/8awaitsauthenticatedexternalroundtrip. Noactivejobs.

### Gitee binding and roundtrip preparation
Authenticatedcredentialcheck26985terminal0 stillconfiguredfalse on designatedproject. Preparedguardedprism-gitee-bind.py: exactauthorizedURL/branch, existingbindingguard, realUIbinding, unchangedmanuscript, noapply/push. Syntaxchecked; notexecutedwithoutcredential. Detailedroundtripplanprism-gitee-roundtrip-plan.md coversinitialpreservation,Webpush,externaledit,concurrentWebmerge/conflict,graphandotherbranchrefs. Externalwriteauthorizationexists, credentialstillmissing; noactualremotewrites. Previousgoalturnprogress(Zoterorealimport). Currentprepconcretebutcannotcountactualsyncpass. Userasynccredentialquestionpending, overallactive,2/3externalchecks.

### Gitee credential dependency turn1
Authenticatedstatus27913terminal0 configuredfalse for designatedtestproject/remote. Targetrepoandbranchwriteauthorization already supplied; do not re-requestauthorization or Zotero setup. Remainingexternalcredential alone blocks preparedroundtrip; no independentrequiredwork/livejobs. Previousgoalturnpreparedguardedbindingrunner; currentblockedcount1, goalactive. No remotewrites or manuscriptchanges.

### Gitee credential dependency turn2
Authenticatedstatus54267terminal0 remainsconfiguredfalse. Samecredentialblocker; targetauthorization and Zotero acceptance unchanged. Noactivejobs/independentremainingstep. Count2; goalactive. No remote writes/config changes.

### Gitee credential dependency turn3
Third consecutive goal turn with missing saved Gitee credential. Authenticatedcheck39203terminal0 configuredfalse. Target and branch write authorization retained; Zotero real import passed. No independent required step or active jobs. Mark goal blocked, not complete; resume actual designatedbranch roundtrip once credential exists. No remote writes.

### Updated Gitee token verified; provider username defect fixed in source
User says updatedtokenready. Actualbind69883failed. DirectauthenticatedHTTPprobe25713 proves APIuser200/loginlapulatos andGitinfo200/serviceadvertisement. Actualgitprobe3197 showsx-access-token403 tokenusernameinvalid; lapulatos authenticates but repo-test ref absent. CurrenttransporthardcodesGitHubplaceholder. Sourcefix queriesGiteeAPIforactualtokenowner(neverinferrepoowner), boundedtimeout/no redirects, sanitizesallerrors, skipscredentialheaderlookupforlocalgitcommands. Twoadditionaltransporttests verifycollaboratorlogin/tokenredaction/failurebeforeGit. Unitpass; lintpending. Nextbackend-onlycandidateimage+verifieddeployment,realbind; inspectrefsbeforeinitializingauthorizedrepo-test ifmissing. No remote writesyet; authorizationpermitsrepo-test creation/testwrites, nototherbranches.

### v47 Gitee authentication repaired and actual branch initialized
Five transport tests and scopedlint pass. Backend-onlyimage v47-gitee built/203hashverified, guardeddeploy6769terminal0; finalinventory203live/sourcehashpass. NewGiteecredentialvalid APIloginlapulatos andGitHTTPadvertisement200. Correcttokenownerlogin nowautomatic; no UI tokenchange required. Remote refs probe62188foundnoheads atall. Authorizedrepo-test initialized via isolatedbarecheckout and productiontransport exactexpectedHeadnull lease; initialcommit91096385ab46f675c41d7a1d9f802368a8c045c9 confirmedremote by20969. Onlyrepo-testwritten; initialmaintexminimalpaper. Durableinitializationstate /var/lib/overleaf/git-sync/gitee-acceptance-initialization/acceptance-state.json preservescommitforresume. ActualUIbinding60097passed,projecttextunchanged,branchrefs/remotes/origin/repo-test,baseCommitnull. Reportsprism-gitee-bind.json andinitialize.log.
Webpushbrowser42145terminal1 testselectorSave resolutionincorrect (actualSave conflict decision), beforeapplication/push. Correctedrunner;41676currentlyrunning. Inspectsamehandle andstateprism-gitee-web-push.json beforeanyrerun; initialreviewmayapplythenpushoperationpersisted. Fullroundtrip stillpending; nootherbranchwrites. Currentcandidatev47/demo unchanged. Wholegoalactive; previouslymissingcredentialblockerresolved.

### Actual Web-to-Gitee push passed with independent readback
Browser41676terminal0: initialremote main.tex chosenexplicitlyinreviewandapplied; webeditaddedonesentence; actualcommitdiffreview/checkbox/Pushreviewedcommit completedpushed. Commit36808b2b2f9c60cf6cdd65ff8febe74f50e21f81 onrefs/heads/repo-test. Independentproductiontransportfetchin separatebarecheckout45374terminal0 confirms exactremotecommit, websentence andinitialtextpreserved, onlyrepo-testremotehead. Reportsprism-gitee-web-push.json/.png andprism-gitee-web-readback.json/.log. Oldfailedselectorerror movedpreviousAttemptError, notcurrenterror. Do notrerunwebpushfirst-run scriptas-is nowpushed; itexpects prepared state. Noactivejobs. Next externalcheckoutedit+concurrentwebedit,automaticnotice/review/apply merge andconflict acceptance; wholeGitroundtripnotyetcomplete. Usercredentialnowvalid,no moretokenrequests.

### Actual remote-to-Web concurrent merge plan
SeparatebarecheckoutwillreadexactWebpush36808b2, prependcommenttomaintex, createchildcommit andpushonlyrepo-testwith exactlease. Websimultaneouslychangesexistinglastbodysentence. ActualservedUIautomaticchecks(nomanualfetch)mustnotifywithin90s,retainwebbytesbeforeconfirmation,automaticnonoverlapdiffready,explicitapplyretainbothchangesandreload. DurableexternalstateandUIpreviewIDsrecorded, nootherbranchwrites. Scriptsprism-gitee-external-edit.mjs/prism-gitee-pull-merge.py. Previousgoalturnprogress(actualWebpush/readback).

### Gitee and Zotero external acceptance: 3/3 complete
Actual repo-test Web push and independent readback passed. External edit plus concurrent nonoverlapping Web edit: automatic remote notification before any write, reviewed merge, reload persistence and pre-merge recovery snapshot passed. Merged Web result pushed as 995ec809fbee8fae6cd31634400f8d53e352a92f. Same-line external commit e081bc783cbf6a960dd8f8728824fbee99a670ee detected conflict; UI omits Apply until resolution, backend canApply=false. Explicit manual resolution preserved both authors, applied and persisted on reload without page errors. prism-gitee-conflict.json passed; native recovery/readback prism-gitee-conflict-native.log confirms exact submitted resolution bytes and pre-merge snapshot retained (operation 3fa1e956-9ce9-49f5-88a0-ec3616d07f34). Test correction: absent Apply button is expected, not disabled; native helper requires /overleaf/services/web cwd. CodeMirror inner_text adds trailing blank lines in test input; exact resolved bytes checked against submitted textarea value, original content compared with trailing whitespace normalized. Conflict resolution remains in Web, not pushed; remote external commit preserved. Only authorized repo-test written. Candidate 18081 v47; demo 18080 unchanged. This completes the three external connection/Zotero/Git acceptance tasks, not a claim that every Prism requirement is complete.

### Current completion audit pass
Previous turn: progress (real Gitee same-line conflict acceptance and recovery snapshot verified). Use expression-skill and planning-with-files; retain all existing edits.
- [ ] Reconcile original requirements and stale current-status documents against existing results and live runtime.
- [ ] Verify actual Gitee commit graph author/file inspection in served candidate; fill any demonstrated gap.
- [ ] Update final handoff and remaining requirements with precise evidence/version boundaries.
No deployment, new remote commits, credential rotation or manuscript editing needed for this read-only pass.

### Completion audit pass outcome
3/3 actions in this pass completed: baseline/combined requirements and live v47 runtime inspected; actual Gitee graph author/file diff browser passed (74376 terminal0, zero Git mutations/page errors); handoff and final audit corrected to remove stale credential blockers and v46 runtime claims. Screenshot inspected. Overall goal remains active: reconcile historical named gates, isolate Zotero disconnect verification without disconnecting user library, review current typecheck baseline. No implementation edits, deployment or remote writes in this pass.

### Typecheck and disconnected-library acceptance pass
Previous turn made progress: actual graph acceptance plus corrected handoff.
- [ ] Run current frontend typecheck and compare baseline diagnostics.
- [ ] Verify Zotero disconnect using a separate test identity, preserving owner connection.
- [ ] Record evidence and update remaining full-scope gates.

### Current typecheck and Zotero disconnect verification
Previous current typecheck had16 errors:13 baseline plus3 new TS2769 errors in git-sync-panel.test.tsx (unsupported Testing Library exact option). Removed only those3 options;11 panel tests and scoped ESLint pass. Repeated tsc has13 diagnostics byte-identical to prism-zotero-typecheck.log:12 missing optional-module declarations and1 pre-existing nullable project access. Full typecheck is not green. Reports prism-current-typecheck-audit.json and prism-git-panel-typefix-tests.log.
Actual browser/server Zotero disconnect passed using a synthetic stored connection on fixed reviewer account and separate project6ae6aeea492c9e9b3b6e0d50. DELETE removes row, UI search disabled, search API409, idempotent DELETE200, reload disconnected, manuscript unchanged. Native verification proves owner library record byte-identical. No real credential copied or upstream request made; positive live library connection/import evidence remains prism-zotero-live.json and prism-zotero-no-doi.json. Evidence prism-zotero-disconnect-browser.json and prism-zotero-disconnect-verify.log. Initial native helper failed before mutation due fs.promises.readFile numeric fd; corrected to /dev/stdin then seed succeeded. Test connection is removed; no cleanup of user data.
3/3 current pass actions complete; goal active. Next audit remaining historical feature/runtime source boundaries and finalize original requirement matrix. No application source/runtime/image change, no repository push.

### User-reported project Git connection repaired
User URL18081/project/6ae64c143fb98b69218c6978 had no binding and no credential; authorized Gitee acceptance project6ae6a79ece5f0b9e3242f0b0 had both. Credential scope is project/user/repository, so prior test did not cover this project. Reused same owner same repository existing token via credential store without output; saved only if target credential absent. Actual browser Connect repository returned success, repo-test bound, manuscript unchanged. Evidence prism-user-project-git-bind.json. No merge/apply/push performed. Generic connection failure text remains a UX issue; no runtime source change in this fix.

### Git connection feedback repair
Previous turn progress: repaired user project binding without content writes. Next: (1) distinguish missing project credential from history loading failure, (2) add focused UI regression tests, (3) verify and prepare candidate update. Preserve token isolation and public anonymous connections; never display raw transport errors.

Git feedback source implementation done;14 UI tests/lint pass; tsc same13 baseline. New build14765 running v48 atopv47, context only2 frontend source files; manifest203file hashes. No deployment yet. Use same build handle and guarded prism-v48-deploy.py after immutable verify. First test insertion attempted wrong relative cwd before mutation, corrected and14 tests passed.

### User Git tabs/branch picker/merge demo scope
User explicitly asks separate Settings and Commits tabs; URL automatically retrieves branches; wants branch merge and multi-lane graph demonstration. Source implemented tabs plus authenticated remote-branches endpoint using ls-remote --heads (no local ref or remote mutation), debounced abortable branch dropdown, credential-save retry.20 frontend tests and7 transport tests passed; typecheck same13 baseline. Existing merge operation already implemented, prior native branch merge evidence; next create local-only demonstrator with two-parent merge, since user only authorizes remote repo-test. v48 build67893 terminal0 but NOT deployed (superseded). v49 build prepared atopv48 includes8changed/newfiles,204file manifest, targetruntime stillv47. Deploy guard requires v47.

### Git Settings/Commits tabs, branch discovery and merge demonstration delivered
User requested tabs, automatic branch listing and visible branch merge. v49 deployed on18081 after idle Agent/no active Git application guard; demo18080 unchanged.204 source hashes match image/live/worktree. Settings contains repository/branch/credentials/sync controls; Commits contains graph and historical diffs. URL changes trigger debounced authenticated ls-remote --heads; stale requests aborted/ignored, credential save retriggers list, manual branch typing retained only in existing New branch commit workflow. No automatic project-content merge. Connection failure differentiates absent credential, saved credential and history-only failure.
20 frontend tests (18panel/credentials+2picker),7transport tests pass; scoped lint passes after renaming test Promise parameter; tsc remains identical13 baseline. Actual served UI loaded real Gitee repo-test option (only initial status intercepted to display unbound form, no bind POST), tab isolation and true two-parent graph/diff passed at1440/1000/760, no page errors. Screenshots1440 visually inspected. Reportsprism-v49-browser.json,prism-v49-final-inventory.json.
Independent local-only project6ae6b190cbb0b09ff978bb75: main setup comment vs analysis robustness sentence from common base. Actual Web Review branch merge/Apply retained both; original unchanged before confirmation. Then local git merge --no-ff generated e219394f24f255108ef3cd3a680014b2997b01dd with two verifiedparents and exact same final text; fixture binding advanced to local merge commit. Not an actual remote push demonstration; no remote branch created/written. User can inspect Commits graph and first-parent diff. Native seed and merge persisted in candidate data volume; reportsprism-merge-demo-browser.json,prism-merge-demo-fixture.json.
Buildv48 completed but superseded beforedeployment; v49 uses it asbase. First v49 browser attempt saw server startup empty response, waited for login200 and reran read-only check successfully. First test/script generation attempts used wrong cwd and failed before writes; corrected. Current task4/4 complete, whole original goal remains active for final requirement reconciliation.

### Historical compatibility evidence reconciliation
Previous turn progress: delivered v49 Git tabs/discovery and merge demo. Current plan: compare feature manifests with actual source, inspect changed paths and targeted tests, record concrete remaining gates without treating older evidence as a current rerun. Audit output prism-historical-source-audit.json.

### Final original-scope delivery audit
All18 requirement groups mapped in prism-delivery.md and prism-delivery-matrix.json to inspected passing artifacts, with evidence hashes and explicit scope limits. Current v49 comments/history restore8browserchecks passed after5comment-relatedsourcechanges;133historicalfeaturefiles verifiedlive/current. Voice9/9, inline4/4 and history51/51 feature manifestfiles unchanged. Current targeted compatibility22backend+11frontend tests pass. Modelsmoke8loweffort replies retained, not all-effort certification. Wholefrontendtypecheck retains13 baselineerrors; do not call allrepo green. No remaining required implementation items found after original baseline, combined regression and subsequent UI/Git requests reconciled. Fixedcredentials retained. Final delivery18/18; no public release/sourcepush/PR.
Earlier entire-goal-incomplete and missing external credential statements are superseded by this final audit. Current handoff18081v49; original18080v41 preserved. User-scope Git merge demo is local-only, actualGitee roundtrip limitedauthorizedrepo-test.

### New active goal: conversation copying and Agent timeout
Read both userattachments fully. Dedicatedplan plan/copy-timeout-plan.md is authoritative for this newgoal; previousPrismgoalcompleted andcleared. ConfirmedWebandAgentcompiler misssetspace, deployeddaemon240sharddeadline. Addedsourcecopybuttons+selectableCSS,5tests pass; deployment and realclipboardtestpending. Texpackageimagebuild75679running, logplan/prism-tex-packages-build.log; inspectsamehandlebeforeanyretry. Userproject6ae6b4aa00cfc6a2e2ed96b5, actualtimeouttask6c21a53e-7c82-428b-8ef9-76ddbed00554. No manuscriptchanges/runtime restart. Newgoalnotcomplete.

### Current user request: verify branch merge demonstration
- [x] Inspect existing branch merge implementation and prior acceptance evidence.
- [ ] Recheck served Settings/Commits, real merge topology and historical diff read-only.
- [ ] Deliver demo link and precise distinction between Web content merge and Git merge commit.
No manuscript edits, repository writes, deployment or unrelated copy/timeout changes in this pass.

Current branch-merge recheck: 3/3 complete. Served v49 on18081 verified by read-only browser: Settings/Commits isolation, distinct SVG lanes, two-parent merge node, historical main.tex diff at1440/1000/760; no page errors. Existing local demo preserved. No application code, manuscript, credentials or remote changes. Evidence plan/prism-merge-recheck-browser.json and screenshots. Prior copy/timeout work untouched.

### Copy/timeout goal complete
3/3repair steps complete; see plan/copy-timeout-delivery.md and final-audit.json. Livev52 on18081; copies verified from realclipboard. MissingTeXdependencies/read-onlyfontcache resolved; actual33-filepapercompiles40pages and WebAgent completes23.07seconds/4steps. Daemon15minute cap/concurrency2allows backgroundchecker+conversation. Final33files unchanged. No credential/sourcecommit/remotewrites. Original18080unchanged.

### Git settings disappear on refresh: current investigation
- [ ] Identify affected project and distinguish unsaved form draft from persisted binding.
- [ ] Reproduce and repair the confirmed persistence issue within scoped source.
- [ ] Verify refresh/reopen persistence, preserve credentials/manuscript, report exact cause.
User asked why URL disappears; project URL/success state requested asynchronously because screenshot contains neither. Do not bind an arbitrary project or copy credentials between projects.

Git refresh investigation outcome: read-only inspection3/3complete, no repair claimed. User suppliedproject6ae6b4aa00cfc6a2e2ed96b5 has bindingcreated2026-11-01T05:35:57.647Z (13:35:57CST) and1credentialrow. Actualauthenticatedbrowserbefore/afterreloadbothconnectedtrue,sameGiteeURL/repo-test. Screenshot predates this observedstate; cannotprove why earlierstatewasunbound. FormremoteUrl/branchonlyReactstateuntilsuccessfulConnect,so unsavedinputdoesclear. No binding/manuscript/credentialmutation. Reportplan/git-binding-refresh-check.json. InitialDBprobeusedprojectIdinstead_id; correctedbeforeconclusions.

Git investigation reopened after user clarified latestbindingwasreconnection. Currentstatechecks alone cannot explain earlierloss. Historicaloplog now inspectedcoversfullprojectlifetime andcontains onlyreconnectinsert,no earlierbindingor deletion. Rootcauseearlierattempt remains unconfirmed; avoid claimingfixed or usererror. Nextclarification: whether earlierconnection showedrepository/Commits, and exactpriorprojectURL/time ifavailable.

### Multi-author branch graph demonstration
- [ ] Inspect existing merge entry and graph representation.
- [ ] Create isolated local-only repository/project with three explicitly simulated authors, divergent branches and true merge commits; preserve user repositories.
- [ ] Verify actual served graph, author labels, merge parents and diffs; deliver project link and precise merge instructions.

Multi-author graph demo3/3complete. New isolatedproject6ae6db53b54b265c36e52534, localrepositoryonly,10realcommits/4branches/3simulatedauthors/2two-parentmerges. Nativeparentsverified. Servedbrowserverified3graphlanes,authorlabels,2mergenodes,main.texhistoricaldiff andenabledSettingsReviewbranchmergeforbob/follow-up. Screenshotvisuallyinspected. No applicationcodechanges/deployment oruserrepositorywrites. Evidenceplan/git-multi-author-demo.json andgit-multi-author-browser.json.

### Git Graph workspace usability overhaul
- [ ] Inspect screenshot-matching upstream source/license and current detail flow.
- [ ] Implement dense selectable history plus immediately visible commit/file/diff workspace and discoverable existing branch operations.
- [ ] Verify selection/races/merge details and responsive frontend behavior.
- [ ] Build/deploy candidate, browser-verify real multi-author repo and report scope vs full Git Graph.
Preserve existing repositories/credentials/manuscripts; no unreviewed destructive Git commands. Do not claim full extension port without implementing its VS Code-specific integrations.

Git workspace implementation/source tests3/4done.5productionfileschanged:commitgraph/details/panel/css + GitRepositoryReader.22frontendpass,realrepositorytestpass(includinginitial3additions,merge1/1,binarynullstats);scopedESLintclean. Tsc13existingbaselineerrors,nogitworkspaceerrors. Build1019runningtagv53fromv52,loggit-workspace-build.log. UpstreamcloneinspectedlicenseandVSCodebridge;no upstreamcodecopied. Newgit-workspace-browser.py awaitsdeployment. Firsttestfailuremockmissingbranchesfixedoptionalcount;firstnewtestappendwrongcwdfailedbeforewritecorrected;firstESLintyarnexecnotfoundfixedrootnode_modulesbin. Needactualbrowservisualandresponsiveinspectionbeforecompletion.

V53 build1019completed9fef656...butcannotstart: Docker maxdepth128layers; v52has124andcurrentruntimeunchanged. Verifierfailedbeforedeployment; noartifactwritten/deploynotexecuted. PreparedscratchCOPYfrombuiltv53toflattenfilesystem, preservingEnv/Entrypoint/Cmd/Workdir/ports/User. Build46137runningtagv53-git-workspace-flat. Needcompareconfig/sourcehashes,runcandidateguards,realbrowser.23frontendtestsnowpass(includingtext-to-binaryswitch;initialasserttextsplitbydiffspanscorrectedtoregioncontent).Notfinished.

V53flattened128to2layers8a5e251...configurationequal;5sourcehashesverifiedandidle-guardedcandidate deployed. Functionalbrowser6checkspassed,butvisualinspectionfoundfocus-trapwrapperpreventedboundedmodalheight;diffextendedbelowviewportespecially900px. NOTdeliveryready. Addedflex/heightconstrainttofocuswrapper,30%boundedhistory,compactmetadata;layoutimagev54build43405runningfromflatbase. Browsernowassertsaddedlineboundingboxinsideviewportatdesktopand900px,notjustCSSvisibility. Needverify/deployv54/rerunvisual. No userdatawrites.

LayoutpreviewCSSbrowserpassedbutvisualstillshowedfirstgreenlineclippedbyinnerdetailsviewportwhileglobalviewportassertpassed. AddedscrollIntoView(nearest)onfirstactualadded/removedlineafterfileloadandstrengthenedacceptanceboundingboxagainstinnerdetailspanelbottom. DeliberatelystoppedobsoleteCSS-onlybuild43405(exit130);finalcombinedv55build69263runningfromflatv53. Currentservedv53functionalbutfinalvisualfixpending. Sourcechange6? still5productionfiles;manifestupdatednewdetails/csshashes. Needfinalverify/deploy/browserbeforeclaimdone.

### Assistant vertical resizing (user steering)
- [x] Diagnose fixed dock limits and inspect existing panel framework.
- [ ] Add saved accessible vertical split; preserve read-only permissions and scrolling.
- [ ] Verify actual pointer, keyboard, reload persistence and Git workspace.
- [ ] Deploy candidate and report both results.

Git workspace4/4complete onv55: immutable5filehashesverified, candidateactivationguarded, actualbrowser6checkspassedincludingstrictinnerdiffbounds, desktops/narrow screenshotsvisuallyreviewed. Usersteeringaddsverticalassistantresize; implementednestedreact-resizable-panelswithautosave,accessiblehandle,20-75percentassistantlimits,andunboundedinnerflexscroll. SourceESLintpass;v56build84465running. Needserveddrag/keyboard/reload/viewportacceptanceandGitregression.

V56 deployed2hashesverified; pointerup/down,keyboard,reloadpersistencepass(301to479px,restored479px). Existinglongconversationextraacceptancefoundcomposerflexshrinkclippedtoolbarat900x700evenafterenlarging. Correctedconversationbasis0andcomposerflexshrink0,maxheightbounded. v57buildpending. Do notclaimfinalacceptanceyet.

Assistant resizing4/4complete: v57 e8d9691...2sourcehashesverified,idleguardeddeployment. Actualbrowserverified8checks, includingloadedhistoricalconversationandnarrowtoolbar. Heights300.59->478.95,reload478.95. Gitworkspace6browsercheckspassonv57. Screenshotsvisuallyreviewed. Startupfirstattemptnotreadyandconcurrentloginonefailure; sequentialretrypassedwithoutcredentialchanges. No manuscriptedits/remotewrites. Deliveryplan/assistant-resize-delivery.md andgit-workspace-delivery.md.

### Git source-control workflow reorganization
1. [x] Inspect settings/merge/push coupling and backend whole-tree commit behavior.
2. [ ] Separate Settings/Changes/Commits, local selection and incoming merge flows; implement validated selective commit snapshots.
3. [ ] Test selected/unselected modifications, deletes/binary, stale snapshots and pending merge semantics; frontend tab and selection behavior.
4. [ ] Build/deploy isolated candidate, browser verify read-only user project and isolated fixtures; document exact scope.
No live manuscript merge/apply or remote push in this task. Selected files only must actually define commit tree; unselected edits stay in web project. Preserve existing pending operation restoration and permission guards.

Git changes implementation3/4sourcecomplete:8productionfiles (4frontendinclnewlocal-changes,4backend).57frontend/8backendtests pass; scopedESLintclean;tsc13existingbaselineerrors. Selective real Git tests cover unselectedmodify/delete/binary, stale fingerprint, invalid paths, incomplete merge ancestry and remaining edits afterbaselineadvance. Candidatev58build27654running. Isolatedfixture6ae6f434ee9024c88117f6c5 created locally,no remote. Browser/nativeactualselectivecommit checks pendingdeploy. User project initialsync notapplied; no remote writes.

Git Changes4/4complete: v58a7a24b...deployed8filehashesverified.57frontend/8backendpass;10actualbrowserchecks+loadedSettingscheck+6Graphregressionspassed. Retainedlocalcommit60cf878...containsmain.texonly;nativeGitconfirmsnotes.texpreserved,branchunchanged,webchangesstillpresent. Nativecheckinitiallyrootownershiprejected;reranunderrepositoryownerwithoutchangingGitconfig. Finalscreenshotsinspected. No usermanuscriptmerge/apply,remotecommit/push,orcredentialchanges. Deliveryplan/git-changes-delivery.md.

### Web automatic commit and push
User clarified Web Settings only; external worktree automation out of scope.
1. [ ] Inspect editor panel lifetime and existing safe push APIs.
2. [ ] Add default-off, persisted per-user/project/binding automatic sync interval and status; periodically commit/push all web changes with no-op detection. Pause for initial sync, incoming changes, merge/manual review, offline or ambiguous outcomes.
3. [ ] Test timer, settings persistence, disable/cancellation, no overlap, remote changes and uncertain push recovery without repeating writes.
4. [ ] Deploy isolated candidate and browser verify controls plus controlled local-only test flow. Do not enable live auto-push on user's remote repository during acceptance.

Additional steering: reorganize Incoming & merge into Remote updates and Branch operations cards; fix Commits tab overflow on narrow rails. Included in same build.
Automatic implementation: browser timer defaultoff,1/5/10/30min,per-user/project/remote/branch localStorage includingpausedoutcome. Mount Gitpanel atprojectload so savedtimerdoesnotrequireopeningGit. Manualselection/reviewpause;WebLock preventssametabduplicateacrossbrowsercontexts; existingserverleaseprotectspush. No incomingautoapply.71frontendtestspass;lint3styleerrorsfixed;typecheckpending. Need actualbrowserinterval/persistence/disable/layout+isolatedmockedtransportacceptance, no liveautoenableonuserrepo.

Additional Literature requests: Settings/Search tabs; Zotero logo; API-key actions beside input and search beside query; compact result cards; diagnose failing real Zotero search. Actual credential read succeeded20items (7.4s), currentclientrepeat8.5s/1.0s/0.95s. Earlierfailure not reproduced; old10stimeoutnearobservedcoldlatency. Confirmed Refreshcitationdidnotretrysearch. Implement30stotalrequestdeadline+one transientGETretry,distincttimeout/network/JSONerrors,andactualRetrysearch. No credentialreplacement/librarywrites. Tests pendingcombined.

Git/Literature combined source verification complete: 80 frontend tests,14 Zotero backend tests, scoped lint clean; tsc has13 pre-existing baseline errors. Latest periodic-check/auto-timer contention fixed and80tests rerun. V59 built5cf3d323...,10sourcehashes verified,guardeddeploymentcompleted on18081; original18080untouched. Browseracceptancepending. Initial startup returnedHTTPerroruntilrunitready; currentlogin200. No credential/library/userpaper mutations.

Git/Literature combined task4/4complete. V60 9ef6552...deployedafteridlechecks,10sourcehashesverified. FinalbrowseracceptancepassedrealZotero20results,Settings/Searchisolation,logo/textpadding,input/buttonheight,narrowLiteraturebounds,Incomingcards,Git tabsandautooffonrealproject. Screenshotdesktop/narrowvisuallyinspected. Auto-synccontrolledfixtureand6GitGraphregressionspassedv59;v60onlyLiteratureCSS. No userpaperapply,remoteGitwrites,credentialchanges. Deliveryplan/git-literature-delivery.md.

### Literature multiple selection and atomic batch import
1. [ ] Inspect citation preview/apply guards and extend one proposal to multiple validated citations (Crossref and Zotero).
2. [ ] Add result checkboxes, select loaded results/clear/count and batch preview; tests for duplicates, failures and selection lifecycle.
3. [ ] Build/deploy guarded candidate; real browser batch preview and isolated import acceptance; preserve user papers/library/credentials.

Literature batch phase1/2complete (2/3): onecombinedproposal,duplicateguardsatpreviewandapply,bounded50selection,12frontend/61backendpasses. Buildv61inprogress;6fileimmutablemanifest. NeedguardeddeploymentandrealZoterotwopaperacceptanceinfreshfixture,thenreadbackandduplicaterejection. Userpapers/keysuntouched.

Literature batch3/3complete: v62 f5ce24d...deployedwith7sourcehashesverified.12frontend/61backendtests;productionlintclean;tsc13existingunrelatederrors. RealZoterotwo-paperpreview/accept/readbackandrepeatduplicaterejectionpassedfreshproject6ae70166b49f4249dedb7859;900pxboundsandvisualscreenshotschecked. No userpaper/library/credential/remoteGitwrites. Deliveryplan/literature-batch-delivery.md.

### Git push request not confirmed
1. [ ] Identify screenshot operation/project, durable state and remote binding without retrying a push.
2. [ ] Correct verified failure and actionable UI/preflight diagnostics; protect uncertain push semantics.
3. [ ] Focused tests and guarded deployment/browser verification; no unrequested remote mutation or credential changes.

Git push diagnostics2/3complete: exactscreenshotoperationprepared,noattempt,local-onlybindingnoremoteURLconfirmed. Runtimeprepare/executepreflight+local-onlybannerdisabledremotecontrols+actionableerrorimplemented. Network-lostpreparedstatusremainsuncertain;explicitHTTP-rejectioncanreportnotstarted;confirmedpushedclearsstaleerror.75frontend/4backendpass;lintclean. Obsoletev63buildcancelled;finalv64building3filehashmanifest. Needverify/deploy/live409checkswithoutmutatingoriginaloperationandactualGiteefetch.

Git push diagnostics3/3complete: v64 8e59b735...deployed3hashesverified;75frontend/4backendtestsandlintpass. Actualbrowserlocal-onlypreflightprepare/execute409originaloperationunchangedprepared,UIwarning/disabledcontrolsverified;realGiteeproject6ae6b4aa00cfc6a2e2ed96b5repo-testfetchHTTP200. No remote writes,userpaperapply,credentialchanges. Deliveryplan/git-push-diagnostics-delivery.md.

### Automatic web sync real remote failure
1. [ ] Inspect real project state, failed stage and persisted operations; distinguish outgoing auto push vs incoming review-only.
2. [ ] Fix verified cause and stage-specific diagnostics/independent incoming checks; tests including failure/no-change paths.
3. [ ] Deploy and verify actual authorized repo-test outgoing timer and incoming detection; retain current user edits and require review before incoming apply.

Automatic recovery progress2/3: diagnosis and source fixes complete;v65 live18081,79tests/lint/sourcehash checks pass. Actual nonaccelerated1minute outgoing timer, railclosed, committedonlytestprobe in73.4s:464e99b0d0b6fa6e165f8aa184f00d9da91c8f76. Disposableprobeauto-sync-acceptance-1793526668.txt; incoming remoteedit a8ff676952946449bae843b70d8cab8f0e3ed9ac confirmed; automaticdetection/reviewedapplyandcleanupongoing. Acceptance harness repaired collapsedrail detection and dockerCLIcwd before remote execution; no replay of dispatched push.

Automatic sync task3/3complete: v65deployed;79frontendtests/lint/hashchecks pass. Real1minuteWebtimer→Giteeconfirmed464e99b0d0b6 in73.4s. Remoteedit a8ff67695294 automaticallydetected51.7s,previewonlyprobe,reviewedapply1/1 andeditorreadbackpass. Cleanupdelete779fdfa2fafb automaticallydetected52.0s,revieweddelete1/1confirmed. Probe removedbothsides;testcommitsretainedauthorizedrepo-test. Incoming remainsauto-detect/manual-review-apply,notunattendedmerge. Deliveryplan/auto-sync-recovery-delivery.md;actualevidenceplan/auto-sync-two-way-live.json passedtrue.

### References workspace and citation verification
1. [ ] Inspect current bibliography/agent APIs; verify provider options, Scholar keys and ACM style from primary sources.
2. [ ] Rename Literature to References; add readable deterministic import keys and reviewable ACM formatting option without breaking existing citation links.
3. [ ] Implement separate metadata verification and citation-context support review with sourced evidence, uncertainty and review-before-edit behavior using existing agent infrastructure.
4. [ ] Focused tests, candidate deployment and browser acceptance; document actual capabilities and source options.

References progress3/4:15-filev67accepted realCrossref+Codex metadata and supportreports; fixture6ae716d65b0553afe07b59c9. Metadataidentifiedwrongtitle/year/pages; supportcorrectlyinsufficientevidence,proposalsnone,manuscriptunchanged. BibTeXimportkeylecun2014deliberatelyacceptedfixtureonly. Customiconrequiredscreenreaderlabel;fixedv68. ACM preview exposed missingBST;officialpublic-domain2.2/acmart2.19BSTdownloadedchecksum4342d274... and bundledimmutableattachment, copiedinto reviewproposal byagent. v69webdeployed17hashesverified;66backend/18frontendtests,lintclean. FinalactualACMcompileandfixtureacceptanceinprogress. No originaluserpaperwrites or remoteGitpushes this task.

References task4/4complete: v69deployed18081,17sourcehashesverified;66backend+18frontendpass,lintclean,13unrelatedbaselineTSerrors. Realmetadataandsupportreportsverifiedfixture;Zoteroactualkeysreadable. OfficialACMBSThashmatched,newstyle+hyperref/rootstyleproposalscompiled1page50710bytesandacceptedfixtureonly. AccessiblelibraryiconandReferenceslabelverified;900pxvisualchecked. Existinguserpapers/library/credentials/Gitremoteuntouched. Existingcitationkeysnotmassrenamed;newimportsreadable. Directadditionalprovideradaptersnotclaimed;BibTeXuniversalimportadded. FulltextretrievalcurrentlyarXivHTML;othercitationslimitedtosuppliedmetadata/abstractandevidencelimits. Deliveryplan/references-workspace-delivery.md.

### BibTeX metadata completion and clipboard cleanup
1. [ ] Inspect existing import/check/proposal paths and source metadata coverage.
2. [ ] Add pure-BibTeX clipboard handling, richer sourced fields and deterministic reviewable corrections/completion; preserve existing citation links and unsupported fields.
3. [ ] Focused regression tests, build/deploy candidate and real DOI/browser verification; document evidence limits.

Completion progress2/3:6productionfiles;60backend+15frontendpass;lintclean. v70buildongoing. LiveCrossref2DOI evidence captured; need guardeddeploy and browser import/preview/apply fixture verification. Existingreferenceskeys preserved, importkeysreadable; no originalpaper or remotemutations.

Completion task3/3complete: v70 c546fd425ba139c6 deployed18081,6hashesverified;60backend+15frontendtests,lintclean. Browserlive2DOIHTMLimport/readablekeys/sourcedcompletion/fixtureacceptance/unchangedmanuscriptpassedproject6ae72a1f94268800e60ef29d;900pxvisualchecked. No userpaper,credential,Zotero,remoteGitchanges. Deliveryplan/reference-completion-delivery.md.

### Compact reference review and reference-file import
1. [ ] Inspect report renderer and import API; define actionable summary and supported formats.
2. [ ] Add compact issues-first metadata review with expandable evidence and repair preview; add BibTeX/RIS/EndNote tagged/CSL-JSON file drop conversion and optional DOI enrichment into reviewed target bibliography.
3. [ ] Tests, guarded candidate deployment and browser acceptance; preserve user manuscripts and existing bibliography fields.

Reference files progress2/3: compactstructuredreview+collapsedlegacyreport+audited-selectionrepair implemented; BibTeX/RIS/EndNotetagged/CSLJSONimport withdropandoptionalDOIenrichment, destinationreview.65backend+17frontendpass;lintclean;tsc13errorsoutsidechangedfiles. v71buildinprogress11productionfiles. ActualbrowserRISonline+CSLappend+EndNotepreview+AIcompactpersistencestillpending.

Reference files3/3complete:v71dee46d73906deployed18081,11hashesverified;65backend17frontendpass,lintclean,tsc13identicalbaselineerrors. BrowserRISrealDOIenrichment+CSLexistingbibappend+EndNotepreviewrejectpassedfixture6ae73106c264af693085abc4. RealCodexmetadataaudit9de6c8e4-11bd-47e1-aa54-e0cb77b05fcashows3differences7missing,collapsedreport,persistedafterrefresh;originalmanuscriptsunchanged. Desktop900pxvisuallychecked. Deliveryplan/reference-files-delivery.md.

### Reference check interaction and field-level application
1. [ ] Inspect immutable audit data and guarded document application; define issue-only review and compact icon toolbar.
2. [ ] Implement server-validated per-field/all application against saved evidence, stale-document protection, actionable issue rows and restrained responsive layout.
3. [ ] Focused tests, candidate build/deploy and browser tests for individual/selected/all application and stale protection; original papers untouched.

Reference actions progress2/3:9productionfiles;69backend19frontendtests pass;lintclean;13baselineTSerrors unchanged outsidefeature. v72building. PendingbrowsertrueAIaudit then year-only application, title/pages selected application, remaining-all application, old-snapshot409, unknown-sourceexcluded,refreshpersistence andnarrowvisual. No originaluserpaperwrites.

Reference actions scope update: user requests English-consistent Check UI, removal of duplicate model controls in References, inheritance of Paper Assistant model/effort, and diagnosis of apparent formatting compile stall. Include these before final deployment and acceptance.

Reference actions3/3complete:v75 deployed18081,11productionhashesverified;69backend22frontendpass,lintclean,13baselineTSmessagesidentical. LiveCrossref+agent audit and individual/selected/all writes passed fixture6ae748f210485961c3e73dca;stale409,originalcontentpreservation,reloadpersistence,EnglishUI,sharedDockEffort,noReferencesModelControls verified.900pxvisualchecked. Transientpollretryfixed. ExistingACMformat task completed21:22:21 with2pendingproposals,notaccepted. Deliveryplan/reference-actions-delivery.md.

### Correct ACM metadata interpretation
1. Remove style-changing API/UI and retire known incorrect pending preview.
2. Present sourced BibTeX enrichment as metadata-only; preserve every template/style and existing citation key.
3. Test, deploy and verify source-backed .bib-only changes with the supplied DOI examples.

Metadata-only correction3/3complete:v76deployed18081,3hashesverified;70backend22frontendpass,lintclean,13baselineTSmessagesunchanged. RetiredformatAPI410;Settingsmetadata-onlylink;2incorrectpendingstyleproposalsrejected. Live2DOIcompletion18fieldsinfixture6ae74f5297a76b5976c63388,onlyreferences.bibmodified,mainunchanged. Missingfieldsnotfabricated. Deliveryplan/reference-metadata-only-delivery.md.

### Citation support actionable review
1. [x] Structured per-context findings with evidence-bound suggestions; never infer corrections from unavailable evidence.
2. [x] Issue cards with inline diff and per-suggestion Apply, guarded original snapshots; Markdown table rendering for full reports.
3. [x] Tests, deployment and browser verification of unavailable evidence, individual edits and stale conflict rejection.
User steering: add Select all with sequential <=10-reference batches, progress and stop; keep every batch report/action. Expand final checklist to 4 tasks: structured claims, guarded cards/apply, all-selection batching, tests/deploy/browser.

4. [x] Select all, sequential batches, progress/stop, retained reports; v80 real browser acceptance passed (12 entries, 10+2, across tabs and reload). All four tasks complete. Delivery: plan/reference-claims-delivery.md.

### Citation evidence and reject actions
1. [x] Inspect source fetching and suggestion decisions; reproduce metadata-only limitation.
2. [x] Improve citation evidence retrieval and compact actionable cards; preserve evidence requirements for diff/apply.
3. [x] Add persistent Reject/restore for metadata and citation suggestions.
4. [x] Run focused tests, deploy candidate, verify UI and document results.

User steering: pending combined BibTeX preview must not block per-field Apply. Fixed frontend disabled state, click handler and backend gate; matching pending previews are read-only combined diffs. Applying/uncertain or unrelated previews still block writes. Added regression tests.

Complete: v82 deployed18081,11hashes;78backend14frontendpassed;lintclean;13baselineTSmessagesunchanged. Real browser checks passed for pending per-field apply/reject persistence and ACL-backed citation diff/reject/apply/stale replay. Delivery: plan/reference-reject-delivery.md.

### Automatic reference identity verification
1. [x] Inspect current title-only gate and reproduce screenshot entry.
2. [x] Verify candidate identity with DOI record and official publisher metadata where available; distinguish source conflicts and uncertain versions.
3. [x] Expose evidence-backed field actions and concise verification status, leaving only unresolved fields for manual review.
4. [x] Regression tests, deployment and live missing-DOI verification in isolated fixtures.

Complete: v84/18081,6hashesverified,85backend13frontendpass,lintclean,13baselineTSmessagesunchanged. Real missing-DOI example verified against Crossref+ACL,7visibleactionsenabled,DOI applied in fixture only. Delivery: plan/reference-verification-delivery.md.

### PMLR citation support and location
1. [x] Reproduce no-DOI PMLR evidence failure and inspect editor navigation.
2. [x] Add verified PMLR volume/title discovery and source PDF/abstract fallback independent of DOI search.
3. [x] Improve location, cited sentence and actionable result presentation without inventing corrections.
4. [x] Tests, deploy and live user-example audit.

Complete:v86/18081,8hashes,90backend10frontendpass,lintclean,baselineTypeScriptunchanged. Live originaltwoquotes supported; falsefixturequote contradictedwithdiff; cross-filejump,Apply/Reject/undo/stalereplay/reloadpassed. Delivery:plan/pmlr-delivery.md.

### Local Git changes diff inspection
1. [ ] Inspect local change API and preview behavior.
2. [ ] Make per-file before/after diffs discoverable, with loading and error states independent of staging.
3. [ ] Test changed/new/deleted files and request races; build and verify candidate if available.

User addition: show field-level green cross-verified, yellow unconfirmed, red conflicting-source badges. Do not infer field cross-verification from entry identity. Include in candidate delivery.

User addition: batch Apply/Apply all fails after first batch because whole-document hash is stale. Rebase against current document while validating selected field old values and checked identity; retain version-checked writer. Add four-batch sequential application and identity-conflict regressions.

Completed local Git diff / verification badges / batch apply: v89 deployed to 18081, seven production hashes verified. 20 frontend tests, 28 reference backend tests, 3 Git backend tests passed. ESLint clean; TypeScript matches existing baseline. Controlled browser UI tests passed for modify/add/delete diff and three verification states. User repository was not pushed or modified. Delivery: plan/git-diff-reference-delivery.md.

### Inline reference verification badges
Move field verification badges into the title/status row, allow wrapping only when narrow; keep verification and Apply logic unchanged. Verify existing tests, build and activate candidate, browser-check header placement.
User refinement: icon-only at beginning of each field, no visible status text; hover title and accessible label describe green/yellow/red states. Cancelled superseded build, rebuilding updated UI.
Completed: v90 icon-only field statuses deployed18081;2sourcehashesverified,4tests passed,eslintclean. Controlled browser verified first-child placement, accessible labels/title hints, no visible label text, hover/focus. Delivery:plan/reference-inline-delivery.md.

### Basic account Skill plugin library
1. [x] Implement bounded public GitHub discovery/install pinned to commit, account storage and lifecycle API.
2. [x] Add shared invocation resolver to agent task creation; expose reusable invoke endpoint and slash command activation.
3. [x] Add Plugins rail panel, install chooser/list/enable/remove and composer command picker.
4. [x] Test authorization, remote input limits, slash resolution and UI; build/deploy candidate and verify browser workflow.
Scope: instruction Skills and markdown/text/json resources; existing agent tools and project review gates. No automatic execution of installation scripts or new MCP services. Unsupported package files listed to user. Original18080 untouched.
Plugin phases1–3 complete. Phase4 core tests/live functional acceptance passed; final accessible icon/default width image build pending. Evidence:plan/plugins-browser.json, APIs:plan/plugin-library-api.md.

Completed: v93 deployed18081;14productionhashesverified. Real GitHub install/disable/slash/Agent resource execution passed on v92; final accessible tab, default panel width and draft preservation passed on v93. Existing18080 unchanged. API contract:plan/plugin-library-api.md; delivery:plan/plugins-delivery.md.

### Remove redundant References settings shortcut
Remove BibTeX metadata section and jump button only; lint, build candidate v94, verify Settings removal and Check preservation in browser.
Completed: v94 deployed18081, single source hash verified, ESLint clean; browser confirms removed metadata section/button and visible source selector/Check panel. No manuscript edits. Evidence:plan/reference-settings-browser.json/png.

Remove Preview fixes entry: delete button, make actions two equal columns; update existing test; lint/test/build v95 and verify browser. Retain backend compatibility for existing reviews.
Completed v95: Preview fixes removed, two equal-width check actions.8frontendtests passed;eslintclean;2productionhashesverified;browser confirms absent preview button and two equal-width remaining actions.18081updated,18080andmanuscriptsunchanged. Evidence:plan/reference-actions-removal-browser.json.

P0 v95 deployment regression: reused reference-actions-context contained stale backend/frontend files overriding plugin routes and older reference logic. DB retains installed paper-repo-builder. Recover from v94 with newly created context containing exactly2UI files; verify17sourcehashes and real discover/list/invoke. Never reuse populated build context; verify actual copy inventory matches manifest.
v96 complete: clean v94 base + exactly2UI files,24hashes verified. Original paper-repo-builder ID retained; live discover returns SKILL.md; list and slash picker survive reload; real stored Skill resolver loads resources. No plugin or manuscript modifications. Evidence:plan/v96-plugin-recovery-browser.json,plan/v96-plugin-resolver.log.

### Plugin library layout and descriptions
1. [ ] Inline URL/Find Skills form; compact library cards with descriptions, switches, details; remove per-card fixed-command Use button.
2. [ ] Parse multiline Skill descriptions for new and existing installs without rewriting installed resources; retain slash Skill activation with task-specific input.
3. [ ] Focused tests, clean exclusive build context, production hash and live layout/persistence checks at18081.

### Cursor-style composer and persistent goals
P0: @ file/folder mentions with actual backend write scope; visible Skill chips and slash picker; direct image upload/paste/drop.
P0: persistent goal scheduler with pause/resume/stop and completion/review boundaries; awaiting whether review means AI or user. Preserve existing per-file review and version checks.
P1: real fixture validations, scoped-write denial and scheduler restart/race tests.
Plugin UI v97 build hit128layers; flatten untouched v96 image (config preserved), rebuild on1layer base.
Plugin UI v97 complete:25hashes,11focusedtests,livewide/narrowcardsdescription/findskillsvalidated. Image flattened to resolve128layerlimit;originalbaseconfigpreserved. User clarified goal modes: automatic AI approval or explicit human approval; both implemented. v98:62backend15frontendpass;37productionhashesplanned;livegoalfixturepending.
v99: direct /goal <objective> replaces standalone setup;compactmodechoice;37hashes. Reviewer evidence now includes initial/current file fingerprints and accepted before/after hashes;63backend15frontendpassed. Live v99 test pending.

v99 complete: direct /goal command deployed18081. Real fixture completed automatic goal in2steps with page closed; manual mode waited without source writes; pause/resume/stop passed.63backend15frontendtests passed;lintclean;13existingTypeScriptdiagnostics. References regression passed. Final installed-plugin description/slash checks passed; new GitHub discovery rerun blocked by GitHub rate limit (v97 discovery passed). Delivery:plan/composer-goals-delivery.md.

### Goal conversation layout, restart command and timing (v100)
- [ ] Move goals into conversation scroll area; keep composer visible and draft editable during execution.
- [ ] Add durable active-time accounting, optional countdown, stage/round indicators and /Resume Goal fresh execution preserving time.
- [ ] Regression tests for expanded activity scrolling, restart/reset/time boundaries; build exclusive candidate and verify.

v100 deployed and browser passed: goal inside transcript, 35 activity steps scroll to bottom at1440/1000 widths, draft editable, real /Resume Goal starts new task preserving time, Reset clears time. User additional scope: expose historical automatic batch diffs/commands; investigate blocked goal. Actual image exists in project file tree. Root cause: reportOnly snapshots intentionally omitted project assets; goal reviewer reused that mode. v101 adds internal includeProjectAssets for goal review only, retains reportOnly discard of edits. Add historical task detail loader.

v101 complete on18081.37imagehashesverified;67backend18frontendtests passed;lintclean;13existingTSdiagnostics unchanged. v100 real restart/reset/scroll acceptance passed. v101 real original goal history shows8applieddiffs and15executionsteps. Read-only diagnostic with project assets found image955156bytes and compiledmain.tex successfully40pages,0proposals. Original blocked goal not auto-resumed or rewritten; user can /Resume Goal. Delivery:plan/goal-conversation-audit-delivery.md.

### Live execution timeline (v102)
- [ ] Preserve chronological public activity with per-edit diffs and command updates through agent/web APIs.
- [ ] Render an inline live timeline for ordinary tasks and goals, with compact expandable command outputs and file diffs at each edit.
- [ ] Validate streaming updates before completion, rebuild/deploy candidate and safely update local agent when idle.

User refinement v105: unify command/output typography; intercept project-file links without navigation; remove goal control buttons, route /resume goal /stop goal /pause goal through composer; /goal NEW objective replaces current goal and resets timer (explicit correction: NOT /go). Fixed footer timer outside scrolling transcript. Preserve pending new-file preview rather than navigating to404. Remove duplicate final assistant summary when identical public message exists. v104 follow change rolls into v105 before deployment.

V105 complete: /goal (not /go) resets objective/time; slash resume/stop/pause replace card buttons; footer clock outside transcript. Existing file links open editor, pending creations open proposal, external links open new tab. Unified command/output typography and removed duplicated final summaries. Candidate18081 deployed;40image hashes verified;69backend+30frontend tests passed; lint clean;13baseline TS diagnostics. Real browser goal command and link tests passed; controlled follow/reading-position test passed. V102 real streaming test showed diff before completion. Original18080 and user manuscripts untouched. Delivery:plan/assistant-interactions-delivery.md.

### V106 goal repetition and Markdown
- [ ] Replace summary-text progress detection with structured verified progress; preserve reviewer next steps/history and stop repeated stalled work.
- [ ] Render goal summaries/reviews with shared sanitized Markdown and improve tables/code/list styles.
- [ ] Regression tests and candidate build/verification; do not interrupt the user's running goal during deployment.

V106 complete: continuation/checkpoints/blocker tests16pass; shared Markdown frontend tests25pass; ESLintclean; TypeScript13unchangedbaseline. Exclusive4file image delta,40manifesthashesverified, deployed18081 while agentidle. Browser controlled-reply and goal-reason Markdown rendering passed; screenshot inspected. No user goal restarted. Delivery:plan/goal-markdown-delivery.md.

### V107 ordinary task hidden behind old goal
- [ ] Order current ordinary task and goal by activity chronology; keep active work last, suppress stale goal footer during newer ordinary work.
- [ ] Add current-task status near composer, including waiting for first activity; preserve polling and live details.
- [ ] Regression for completed goal + running scoped follow-up; isolated build and browser acceptance.

V107 complete:14frontend conversation tests,ESLintclean,13unchangedTSdiagnostics;40imagehashesverified. Deployed18081 while agentidle. Browser controlled completed-goal+running-scoped-task scenario passed actual viewport visibility, progressive updates and completed-reply ordering; screenshot inspected. No user task cancelled/restarted. Delivery:plan/current-task-progress-delivery.md.

### V108 Submission deadlines plugin
- [ ] Read CCFDDL live catalog and official submission guides; distinguish future deadline, confirmed open, rolling journals, and unknown requirements.
- [ ] Add reusable catalog/details API, built-in Skill resources and plugin library entry; cache sources with freshness/access state.
- [ ] Build searchable deadline cards and highlighted requirements detail with source, submission and template links; connect to Paper Assistant.
- [ ] Test timezone/round filtering, safe source fetch and plugin use; production build and live browser verification.

V108 implementation/browser passed: built-in plugin library entry + /submission-deadlines, real473entry catalog,6journal entry points; source-linked highlighted requirements, actual GitHub ZIP metadata, tracking persistence and composer draft handoff.16backend+20frontendtests passed; lintclean;13unchangedTypeScriptbaseline.47productionhashes verified;candidate18081 deployed idle. Live browser confirmed existing paper-repo-builder retained, catalog/official JMLR sources/templates and draft preparation; source-context resolver final check in progress. Templates/manuscripts unchanged.

V108 complete: production Skill resolver verified actual deadline-context.json + SKILL.md assets with JMLR sources and4template links. Deployment validated; live screenshots inspected. Deliverables:plugins/submission-deadlines/README.md and plan/submission-deadlines-delivery.md.

### V109 submission workspace and calendar
- [x] Move planner from Plugin rail into editor-area tab; preserve mounted editor, selection and planner filters when switching.
- [x] Add actual monthly calendar, separate abstract/paper events, day expansion and event-to-requirements navigation; keep rolling journals undated.
- [x] Responsive workspace layout, regression tests and live browser switching/calendar checks; candidate deploy when idle.

- [x] V109 extension: dated timeline across venues, separate registration/abstract/paper milestones, explicit registration uncertainty and official rule excerpts.

### V110 venue style conversion
- [x] Add one-click isolated conversion using selected venue evidence and the existing agent; preserve original project and model choice.
- [x] Preserve manuscript content, ignore page limits for conversion; require official class/BST/template and bounded compile verification.
- [x] Persist export-only task link, generate frozen LaTeX ZIP with report, import as a new project idempotently, and show completed/incomplete/decision sections and package diffs.
- [x] Targeted regression tests, candidate image and browser verification.

V110 verified on candidate 18081: 56 backend / 24 frontend tests, unchanged 13 TypeScript baseline errors, ESLint clean; 55 image hashes. Live fixture ZIP import preserved binary bytes and all files, produced distinct project ID, repeated import returned same ID, original source remained byte-identical, direct original apply returned 409. No real venue-specific AI conversion claimed by this fixture.

### V111 submission filters and per-venue timelines
- [x] Full area names with multi-select chips; consistent Window behavior across all views.
- [x] Preserve CCF/CORE/THCPL source ranks, distinguish N from unknown; multi-select ranking filters.
- [x] Per-venue dated milestone axis and favorite stars in list/timeline/detail; persistent venue-level favorites.
- [x] Targeted tests, candidate deployment and live browser verification.

### V112 conversion package layout
- [x] Apply ASE26-TAMARIS directory/main.tex organization only to Convert to new LaTeX ZIP; do not copy manuscript text, IEEE style or spacing hacks.
- [x] Add validated package-only relocation manifest to preserve original image bytes when moving to figures/src and other assets.
- [x] Test unsafe/colliding moves and content preservation; deploy after V111 browser checks.

V111/V112 candidate 18081 verified: 52 combined backend tests, 11 targeted frontend tests, no new TypeScript diagnostics; 56 image file hashes. Browser fixtures verify multi-area/rank filters, consistent Window counts, star persistence, ZIP image relocation, unchanged original, exact imported ZIP and idempotent import. Live CCFDDL access timed out during acceptance; no live-refresh success claimed.

### V113 manuscript venue recommendations
- [x] Compact planner entry button.
- [x] Read-only AI recommendation task based on manuscript plus sourced venue catalog; validate structured results against catalog IDs.
- [x] Reuse current filters/views and add relevance, CCF, CORE, THCPL, type, deadline and area sorting; show fit reasons and source limitations.
- [x] Targeted tests, build/deploy candidate and browser acceptance.

V113 deployed and verified on candidate 18081: 38 backend and 13 frontend tests pass; ESLint clean, 13 unchanged TypeScript baseline diagnostics; 60 image hashes verified. Browser controlled AI results verified compact 31px button, recommendation sorting and existing area filters, unchanged manuscript. Actual model recommendation quality not validated by the controlled fixture. Original 18080 unchanged. Delivery: plan/v113-delivery.md.

### V114 visible recommended venues
- [x] Show compact named recommendations before collapsed explanation; reset filters for newly received results.
- [x] Regression for expired/undated candidates and active filters; build and browser verify candidate.

V114 deployed18081: 6 frontend tests, ESLint clean, unchanged13 TypeScript diagnostics,60 image hashes. Browser9candidate fixture passed visible names, folded notes, undated candidate, sorting/filtering and unchanged manuscript; screenshot inspected. Original18080 unchanged.

### V115 recommendation layout and venue status
- [x] Move activity outside toolbar; running indicator in button, full-width fit and jump to result cards.
- [x] Explicit closed/registration-gated/unknown deadline status in overview/cards/detail.
- [x] Add sourced dated journal metrics, separate missing indexing/quartiles and conference applicability.
- [x] Tests, isolated candidate deployment and browser verification.

V115 deployed18081 and verified:9 frontend tests,ESLintclean,13unchangedTypeScriptdiagnostics,62imagehashes. Browser controlled9candidate result verifies36px toolbar, separate progress, direct result focus, closeddeadline despitefuturedecision, fullwidthfit and unchangedmanuscript. Metric coverage explicitly limited to dated reviewed observations; missing SCI/EI/CAS data remains unknown. Original18080 unchanged.

### V116 visible deadline countdown
- [x] Add nearest submission countdown and per-registration/abstract/paper remaining time; preserve closed/unknown status. Compact recommendation cards also show countdown, CCF/CORE/THCPL and full area. When submissions have closed, a later decision/conference event is explicitly a milestone, not a submission deadline.
- [x] Boundary/timezone tests, candidate build and browser verification.

V116 deployed18081:12frontendtests,ESLintclean,13unchangedTypeScriptbaseline,63imagehashes. Browser verified compact countdown/CCF/CORE/THCPL/fullarea, detailed countdown, closedstatus, resultnavigation and unchangedmanuscript; screenshot inspected. SAEA remains undefined pending user clarification.

### V117 environment repair and interface cleanup
- [x] Put recommendation activity inside progress frame; compact venue cards with full-width timeline and no duplicate cutoff text.
- [x] Inspect both compile environments; prepare immutable TeX package repair image and verify ACM compilation.
- [x] Add default-off environment maintenance setting and explicit per-action confirmation with impact/audit/rollback; retain manuscript sandbox.
- [x] Verify/deploy interface and present concrete environment changes before activation. Activation awaits explicit user confirmation.
- [x] Extract CCF 2026 (681 rows) and Xidian 2025 (760 rows), persist source PDFs/rules and show conditional classifications.
- [x] Integrate Submissions into editor segmented control; browser verifies equal 22px height/12px font and navigation.

### V118 compact venue dates
- [x] Move timeline inside right dates column; reduce countdown to24px and padding.
- [x] Build isolated candidate and verify desktop/narrow layout and navigation.

### V119 AI environment maintenance
- [x] Identify local-image FROM bug; real Codex diagnosis verified.
- [x] Add Codex diagnostic workflow and one confirmation for build/validation/activation.
- [x] Regression tests (12 agent + 1 frontend), real Codex diagnosis, real isolated broker build/ACM compile, deployment and browser confirmation check.
- [x] Prepared corrected plan from actual failure; compiler activation remains pending user confirmation in settings.

### V120 maintenance activation recovery
- [x] Reproduce Docker top failure; retain PID column and process guard.
- [x] Diagnose activation failures using actual logs; preserve built image and previous failure. Avoid Agent self-busy rejection and misleading permission message.
- [x] 14 regression tests; idle Agent restart; resume already-confirmed plan; live candidate and future Agent compiler activated. Actual fse27-opt 2 Recompile success,21-page PDF.

### V121 system-owned autonomous maintenance
- [x] Add Codex recovery decision loop to confirmed maintenance task; execute bounded repair actions and record attempts.
- [x] Real Codex + isolated Docker fault injection passed: one authorization, PID failure, AI use-pid-column decision, automatic retry, verified active container and Agent compiler.
- [x] 16 regression tests + frontend confirmation test; deployed V121 and idle host Agent; browser confirmed bounded-task authorization and no execution on review.

### V122 maintenance settings organization
- [x] Independent AI Maintenance tab; remove from Writing Assist; own stylesheet,13px logs, bounded wrapped code blocks.
- [x] Combined V123 deployment; independent tab navigation and both13px logs verified in browser at1440/960px with no overflow.

### V123 toolbar and venue cleanup
- [x] Reuse original toolbar portal and segmented switch in Submissions; disable editor tools there.
- [x] Remove duplicate closed-deadline block; compact closed notice; add Xidian multiselect and sorting.
- [x] 13 frontend tests; browser verifies shared toolbar, Code/Visual round trips, closed-state deduplication, Xidian multiselect/sort and unchanged source.

### V124 maintenance entry points
- [x] Replace unsupported build glyph with bundled settings icon.
- [x] Natural-language maintenance routes through Codex tool; inline conversation authorization/status card reuses maintenance service.
- [x] Real Codex harness routing,2 confirmation tests and actual deployed Paper Assistant natural-language task passed; inline card and bundled settings glyph visually verified.

### V125 AI-assisted FSE to TOSEM conversion
- [x] Diagnose snapshot rejection and preserve all manuscript documents/assets.
- [x] Wire conversion to internal Codex with official template retrieval and isolated output validation.
- [x] Test recovery, complete ZIP/report and unchanged source; deploy candidate and verify.
- Scope clarification: generic source-to-target LaTeX conversion, FSE→TOSEM is a regression case only. Add per-requirement actionable advice and reviewable diffs.
- Root causes: excluded .tikz documents (12), Makefile/Python support files; network-disabled Codex has no official-source download tool.

V125 deployed18081 (r3,8 image files verified). Generic source tools and per-rule advice enabled. 35 focused +36 service tests,10 frontend tests across suites, ESLint clean. Real Codex converted full FSE snapshot to an explicitly provisional TOSEM-style draft; server-built86file ZIP compiles,23 assets/bibliography identical. Live conversion start201,cancel200,all71originalfilehashesunchanged;46editable+23assets+2preserved support documents. Original18080 unchanged. See plan/v125-delivery.md.

### V126 conversation retries and branches
- [x] Diagnose Invalid project document against the failed snapshot.
- [x] Add authenticated retry and branch APIs preserving parent transcript and request settings.
- [x] Add per-turn controls, branch navigation and persistent request context; verify race/permission isolation.
- [x] Run focused tests, deploy candidate and browser-check without changing manuscript contents.

V126 deployed18081,11 frozen image source hashes verified.75 backend/harness tests and16 frontend cases pass; ESLintclean. Actual user failed request retried viaUI in child5fcf8b3a-2e6e-4613-bb80-50db5bda9697,task2c349512-b0ea-42c3-a1f0-17d52cd6feb0 completed with compiledPDF and unapplied proposals. User/reply branch, parent navigation and reload tested; all85filebytes unchanged apart from prior report rename. Original18080 unchanged. See plan/v126-delivery.md.

### V127 compact message actions and conversion compliance
- [x] Replace text actions with accessible icons and one branch menu.
- [x] Require evidence-based before/after conversion checks and gate automatic import on compliance, not compilation alone.
- [x] Test UI and conversion validation, deploy candidate, verify browser.
V127 validation:16backend+30frontend cases pass; live API blocks unaudited automatic import; live branch UI preserves manuscript hashes. Real Codex emits10checks+matchinghashes; IEEE test fontmissing prevents compile success and is correctly retained as draft. R2 menu clipping fix builds but runtime image hits maxdepth; flatten clean app image124→1layers, configverified; r3 build in progress.

V127 complete: r3 deployed18081,7image source hashes verified; final browser confirms unclipped menu (hit-test), working request branch, unchanged85manuscript files.16backend+30frontend tests,16conversation recheck, lintclean. Server automatic-import409 verified. All compiler/fullformat validation limitations recorded in plan/v127-delivery.md.

### V128 source diagnostics and actionable conversion report
- [x] Trace actual403URLs and contradictory tool completion/compile states.
- [x] Preserve verified tool outcomes and actionable source failure diagnostics; fix copy icon sizing.
- [x] Add AI-generated numbered red/yellow/green conversion items with files and next actions.
- [x] Run focused and live checks, deploy candidate, verify report and original files.
- [x] Add Settings > Network for owner-controlled persistent source proxy mode/address/credentials and a saved-settings connectivity test (user-requested addition).

V128 additional scope implemented: default-collapsed execution and changed-file tree, bold numbered report sections, live green activity summary, explicit active-root mismatch. 70 backend checks and19 frontend cases pass; final image building, browser verification pending.

V128 complete: r4 deployed18081,20 image source hashes verified.72 backend tests,19 frontend cases, lint pass. Actual Codex previous-year rule selection verified; browser report/proxy/copy/collapse checks pass with original file hashes unchanged. New lowercase target naming validated by export unit cases; a new full-manuscript conversion remains needed to exercise it. See plan/v128-delivery.md.

### V129 compact calendar undated venues
- [x] Replace wraparound chips with journal/conference groups, six-row pagination, readable names and metadata.
- [x] Verify filtering, paging, details navigation and narrow layouts.
- [x] Deploy candidate18081 only and capture browser evidence.

### V130 official tracks and horizontal branch timeline
- [x] Discover edition-scoped official Track links and extract per-track dates/requirements with source evidence and unavailable/TBD states.
- [x] Show horizontal date-scaled branches with default Main Track and hover/focus highlighting; details show one row per Track and its requirements.
- [x] Feed loaded tracks back into venue cards, test extraction/isolation/interactions, verify real ISSTA source and deploy candidate.

V129 deployed and browser-verified: pagination, details navigation, collapsed progress output, narrow layout. 16 regression cases pass. V130 extends this candidate with per-Track source retrieval, horizontal branches, prerequisite conditions, scoped AI recommendations and evidence-gated Track conversion.

V130 initial candidate verified:36backend+19frontend, live11Track2026 extraction; browser graph/prerequisite/convert gating; actual2027 API3Tracks + nonLaTeX422. Refinement r2 building; final browser check pending.

### V131 Track graph corrections
- [x] Exclude how-to/instruction pages from Track discovery.
- [x] Replace native title tooltips on Track and conference milestones with immediate accessible overlays.
- [x] Draw date-scaled colored curved branches with shared trunk/conference merge; test and deploy candidate.

V131 added user-requested child-Track calendar entries with conference/year prefix and exact-Track navigation, scoped LaTeX visibility, bounded automatic source reads.22frontend+6Trackbackend cases pass, ESLint clean. Candidate build pending; browser validation prepared.

V130 r2 and V131 complete: V131 deployed18081 with7 frozen source hashes verified.22frontend+6targetedbackend cases and browser regression pass. Calendar child prefix/exact navigation, immediate tooltips, curved colored branches, prerequisite and LaTeX guards verified. Live software-engineering FSE2027 returns7 Tracks without How to Submit. Original18080 and manuscripts untouched. See plan/v131-delivery.md.

### V132 complete Track overview and per-card timelines
- [x] Keep undated/unavailable Tracks visible without invented milestones.
- [x] Add each card's own dated timeline and explicit no-date/source states.
- [x] Verify mixed/all-undated cases, build candidate and browser-check.

### V133 detail hierarchy and readable Track recommendation
- [x] Move classifications to header; remove repeated deadline rows and align countdowns.
- [x] Add Today and aligned labeled milestones to each Track; compact recommendation and prerequisite disclosures.
- [x] Run focused tests, deploy18081 and browser-check.

### V134 explicit detail groups and separate conversion workspace
- [x] Add section navigation and clear cards for timeline, Tracks, rules and resources.
- [x] Show conversion report in a focused dialog only after conversion/view-report action; retain existing task history.
- [x] Verify open/close/history behavior and current layout, deploy18081.

### V135 venue type labels and current-year conference retention
- [x] Mark full venue names as Conference/Journal everywhere displayed; verify ASE records remain distinct.
- [x] Inspect ASE dates and keep current-year rounds even after next edition is announced.
- [x] Test and deploy candidate; verify both ASE types and current-year conference timeline.

V135 scope addition: independent Calendar / Recommended venues toggles. Calendar only uses all catalog; combined uses recommended subset; recommendation only displays saved cards. Rerun is explicit and must not reset current view when polling returns. Default calendar window all.

V135 complete:23frontend+10backend checks pass; browser verifies independent switches, explicit re-recommend action, no result-induced navigation, ASE type labels/ranks and live2026 timeline. Candidate18081 deployed with4 frozen source hashes verified.

### V136 combined calendar and recommendation cards
- [x] Render recommendation cards below calendar when both switches are enabled.
- [x] Verify DOM order and other switch combinations; deploy candidate.

### V137 recommendation toolbar placement
- [x] Move recommendation controls after Ask AI to shortlist; use an accessible refresh icon for rerun.
- [x] Verify button order and action, deploy18081.

### V138 planner cleanup
- [x] Shared persistent filters, default 90 days; remove shortlist, notes, activity and undated directory.
- [x] Type badges and journal-specific display without timelines.
- [x] Focused tests, candidate build and browser verification.

### V139 compact parenthetical venue types
- [x] Remove synthetic directory-entry row and duplicate raw kind; retain actual rounds.
- [x] Gray parenthetical Journal/Conference directly after title, without badge background.
- [x] Validate and deploy18081.

### V140 compact Submission page
- [x] Simplify heading, remove scope/help paragraphs, move results beside search.
- [x] Remove Track loading panel; background bounded queue, calendar directly below month/timezone.
- [x] Verify and deploy18081.

V140 addition: remove inherited4px top margin on recommendation type label; flex-center abbreviation and parenthetical type.

V140 addition: move followed-only filter after Timeline, accessible star icon with active state and no count.

### V141 legend and English controls
- [x] Restore legend above grid; remove muted-events text only.
- [x] English Xidian filters/sort/classification labels, preserving category keys.
- [x] Build, deploy18081 and browser-check.

### V142 whole-day calendar selection
- [x] Expand native date button to cover blank cell area; event buttons remain independently clickable.
- [x] Test0/1/2/3/5 events.
- [x] Build, deploy and verify actual blank-cell clicks in browser.

V142 addition: icons inside select controls and four ranking filters in one row; browser checks for geometry.

### V143 consistent cards and dismissible filters
- [x] Shared top-aligned venue cards in recommendations and selected-day events.
- [x] Close rank menus on outside pointer, mouseleave or focus departure; inset select arrows.
- [x] Tests, build, candidate deploy, browser geometry and interactions.

### V144 identical daily/recommended card presentation
- [x] Explicit shared12px card typography; restore countdown in daily cards; secondary plain event times below status.
- [x] Test, deploy18081 and compare computed card typography/countdown styles in browser.

### V145 venue naming and search size
- [x] Rename visible editor tab/page title to Venues and set search/placeholder12px.
- [x] Build, deploy18081 and browser-check.

### V146 journal-only list layout (includes V145 naming/search size)
- [x] Journal full-width metadata, official link, metrics then fit; journal-only icon star and hidden sources.
- [x] Conference layout/star/source disclosures unchanged;13 tests passed.
- [x] Build, deploy18081 and browser verify journal/conference boundaries.

### V147 compact list cards and categorized timeline
- [x] Remove View requirements; clickable card background with independent controls.
- [x] Shared star, no list source accordions/compact tracks/date list; colored timeline legend.
- [x] Build/deploy and browser event/control/tooltip checks.

V147 added: no secondary Paper countdown in list; primary countdown+axis/legend only on right, full-width fit retained.

### V148 indexing snapshots and elapsed conference milestones
- [x] Move conference status below right timeline; retain elapsed final milestone countdown.
- [x] Inspect LetPub PDF and public data; match journal identities and record full catalog coverage.
- [x] Persist dated metric snapshots; expose explicit refresh and readable provenance, keeping conference edition/paper EI separate.
- [x] Targeted tests, candidate build/deploy and browser validation.

### V149 additions requested during V148 verification
- [x] Rename plugin to Venues, command /venues, Open venues + Update metrics side by side.
- [x] Parallel official providers, incremental saved results and live card refresh.
- [x] Preserve V148 scope in combined deployment; verify UI, backend persistence and commands.

V150: Discover Computing uses current name; final combined version deployed18081. Official full-catalog pass completed; unverified fields remain explicit. LetPub supplemental refresh5 succeeded/2 failed, prior values retained. 297 journal/794 conference records preserved.

### V152+ complete remaining metric coverage and hide unknown fields
- [x] Hide unverified metric/classification placeholders in shared cards and details; retain backend audit state (27 tests).
- [x] Expand Springer lookup through latest official catalog (53 matches, 49 JIF); Elsevier active catalog62 matches but sample403 prevents page verification.
- [x] Persist Springer fields; expand Update metrics to bounded concurrent publisher lookup with per-record streaming.
- [ ] Finish V154 deployment: primary links first, confirmed conference dates/place, hide unknown fields; verify browser.
- [ ] Report coverage and unresolved access/identity gaps; verify UI and persistence.

### Backlog: interactive conference location
- [ ] Clickable conference location → rotating globe with origin/destination and surface-following curved connection → click destination to flatten its local area into a centered square map.
- Specification: docs/feature-backlog/venue-location-globe.md. Requested 2026-11-04; implementation deferred while current UI bugs are being addressed.

## Active goal 2026-11-04: finish reported bugs, then implement venue location
P0 bug closeout:
- [x] Hide uncertain metrics/ranks across shared cards/details; source links ordered; remove toolbar Update metrics while preserving plugin entry and incremental updates.
- [x] Confirmed conference dates/place in cards/details; unknown fields hidden.
- [x] Guard non-Node blur targets in all four rank menus;28 unit tests passed. V156 browser verified blank-area clicks and checkbox changes in all4 menus without page errors. User's reported residual symptom remains under observation; clarification pending.
- [x] Composer tools visible after dragging to minimum at widths1400/950; deployed V156 candidate18081, original18080 untouched.
P1 implement requested globe:
- [x] Inspect settings and location data; choose D3/Natural Earth + Leaflet/OSM, cached rate-limited geocoder.
- [x] Add default-off browser-location setting and authenticated destination resolution with explicit area precision.
- [x] Implement clickable locations, rotating globe, surface curve, 3.8-second destination ripples, transition to local square map.
- [x] Verify permission denied/disabled, city precision, reduced motion, focus restoration and narrow layout; V160 real-browser evidence.
- [x] Deploy V160 on18081; all three browser reports passed, 33 frontend/5 backend tests passed; original18080 image unchanged.
Canonical feature spec: docs/feature-backlog/venue-location-globe.md.

V160 final: 3.8-second destination ripples in globe/local map; settings shortcut uses existing UI events; same-origin geolocation permission policy and exact OSM tile image allowlist; reject unrelated business geocoder matches. Location test uses simulated Shanghai origin with real Montreal area lookup and real map tiles. No exact venue-address inference.

## V161: visible return from local map
- [x] Move Back to globe inside the map at top right, including during unfolding; resume rotation on return.
- [x] Verify map/globe round trip and button visibility in short and narrow windows.
- [x] Deploy isolated candidate18081 and update verification records.

User addition: keep initial local view at zoom11, allow minus-button zoom out to global view (minZoom0), retain maxZoom18 and Back to globe. Include in final build and browser acceptance.

User addition: replace visible Conference dates/Location labels with calendar/map-pin icons in shared cards and details; retain tooltips and screen-reader labels. V161 and V162 build attempts canceled before deployment to include additions together in V163.

User addition: remove Venue type sort; add numeric descending JIF and ascending JCR quartile Q1–Q4. Unknown/nonfinite/negative values and conference journal metrics go last. Multiple verified JCR categories use best quartile, consistent with shown category data; metric polling rerenders selected sort. Verify meaningful sort fixtures and live catalog order. V163 canceled before deployment; include all changes in V164.

V165 scope addition: conference overview under full name (official-page excerpt when identified, catalog-based fallback); hide both detail metadata disclosures; detail timeline merges main and retrieved Track dates, shows only next two milestone cards, colorful point/short legend, original timezones and official edition homepage footer. Date-only Track dates retain day precision; unknown dates excluded. V164 build canceled before deployment.

Latest graph correction: common trunk with per-Track forks/merges; fork curve completes before first node, merge curve begins after last node. Use 110px lane separation, reuse lanes only for non-overlapping branch intervals. Default legend Track colors; hovered/focused Track alone highlights and changes legend to its event categories.

V169 user refinement: reduce GitGraph branch lane spacing from110px to72px; preserve before-first fork and after-last merge geometry and hover behavior. Build and browser acceptance pending.

V169 accepted:72px branch gap in actual PLDI2027 detail; hover/legend checks passed. V166 map/icons/full297-entry sorts and V168 overview/eight-branch checks retained.23 backend tests and45 frontend tests, followed by7 graph tests after spacing refinement.12 final production files hash-verified. Closeout:plan/v169-closeout.md.

V170: move Track legend above graph; reduce lanes72→48px; align active Track name/category legend in one horizontal row. Retain default legend height during hover to prevent graph jumping. Verify FSE2027 in real browser.

V171 addition: gray rounded background around undated Track names, comma-separated. V170 FSE browser selector matched cryptography FSE; corrected to Software Engineering area before verification.

V171 accepted: legend above graph;48px lanes; Track title/category legend on one centered row; undated names in gray6px-radius background separated by commas.7 tests and real FSE2027/ISSTA2027 browser checks passed at1500/700 widths, no errors. Candidate18081 and operator pointerV171; original18080 unchanged. Evidence:plan/v171-closeout.md.

V172: rename detail Track directory to Tracks; remove duplicate graph and Analyze my paper button; add clickable Track navigation cards with next milestone/day countdown and deadline colors (past red, soon amber, future green, unknown neutral). Preserve lower Track requirements/conversion. Verify time semantics and click navigation.

V174 accepted: Tracks navigation cards replace duplicate overview graph; analysis button removed. Next milestone/day countdown and deadline colors; revisions do not imply reopened submissions.17 tests and real7-card FSE2027 checks passed, including closed/open/repeated click navigation; no browser errors. Candidate18081 and operator pointerV174; original18080 unchanged. Closeout:plan/v174-closeout.md.

V175 follow-up: navigation targets the corresponding lower Track article without opening requirements. Inline default-collapsed requirements below each Track timeline; green/no prerequisites vs amber/explicit conditions; concise parsed page/review/template fields; solid centered timeline dots and Today with line extensions; shared closed-status orange badge; verified Track-specific submission links from official call content at card bottom. Verify parsing, link provenance, collapsed state and real navigation/geometry.

V175 accepted: correct subcard navigation, inline collapsed requirements, concise page/review/template fields, prerequisite colors, orange closed badge, centered solid timeline points and extended line, Track-local submission footers.20 frontend/8 backend tests and real FSE2027 browser passed;6 portals for7 Tracks, missing portal omitted. Candidate18081/operatorV175; original18080 unchanged. Closeout:plan/v175-closeout.md.

## V176: categorized Track requirements and draft actions
- [ ] Inspect/reuse read-only AI task service and isolated conversion; preserve source evidence.
- [ ] Add source-backed AI requirement organization and read-only Track draft audit with structured findings/file paths.
- [ ] Replace nested requirement accordions with category cards; action row for template download, conversion and Check current draft; move submission portals to heading right.
- [ ] Validate category separation, evidence/file validation, UI loading/error/results, source links and unchanged manuscript; deploy only18081.

V177 accepted: AI requirement category cards and read-only draft findings; action row/template/conversion/check; right header submission links; explicit-stage column labels. Real AI completed4 categories/7 findings,46 manuscript files unchanged and0 proposals. TLS source failure handled with dated verified snapshot.19 frontend,41 agent,12 source/report tests passed.12 production files hash-verified; original18080 unchanged; operatorV177. Closeout:plan/v177-closeout.md.

V178: grouped draft-check controls; primary reopens saved results/progress, explicit Recheck alone starts new task. Preserve previous check separately from requirement-organization results and across remount; do not reopen hidden report automatically on polling completion. Verify request counts and real saved task reuse.

## V179: persistent, actionable Track check reports
- [ ] Give each report and finding globally unique stable IDs; persist resolution independently from audit evidence.
- [ ] Resolve IDs in Paper Assistant with permission checks; investigate one issue or sequentially all unresolved report issues, retaining concrete evidence and human blockers.
- [ ] Add report-wide and per-issue actions, yellow unresolved / green resolved cards, explicit completion status and refresh from persisted state.
- [ ] Verify identifier authorization, status persistence, batch skip/resume, UI commands, and artifact inspection limits; deploy candidate only.
User additions: remove standalone detail Links & templates, Submission requirements and Source access & freshness sections, plus their navigation. Keep per-Track requirements and actions.
User additions: move star to title right; move Conference Link/Publisher inside type parentheses; remove detail-wide AI check/conversion/autoimport controls and request-prepared notice. Replace generic overview with official substantive excerpt only; verified official FSE2027 paraphrase fallback (2026-11-04), no invented generic filler.

V180 additions: official per-Track title links and gray rounded scope panels with responsive topic lists. Generic extraction for newly fetched sources; FSE2027 seven exact official calls paraphrased and dated as fallback. Issue command entry replaces prior unsent draft instead of appending an old issue command. V179 deployed to candidate for live workflow test while V180 builds; original18080 remains unchanged.
V180 browser passed: 7 exact Track links/overviews, 2-column scope list, 800px no overflow, title star and official link, removed obsolete detail sections, report command injection, green/yellow status roundtrip, saved results reopen. Real batch 55e6f54a-8dc2-4518-9813-fdfe19f3680e processed7/7, resolved0, proposed1; all46 manuscript files unchanged. External public-source TLS failures retained as explicit blockers. V181 final refinement preserves AI evidence through manual close/reopen and suppresses empty-list zero rendering; building with lower Node heap, no simultaneous heavy checks.

V181 accepted on18081: all V179–V181 report/issue/UI/Track scope work complete. Real7-issue batch processed7, resolved0, proposal1; original46 manuscript files unchanged.24 frontend,56 backend,10 Track parser and16 Agent tests (overlapping suites) passed;19 web hashes verified. Real conversation manual close/reopen retains evidence; Mongo fixture validates automatic resolution guards. Original18080 application image unchanged; acceptance Mongo OOM recovered. Closeout:plan/v181-closeout.md.

## V182 inline issue clarification and finding typography
- [ ] Render validated issue outcome blockers as inline question forms; hide machine JSON from displayed assistant messages, retain backend evidence.
- [ ] Submit scoped answers directly into the current Paper Assistant conversation; retain unrelated composer drafts, guard duplicate sends/busy state, continue issue processing with context.
- [ ] Unify finding text/list/analysis typography; test parsing, form state, continued issue authorization/outcome updates and actual browser layout.
- [ ] Build/deploy candidate18081 only, verify original manuscript unchanged and record results.
V183 user addition: replace ambiguous conference-wide Submission closed in List cards with confirmed Track names in separate closed/open rows. Reuse Track cache and load visible cards with global concurrency2; unknown Track dates are omitted, catalog-only fallback names the exact submission round. Preserve abstract/registration warning.

V183 journal addition: restore a dedicated journal submission section (not an empty conference container), official homepage beside Journal, source-backed introduction/scope/article types, cover when verified, publisher template resources, and reuse saved checks/issue workflows. AEI official Elsevier Shop description verified 2026-11-04; ScienceDirect author guide returns403, so no invented page/layout/format obligations. Generic title-matched extraction and existing official Publisher links support other journals.

V184 accepted on18081: V182 inline replies/typography, V183 named closed/open Track rows and journal detail/workflow, V184 no pending-cover whitespace.26frontend+6journal/review+6issue tests pass;3cover-related rerun pass.28production hashes verified. Real browser journal layout/actions/homepage andFSE6open/1closed passed,800px overflow0,no errors. Real journal AI organization47e71434-6de1-446f-bfa1-3ea4b53c462a completed(scope/format). Cover did not load; gracefully hidden. Author guide403/localTLS limits remain, no invented formatting. Original18080 image unchanged. Operator pointerV184. Evidence/limits:plan/v184-closeout.md.

## V185 journal coverage regression (AAMAS)
- [ ] Resolve journal homepages from live official Publisher snapshots, not only static seed; preserve exact journal identity.
- [ ] Add verified AAMAS profile and author-guide evidence, including article types and LaTeX link; make fallback requirements publisher-specific.
- [ ] Never render an empty Publishing card; retain helpful source/retry state when retrieval is unavailable.
- [ ] Test across journals, source failure and identity ambiguity; build/deploy18081 and validate actual AAMAS page.
User clarified ALL journal detail pages, not individual examples. Inventory297 journals. Batch title/ISSN-matched official homepage discovery and publisher page harvest started; save provenance/status per journal and reusable profile snapshots. Latest additions: bottom-align cover with gray overview; add journal requirement summaries; repair conference layout extraction across categories and separate submission vs publication layout. No invented unknown limits/anonymity.

V185 verification checkpoint: regenerated source registry covers297 catalog journals;276 resolved homepages,111 sourced overviews,114 nonempty requirement snapshots,58 covers including manual verified AEI. All297 identities checked, conference exclusion and source URLs checked.10frontend+5backend tests pass. Full tsc remains blocked by unrelated existing errors; no changed-module diagnostics. Build underway; candidate browser/deploy pending.

V185 accepted on18081: all297 journal identities/inventory checked;276 homepages,111 overviews,114 requirement snapshots,58 covers including verified AEI.10frontend+5backend tests pass; production webpack succeeds,30 image hashes verified. Real browser AAMAS and generic DistributedComputing content/actions pass; AEI real cover loads using existing systemproxy and bottom alignment delta0px at1400/800 widths,overflow0. FSE single-column visible. No browser errors. Original18080 unchanged; operator pointerV185. Seeplan/v185-closeout.md for partial source coverage and tsc limits.

## V186: card covers, location recovery, conference Track recommendations
- [ ] Add verified journal covers to shared list/timeline cards, retaining title/star and fit panel layout.
- [ ] Retry qualified place queries at city/region precision without reducing to country-only; invalidate old empty lookup cache; preserve rate limits and source labels.
- [ ] Offer manuscript-based Track recommendations within recommended conference cards using existing scoped AI workflow; display ranked reasons/eligibility and official Track links.
- [ ] Run targeted tests and browser checks, deploy candidate18081 only, record bounded live evidence.

V186 user addition: submission-sequence planner after recommendation controls. Journal/conference/mixed filter; quality-first feasible chronology with visual review/submission windows. Non-overlap invariant: next submission no earlier than previous rejection or effective withdrawal. Scores alone never establish rejection. Journals need explicit estimated duration and uncertain outputs; no automatic submission/withdrawal. User can arrange candidate order and explore withdrawal scenarios.

V187 steering: replace whole-list arrangement with sequential dynamic choices. Initial near-term suggestion, each chosen venue recomputes eligible next choices from previous release and buffer; changing an earlier choice resets downstream. Horizon12/18/custom months; month-aligned Gantt with conditional/over-horizon/conflict states. V186 build is intermediate only; deploy finalV187.

V187 accepted on18081: V186 journal-card covers, city fallback geocoding, scoped Track recommendation controls plus V187 sequential submission planner complete.32 targeted tests(22frontend/10backend), production webpack and36image hashes passed. Actual browser: ASE cover; CAV Amsterdam area fallback globe; defaultnear-termCAV;18monthhorizon; addsecondchoice and earlier-choice reset; active-review blocker; no pageerrors. RealFSEread-onlyAI taskee9fc0be-eb40-4328-9468-4d507eb8af99 completed2Trackrecommendations with expliciteligibility,0proposals. Original18080unchanged,operatorV187. Fullrepo tsc still unrelatedfailures,noneinchangedmodules. Scopeandlimits:plan/v187-closeout.md.

## V188 inline Plan mode and review-aware Track selection
- [ ] Move planner below research-area chips in Plan view after Timeline; remove modal/old toolbar launcher.
- [ ] Search/select current under-review venue and explicit conference Track; display its review window first and derive next availability with preparation gap. Unknown outcomes stay explicit.
- [ ] Expand recommended conference candidates to source-backed Tracks; show venue/edition/Track in chart and selectors.
- [ ] Add next-choice plus inside chart; show only focused choice editor; remove standalone next-target list and per-choice withdrawal fields; migrate saved state safely.
- [ ] Verify targeted tests and actual inline browser workflow; deploy candidate18081 only.

V188 toolbar steering: keep Plan mode tab after Timeline; Recommend and Plan submissions operation buttons use icon+text, latter switches to same inline Plan view.

## V190 compact Track recommendation reports
- [ ] Hide completed recommendation activity for scoped Track results; retain active/error feedback.
- [ ] Default-collapse the entire Track result list; concise fit / unmet-or-unconfirmed bullets with optional full evidence.
- [ ] Request/validate short structured AI bullets; summarize existing cached reports without rerunning AI.
- [ ] Verify backend/frontend and actual saved results, then deploy candidate only.

V189 inlinePlan accepted:19tests,37imagehashes, real FSEreviewTrack-first/plus/singleeditor/icons/modeswitch/narrowlayout pass. Candidate18081/operatorV189; original18080unchanged. Seeplan/v189-closeout.md.
V191 user steering: align top controls and checkbox; search/venue/outcome fields in one desktop row with responsive wrapping; remove redundant ASE review-outcome banner. ISO year-month ticks with sufficient horizontal space; explicit type/Track labels; all known Track milestones plus parent conference event, dated tooltips and legends; horizon line labelled. Plus icon/text baseline fixed. Preserve V190 compact Track reports in final deployment.

V193 preservation bug: under-review toggles, review identity/date changes and candidate-kind filters must preserve selected plan IDs, including the initial suggested row. Displayed plan lookup must use all candidates rather than filtered suggestions. Editing one chosen target retains later choices and marks conflicts; only explicit remove/reset deletes. Freeze and test localStorage plus chart row identities. V192 icon-only build is intermediate; finalV193 includes all pending fixes.

V194: insert targets between existing choices; drag reorder with accessible up/down alternatives; preserve all chosen IDs and show per-row scheduling conflicts. Verify insertion/reorder/persistence, then ship accumulated V190–V194 candidate changes.

V194 accepted on18081: insert-between, drag/arrow reorder, visible conflicts, review-toggle preservation; all pending compact Track reports/icon/layout/milestone changes shipped.28frontend+4backend tests,production webpack,40imagehashes,actual browser planner and cached Track report pass. Original18080 unchanged; operatorV194. Fullrepo tsc unrelated failures; no changed planner-module diagnostics. Details:plan/v194-closeout.md.

V195: gate all Manuscript fit/Track recommendation rendering on Recommend; preserve cached results. Rename List to Card, use multi-column vertical cards without miniature timelines. Verify cached-result toggle and Card/Timeline distinction; build and browser-check candidate18081.

V195 accepted: Recommend gates cached fit/Track result rendering; List renamed Card, responsive vertical multiple-column cards without miniature axes.28frontendtests,webpack,40imagehashes and actualbrowser3columns/toggles/narrowoverflow0 pass. Candidate18081/operatorV195; original18080 unchanged. Seeplan/v195-closeout.md.

V196: compact line/circle insertion controls; left-edge drag handle only (keyboard arrows on handle retained); quarterly responsive axis; per-row Today; collision-aware above/below milestone labels; click-to-select cross-row date guide. Verify interactions/layout and deploy candidate.
V197 steering: journals default to three calendar months, starting at today's availability; draggable start/end handles resize, review bar drag translates without changing duration. Persist explicit windows, keep manual conflicts visible, recompute downstream targets. V196 build intermediate only; ship accumulatedV197.

V197 accepted on18081: quarterly planner, compact insert/left drag, Today/cross-row guide, alternate labels; journals default3calendar months, editable persisted endpoints/bar translation; light-red exact overlap Conflict bands.30tests,webpack,40hashes pass; live journal browser and isolated conference-fixture guide pass. Official conference source unavailable during browser check, explicitly recorded. Original18080 unchanged,operatorV197. Seeplan/v197-closeout.md.

V198: equal-height Card grid; shared Today/horizon, multi-toggle date guides, shared conflict bounds and drag guide; no inline milestone/date/reason text; circular journal handles and pixel-distance snapping; row blank-area selection; insertion popover; full-name, deduplicated under-review editions with historical catalog coverage. Conflict label threshold >=1day. Build/test/browser candidate only.
V199 steering overrides hover-only journal text: show journal review start/end and duration beneath journal name, updating with drag. Keep bar tooltip. V198 intermediate build not deployed; finalV199 accumulates all changes.

V199 accepted on18081: full pending V198 refinements plus journal dates under name and full-name hover.32frontend+4catalogtests,build,40hashes,actualbrowser interaction/equalheight/narrowoverflow checks pass. Historical source editions retained; conference browser milestone fixture boundary recorded. Original18080unchanged;operatorV199. Seeplan/v199-closeout.md.

V200: remove only current choice (not suffix), prune orphan reference dates and suppress drag-end click toggles; clear guides control; available-first fit-desc insertion sort; diagnose unavailable FSE Track overwriting good cached sibling data. Actual review overlaps >=24h only; touching endpoints/preparation shortfall are not overlap conflicts.
V202 steering: rolling journals remain selectable for draft insertion while prior release date is unknown; label start pending rather than unavailable, keep schedule blocked until release confirmed. Final cumulativeV202 will supersede intermediateV201.
V203 steering: initial-notification rejection branch is the default continuation point when published, keeping final notification as a visible milestone. Actual submission still depends on rejection/effective withdrawal; revisions/acceptance do not release manuscript. PendingV202 not deployed; finalV203 includes it.
V204 latest steering: move conditional-transfer boundary from initial notice to author-response start (when dated; fallback to initial notice otherwise). Red before checkpoint, pale yellow between checkpoint and final notification; one Conflict label per row. Scores do not establish rejection; yellow assumes effective withdrawal or confirmed rejection. Final artifact includes all V200–V204 pending fixes.

V205 steering: equal card heights within each grid row only; use auto row sizing instead of shared 1fr across all rows. Validate with differently sized rows. Final cumulative artifact V205.

V206: add conference historical submissions/acceptance dialog below location entry. Fetch CCFDDL allacc independently, exact conference_key identity (SE/fse vs SC/fse), filter year <= selected edition server+client, validate counts/rates, missing data distinct from zero. Two aligned line plots with tooltips + accessible annual table and sources. Test identity/year/missing/cache; production browser opening/year cutoff; candidate only.

V206 latest: full conference review bar through final notification; author response only splits fatal red vs warning orange overlap and conditional scheduling. Single Conflict label per row.

V207 validation fix: align conference review-bar endpoint exactly to plotted final decision node (date-only events previously displayed next local day). V206 real statistics browser passed FSE2026 historical2021/2023/2025/2026, server2025cutoff, cardrow188/188 then288/288. FinalV207 build/browser pending.

V208 steering: compact planner track64px/rowpadding6px; insertion20px symmetric gap, Today centered above line. Normalize stats icon16px for location-text alignment. Combine count/rate in one dual-axis plot with distinct color/line style, collision-thinned point labels and hover/focus annual detail. Keep all preceding functionality.

V209: move card Conference Link adjacent to title/type badge, remove lower duplicate via existing hidePrimaryLink option; journal publisher links unchanged. Final cumulative artifact V209.

V210: conflict fill uses exact left/right percentages (no artificial0.5%minimum) and no local borders; shared guides render each boundary only once. Verify fill-right vs sharedguide geometry at desktop and narrow width. V209 built, not deployed; finalV210 accumulates it.

V210 accepted on18081: all V200–V210 fixes, compact planner, exact conflict boundaries, author-response fatal/warning split with full final-review bar, one dual-axis historical chart/year cutoff, title-adjacent conference link.40frontend+14backend tests; production build+45hashes; browser passed wide/narrow geometry and real FSE statistics. OperatorV210; original18080 unchanged. Seeplan/v210-closeout.md.

V211: diagnose NeurIPS2025 multi-site geocoding. Split explicit semicolon-separated destinations before lookup; independently resolve each site with city fallback for named convention centers; preserve per-site partial failures and area precision. Globe plots one chosen candidate per site with distinct markers/routes from opt-in origin; selecting any marker opens its local map. Validate service parsing/pacing, globe points/routes, actual NeurIPS candidate UI; original18080 untouched.

V211 accepted on18081: independent multi-site geocoding and cityfallback; multi-marker/color-matched routes; localmap per site; partialfailures retained.9backend+8frontendtests, build,47hashes, real NeurIPS2025/2026 2/3site browserchecks passed; all5localmaps opened. OperatorV211;18080 unchanged.

V212: shorten primary prep label to Preparation (days), scope five-column single-row grid to primary controls, allow numeric inputs to shrink, align button/input38px heights; narrow viewport uses local horizontal scroll. Verify actual layout on candidate, preserve all prior features.

V212 accepted on18081: five primary controls same row, Preparation (days),38px aligned heights; production build+47hashes+browser2400/1800/1400 passed. Narrow panels locally scroll. Original18080 unchanged. Seeplan/v212-closeout.md.

## V213 CFP submission categories and milestone extraction
- [ ] Analyze official CAV2027 CFP and artifacts; preserve evidence for each paper category, shared dates and category-specific requirements.
- [ ] Fix discovery so an ancillary Track does not suppress CFP; represent in-page categories with stable IDs and scoped requirements; improve dated row/range extraction.
- [ ] Add regression coverage for category isolation, source links, AoE/ranges and existing Researchr behavior.
- [ ] Build cumulative candidate, refresh CAV snapshot, validate actual planner choices; keep18080 unchanged.
AI assistance: use this session to interpret official category evidence; existing runtime AI reviews currently analyze already-discovered Tracks, not discover missing categories. No claim of a new always-on AI crawler.

V213 accepted: four phases completed;17tests,48hashes, actualbrowser CAV3paper+2AErounds verified. Official timestamps/ranges and scoped requirements retained. Session AI-assisted interpretation documented; existing perTrackAI receives scoped evidence. OperatorV213;18080 unchanged. Seeplan/v213-closeout.md.

## V214 manuscript-based AI planning action
- [x] Diagnose: Start button only clears chosen; global recommendation endpoint already snapshots current manuscript.
- [ ] Wire planner action to the single existing AI recommendation controller; progress/results visible inline; reset only on fresh successful result, preserve on error/empty results.
- [ ] Prefer AI fit among feasible first choices; explain score/reason and respect horizon/type/current review.
- [ ] Regression tests, production build, candidate deployment and real AI-backed browser run; preserve18080/manuscript.

V214 added user report: rolling journals wrongly listed as unavailable due to stale per-venue windows. Preview alternatives using a fresh scheduled window, clear stale window on replacement/insertion, retain intentionally edited current choice and its timeline conflicts. Unavailable list only describes conference deadline blockers.

V214 additional UI steering: group legend into Conflicts, Date guides, Review periods, Milestones, each with fixed icon column and group-local wrapping.

V215 steering whileV214realAI runs: remove selected-date legend entry and inline date list; retain Clear selected dates button and timeline guide toggling. Buildnextcandidate after realAI task completes; do not restart active task.

V214 accepted: all phases completed;42frontend regressions, production build,48hashes, actual AI task and browser validation passed. Suggest with AI reads current manuscript; failed/empty result retains plan; fit-first feasible suggestion. Rolling journal alternatives rescheduled,4legend groups aligned. OperatorV214;18080 unchanged. Seeplan/v214-closeout.md.

V216: add persistent Simplify/Expand timeline toggle beside Submission target; hide Track/journal-date text only in compact rows, hover full venue+Track,40px tracks/4px row padding/14px insertion gap, unchanged plus buttons/time scale/dragging/selection. Verify saved preference and dense geometry.

V215 accepted: selected-date legend enumeration removed; Clear selected dates and timeline toggles retained.42tests, build,48hashes and real browser2guide clear verified. Includes acceptedV214 actual AI10recommendations, rolling-journal scheduling and grouped legend. OperatorV215;18080 unchanged. Seeplan/v215-closeout.md.

V217 steering: per-row trash removes exactly that ID, cleans its date guides/window, no picker. Reserve28px action gutter outside plot, adjust sharedguide right by28px to keep dates aligned. Keep existing Choice remove action and compact toggle.

V217 accepted: compact timeline and per-row trash complete.44tests, build,48hashes, actual browser deletion/persistence/geometry pass;0px guide alignment difference. OperatorV217, rollbackV215;18080unchanged. V216superseded without deployment. Seeplan/v217-closeout.md.

## V218 unified under-review selection and Track failures
- [ ] Reproduce failed Track API and identify cause.
- [ ] Restore single venue/year/Track selector with search-loaded historical editions; preserve existing plans.
- [ ] Targeted tests, build, candidate deployment and browser evidence; preserve18080.

## V219 user-authorized MongoDB Venue database (supersedes V218 deployment)
- [ ] Store venue catalog/details and conference Tracks in existing app MongoDB, with source timestamps/status and indexes.
- [ ] Migrate verified catalog and existing Track snapshots without deleting originals; read DB on restart, retain good data on refresh failure.
- [ ] Complete unified under-review selector and journal default duration fixes.
- [ ] Verify storage with actual candidate MongoDB and API/browser, deploy18081 only.

V221 scope additions: Update metrics becomes durable Venue database refresh (online source reads, AI analysis, Mongo persistence, visible progress/resume). Remove planner activity/reasons/planning footnote; retain busy button and failure messages.

Additional user requirement: repeated journal Plan entries allowed; use stable per-insertion instance IDs so dates, duration, reorder and trash remain independent. Keep conference Track deduplication.

V221 accepted and operator updated: MongoDB import and real source/AI write, unified Track selection, default journal duration/bar, duplicate journal instances, requested panel removal all passed browser validation. V222 built/55hash-verified and27backend/39frontend checks passed; activation deferred by running-agent guard. No user task interrupted.

V222 accepted: all V218-V222 user requirements complete. MongoDB Venue database and evidence import; real button-driven source/AI write verified; unified historical Track selector/default journal bar; duplicate journal instances; requested panels removed.27backend+39frontend tests,55hashes,final browser and DB restart retention passed. OperatorV222,rollbackV221,18080/manuscript unchanged. Deployment waited for running AI task. Seeplan/v222-closeout.md andplan/venue-database.md.

## V223 continuous horizon recommendations
- [ ] Add busy animation and explicit allow-warning preference (defaulttrue).
- [ ] Build continuous fit/time-aware sequence after AI result and Track loading; independent repeat journal IDs/default3month review; no fatal overlap; last submission before horizon with natural review duration.
- [ ] Tests and isolated build/browser validation; do not interrupt running AI/update jobs; preserve18080.

## Venue deep audit requested 2026-11-06
- Baseline exported to plan/venue-deep-audit/before.json: 3290 entries, 297 journals, 114 journal details, 242 Tracks, 21 journals without publisher URL.
- [ ] Verify screenshot journals against official sources; repair missing publisher/profile/cover data.
- [ ] Refresh official source data across catalog with per-entry evidence and failure records, preserving good previous fields.
- [ ] Persist into existing MongoDB, verify counts and API/UI; report remaining unavailable fields honestly.

## V226 compact controls and instant replan
- [ ] One-row month selector, preparation, semantic icon, trailing short warning checkbox.
- [ ] Reuse existing AI fit immediately; initial analysis includes under-review and planning context.
- [ ] Regression tests/build/browser; wait for active user AI and deep audit before deploy.

## V227 mixed recommendations, Plan metadata and under-review eligibility
- [ ] Preserve near-fit conference opportunities before a journal review would miss their deadline; supply saved Track evidence to initial AI.
- [ ] Reuse venue badges/metrics/location in choice cards and preserve Plan when returning from details.
- [ ] Hide not-yet-started under-review Tracks, using first abstract/registration/paper milestone; keep journals.
- [ ] Targeted regression, cumulative build and browser; preserve running source audit and user tasks.

## V229 adapted manuscripts
- [ ] AI may recommend Tool/other Tracks for a proposed rewritten manuscript, with explicit branch key, rationale and concrete changes.
- [ ] Plan each manuscript branch independently; cross-manuscript overlap is not a conflict; preserve same-manuscript conflict logic.
- [ ] Display adaptation plan only in the bottom choice card, never add it to timeline labels.
- [ ] Parser/branch/UI tests, cumulative build and isolated browser verification.

Latest V230 steering: restore icon+Suggest with AI text, move warning checkbox beside under-review checkbox in its card.

V232 conflict regression: EASE Workshop Paper Notification was misclassified as a paper deadline. Exclude outcome/response/proposal milestones; preserve actual invalid fixed dates and mark conflict instead of hiding overlap. Split response ranges with a month at both endpoints, and repair stored event rows from their retained original source text. Journal cover and all V229-V231 layout changes included.

V235 supersedes future Track exclusion: user explicitly defines status as Under Review or Submitted, so future known Tracks are selectable as author-declared submissions. Preserve stored active/reviewId/chosen state; journals unchanged. Remove date eligibility gate and update visible labels/tests/browser scenario.

V236 current submitted venue editor: clicking the active row opens the same metadata card; journals get default estimated3months, independent persisted currentWindow, typed date/duration editors and draggable endpoints. Existing future choices remain unchanged. Conference Track metadata is available through this card too.

V237 visual check found the new date editor reused an old absolute-positioned timeline caption class. Renamed editor class; browser gate now requires real clickability and static layout. V236 browser assertions passed but screenshot review prevented final acceptance.

V238: remove requested outcome notice; preserve historical conference outcome dates instead of filtering them by today, restoring later fixed Track bars. Missing dates/horizon overflow are not review-overlap row colors. Regression includes historical FSE followed by future ISSTA; browser scenario pending. V237 not deployed; expected current V236.

V238 accepted browser: controls, real clicking and containment of date editor, current journal dragging, historical FSE2026 / ISSTA2027 without false yellow, EASE real fatal/warning overlap all passed. V239 latest steering: explicit Suggest with AI always starts fresh manuscript analysis; option changes do not invoke AI. Old latest task had zero Track entries and no planning context; EASE March12 release misses ISSTA Jan11 deadline, explaining journal-only old shortlist. 58 tests pass.

V241: latest card spacing tightened (link margin0, badges/metrics gap6, reduced cover reserved height and date-editor margins). V239 real AI request failed before model execution: 11,634,245-byte attachment exceeded10MiB; compact analysis catalog retains4,021 entries/731 Tracks at6,497,720bytes and passes real validateProjectAssets. Full task snapshot stays unchanged. V240 not deployed. Fresh live AI retry after guardedV241 deployment.

V242: database-backed thin Track search index plus shared normalized token search for Venues, current-submission parent discovery/options, and insertion. Long-word one-edit typo matching; short acronyms match tokens/prefixes, not incidental interior strings. 67 frontend cases passing. Build complete; image verification and browser ERA/ICPC check pending. Wait for live AI ac65a5eb to finish before deployment.

V244 final requested layout: journal metadata/dates left and cover right, shared bottom alignment. V243 also separates catalog manual insertion from assessed automatic targets, adds recommended marker/filter, removes cached-status false spinner, and projects large catalog out of ordinary task reads. Mongo same-volume restart after proven OOM recovered editor/Plan; persistent2GiB/unless-stopped config.70 frontend tests and targeted backend gates pass. V243 activated for browser; V244 building.

## Bioinformatics missing publisher data
- [x] Inspect existing profile: obsolete Oxford Journals URL and empty requirements.
- [ ] Retrieve current official About/author guide and store sourced supplement in MongoDB.
- [ ] Check ordinary browser access; distinguish unavailable browser bridge from source refusal.
- [ ] Complete V244 layout browser verification and preserve original web image.

V244 complete: browser passed,0px cover/date alignment,570px fields,original18080 unchanged. Bioinformatics data repair stored+service verified; V245 persisted seed image ready but deployment held by running userAI guard. No task interrupted.

## V246 New manuscript timeline badge
Show a short New manuscript badge in compact and expanded timeline rows; keep rewrite details in the card. Tooltip explains original-manuscript overlap and same-branch conflicts. Verify regression/build/browser; preserve active tasks.

V247 steering: NEW icon badge plus Tool(wrench)/Dataset(database) icons and short type label. Combined Tracks display both icons; unknown type uses Article/document fallback. Tooltip explains manuscript-branch conflict semantics.

V248: shared type icons for every timeline name (including active submission) and choice-card header, not only new manuscripts. NEW indicator remains adaptation-only. Covers research,tool,dataset,workshop,poster,short/early,industry,doctoral,journal-first,survey,tutorial,artifact,replication; unknown type uses generic article.

V249 priority: within10points of best assessed fit, order unused feasible targets by known quality, then outcome speed; lower-ranked conferences cannot preempt higher-ranked journals. Preserve exact Track feasibility and independent manuscript branches. AI must assess distinct contributions/readiness and explain stretch/fallback tradeoffs; no invented acceptance probabilities or guaranteed maximum publication count.

## V250 /plan command
- Parse /plan project=<24hex ID> requirements (current project default), validate ID and existing service access.
- Start same recommendation endpoint, pass user requirements/current settings, poll with recoverable status in chat.
- Validate AI planning options; completed result opens target project Plan and applies once without starting a second AI task.
- Add command picker entry, parser/access/handoff tests and browser fixture, retain real-AI validation boundary.

V252 icon consistency: one paper-type-icons.tsx registry returns the same Unicode glyphs for native select labels, timeline/card headers, venue detail heading, Track navigation and Track cards. Added models/awards/ideas/education/reproducibility. This supersedes earlier separate SVG/Unicode designs.

V252 COMPLETE: deployed and accepted.62hashes,92frontend+7parser+1access tests; browser icons, original-manuscript TOSEM/TSE priority and /plan single-request handoff passed. Operator pointsV252. Fresh model run for /plan not performed; UI used prior live-analysis result fixture. Seeplan/v252-closeout.md.

## V253 Track details, location choices, SVG icons
- [ ] Reuse full Track card for selected Plan details.
- [ ] Deduplicate same geographic area candidates without merging distinct places.
- [ ] Replace emoji registry with shared SVG icons and SVG-capable planner dropdowns.
- [ ] Run focused regressions, build and guarded candidate deployment, browser checks.

V254 steering: preserve V253 fixes; pass selected areas to planner, group matching options first with divider and muted selectable other areas; no selected areas means all equally presented. Expand quality-first from a relative 10-point band to suitable scored targets (70+); poor-fit targets cannot displace good-fit targets. Add explicit Prioritize quality action to rebuild old saved order from current analysis without another AI call.

V255 browser passed full Track details, cached Amsterdam deduplication to one option, selected-area grouping, TOSEM first among journals after quality reorder, 210px /plan help and project-ID completion. User found menu/button style inheritance and selected filter icon contrast issues while validating deployed V255. V256 narrows insert-plus span selector, adds scoped compact dropdown styles/short names/full title tooltips, keeps AI filter SVG dark on tinted selected background. Revalidate at actual computed style/layout level before closeout.

V256 COMPLETE: accepted candidate18081;63image hashes verified;110frontend+1command+11location tests passed. Browser measured12px/32px dropdown,38px aligned controls,8pxNEW,visible dark-green pressedfilter,redhatchfatal/solidamberwarning;fullTrack card,oneAmsterdamchoice,area grouping/no-filterall,TOSEMfirstjournal,/planhelp210px andIDcompletion passed,noAIcalls/noJSerrors. Original18080unchanged. Seeplan/v256-closeout.md. Scoped fixes include all subsequent user steering through compact controls/filter visibility.

## V257 user correction
- Restore full single-line option names; wide viewport-constrained dropdown with horizontal scrolling when necessary.
- Replace standalone Prioritize quality action with persisted leftmost checkbox in review toggles; toggling recalculates from existing analysis, default quality-first retained, no AI call.
- Verify both ranking modes, checkbox location/persistence, menu full labels/no wrapping, then guarded deployment.
V257 COMPLETE: deployed and accepted; full single-line portal dropdown measured761px/12pxfont/32pxrows; quality checkbox first/defaulton, toggling preserves saved preference and recomputes withoutAI;82frontend tests+browser pass,63imagefiles verified,original18080 unchanged. Seeplan/v257-closeout.md.

## V258 /PLAN progress and composer lock
- [x] Trace command interception, missing activity rendering and polling error lock.
- [ ] Render backend activity and terminal summaries; recover polling without duplicate tasks.
- [ ] Keep ordinary chat available during planning; test uppercase and failure paths.
- [ ] Build and guarded deploy candidate, verify browser and original instance.

V258 COMPLETE: 23 focused frontend tests pass; candidate build and 63-file image verification pass; browser verifies live /PLAN messages/tools, ordinary follow-up while planning runs, poll-error retry on same task, terminal no-result unlock. Candidate18081 accepted, original18080 unchanged. No fresh model invocation. See plan/v258-closeout.md.

## V259 relevance and persistent venue data
- [ ] Keep full insertion catalog; prioritize related targets and mute other targets.
- [ ] Audit venue persistence; persist acceptance history with source/fetched metadata and serve stale data without blocking.
- [ ] Retrieve valid public statistics, seed database and verify live CVPR response/restart reuse.
- [ ] Add targeted regressions, build/deploy candidate and browser check.

V259 scope extension: user explicitly requested private plan/favorites/AI results too. Added authenticated user+project workspace and durable recommendation snapshots, browser migration/hydration and queued patch writes. All implementation and verification steps complete:73frontend+21backend,66imagefiles; liveCVPR76ms/7ms; isolated clean-browser restore and UI writeback pass. Snapshot persistence audit: plan/v259-persistence-audit.md.

## V260 legacy workspace migration regression
- Confirmed user GETworkspace200 followed by migrationPOST400; not a database outage.
- Preserve legacy plan fields and local backup; separate migration errors from read failures, keep Venues usable.
- Regress legacy field migration and rejected migration fallback; guarded deploy/browser check.

V260 COMPLETE:deployed/accepted;76tests,66imagehashes,browserlegacyfields accepted and POST400 fallback keepsVenuesusable with exactbackup. Original18080unchanged;testproject archived. Seeplan/v260-closeout.md.

## V261 calendar export and Venues checkpoint
- [ ] Add shared ICS export with stable identifiers, UTC/date-only handling and escaping.
- [ ] Add bottom actions for full Plan (journals included), individual/all conference Tracks and filtered conference views.
- [ ] Verify export contents and UI; record delivery limits.
- [ ] Resume scoped Git checkpoint; pending dependency-scope reply, no push.

V261 COMPLETE calendar feature: ICS export, footer integrations,56focusedtests,25expandedpasses with3confirmedpreexistingfailures,productionbuild,68imagehashes,browserdownloads allscopes passed. See docs/venues/calendar-export.md and plan/v261-closeout.md. No calendar account mutation. Git checkpoint remains pending dependency-scope reply; no staging/commit/push performed.

## V262 calendar footer presentation
- Short provider labels globally; compact paired buttons centered without top rule.
- Use Google G and iCloud brand SVG assets with provenance.
- Move all-Track export to Submission timeline footer; retain per-Track export only in each Track card.
- Verify UI geometry, scopes, production build and candidate deployment.

V262 COMPLETE: centered paired short-label brandSVGcontrols everywhere; no separator; aggregate Track export now only at Submission timeline footer, individual export retained in each Track card.18tests,productionbuild,72imagehashes and browserpassed. Browser verified same-row/centered/zero-border/imagesloaded,12px/32px,all exportscopes, noJSerrors. Candidate18081accepted; no externalcalendar writes. Git remains pending earlier scope clarification.

## V263 calendar alignment correction
Root cause: Card tiles inherit align-items:start, so footer shrank to button width; earlier browser check compared buttons only to this shrunken footer. Set footer width100%/stretch; remove extra footer margin and set card row-gap8px. Verify against whole card center and actual preceding content gap, both Card and Timeline.
V263 scope extended: unique SVG navigation icons, one Submission Plan entry replacing duplicate Plan/Plan submissions; retain distinct lightweight refresh, rename Refresh deadlines (plugin Update metrics is full database+AI job).

V263 COMPLETE: candidate18081accepted,72frozenimagehashes,20tests,browser allpass. Whole-cardcenter and same-row confirmed;Timeline content-to-exportgap8px.4uniqueSVGnavigationicons andsingleSubmissionPlan verified. Noexternalcalendarwrite;testprojectarchived. Original18080unchanged. Git scope stillpending.
