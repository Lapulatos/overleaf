# Implementation evidence

## First implementation pass (2026-11-11)

- Added `gitWorkspace` storage metadata and unique parent/branch index. Default workspace retains original Project identity.
- Added named-member inheritance from parent and removed token/public access from internal workspaces.
- User-facing project queries exclude internal storage records. Internal admin/rename requests refused; lifecycle endpoints currently blocked while workspace lifecycle support is incomplete.
- Branch entry creates an independent native document space; repeat/concurrent entry reuses it. Default binding and uncommitted files are preserved. Interrupted initialization retains its identity and refuses third-party changed bytes.
- Workspace switching returns a navigation response; the calling browser alone reloads. No global file replacement.
- Membership-removal/role-change notifications fan out to child rooms.
- Snapshot collection now checks document versions a second time. Apply preflight checks version vector including ABA (edit then undo).
- Workspace feature defaults off; enable only synthetic project IDs / persistent opt-in metadata. Destructive workspace Git commands and writable Shell remain gated pending P3.
- Unit/native Git tests are not multi-user OT acceptance. Full P1 security and P2 reconnect gates remain outstanding until live tests complete.
- First frontend build attempt ran before staging due to wrong cwd, was cancelled; it is not acceptance evidence. Rebuilt with staged changed files.

## Environment interruption

The first acceptance image build exhausted Docker VM disk space. Its MongoDB failed with ENOSPC and recovered after removing this build's 545 MB context cache and unused native Git r46/r47 test images. r44 was already absent. No database volumes were removed. Candidate MongoDB returned healthy and port18081 login returned200. The separate main `mongo` has an older kernel-compatibility startup failure predating this event; it was not changed. Port18082 now runs with four synthetic accounts. Large repeated image builds must be avoided until more disk headroom is available.

## Cross-branch acceptance checkpoint (2026-11-11, 14:39 Asia/Shanghai)

The initialization403 was traced to TpdsUpdateSender asking for members while an internal workspace was preparing. Legacy project-name-based third-party export must not export branch storage separately; doing so would also risk overwriting the default branch. Disabled that export for internal storage (and avoid membership lookup entirely when TPDS is unconfigured). Preparing-workspace HTTP authorization remains denied.

The next live failure was realtime join using `new ProjectAccess(child)` rather than parent-inherited membership. EditorHttpController now uses the same inherited access for child joins and reads invites from the logical parent. These are substantive platform integration fixes, not loosened child access.

- `workspace-integration-unit-tests.log`:41 tests pass, including third-party export suppression and inherited realtime join/refusal regressions.
- `multi-user-isolation-accepted.json`:10 real browser checks pass using four independent accounts, including same-branch concurrent OT, personal branch switching, B/C collaboration separate from A, unpublished branch inventory, nonmember refusal, reload persistence, hidden internal project, refused child delete, and membership revocation disconnect.
- `fixture-tested-overlays.json` records the three source overlays verified against the test container. Latest repository-event changes are not covered by these browser results.
- Previous failed attempts are retained. This checkpoint does not prove stale/offline epoch protection, transactional conflict recovery, presence, remote automation, or P6 lifecycle completion.
- The original18080/18081 applications were not updated. No real manuscript/remote modifications and no new commit/push in this continuation.

## Conversation consolidation follow-up (2026-11-11)

Input: current conversation, requirements.md, implementation-points.md, implementation-plan.md, and existing multi-user-isolation-accepted.json. This pass reads prior test evidence; it does not rerun browser tests or claim production acceptance.

Added an inventory of earlier Terminal/permissions/menu/Graph/Clone/Assistant requirements and the distinction between Git primitives and Overleaf-specific integration. Added W29–W34 (semantic/compile failure, moving source refs, late background results, snapshot/event races, capability separation, recovery retention), each mapped to the existing six stages and eight test groups. Marked the source-entry table as the original design baseline to avoid treating it as a fresh code audit.

Changed only README.md, requirements.md, implementation-points.md, implementation-plan.md, task_plan.md and this notes.md. Existing source modifications, test evidence, manuscripts, containers and remote repositories are untouched by this documentation pass.

Validation:34 unique consecutive risk IDs; 15 relative Markdown links resolved across the six documents; existing acceptance artifact contains10 passing checks. This is document/evidence consistency verification, not a new functional test run.

## Isolated merge draft implementation (2026-11-11)

Added CollaborationTaskStore.mjs and MergeDraftService.mjs. Task writes use temporary-file fsync, rename and directory fsync. Merge preparation creates a distinct locked native worktree. The live project is read/exported for its baseline but never receives conflict markers. Resolution requires matching task revision, actor/session lease and lease generation. A native-resolution intent is persisted before Git writes; failures retain a recovery-required task instead of blindly retrying. Cancellation retains its draft. Public task responses exclude disk paths and document manifests.

GitCommands schemas, NativeGitRuntime dispatch and RepositoryEvents invalidation now include prepare/list/get/claim/conflict/resolve/validate/cancel draft commands. These routes do not apply live document changes. Runtime dispatch itself has not yet been tested inside the application. Existing HTTP authorization still requires write access even for task reads; read-only status UX remains pending.

The first real-Git run had6/7 passing: deleting a source ref produced an unclassified Git error and left the preview active. Fixed missing-source handling to persist superseded state while preserving the draft. Source-deletion failure log is merge-draft-first-attempt.log.

Final targeted command: node --test services/web/test/agent/native-git-merge-draft.test.mjs services/web/test/agent/native-git-handlers.test.mjs services/web/test/agent/native-git-branch-workspaces.test.mjs services/web/test/agent/native-git-overleaf-project.test.mjs. Result:29 pass,0 fail, recorded in merge-draft-tests.log. Includes9 new real-Git draft scenarios and command-schema/authentication regression. Runtime syntax and git diff --check also pass.

Remaining: draft reconciliation after interruption; epoch/lease-fenced application and recovery across document/ref changes; project-wide conflict UI; browser and external-client end-to-end acceptance. This does not complete P3. No real manuscript, remote, deployment or container change in this checkpoint.

## Merge application coordinator and transaction scope (2026-11-11)

Added MergeApplicationService.mjs. It requires an explicit epoch adapter and project transaction, revalidates the preview, creates a native commit object, retains before/after files and a per-step journal, blocks workspace export while a mutation is pending, applies documents, advances epoch, updates the target ref using its expected old OID, and updates the index/worktree. Failure preserves a recovery-required state; it does not restore old bytes over potentially newer collaborator edits. This coordinator is not yet exposed by an application HTTP command: the real epoch/session integration and reconciliation path remain required.

OverleafProject now offers transaction-scoped read/apply operations with an expiring capability, per-step callbacks and lease assertions. ProjectWriteAccess supplies the actual Redis lease assertion. WorkspaceStore retains mutationTaskId; ProjectWorkspace refuses ordinary export during pending mutations and exposes the task identity in status. Draft tasks can capture an injected workspace epoch. Task storage now rejects oversized JSON before writing an unreadable record.

Verification:
- merge-application-tests.log:60 cases,57 passed,3 Redis-dependent cases skipped in the host run;0 failures.
- write-gate-live-redis-tests.log:4/4 passed against the task-owned collaboration Redis DB14 using unique temporary keys, including the three skipped cases. The container ProjectWriteGate.js hash matches the local source:16bbea8aaeda86e58d2a66dfdc3b312cf84e9505fb8d87ab0770ce2138d6c1fb.
- New application tests use real Git with a modeled document transaction; adapter tests separately verify native-service calls and lease loss. They are not browser/OT/epoch end-to-end acceptance.
- Covered successful transfer, failure after the first document, epoch-update failure, final lease-check failure, epoch mismatch and a competing target ref. Failure retains snapshots and prevents ordinary export. Further apply attempts do not overwrite later collaborator bytes.
- The first competing-ref injection missed its target because macOS canonicalized /var to /private/var. Corrected the test to match the requested worktree path; saved the invalid attempt as merge-application-first-attempt.log, then reran the full targeted suite.
- Syntax checks and git diff --check pass.

Changed source in this checkpoint:CollaborationTaskStore.mjs, MergeDraftService.mjs, new MergeApplicationService.mjs, OverleafProject.mjs, ProjectWriteAccess.mjs, ProjectWorkspace.mjs, WorkspaceStore.mjs; tests:native-git-merge-draft.test.mjs and native-git-overleaf-project.test.mjs. Original applications/manuscripts/remotes are unchanged. No deployment or push. Redis verification only created and cleaned unique test keys.

Still required: durable snapshot-directory guarantees, explicit reconciliation of interrupted phases, persistent workspace epochs enforced by all edit sessions/queues, prepare barrier and offline recovery, application endpoint/UI, multi-browser conflict notifications and full P3 acceptance. Automatic live application and AI writeback remain disabled.

## Explicit interrupted-application recovery (2026-11-11)

Added RecoverySnapshots.mjs (file manifests, directory fsync including ancestors, verified readback) and MergeRecoveryService.mjs. MergeApplicationService now retains an initial and per-file document checkpoint plus before/after manifests.

Recovery preview binds task revision, docId/version/content/structure identity, epoch, HEAD, index and pending mutation ownership into one fingerprint. Resume is permitted only when the checkpoint and allowed Git/epoch states still match. It uses the already-created commit and advances epoch only if not already advanced. Explicit preserve-current keeps current collaborative content, HEAD and index, backs up the existing disk tree and current documents, then unblocks ordinary export. It marks the merge cancelled rather than falsely resolved. Ambiguous partial writes do not automatically resume or restore before-images.

Recovery uses a stable operationId; repeated successful requests return the same result, and reuse for another actor/mode is refused. A newly changed document/version invalidates the preview; corrupt after-snapshot content is refused. These APIs are service-level only pending real epoch/session integration and application routing.

Validation:node --test over native-git-merge-draft, native-git-overleaf-project, native-git-branch-workspaces, native-git-handlers and native-git-workspace test files. merge-recovery-tests.log records62 passing tests,0 failures/skips. New recovery cases cover a completed first-file checkpoint, epoch failure, final lease failure, idempotency, ambiguous partial write followed by a collaborator edit, stale preview and modified snapshot. Native Git is real; document transactions in coordinator tests are modeled, while adapter behavior is tested separately. Syntax and git diff --check passed.

Files changed in this checkpoint:new MergeRecoveryService.mjs and RecoverySnapshots.mjs; updated MergeApplicationService.mjs and native-git-merge-draft.test.mjs, plus task_plan.md/notes.md/README.md. No production deployment, manuscript edits, container changes, commit or push.

Remaining boundaries:real persistent epoch adapter and stale/offline session rejection; durable recovery references/retention against Git GC; interrupted draft-resolution reconciliation; project-wide notifications and recovery UI; integration/fault tests with actual OT queues. Automatic live application/AI writeback remain closed until full P3 acceptance.

## Epoch admission foundation (2026-11-11)

Added WorkspaceEpochGate.js to redis-wrapper and WorkspaceEpoch.mjs/WorkspaceEpochRuntime.mjs to NativeGit. Project metadata now has opt-in gitWorkspaceFenceEnabled and persistent gitWorkspaceEpoch. Native runtime can capture an enabled epoch for merge previews. Database CAS is authoritative; the Redis mirror rejects older generations. Advance first fences Redis admission, then changes the database, then publishes the new generation. Database/mirror failure cannot silently restore old-session admission. Durable read is distinct from mirror hydration so interrupted operations can inspect/reconcile the authoritative epoch.

Realtime joins retain the supplied epoch in session context, and applyOtUpdate checks that submitted edit metadata matches it without relabelling an old edit. DocumentUpdaterManager now checks epoch and project write lease in a single Lua queue insertion when native integration is enabled. Existing unversioned/non-enabled behavior remains supported. No project has been opted into fencing in this checkpoint; browser metadata and authorized join hydration are not yet connected, and the queued-operation consumer still needs stale-epoch handling before activation.

Verification:workspace-epoch-realtime-tests.log has151 passing WebsocketController/DocumentUpdaterManager tests, including rejection without enqueue/relabel and matching-session acceptance. workspace-epoch-host-tests.log has6 pass/3 Redis skips (includes existing branch-workspace tests). workspace-epoch-redis-tests.log has5/5 pass in task-owned Redis DB14, covering monotonic publication, write-lease admission, missing mirror, stale generations and failed publication after durable advancement. Test helpers were copied only into /tmp/overleaf-epoch-acceptance in the synthetic container, not into running application source; unique Redis keys were cleaned by the tests.

An initial test-edit command used a repository-relative path from the service working directory and made no edit; corrected the path and reran the tests including the new cases. Syntax checks and git diff --check pass.

Changed files:WorkspaceEpochGate.js, redis-wrapper/package.json, WorkspaceEpoch.mjs, WorkspaceEpochRuntime.mjs, Project.mjs, WorkspaceScope.mjs, WorkspaceIdentity.mjs, NativeGitRuntime.mjs, realtime WebsocketController.js and DocumentUpdaterManager.js; new native-git-workspace-epoch.test.mjs and updated realtime WebsocketController.test.js; prepare-build.py adds the new gate/controller to staging; task_plan.md and notes.md record the boundary. No manuscript, remote, production deployment, commit or push changes.

Next critical step:browser document epoch must remain bound to its original snapshot across reconnect; old queued operations must be retained/refused at consumption, not merely blocked at new enqueue. No claim of completed offline protection yet.

## Browser epoch binding and queued stale-edit retention (2026-11-11)

Authorized joins now hydrate an enabled workspace epoch from the database adapter; ProjectEditorHandler exposes it only for fenced projects. Realtime returns the session epoch with joinDoc. ShareJsDoc stores the epoch when the document is created, and retries continue to use that value. DocumentContainer compares the returned epoch before reconnect catch-up; mismatch routes the existing local text to recovery error handling. Stale-edit errors capture the text before pending/inflight operations are cleared.

WorkspaceEpochGate now atomically takes queued updates: matching generations are returned for application, stale ones are retained under project/doc-scoped recovery keys before the source queue is trimmed. Malformed JSON leaves the entire batch intact. A foreign write lease prevents consumption. RealTimeRedisManager uses this path for native-enabled non-clustered Redis and broadcasts only a recovery notice, not rejected edit content. UpdateManager consumes that workspace-aware API. Notification publication failure does not discard accepted operations.

Verification:
- workspace-epoch-browser-unit-tests.log:4 targeted tests pass, exercising real ShareJsDoc send and DocumentContainer reconnect/error methods with mocked socket/editor surroundings.
- workspace-epoch-consumer-tests.log:51 pass; includes retained-update notification and failed-notification handling.
- workspace-epoch-realtime-tests.log:151 pass.
- workspace-epoch-web-tests.log:41 pass (existing unauthorized/unfenced cases; enabled join hydration is still awaiting live acceptance).
- workspace-epoch-redis-tests.log:7/7 pass against isolated Redis, including stale queue retention, malformed batch preservation and admission tests.
- An initial frontend fixture omitted the watchdog constructor's timeout callback; the failed run is retained as workspace-epoch-browser-first-attempt.log. Fixed the test setup and reran the targeted editor tests. The broad run before that fix had145 pass and1 fixture failure; it is not labelled a fully passing regression run.
- An initial consumer-test edit used an incorrect working-directory-relative path; corrected it and reran. Syntax/diff checks pass. Existing CodeMirror/jsdom layout and Browserslist warnings are not real browser rendering evidence.

Changed in this checkpoint:EditorHttpController.mjs, ProjectEditorHandler.mjs, realtime WebsocketController.js, frontend share-js-doc.ts/document-container.ts/new workspace-epoch.ts, WorkspaceEpochGate.js, document-updater RealTimeRedisManager.js/UpdateManager.js, related frontend/consumer/Redis tests, prepare-build.py, task_plan.md and notes.md. Original manuscript/remote/application deployments were unchanged; only isolated /tmp test helpers were updated and unique Redis test keys were created/cleaned.

Remaining:real synthetic-browser offline acceptance, epoch activation/migration/prepare barrier, authenticated recovery queue UI and durable retention beyond Redis restart guarantees, shared conflict/application/recovery interfaces. No opt-in flag was activated; do not describe this as completed offline protection.

## Discussion consolidation — 2026-11-11

Input: user conversation and existing requirements/implementation-points/implementation-plan. This pass changes documentation only. Added W35–W38 (concurrent branch identity, mixed-version admission, restore generation, automatic versus manual staging), mapped to existing P/T groups. Read retained JSON evidence: epoch browser5 pass; subsequent branch regression3 pass then timeout. Historical10-pass evidence is not reclassified as latest-version success. No application deployment, Git remote operation or manuscript edits performed in this documentation pass.

## Epoch compatibility rerun and dark-theme steering

The previously built null/undefined compatibility fix was deployed to the isolated fixture:54 files,1064753 bytes, hashes verified. Four-account regression now passes10 checks with no page errors; frozen evidence epoch-multi-user-fixed.json. This completes the previously failing branch regression, not all P1/P2 requirements. Offline epoch rerun is in progress. UI steering fixes three stylesheets; separate source-CSS browser evidence is in ../dark-theme/. No original-instance deployment or remote operation.

Final epoch offline/reconnect rerun:5 checks passed, complete:true, errors:[] on the repaired fixture overlay. Theme source build succeeded with2 warnings; source CSS browser validation covers three panels in both themes. Original instance unchanged.

## Exclusive queued-edit drain — 2026-11-11

Found: lockUpdatesAndDo processed only one8-operation batch before returning a Git snapshot or replacement. Exclusive operations now drain all accepted batches while holding the document lock, refuse no-progress/batch-limit failure, and recheck project lease before the method. WorkspaceEpochGate rejects token-bearing consumers if their owner lease is missing or replaced; ordinary non-owner queue reads remain blocked without dequeue. Tests cover25-operation modeled backlog, no-progress, lease loss between batches and after the last batch, plus actual Redis expired-token/no-dequeue behavior.

Evidence: queue-drain-unit.log55 passed; queue-drain-redis.log8 passed,0 skipped. Redis tests use only uniquely named keys in fixture DB14. Initial Mocha command used the repository cwd with a service-relative executable and failed before testing; rerun from services/document-updater succeeded. Application services were not redeployed for this checkpoint; temporary Redis helpers only. This is a queue admission/read boundary fix, not complete prepare-barrier or real multi-document application acceptance.

## Live document queue drain — 2026-11-11

Deployed only UpdateManager.js, RedisManager.js and WorkspaceEpochGate.js to the task-owned18082 instance; hashes stored in queue-drain-overlay.json; restarted only document-updater. Guarded queue-drain-fixture.mjs requires the exact fixture DB, root project name, project ID and enabled epoch. Under the real exclusive lease it queues25 sequential legitimate text edits without dispatcher notification, then calls the existing web document adapter over HTTP. Result: version25→50, exact final text match, queueRemaining0. Evidence: queue-drain-live.log. The synthetic manuscript intentionally retains the25 comment markers; no user manuscript or remote was changed.

This proves per-document multi-batch draining through actual HTTP/Redis/OT storage. It does not prove all-browser prepare acknowledgement, a multi-document mutation barrier, application rollback, or durable rejected-operation recovery. Those gates remain required.

Browser regression initially timed out at its first marker because25 added lines placed it beyond CodeMirror's rendered viewport. Saved epoch-browser-virtualization-failure.log/json. Corrected sees() to reveal the document end before inspecting text; rerun5 functional checks passed, complete:true, but errors contains3 Internal Server Error messages. These remain unclassified and must not be described as an error-free pass. A documentation assertion requiring errors:[] correctly failed before any misleading success record was written.

Prepare-barrier integration findings: nativeGitWriteState toggles busy only after exclusive admission closes; it does not flush others first. OpenDocuments.awaitBufferedOps resolves on abort, so acknowledgements must separately check signal and pending changes. /clients is local diagnostic inventory, not durable cross-realtime membership; do not treat it as the global barrier membership source.

## History fixture contract diagnosis

Browser errors traced to POST /project/<fixture>/flush → project-history3054, whose UpdateTranslator rejected queue-drain synthetic operations without doc. These were generated by our fixture script, not normal browser OT. Original queue test proved byte/version drain but was invalid as a history-integrity test. Added doc to generator. Paused only fixture project-history; backed up25 exact malformed records in queue-history-repair-before.json, added only doc using per-entry CAS, then restarted service. A first repair-script syntax check failed before mutation (missing brace); fixed before execution. No history operations were dropped and no real project modified. Error evidence retained in queue-history-error-evidence.json.

Corrected queue test: version57→82,25 operations, exact text and empty queue (queue-drain-live-corrected.log). Real project-history flush returned204 (queue-history-flush.log). Browser regression rerun pending. Separate writing-assist/check failures reflect fixture missing AI credentials; do not suppress or classify a generic pageerror without its request/stack. Browser evidence now captures response paths/status and pageerror stacks.

Final history correction evidence: epoch-browser-acceptance.json records5 passing functional checks and errors:[]; all captured failed HTTP responses belong to writing-assist endpoints, summarized in epoch-browser-error-classification.json. No history/Git5xx captured in this rerun. Queue fixture now asserts real history flush204 as part of the test, preventing a bytes-only acceptance from concealing this contract failure. See queue-drain-live-history.log. This is still not a full AI/history-lifecycle acceptance.

## Shared preparation state foundation

Added libraries/redis-wrapper/WorkspacePrepareGate.js and package file inclusion. Preparation records bind server operation UUID, workspace epoch, expected session IDs, Redis-clock deadline and per-session pending/saved/failed status. Negative acknowledgement is sticky; a single atomic claim requires all sessions saved; wrong identities/expired/missing records fail closed. Cancellation uses exact operation identity. No public route or runtime activation.

Evidence: workspace-prepare-redis.log4 tests passed,0 skipped, against unique fixture DB14 keys with two independent Redis connections. Tests cover concurrent claims, partial acknowledgements, nonmember ack, sticky rejection, stale task/epoch, exact cancellation, timeout and missing state. Membership generation, join exclusion, process restart reconciliation and browser flushing are deliberately NOT inferred from these tests. Runtime must close admission around a trustworthy cross-node session snapshot and retain the project write lease/version checks; the preparation claim is not itself permission to modify documents.

## Browser preparation protocol

Added workspace-preparation.ts, bound in EditorManagerProvider with the current project epoch. Dedicated gitPrepareBusy participates in IDE readOnly so it does not overwrite local command or server write busy flags. The React adapter commits readOnly synchronously before awaiting buffers. Positive acknowledgement waits for buffers and checks remaining changes; pause survives until matching completion or deadline. Wrong project ignored, wrong epoch rejected, competing operation rejected, disconnect/context disposal cancels outstanding confirmation without clearing local edits.

Evidence: workspace-prepare-browser-tests.log12 passing (8 preparation protocol +4 epoch regression). First test creation used wrong cwd and was corrected; timeout test initially used unsupported Sinon tickAsync, corrected to synchronous tick plus explicit promise settlement. Production frontend build is running. Realtime authenticated ack receiver, authoritative membership/join exclusion and end-to-end prepare acceptance remain pending; no server initiates this protocol yet and merge application remains closed.

Browser preparation production build completed successfully with2 warnings (workspace-prepare-build.log). Source/client tests and bundle compilation are verified; no fixture or original-instance deployment for this browser checkpoint.

## Preparation membership and post-claim invalidation

Implemented in `libraries/redis-wrapper/WorkspacePrepareGate.js`: atomic registration and registered preparation snapshot, explicit initialization against epoch mirror, disconnect invalidation, and `assertClaimed` for protected application callers. Claim now checks the current epoch mirror as well as registry generation. Negative acknowledgements arriving after claim invalidate the record; subsequent success cannot undo failure.

Verification: `services/web/test/agent/native-git-workspace-prepare.test.mjs` executed against isolated Redis DB14 using two independent connections and random project keys;12 tests passed,0 skipped. Evidence: `workspace-prepare-redis.log`. Includes concurrent join/snapshot, missing registry, old generations, disconnect after confirmation/claim, late negative confirmation, epoch loss/advance, cancellation and expiry. Module syntax check passed.

Scope: helper copied only to fixture temporary test directory; no production/runtime module deployment. Actual authenticated socket registry integration, restart reconciliation, project write admission and merge application wiring remain unfinished. A successful recheck is only a point-in-time observation; callers must hold the independent project write lease and preserve snapshot/version validation through mutation. This is not evidence that production merge or automatic pulling is safe to enable.

## Realtime preparation admission and acknowledgements

The real-time controller now registers opted-in sessions before room admission and removes registrations on leave, disconnect racing registration, and failed room joins. Document joins/updates are rejected while registration is pending. Router receives `nativeGitPrepareAck`; controller validates payload and uses server-side project, socket ID and epoch, ignoring supplied identity fields. Redis gate initialization is lazy, preserving disabled deployments. Project model flag `gitWorkspacePrepareEnabled` defaults false and is exposed only with fencing enabled.

Verification:135 WebsocketController tests passed, including8 new cases covering identity spoofing, disconnected/unregistered acknowledgements, malformed/stale requests, pending admission, registry failure, disconnect race and room failure. Evidence: `workspace-prepare-realtime-tests.log`. Syntax checks and scoped diff whitespace check passed. An initial test-edit command used the service working directory with a repository-relative path and failed before editing; corrected from repository root. The initial127-test regression run did not cover the new tests; only final135 count includes them.

Remaining: runtime bootstrap/restart reconciliation, browser capability migration and actual multi-user preparation acceptance, plus orchestrator and application lease/snapshot integration. Flag remains disabled. No production or fixture runtime deployment in this checkpoint, only source changes and unit tests.

## Prepared write orchestration checkpoint

Added `WorkspacePreparation.mjs` and explicit `withPreparedProjectWrite` adapter in `ProjectWriteAccess.mjs`. Preparation precedes exclusive lock acquisition so browser buffers can drain. Claim is revalidated inside the lease; callers receive a check for subsequent protected mutations. Exact-operation cleanup runs on success, failure and cancellation; cleanup errors preserve the original application error. Adapter refuses unconfigured/stale workspaces and never silently downgrades to an unprepared write.

Evidence: `workspace-preparation-orchestration-tests.log` (7 unit cases), `workspace-preparation-redis-integration.log` (14 Redis cases,0 skipped). The2 new Redis integration cases exercise independent A/B confirmations and disconnect between claim and protected action. Lease and transport in these tests are injected adapters, not real HTTP/socket/browser execution. Modules were copied only to fixture temporary test directory. Source syntax passed.

Remaining: registry bootstrap/reconciliation, actual browser preparation, merge application/recovery invocation, intentional epoch-advance lifecycle and other P1–P6 work. No automatic application enabled or production deployment.

## Live two-user preparation and disconnect acceptance

Deployment: task-owned18082 container only; `prepare-fixture-overlays.json` records66 verified file hashes. Overlay includes current frontend assets (including dark theme correction and browser preparation), realtime router/controller and Redis helpers. Original18080/18081/80 instances untouched.

Fixture bootstrap: `prepare-fixture-control.mjs initialize` guards the dedicated DB, exact synthetic root name, fenced status and stopped real-time service. It refuses existing participant entries and enables preparation only after epoch hydration and registry initialization. The sole fixture realtime process was stopped/restarted. This is fixture bootstrap evidence, not a production multi-worker migration or crash reconciliation implementation. Root now has preparation enabled at epoch8; future epoch tests must explicitly coordinate registry generation before advancing.

`prepare-browser-acceptance.mjs` uses two authenticated browser contexts and the actual backend `withPreparedProjectWrite` adapter.9 checks passed,0 uncaught page errors: both session registrations, edit convergence, both DOM editors read-only, all acknowledgements received/protected callback completed, release/state removal, resumed editing, participant disconnect causing rejection, surviving editor release and disconnected-user rejoin/convergence. Artifacts: `prepare-browser-acceptance.{json,log}`. Initial6-check happy path passed before adding3 disconnect/rejoin checks. Synthetic marker text only; no user manuscripts or remotes changed.

Limits: protected callback holds the actual write lease and rechecks preparation after a delay, but deliberately has no merge/document replacement; this is not merge-application acceptance. No second realtime worker, crash reconciliation, epoch advance within prepared application, or AI callback was validated. Application/recovery integration and remaining P1–P6 work remain required.

## Prepared merge transaction and intentional epoch advance

`WorkspacePrepareGate.advanceMembership` now performs an atomic registry generation transition only for the exact claimed operation, after the epoch mirror is next-generation. It removes old registrations, preserves active join exclusion and allows idempotent same-transition retry. Old sessions retain old epoch and cannot register into the new generation. Claims distinguish authorized advancement from unexpected epoch changes.

`WorkspacePreparation` exposes an epoch-advance capability under the actual lease, coordinates durable epoch advancement with registry transition, and performs a final preparation assertion. A caught transition failure still fails the operation. `ProjectWriteAccess` supplies the real epoch adapter. `OverleafProject.transaction` accepts explicit prepared mode, rejects missing prepared integration, and expires the transaction capability at exit. Native runtime passes that adapter; MergeApplicationService requests prepared mode and uses transaction epoch advancement. Other ordinary operations retain existing behavior.

Evidence: `workspace-preparation-epoch-redis.log`16 passed; `workspace-preparation-orchestration-tests.log`9 passed; `prepared-merge-adapter-tests.log`32 passed including existing real-Git conflict/application/recovery tests and2 new adapter tests. Redis helper copies were updated only in the fixture temporary test directory. Actual runtime overlay remains the prior browser-tested revision. The existing merge tests use a modeled document transaction; they do not prove browser merge acceptance.

Still required: prepared recovery integration, production registry reconciliation, post-merge client notification/reload preserving local buffers, application routes/UI and full real-browser merge acceptance. No source changes in this checkpoint were deployed to normal or fixture runtime.

## Client epoch notification and real browser transition

Backend preparation now broadcasts the advanced epoch after leaving the exclusive lease and before the matching finished event, including failure after known durable advancement. Client ignores wrong-project/malformed/older/repeated events, locks editing synchronously, captures every open document snapshot and displays the existing out-of-sync recovery dialog without clearing pending operations or automatic reload. Single-document recovery remains plain text; multiple documents are represented as JSON records with document IDs and exact contents.

Validation: `workspace-epoch-notification-tests.log`16 frontend tests, orchestration9 tests, `workspace-epoch-notification-build.log` webpack completed with2 warnings in64692ms. Deployed59 hash-verified files (1,138,620 bytes) only to18082; manifest in `prepare-fixture-overlays.json`.

`prepared-epoch-browser-acceptance.{json,log}`:4 checks passed with no page errors. Two registered users shared a marker; actual prepared transaction advanced durable epoch and Redis membership from8 to9; both old editors became read-only and exposed marker text in recovery textarea without another edit; both manually reloaded into the new generation and resumed synchronized edits. This includes real Mongo/Redis/write-lease/socket/browser handling, but not document replacement by a merge. Production instances and remote repositories unchanged.

Remaining: prepared recovery integration, multi-worker crash reconciliation, application endpoints/UI and actual multi-user merge application/recovery, followed by remaining P1–P6 scope.

## Prepared recovery and API command wiring

Recovery now reads the current authoritative epoch before entering prepared transaction, then validates its fingerprint inside that transaction. This supports retry after an earlier attempt already advanced the epoch without a duplicate advancement. Application/recovery require transaction-provided epoch advancement instead of falling back to a separate direct epoch call.

Added `mergeDraftApply`, `mergeDraftRecoveryPreview`, `mergeDraftRecover` schemas and runtime dispatch. Inputs require task/revision/lease or explicit recovery mode, operation identity and fingerprint. Client-supplied disk paths/epochs and invalid modes are rejected. Mutation commands require repository write policy; all handlers retain authenticated project write authorization. Runtime rejects missing prepared integration; the real adapter checks persisted fence/preparation flags and epoch before mutation. Public task serializer remains the response boundary. Expected preparation refusals are classified as409, missing membership as503; unknown failures remain server errors.

Tests: `prepared-recovery-tests.log`32 passed, `prepared-merge-handler-tests.log`10 passed, `workspace-preparation-orchestration-tests.log`10 passed. Initial fixture incorrectly asserted that stale requested epoch equals current epoch; revised to reject it like actual prepared admission. Initial failure retained in `prepared-recovery-first-attempt.log`. Existing recovery tests now assert prepared generation is1 before advance or2 after final-lease failure, with no duplicate epoch/commit and idempotent replay.

Limits: command routing and modeled recovery checked locally, not actual HTTP/browser merge application. No deployment or external Git operations performed this turn. Fixture stays at epoch9 from previous acceptance. Shared conflict/recovery UI, real merge transfer tests, multi-worker reconciliation and remaining P1–P6 still required.

## Actual merge transfer over authenticated HTTP

Added guarded `merge-fixture-source.mjs` (dedicated DB/root/preparation checks, unique synthetic branch, clean baseline required) and `merge-browser-acceptance.mjs`. Test commits existing synthetic test markers as baseline, creates a local source branch with one new marker, and invokes `mergeDraftPrepare`, `mergeDraftClaim`, `mergeDraftApply` via browser-authenticated HTTP with CSRF. Two real browser sessions participate in preparation.

First HTTP preparation exposed `Cannot access identity before initialization`: an unrelated commit-author local variable shadowed the module identity validator throughout execute. Renamed local variable to `commitIdentity`. Earlier service unit tests bypassed this runtime dispatcher. Failure artifacts retained in `merge-browser-runtime-shadow-failure.{json,log}`. A second attempt hit login during service restart; retained `merge-browser-startup-failure.{json,log}` and added bounded login readiness retry. No failed application or user manuscript occurred in either attempt. Failed-attempt synthetic source branch retained.

Final `merge-browser-acceptance.{json,log}` reports4 passed checks,0 page errors: isolated prepare, actual document transfer/epoch advancement, both users reload merged text, clean live Git status/no pending mutation/resolved task. Task631851d4-ad40-4561-b9bf-ec6c885e85a3; source045e71a5c23049e6d5489699c0f697342c40bc25; target baselineaeb7aacd2f49ad31a84a0585b4d7e153a2c5597f. Synthetic root advanced9→10. Deployed57-file overlay plus hash-verified runtime correction (`merge-runtime-overlay.json`), only18082. No remote push, original instance change or real paper edit.

Limits: successful nonconflicting merge tested. Live interruption/recovery, actual conflicting-file resolution UI, multi-worker failure reconciliation and remaining phases are not complete. AI services remain unconfigured in fixture; pageerror-free is not a claim of clean AI HTTP responses.

## Shared conflict task interface and browser acceptance

Added `collaboration-tasks.tsx` and Source Control integration. Isolated-workspace Merge now prepares a draft, then opens shared tasks. Users can claim/renew a resolution lease, resolve files through the existing three-way conflict editor, apply/cancel drafts, inspect recovery and explicitly resume/preserve current. Apply/recovery availability is reported by persisted workspace preparation capability. The modal refreshes shared task state every5 seconds; this is polling, not websocket task-state push. Revision ordering protects newer local task responses against older polls. Existing user-entered conflict text is not replaced by polls.

`conflict-browser-acceptance.{json,log}`:6 real HTTP/browser checks passed with0 page errors, including a genuine same-position conflict, shared task revision, refusal of another user claiming/impersonating resolver, isolated resolution preserving live text, application and convergence.

`collaboration-ui-tests.log`:8 passed; `collaboration-panel-regression.log`:45 passed, with jsdom getClientRects layout errors logged (not a clean DOM warning run). `collaboration-ui-build.log`:production webpack passed with2 warnings in46060ms. Only18082 updated;58 files hash verified (1,151,833 bytes), `prepare-fixture-overlays.json`.

`conflict-ui-browser-acceptance.{json,log}`:6 passed,0 page errors. Real UI actions opened shared tasks in both browsers, selected the same task, claimed A's lease, observed resolver on B, refused B's competing claim, resolved main.tex via Use incoming & stage, applied using Apply resolved merge, reloaded both editors and verified clean Git/document state. Taskb65674ba-9a39-4f4a-9cd6-bb148d6ed1d6; source44a73d4434e7e56a721ec5fe9c7bd27a30daf527. Fixture epoch advanced11→12 (earlier API conflict10→11).

Three UI locator attempts failed before application: implicit Task label included option text, global combobox matched assistant controls, and Close matched rail/header/footer. Retained `conflict-ui-{selector,ambiguous-selector,close-selector}-failure.{json,log}` and synthetic drafts. Corrected selectors scope to task combobox and modal footer. These are test locator failures, not successful product acceptance.

Remaining: actual interrupted application/recovery UI, task notifications outside open modal, server crash/restart reconciliation, automation/presence and remaining P1–P6. Production instances, real manuscripts and remote repositories unchanged.

## Live interrupted merge recovery and preserve-current

`recovery-fixture-control.mjs` guards the dedicated DB, exact synthetic root, enabled preparation and task scope. It creates a separate runtime instance whose injected prepared capability throws after the actual durable epoch advance, leaving the real merge application journal/recovery state. Production service code contains no test injection. This is controlled exception injection, not a killed server/hard-crash test.

`recovery-ui-browser-acceptance.{json,log}`:6 passed,0 page errors. Real documents transferred, epoch12→13, application interrupted with original commitd2bab11b81301bde9f2eb913a6e6ffcf7daee0f3 retained. Both users reload transferred content, ordinary Git commit is refused during pending recovery, recovery preview and Resume interrupted merge UI finish the original commit without advancing epoch again. Final document/Git state clean and mutation marker cleared.

`preserve-current-browser-acceptance.{json,log}`:7 passed,0 page errors. A second interrupted application advanced13→14 and retained commit1fbc5b9b6a726248a24a6c202ff2eb231c1f087b. B added a newer acknowledged edit after interruption. Recovery preview disabled Resume; explicit Preserve current contents retained the new text on both browsers, cancelled the merge task, cleared mutation marker and left main.tex as an uncommitted change. No blind restoration or implicit commit occurred.

Corrected Source Control pending-mutation banner: open the exact recovery task instead of issuing legacy resumeTransfer. `recovery-banner-tests.log`:1 targeted test passed (existing TimeoutNaNWarning). Build pending at checkpoint. Only synthetic18082 project changed; no real manuscript/remote actions. Remaining: live hard-crash/restart and multi-worker recovery, shared notifications outside panel, automatic tasks, graph presence and remaining phases.

Recovery banner follow-up: `recovery-banner-build.log` compiled with2 warnings in44298ms. Deployed58 files (1,152,109 bytes) only18082; hashes in `prepare-fixture-overlays.json`. Re-ran actual interruption and recovery using the new Review interrupted merge entry:6 checks passed,0 page errors. Fixture epoch14→15; recovery reused commit38b5175483f1b4af2c0ccf420cc374e4ec8f9064 and did not advance again. Final Git state clean. Original pre-banner results preserved as `recovery-ui-before-banner.{json,log}`. No production deployment.

## Stale-session recovery primitive checkpoint

Added `WorkspacePrepareGate.recoverMembership`: one Redis script verifies current exclusive project write token, next epoch mirror, and old registry/preparation generation before resetting membership. Missing registry can be rebuilt only with the same guarded transition. Retry returns without deleting users registered in the new generation. Old-epoch registration remains rejected. No timeout-based pruning.

Validation: `session-recovery-redis.log` records20 real Redis tests passed,0 skipped, including4 new recovery cases. Test uses random project keys in isolated Redis DB14, with cleanup. The script was copied only to the fixture temporary test directory; running application code was not deployed.

Boundary: this primitive cannot prove that Mongo advancement or document snapshotting happened; the runtime integration must perform and journal those under the same exclusive lease. Authenticated recovery workflow, journal replay, browser notification and actual hard-crash acceptance remain unfinished. No production or manuscript modification.

## Durable session recovery service

`SessionRecoveryService.mjs` now journals recovery identity and expected epoch before snapshot/advancement. It saves accepted document bytes plus entity/version metadata, using a new snapshot revision on retries before epoch advancement. After durable advancement it validates the retained snapshot, hydrates the mirror and rebuilds membership without another epoch increment. It refuses a competing unfinished operation, a changed project scope, a later unrelated epoch and corrupted snapshots. Notification runs after lease exit.

`session-recovery-service.log`:6 passing tests with actual task files/fsynced snapshots and injected lease/epoch dependencies. These are not live platform or process-kill tests. Runtime wiring must supply the repository lock, actual project lease, queue-draining document reader, authoritative epoch adapter, permission checks and recovery availability policy. Current running instance unchanged.

## Session recovery command integration

Changed GitCommands schema and NativeGitRuntime dispatch, added SessionRecoveryRuntime. Dedicated project-scoped session task store avoids mixing merge task records. Owner restriction is enforced in runtime after HTTP write authorization; mutation also requires repository-write policy. Public results expose IDs, states, phases and epochs only. The write token is read from AsyncLocalStorage inside the actual exclusive lease, never accepted from HTTP.

17 handler/service tests passed (`session-recovery-command-tests.log`): validates strict payload rejection and existing HTTP authorization plus snapshot/retry behavior. Owner check and actual runtime wiring are source-implemented, not yet exercised end-to-end. Pending session journals block ordinary locked repository actions, while list/recover use the recovery lock to remain accessible.

Outstanding combination: binding.pending/mutationTaskId currently refuses session reset. A crashed realtime worker during interrupted merge may therefore require coordinated merge/session recovery; do not erase that journal or advance its epoch independently. UI entry, live owner/editor checks and process-kill browser acceptance are still required.

## Pending merge plus stale session membership

Added MergeSessionRecovery helpers. SessionRecoveryRuntime now checks merge scope, branch and pending application and links its guarded epoch transition to that journal. SessionRecoveryService resolves its task only after this link persists. MergeRecoveryService accepts that recorded generation while preserving all checkpoint, document version, HEAD/index and preview fingerprint checks. Original workspaceEpoch and application snapshots are not rewritten. Legacy binding.pending transfers still refuse session reset.

Evidence:29 tests passed in combined-session-merge-recovery-tests.log, using real temporary Git repositories/filesystem and injected project/epoch adapters. New cases cover unknown advanced epoch rejection, explicitly linked resume retaining original commit, idempotent linking and refusal to overwrite newer edits. session-recovery-service.log separately records7 passing cases including link-write failure retry. Runtime syntax check passed. Actual process-kill/browser tests and owner authorization end-to-end remain pending; no fixture application or production deployment this turn.

## Actual realtime worker crash and session recovery

Previous turn: progress (coordinated merge/session recovery).
- [x] Deploy backend and Redis adapter to isolated18082;60 files hash verified.
- [x] Two authenticated browsers synchronize a unique marker; non-owner recovery returns HTTP403.
- [x] Kill realtime worker with runit SIGKILL; verify new PID and retained stale registry.
- [x] Owner HTTP recovery succeeds; both browsers reload preserved text.
- [x] Retry keeps same epoch; both users continue collaborative editing.

7 browser checks passed,0 page errors (session-crash-browser-acceptance.json).
Epoch15 to16; realtime PID4573 to4660. Synthetic edits remain in fixture.
No manuscript or remote changes. UI entry, combined merge interruption plus
worker crash, web process crash during recovery and Redis-loss validation remain.
Full P1-P6 goal remains incomplete.

## Session recovery UI accepted in isolated fixture

Production build passed with2 warnings;61 fixture files hash verified.
Three frontend tests passed. Seven actual dual-user UI checks passed with no
page errors, including real realtime-worker kill, owner dialog confirmation,
local-text snapshot inspection in the existing out-of-sync modal, reload,
idempotent retry and resumed collaborative editing.

Retained two failed locator attempts: covered reload button in the underlying
recovery dialog, then capitalization mismatch in Show Local File Contents.
Neither failure was a rejected recovery; both advanced the synthetic epoch.
Final script uses the top editor recovery modal and verifies its text before reload.
Evidence: session-crash-ui-browser-acceptance.json/log and session-recovery-ui-build.log.
Original instances, real manuscripts and remote repositories unchanged.
Remaining: combined merge/process crash browser acceptance, web-process crash
inside recovery, Redis-loss path and remaining P1-P6 features.

## Combined interrupted merge and realtime crash acceptance

Previous turn: progress (session recovery UI acceptance).
Created a real merge draft, injected interruption after document writes and
advancement, then killed the realtime worker while that same merge was pending.
The first session recovery request met ECONNREFUSED during service startup;
no recovery write had begun. Preserved that failure JSON/log and screenshot.
ProjectWriteAccess now converts capability-service unavailability to retryable503.
Updated/hash-verified only that backend file in fixture and restarted fixture web.

Resumed the SAME pending merge using combined-crash-resume-browser-acceptance.mjs.
Owner UI session recovery retained transferred text; ordinary commit remained
blocked until merge recovery; original commit resumed with no extra epoch;
Git clean and mutation marker cleared.8 cumulative checks,errors[],complete true.
Evidence combined-crash-browser-acceptance.json contains the successful combined
sequence; initial failure is combined-crash-service-startup-failure.json/log.
This is a recovered startup failure, not a single uninterrupted successful run.
No original-instance/manuscript/remote change. P1-P6 remains incomplete.

## P4 shared presence store checkpoint

Added GitPresenceStore.js and package export. Redis atomic snapshots contain
server-projected session/user/workspace/branch/HEAD/dirty/viewedCommit fields,
monotonic revision and reset generation. Out-of-order sequence is rejected;
closed-session tombstones stop delayed registration; configurable offline and
retention intervals preserve lastSeen. Capacity refusal occurs before mutation.
Six actual Redis tests pass (presence-redis-tests.log); initial naming-shadow
failure retained separately. Random synthetic keys in isolated DB14 cleaned up.
Only temporary test module copied into fixture; live presence not enabled.
Authenticated server identity derivation, permission revocation, heartbeat and
broadcast integration, Graph UI and browser acceptance remain outstanding.
Presence cannot be used as a write-admission or anti-overwrite mechanism.

## P4 socket-bound presence coordinator

Previous turn: progress (6 Redis presence tests).
Added real-time GitPresenceSession.js: browser intent accepts only viewedCommit;
server resolver supplies authenticated editing identity. Per-socket sequence
rejects late lookup results; subscribe precedes snapshot; close removes presence
and subscription, including disconnect during async subscribe. Permission denial
closes the coordinator; transient resolver failure leaves position unchanged.
Six focused coordinator tests pass (presence-session-tests.log).
Not wired to live WebsocketController or a web Git resolver yet; tests inject
those adapters. Actual revocation event handling and browser Graph display remain.
No deployment or manuscript changes this turn. Full P1-P6 remains active.

## P4 authoritative Git position reader

Previous turn: progress (socket coordinator tests).
Added readGitPresencePosition and runtime presencePosition. Runtime requires
isolated fenced workspace and named parent membership, rechecking membership
before/after the read; display name excludes email. Reader holds repository lock,
validates branch binding and viewed commit, detects live document dirtiness by
comparison without exporting/staging/checkout, and rejects epoch changes.
Three tests with real temporary Git repositories passed (presence-position-tests.log).
Runtime syntax/diff checks pass. Private service route, realtime caller/broadcast,
revocation event hook and Graph rendering remain unfinished. No deployment.

## P4 private API and websocket wiring

Previous turn: progress (Git position resolver).
Added strict private presence-position HTTP handler behind existing private API
authentication, real-time authenticated service caller, socket event and dedicated
git-presence:<logicalProjectId> subscription/broadcast. Socket identity is bound
server-side; resolved epoch must match that socket. Disconnect closes presence.
Three handler tests and135 existing WebsocketController regressions pass; syntax
checks pass. Regression suite does not cover the new dynamic runtime end-to-end.
Heartbeat/initial auto-registration, explicit revocation broadcast hook, Graph
client snapshot ordering/UI and multi-user presence browser tests remain pending.
No live deployment this turn. Full P1-P6 goal remains incomplete.

## P4 client subscription and heartbeat

Previous turn: progress (private API and socket wiring).
Added editor-lifetime Git presence binding for fenced workspaces, independent of
Graph visibility.20-second heartbeat is configurable in the binder. Requests
coalesce with viewing-intent updates;12-second timeout clears stale positions.
Disconnect ignores late acknowledgements and broadcasts. Snapshot generation
changes require an authoritative response; older same-generation revisions
cannot restore stale positions. EditorGraph selection publishes viewedCommit
separately and clears it on close. Added shared React snapshot state.
Three client protocol tests pass after disconnect-broadcast protection update.
No production build or live deployment yet; Graph position rendering, explicit
permission revocation hook and three-user multi-branch acceptance remain pending.
Full P1-P6 objective remains active.

## P4 first live Graph presence acceptance

Production build passed with2 warnings (49880ms);75 fixture files hash verified.
Six frontend and12 backend tests pass. Deployed only18082. Three real dual-user
browser checks passed: both users see two editing positions without remote push;
closing B changes A's view to offline last-seen. Evidence presence-browser-acceptance.json/log.
Graph renders per-session edit/history markers and participant list; clicking
position locates/focuses the commit, fetching missing filtered history without checkout.
Cross-branch/multi-tab, history viewing, revocation and reset/ordering full browser
acceptance remain pending. No production/manuscript/remote changes.

## Cross-branch presence acceptance: five checks passed

The first failure was a test locator issue: at a sidebar width below240px, CSS hides direct Changes toolbar icons, and View Git Graph is available through More changes actions. The acceptance now uses the visible overflow menu when necessary. Original failure JSON/log retained as presence-branches-toolbar-selector-failure.*.

Real browser acceptance passed three sessions across two branches, two tabs of one account, same-branch text propagation with root isolation, separate history-view intent without checkout, and independent tab close. Frozen result: presence-branches-five-checks.json/log, zero page errors. Runtime branch activation matches the deployed18082 SHA256 in presence-branch-activation-overlay.json. This does not prove permission revocation or automatic reconnection; network-loss/reload recovery test is being run separately.

### Network-loss test attempt: duplicate list selector
The first90-second offline assertion failed. Redis inspection confirmed B offline and only A online; both sidebar GraphHistory and full EditorGraph render participant lists, so a document-wide selector counted A twice. Failure JSON/log retained in presence-branches-duplicate-lists-failure.*. Assertions now scope to the first participant list; retry remains required before claiming acceptance.

### Cross-branch presence: seven-check run passed

Final run exited0 with seven passed checks and zero page errors. Disconnected B expired while A stayed online; after network restoration and explicit page reload, B retained its branch and appended text, and exactly two sessions were online. The browser assertion scopes to one list to avoid counting sidebar and full Graph twice. Evidence: presence-branches-browser-acceptance.json/log. Only synthetic18082 used. Unverified: transparent reconnect without reload, immediate permission revocation presence cleanup, old-workspace migration. No commit or push performed.

## P4 revocation browser acceptance
Three checks passed: root/child positions visible, removal through real owner API disconnects branch websocket and broadcasts offline within10s, and revoked workspace/Git reads return403. Browser errors empty. Initial attempt tested socket close immediately after offline broadcast and raced the browser event; failed artifacts retained as presence-revocation-close-event-failure.*. Retry waits up to10s for the close event. Synthetic member restored in finally with narrowly guarded addToSet. Evidence presence-revocation-browser-acceptance.json/log.

## P4 automatic reconnect browser acceptance

Seven checks passed with zero page errors, exit0. The test disables the collaborator browser network until the owner sees one online session, restores network, and waits for two online sessions without calling reload, navigating, or pressing a reconnect control. The original branch and appended text remain visible. Evidence presence-auto-reconnect-browser-acceptance.json/log. This proves recovery without test-driven refresh; it does not measure all reconnect durations or cover unsent offline edits/epoch changes. No product code changed in this acceptance turn.

## Offline buffer versus prepared version transition

Current preparation path (not legacy direct epoch advance) passed five browser checks in offline-prepared-epoch-browser-acceptance.json/log. Waited for disconnected A and closed probe to leave session registry, then prepared/drained B and advanced21→22. Reconnected A was fenced; its offline marker appeared in Show Local File Contents; a fresh independent editor contained B marker and excluded A offline marker. Explicit Reload editor admitted A to22; a further A edit propagated to another page.

Diagnostics remain visible: two generic JSON fetch page errors; writing-assist/check500 and models/speech503 responses, counts in offline-prepared-epoch-diagnostics.json. Generic errors not causally attributed, so no zero-error claim. Tested only synthetic18082; root now22 with synthetic test edits. No original project/remote changes or commit/push. Multi-file recovery, document replacement/rename ABA and durable recovery beyond page lifetime remain outside this acceptance.

## Durable local recovery implementation

Added immutable per-snapshot browser storage keys scoped by account and storage workspace, epoch/timestamp/content metadata, explicit quota/readback errors, no silent pruning, and per-copy removal. Editor manager saves before teardown and on epoch invalidation. Out-of-sync dialog reports save status and offers text download. Persistent Local recovery copies UI retrieves/downloads snapshots after reload without applying them.

Fourteen storage/component/epoch tests pass; production webpack completed with2warnings in47147ms.74files/2185211bytes hash-verified in18082 only. Storage failure tests initially attempted unsupported global Storage/proxy stubbing; retained mock-failure log and replaced with injected failure adapters. Browser first attempt reached downloaded copy then hit ambiguous Close selector; artifact preserved, retry scoped to dialog. Not yet complete until retry result inspected. No commit/push. Single-file saved content currently includes workspace+epoch but lacks explicit docId metadata; multi-file/rename reconciliation remains to be completed.

Browser retry passed5checks with errors[]: both users retrieved stored text after real reload and downloaded JSON containing expected marker and original epoch. Evidence local-recovery-browser-acceptance.json/log. Root fixture epoch advanced23→24 in successful retry; original instance untouched.

## Recovery document identity implementation

RecoveryDocument stores original docId, display name, acknowledged OT version, workspace epoch and captured text. OpenDocuments snapshots include all loaded documents. Error handling also explicitly re-inserts the failed document by ID and preserved text even if cleanup removed it from OpenDocuments. LocalRecovery keeps optional documents for backward-compatible old copies; duplicate IDs or malformed document metadata reject persistence/read. UI selects per-file content by docId, not name; downloads include structured metadata. No automatic writeback.

Sixteen storage/UI/epoch tests pass, including distinct same-name documents and preservation of captured version/epoch. Production build and live single-document identity/download acceptance pending. Multi-file deletion/recreation browser scenarios still required.

Recovery identity live acceptance passed5checks with errors[], including both accounts selecting recovered docId and matching downloaded original epoch/version/text after actual reload. Build2warnings/50854ms,68fixture files1174094bytes hash verified. Artifacts recovery-identity-browser-acceptance.json/log, recovery-identity-tests.log, recovery-identity-ui-build.log. This is single-file live evidence plus multi-file unit/component coverage; it does not yet prove actual rename/delete-recreate recovery. No commit/push; original instances untouched.

## Concurrent error capture fix

Found a React batching loss window: setDocError retains only the latest document error, while DocumentContainer removes earlier failures from OpenDocuments. Moved recovery persistence into each synchronous document error callback, before cleanup/state replacement. The modal effect consumes that event's save notice rather than saving again. Generic document errors now capture text before clearing pending operations, like stale-epoch errors.

Seventeen focused recovery/epoch tests pass, including generic and stale errors whose simulated cleanup erases the buffer. Existing multi-document snapshot and same-name-ID tests pass. Build pending; live multi-file rename/recreate and simultaneous-error acceptance remain unverified.

Concurrent-error capture build passed with2warnings in44276ms;68files1174074bytes hash verified in18082. Live offline-error replay now checks persisted original text/epoch after reload. Generated acceptance script initially had a quoting syntax error, corrected before execution. Original offline-prepared screenshots/text preserved under original-* before this run; after completion restore originals and name new evidence recovery-error-reconnect.*.

Live recovery-error acceptance passed6checks, complete=true, pageErrors=2. Preserved stale offline text and per-document epoch found in localStorage after Reload editor; fresh server content still excludes stale text and editing resumed. Original prior screenshots restored, new evidence copied to recovery-error-reconnect.*. Generic JSON errors, if present, remain recorded; no whole-page clean claim. Multi-file concurrent errors and actual rename/recreate still require browser acceptance.

## Multi-file recovery browser acceptance

First attempt timed out with WORKSPACE_PREPARE_EXPIRED before mutation. Screenshot showed empty new editor. Its early "two tabs edit" check only executed keyboard input and did not verify persisted content, so that check is insufficient and must not be used as acceptance. Failed JSON/log retained as recovery-multifile-prepare-expiry-failure.*. Retry waits for editable empty new document and actual doc:saved event carrying the created docId.

With these explicit save assertions, four checks passed: same-account tabs retain two snapshots across actual reload, rename original and create a new document under its old name, unchanged backups keep old IDs/content, per-document selector excludes the new ID. Original document is preserved, not deleted. A final rerun replaces500ms delay for the new file with an explicit empty editable-content condition. This covers rename+same-name recreation, not actual deletion or simultaneous error events in one tab.

Final rerun passed4checks, errors[], complete=true. Both original files had verified save acknowledgements; recreated file became explicitly empty/editable; backups remained byte-equivalent and still reference original IDs. Evidence recovery-multifile-browser-acceptance.json/log. No product code changes this turn; added acceptance and records only. No remote/real manuscript changes, no commit/push.

## Remote discovery verified checkpoint
Six real Git integration checks pass in remote-discovery-tests.log (0 failures): dirty files/index/HEAD unchanged despite hostile configured refmap; upstream rewrite/deletion retained; pre-fetch revocation and target mismatch rejected; operation ID bound to initiating account; post-fetch revocation retains resumable before snapshot; unavailable remote fails then retries the same durable task after restoration. Initial fixture-construction failures retained in remote-discovery-initial-fixture-failure.log. Syntax checks and git diff --check pass.
Delete/recreate recovery browser evidence is now recorded: six checks pass, errors[], in recovery-recreate-browser-acceptance.json; replacement is empty with different docId and old recovery bytes survive reload.
Remote discovery is code plus isolated real-Git evidence, not deployed/browser/runtime-route acceptance. Scheduler, task list/UI, project-wide notifications, webhook/polling, auto commit/pull/push and remaining P1–P6 gates remain outstanding. No manuscript changes, commit, push, or original-instance deployment in this continuation. Next: expose authorized task status and update notifications, then integrate project-level scheduling with ownership and cancellation checks.

## Shared remote-discovery status checkpoint
Added RemoteDiscoveryStatus.mjs public allowlist projection and remoteDiscoveryList command. Runtime rechecks named membership before lock, inside lock, and after task read; shared tasks use logical-project storage. Discovery responses now omit remote URL, credential owner and internal before/after snapshots. Tests exercise nested-field filtering, ordering, revocation at all three checkpoints and strict command schema, alongside six existing real-Git cases:10 pass,0 fail in remote-discovery-status-tests.log. NativeGitRuntime syntax and git diff --check pass.
This is helper/schema and real-Git evidence, not runtime-route/browser notification acceptance. Existing repository invalidation already covers discoverRemote; UI subscription, shared task display and scheduling still require implementation. No deployment, commit/push, or manuscript changes. Full P1–P6 goal remains active.

## Remote discovery UI checkpoint
Added remote-discovery-status.tsx under Source Control repositories for collaboration-enabled projects; it subscribes before the initial query, refreshes on repository invalidation/focus/online/visibility and15s visible-page status polling, and ignores old responses after newer requests or unmount. Queries only status: no periodic fetch or editor writes. Socket reconnect now emits the same local repository invalidation. Failures clear displayed task data, and malformed responses produce a panel error.
Validation:4 component checks pass in remote-discovery-ui-tests.log; combined initial3 checks plus46 existing Source Control cases passed (49 total) in remote-discovery-panel-regression.log. The initial regression failed because an old generic mock returned merge-task objects for the new query; corrected the mock to dispatch by command and retained remote-discovery-panel-mock-failure.log. jsdom CodeMirror geometry diagnostics remain in regression log; do not equate it to a clean browser run. Final production build succeeded with2 warnings in54460ms (remote-discovery-ui-build.log).
Changed production files: source-control/remote-discovery-status.tsx, source-control/source-control-panel.tsx, ide-react/context/ide-react-context.tsx. Tests: remote-discovery-status.test.tsx, source-control-panel.test.tsx. No fixture/original deployment or real manuscript edits this turn; next step is hash-verified fixture overlay and multi-user notification/status acceptance, then automatic discovery scheduler. Full P1–P6 objective remains incomplete.

## HTTPS remote multi-user acceptance
Deployed only to overleaf-git-collaboration-web18082:72files/2533198bytes hash verified (remote-discovery-fixture-deploy.log). Build guard now targets remote-discovery-ui-build.log.
Guarded remote-discovery-fixture.mjs creates an independent external clone and bare remote under /tmp/discovery-status-20261111-a, adds an external-only file and pushes there. Loopback HTTPS uses a one-day certificate with endpoint-scoped sslCAInfo; TLS verification remains enabled. No GitHub/manuscript repository touched. Server process was stopped after acceptance; synthetic remote files, task records and endpoint-specific trust configuration remain for repeatability. Future fetch from those acceptance remotes requires restarting the fixture server.
remote-discovery-browser-acceptance.json/log:5checks pass,errors[]. remote-discovery-cross-branch-browser-acceptance.json/log:5checks pass,errors[]; B workspace4632e2ba3e73977fd23bdcc6 on presence-revocation-mwbx848d, A root/main. Each run verifies editor403 on discovery; owner fetches actual HTTPS remote commit; both pages show same commit; B receives socket-driven invalidation; authorized task snapshots agree without URL/owner leaks; editor content remains unchanged; reload reconstructs durable status. This validates server discovery/status/notification across two workspaces, not scheduled automation or merging incoming content.
Full P1–P6 objective remains incomplete. Next implement project-level discovery scheduling with durable policy, ownership recheck and single-flight execution, then external-change-to-reviewed-merge workflow. No commit/push or deployment to original instance.

## Durable discovery scheduler implementation checkpoint
Added RemoteDiscoverySchedule.mjs: durable CAS policy revision, pinned remote URL and actor, persisted operationId before fetch, due time, exponential retry capped1h, explicit pause on400/403/409, and disable under the shared repository lock. runDueDiscovery retains operationId across failures/restarts and does not apply editor files. NativeGitRuntime exposes owner-only configuration/status commands and a scheduled execution entry; current owner, deleted state and access policy are checked before scheduled fetch and during discovery authorization.
Added RemoteDiscoveryWorker.mjs, started once per router process only with nativeGit.enabled and nativeGit.discoveryScheduler. Scans configured logical-project directories; skips overlapping scans; shared project lock serializes due execution across processes. Publishes existing invalidation after task progress. New env setting OVERLEAF_NATIVE_GIT_DISCOVERY_SCHEDULER defaults off. No new worker enabled or deployed this turn.
Validation:16 tests pass (6 schedule cases +4 shared-status cases +6 real-Git discovery cases) in discovery-schedule-tests.log;2 worker tests pass in discovery-worker-tests.log. Covers due-time competing callers, durable running retry identity, backoff, owner/URL changes, disable/CAS, post-fetch revocation, scan scope and stop/nonoverlap. Runtime/router/module syntax and diff whitespace checks pass. Tests do not yet prove real multi-process lock behavior or background runtime integration.
Next: owner settings UI and isolated scheduled HTTPS/multi-user acceptance without an open browser triggering execution; inspect lifecycle/archive policy before broader rollout. Automatic commit/pull/push and all remaining P1–P6 requirements remain outstanding. No manuscript changes, commit/push or original-instance deployment.

## Owner schedule UI and closed-browser acceptance
Added discovery-schedule.tsx dialog, launched from Remote update checks: owner-only policy load, remote/interval inputs, CAS revision save, explicit unavailable-server state and ability to disable existing policies even when deployment scheduling is off. Runtime rejects enabling when scheduler deployment is off. UI tests7passed; scheduler/worker regression8passed. Final production build2warnings/52130ms.72fixture overlay files/1210058bytes hash verified.
Fixture-only settings now enable the server scheduler. Real browser configured one-minute checks, awaited first scheduled completion, closed every test browser, then an independent external clone pushed3e5b957 to the loopback HTTPS remote. Without browser participation the service fetched the new tip; reopening showed it and preserved editor content. Policy disabled afterward via revision-guarded API. discovery-schedule-browser-acceptance.json/log records4passing checks,errors[],complete:true. Initial attempt hit login readiness during restart and was retained as discovery-schedule-startup-failure.json/log; HTTP200 plus email field confirmed before retry. Temporary HTTPS process stopped after disabled-policy verification.
Production changes: discovery-schedule.tsx, remote-discovery-status.tsx, NativeGitRuntime.mjs. Fixture-only changes: fixture-settings.cjs, deployment build guard, browser acceptance script/logs. Formal instance, real manuscripts and external Git repositories unchanged. No commit/push.
Remaining: real competing worker/crash acceptance, lifecycle/archive decisions, automatic commit/pull/push, remote-update-to-reviewed-merge handoff, shared conflict notifications and all remaining P1–P6 gates. Full goal remains active.

## Remote update to reviewed merge handoff
Added per-tip review action in RemoteDiscoveryStatus, wired through SourceControlView to mergeDraftPrepare with the displayed expectedSourceOid. Deleted refs have no merge action. Preparation validates the source before workspace export and again before constructing the draft; retries bind expectedSourceOid to the original request. Existing application validation continues to supersede drafts when the tracked source advances/deletes, preserving the previous draft. No direct merge/apply bypass added.
Inspection also found remoteDiscoveryList/discoverySchedule periodic queries went through withSavedEditor and toggled local write-busy state. Added these queries plus fetch-only discovery/configuration to the no-editor-save command path; merge draft preparation still waits for local edits to save.
Verification:25 merge/draft/application/recovery tests pass in remote-review-tests.log; final extra source check covered by2 targeted pin regressions in remote-review-pin-regression.log.5UI tests pass in remote-review-ui-tests.log, including exact ref/OID handoff and absent review button for deleted tip. Production build2warnings/57929ms in remote-review-ui-build.log. Syntax/diff checks pass.
This turn changes GitCommands.mjs, MergeDraftService.mjs, source-control-panel.tsx, remote-discovery-status.tsx and their focused tests; no fixture deployment, real manuscript modification or commit/push. Browser review handoff and pending-task conflict notifications remain next; full P1–P6 goal incomplete.

## Live remote review stale-application acceptance
Deployed reviewed build to18082 only;72files/1211154bytes hash verified. Added mergeDraftApply/mergeDraftRecover to repository invalidation commands so completion/recovery/failure can refresh other project rooms.
remote-review-browser-acceptance.json/log:4checks pass,errors[]. Two accounts join newly-created synthetic branch remote-review-mwbzcc53/workspace c68d97c105c3c17b0996bff1 from preserved888b0cc base. Actual review button creates isolated draft8892f6ff-d74c-4d1c-b82a-daee101ee1ab pinned to displayed remote tip; second user sees the same task. External HTTPS remote advances; discovery refreshes tracking ref; actual claim/apply UI refuses stale preview and retains superseded draft. Both editors retain original text; both report clean working trees and current branch ref still points to888b0cc.
Initial run's final assertion incorrectly used graph[0] from all-ref history as current HEAD, failing after the first3checks; retained remote-review-head-assertion-failure.json/log. Corrected to status.branch plus refs/heads/<branch> commit; full rerun passed. Synthetic branches/drafts retained, no original documents or real external repos touched. Temporary HTTPS service stopped.
Next: proactive shared conflict/task notices without requiring opening task dialog, and successful remote-reviewed application/multi-user concurrency coverage. Full P1–P6 goal remains active; no commit/push or original-instance deployment.

## Workspace-wide conflict notification acceptance
WorkspaceTaskNotice now mounts in EditorManagerProvider for fenced workspaces, independent of selected sidebar. It queries only current-workspace mergeDraftList, subscribes before initial read, refreshes on repository invalidation/reconnect/focus/visible-page polling, discards superseded responses, clears details on failed authorization and opens the existing shared task resolver. Completed/cancelled/superseded tasks leave the active-attention list. Prepare capability is typed from existing gitWorkspacePrepareEnabled metadata. Notice uses theme variables and does not initiate merge or editor writes.
Four component checks pass; production build2warnings/54747ms. Deployed80files/2398748bytes to18082 with hashes verified. Actual two-user browser run creates distinct new source/target branches and commits different synthetic main.tex contents; both users then join target with Source Control unmounted. Conflict preparation triggers visible notice on both; B opens resolver from notice, claims/cancels draft; both notices disappear and both editor texts remain unchanged. workspace-task-notice-browser-acceptance.json/log:3checks pass,errors[], target workspace c5e887e25176155eb95cab66.
Changed source: workspace-task-notice.tsx, editor-manager-context.tsx, project-metadata.tsx and source-control.css. Tests and scoped fixture deployment/evidence under docs/git-collaboration. No real manuscript or remote modifications; no commit/push or formal-instance deployment.
Remaining: successful remote-reviewed application across active editors, explicit permission changes while request waits, additional lifecycle/automation and P1–P6 gates. Goal remains active.

## Successful reviewed remote application across active writers
remote-apply-browser-acceptance.json/log:6checks pass,errors[]. A/B join new synthetic branch remote-apply-mwbzmqfn/workspace5bc8aa8336f87b8fca89e6f6 from preserved base. Actual remote-tip review button prepares pinned draft; both users inspect task; A claims/applies through UI. Both old editors require explicit Reload editor, then share the same new branch commit with clean status and resolved task. Both file trees show external-update.txt with exact expected external text. B edits the newly-added document and A receives it in real time. A third tab remains on root: unchanged text, unchanged current-branch commit, no reload prompt. This is explicit reload/resume behavior, not seamless editor replacement.
First run passed preparation/application but then toggled an already-open file tree closed. Screenshot confirmed hidden sidebar; retained remote-apply-sidebar-toggle-failure.json/log and corrected to click File tree only when target file is not visible. Full rerun passed. No source changes this turn: acceptance script and progress/evidence only. Synthetic merged branches and subsequent collaboration edit retained; no actual manuscript changes, commit/push to implementation repository, or deployment.
Remaining priorities: request-time authorization during waits, real competing scheduler/crash acceptance, safe Shell/AI writeback and automatic commit/pull/push, complete project lifecycle and remaining P1–P6 gates. Goal remains active.

## Authorization across waits and transaction checkpoints
Added AuthorizedOperationLock.mjs and wrapped NativeGitRuntime repository/recovery locks: recheck current write permission and named membership after acquiring the shared project lock. Shared merge list/get/conflict reads recheck authorization before returning data. Document transaction guards now verify lease, current authorization, then lease again; existing partial-write journal/recovery handling remains in place if permission disappears mid-transaction.
Validation:31tests pass in authorization-wait-tests.log (6 new queue/read cases plus25 merge/recovery regressions). Final checkpoint helper tests7pass in authorization-checkpoint-tests.log, including lease expiry during authorization lookup. Runtime/module syntax and diff checks pass.
Deployed only18082 using prior validated frontend artifact. authorization-remote-apply-browser-acceptance.json/log:6real-browser checks pass,errors[], confirming normal two-user remote review/application, new-file editing and independent root branch continue to work with authorization rechecks. This does not yet prove live HTTP revocation precisely during lock wait/partial document transfer; only controlled tests cover those timings so far.
Changed production: AuthorizedOperationLock.mjs, NativeGitRuntime.mjs, MergeDraftService.mjs. Added tests and isolated acceptance evidence; no real manuscript changes, implementation commit/push or original-instance deployment. Full P1–P6 goal remains active; next live queued-revocation and competing-worker/crash tests, then safe Shell/AI writeback and remaining automation/lifecycle.

## Live HTTP queued-revocation acceptance
Guarded queued-revocation-lock-fixture.mjs takes the real nativeGitProject Redis lock on the synthetic root, exposes only locked/contender/released signals and holds no production data. Two authenticated browser contexts stay off editor pages; B begins createBranch while lock is held. Redis contention is observed and HTTP request remains unresolved; A removes B through actual project-membership API; lock releases; B receives403 and no branch is created. Helper exits0 and member restoration is separately read back in finally.
queued-revocation-browser-acceptance.json/log:3checks pass,errors[],responseStatus403,membershipRestored:true. Initial preflight used unsupported branches command and got400 before contention; retained queued-revocation-command-schema-failure.json/log and corrected to existing GET status endpoint. This verifies real lock-wait revocation, not revocation midway through a multi-file application.
Only test helpers, acceptance scripts/evidence and progress records changed this turn; current production code from previous turn was exercised. No manuscript changes, implementation commit/push or new deployment. Full P1–P6 goal remains active; competing scheduler/crash tests and safe Shell/AI writeback remain major next items.

## W16 AI identity checkpoint (not full transactional writeback)
Current source confirms legacy terminalOpen uses repo.directory and remains gated on isolated branches. AgentService previously captured document version/content only. Added server-owned identity (logical project, workspace, branch, epoch), model persistence, result identity and snapshot/pre-dispatch checks with current authorization. Unfenced legacy projects remain compatible; fenced projects refuse old task records lacking identity.
Evidence: ai-workspace-identity-tests.log,70pass; initial-failure log preserves catch-classification failures and standalone skill-plugins Mongo configuration failure. Focused final suites exclude the uninitialized plugin suite. Changed production files: WritingAssistWorkspaceIdentity.mjs (new), WritingAssistAgentController.mjs, WritingAssistAgentService.mjs, models/WritingAssistTask.mjs. Tests: service.test.mjs and writing-assist-workspace-identity.test.mjs (new). No deployment or external writes.
Remaining: final identity check and mutation are not atomic. Must put acceptance inside prepared write transaction with durable outcome and lease propagation before W16 or automatic AI writeback can pass; specialized task producers need matching identity capture, and terminal needs isolated draft storage. No new backend safety gate was opened.

## Prepared AI write acceptance
Production: new WritingAssistWriteTransaction.mjs; AgentService invokes it around final proposal validation/mutation, controller uses logical project lock and existing prepared write lease, reviewed deletion avoids reacquiring the held structure lock. Settlement follows successful transaction release; post-action lease failure is uncertain. Existing expectedVersion CAS and token propagation are reused.
Evidence: ai-prepared-write-tests.log (80pass); ai-prepared-write-adapter-regression.log (27pass,18 Redis cases skipped); ai-prepared-write-fixture-deploy.log (77files,577671bytes,hash verified); ai-prepared-write-browser-acceptance.json/log (3pass,errors[]). New branch ai-write-mwc0a4w3,workspace84e60cc382fa5a196d2858e5. A accepts guarded seeded proposal via real endpoint and both editors receive it without reload; B edits after subsequent snapshot and acceptance gets409 without overwriting; accepted proposal replay gets409. This validates synthetic suggestion writeback, not model generation.
Initial browser failure retained under ai-prepared-write-viewport-failure.*; screenshot showed document top while expected appended text was virtualized below. Corrected scrolling and reran on another new branch. Existing background writing checks log missing API key in fixture; no online-model success claim. No real project/remote changes, no commit/push, no formal deployment. Remaining lifecycle/recovery, specialized task producers and Shell integration unchanged.

## Specialized AI task identity propagation
Direct proposal producers found in CitationService, ReferenceService complete mode, ClaimReview and ReferenceApply. All now persist original server-owned workspace identity; derived applications validate original identity rather than recapturing current identity. Reference metadata/claims reports pass expectedWorkspaceIdentity into AgentService, checked before task persistence and again around snapshot submission. Controller wiring covers literature, reference import and Zotero import.
Evidence: ai-specialized-identity-tests.log103pass;9production modules syntax checked; diff check passes. Provider/permission/snapshot/epoch races are controlled local tests, no network providers or online model execution. Not deployed this turn. Existing18082 browser results cover generic prepared acceptance only, not newly changed specialized producers. All previous failures/evidence and unrelated worktree files preserved. Remaining: real bibliography/create/delete acceptance, uncertain-write recovery, Shell isolation, automation and lifecycle phases.

## Specialized multi-user reference acceptance
Source correction from real test: generic workspace identity Error was not recognized by reference controller and became500. Shared WritingAssistErrors.AgentError now used by guard and reexported by AgentService, preserving expected HTTP404/409. Initial classification failure retained.
114unit/service checks passed; deployed85files/630572bytes to18082. Real reference import and task acceptance create bibliography for both users. Guarded synthetic source review exercises real field application; both see year update, independent comment survives partial application, newer user year value refuses old correction, stale epoch refuses without changing pages. Final ai-reference-browser-acceptance.json/log5pass,errors[],workspace 05891ea204f119b617ed3053. No online source or model verification claim; review evidence was seeded and marked synthetic. Test task/branch retained, original manuscript/remote untouched, no commit/push. Next: ambiguous write recovery and Shell draft integration, plus remaining full-scope tests.

## Interrupted AI task retention
Ordinary edit/create claims previously left expiresAt set. Added applicationRetention and atomic claim/unset, with cross-kind release predicate blocking TTL while ANY proposal is applying/uncertain. Shared deletion lifecycle remains compatible. Migration disables known TTL indexes before record rewrites, preserves old uncertain tasks, rejects unexpected policies, and is resumable after failure.
Initial real Mongo fixture check:6checks passed, readiness failed because actual task collection lacked expiresAt index (only_id existed). Failure retained; actual fixture migration ran with web/web-api stopped and verifieddown, services resumed after deployment. No user-instance migration. Final Mongo7checks pass including12races;86focused regression checks pass; normal live two-user AI acceptance3checks pass witherrors[]. See ai-application-retention-mongo.json/log,ai-application-retention-migration.log,ai-retention-regression.log,ai-retention-browser-acceptance.json/log. Temporary isolated acceptance collection retained.
Changed production: DocumentDeletionTaskRetention.mjs,AgentController,WritingAssistTask schema; test driver and guarded fixture helpers/deploy list/evidence updated. No original manuscript/remote changes, no commit/push. Ambiguous records now survive TTL; explicit inspection/recovery UI and verified durable mutation receipts still needed. Do not claim hard-crash recovery or safe automatic retry complete.

## Interrupted application inspection UI/API
Delivered owner-only read-only snapshot inspection for non-delete applying/uncertain proposals. Consistency checks compare document observations and epochs, recheck authorization; task's original workspace and current workspace remain distinguishable. Reports byte matches without confirming previous execution, never enables retry or changes status. UI opens modal with diffs and downloads JSON; cleared after failed refresh.
Evidence:66backend/service checks,7frontend checks,production webpack2warnings/48511ms,89files/1324647bytes deployed18082. Real-browser4checks pass/errors[] including download contents, second-user404, unchanged editor text and uncertainstatus. Fixture explicitly seeds uncertain proposal; no hard-crash or receipt inference. Failed path/mock/staging attempts retained separately and excluded.
Changed: WritingAssistApplicationInspection.mjs, AgentService/Controller/Router, application-inspection.tsx, agent-task-result.tsx, focused tests and guarded fixture scripts. No real manuscript/remote/commit/push. Next unresolved receipt/disposition and Shell integration remain required before W16/fullgoal completion.

## AI server acknowledgement journal
DocumentManager.setDoc first applies OT then awaits document flush; Redis mutation alone is insufficient evidence of completed server call/history. Added per-proposal server acknowledgement only after edit/create returns, before final task settlement. Binding includes stable operation/task/user/project/workspace IDs, doc/path/version and before/after hashes. Mongo CAS prevents acknowledgement of a changed proposal; inspection ignores mismatches. This is server-call acknowledgement, not blanket project-history durability.
71backend/service tests and8UItests passed; build2warnings/47622ms; deployed90files/1327758bytes18082. Guarded helper uses actual service/write/DB with injected final-settlement failure. Real dual-user acceptance5checks pass/errors[]: both receive edit, journal+uncertain retention survive, inspection/download expose valid acknowledgement, second user cannot read private task, read-only actions leave contents/status unchanged. See ai-acknowledgement-browser-acceptance.json/log. This is deterministic injected error, not hard process kill. No real manuscript/remote changes, no implementation commit/push.
Next required: explicit recovery disposition, kill/restart evidence, no-ack ambiguity and remaining Shell/automation/lifecycle requirements.

### Acknowledged recovery implementation and focused verification
Recovery service/controller/route now support owner-only task-state recovery using an exact validated server acknowledgement, serialized on the logical-project lock. Fresh reads after lock acquisition and CAS refuse changed proposals; repeated accepted recovery retries retention cleanup without document mutation. Frontend confirmation is explicit and only offered with an acknowledgement. It clears evidence on failed recovery and aborts/ignores late responses on close, unmount or task identity change. Proposal card keys include project/task/proposal identity to prevent local accepted state leaking between tasks.
Focused evidence: ai-recovery-tests.log84pass,0fail; ai-recovery-ui-tests.log8pass. New recovery service tests cover both interrupted states, missing/tampered receipt, deletion exclusion, noncompleted task, changed epoch binding, owner scoping, permission revocation while queued, stale receipt after lock wait, CAS refusal and idempotency. UI tests cover explicit-only POST, confirmed status, failure clearing and late response after close. node --check and git diff --check pass.
Failure retained: ai-recovery-fixture-alias-failure.log initially12pass/1fail because the in-memory receipt shared the workspace identity object with the task; corrected the test fixture to serialize/clone the receipt as Mongo persistence does. Initial frontend command ran from repository root and exited127 (wrong relative binary path); rerun from services/web passed. No production failure inferred from these harness errors.
NOT YET VERIFIED: actual Mongo recovery CAS/retention cleanup, two-writer recovery preserving newer edits, new production build/deployment, task parent-view refresh and process-kill boundaries. Recovery changes remain local/uncommitted, not deployed to18082 or the user's instance. Full P1–P6 objective remains incomplete; next checkpoint is real Mongo and two-writer acknowledged recovery acceptance. No manuscript or remote repository mutations this turn.

### Acknowledged recovery: real Mongo and two-writer acceptance
Built current frontend (ai-recovery-ui-build.log, webpack2warnings/46376ms), then deployed only18082 with91files/1332643bytes hash-verified (ai-recovery-fixture-deploy.log). Added guarded read-only ai-recovery-record-fixture.mjs and ai-recovery-browser-acceptance.mjs. Actual mutation uses existing injected-settlement-failure helper; after its acknowledged write, B appends newer text through the live editor before A inspects/confirms recovery.
Final ai-recovery-browser-acceptance.json/log:8pass,errors[],workspace 83c92c7ef7b3b81ce25b5563. Actual UI confirmation traverses owner-authorized HTTP/service/logical-project lock/Mongo CAS, updates accepted status, and repeat POST succeeds idempotently. Collaborator B receives404 for both private inspection and recovery. Mongo inspection verifies preserved acknowledgement, recorded recovery disposition, removed applicationRetention and renewed expiry. Full document SHA256 AND document version remain identical to the inspection taken after B's newer edit, proving recovery/repeat did not rewrite the document. Both browser editors retain original acknowledged edit and B's newer edit after reload. Initial8check run passed; final run adds full-content/version assertions.
This verifies the acknowledged settlement-failure recovery path, NOT no-ack ambiguity, physical process kill, full history durability, parent specialized workflow reconciliation or Shell draft support. Remaining P1–P6 requirements continue unchanged. No original instance, real manuscript or external remote touched; no commit/push. Next: resolve no-ack crash outcomes and parent workflow state, then isolated Shell draft transactions and remaining lifecycle/automation gates.

### Specialized continuation metadata and parent UI propagation
Found that derived reference-field and claim-correction tasks save continuation review metadata only after decide returns. If the document was acknowledged but the response/settlement failed, recovery previously lacked the next review state. Producers now precompute and persist private applicationOutcome before dispatch, bound to proposalId and SHA256(after). Original review remains unchanged and derived task does not expose premature accepted review. New ApplicationOutcome module restricts projected fields to referenceReview+summary or claimInput+claimReview+summary; binding/shape mismatch refuses recovery. Recovery Mongo CAS compares saved outcome and atomically updates accepted status plus projected workflow fields. Accepted replay can finish previously missing workflow metadata; stable applicationRecovery is retained.
ApplicationInspection now returns the recovered Task to its parent. AgentTaskResult/ProposalCard propagate it; References updates matching current/batch tasks and AgentPanel updates only matching task id. ReferenceTaskView direct ProposalCards now receive project/task identity (previously inspection was unavailable there).
Evidence: ai-workflow-recovery-tests.log92pass; ai-workflow-recovery-ui-tests.log9pass; syntax checks and git diff --check pass. Tests prove producer metadata exists before interrupted dispatch, original evidence remains pending, invalid outcome bindings cannot settle, and recovered specialized data reaches parent callback. Initial frontend command used wrong cwd and exited127; corrected services/web cwd passed (no production failure).
New changes NOT built/deployed or real-specialized-recovery tested yet. Current18082 still runs prior generic acknowledged recovery. Outstanding: actual specialized HTTP failure-to-recovery/remaining-field continuation, accepted-normal-settlement bookkeeping crash path, all parent task consumers, no-ack outcomes and full P1–P6 requirements. No manuscript/remote writes, commit or push in this turn.

### Specialized reference recovery live acceptance and atomic normal settlement
Normal accepted settlement now writes applicationOutcome fields and accepted status in the same Mongo update, validating acknowledgement and exact saved outcome/proposal. This closes the accepted-but-continuation-missing interval before producer post-write bookkeeping. Recovery remains metadata-only.
Production build ai-workflow-recovery-ui-build.log2warnings/46681ms. Deployed92files/1336076bytes with hashes only18082. Guarded ai-workflow-failure-fixture.mjs uses actual applyReferenceReview/agentService/document mutation/Mongo, injecting either final accepted settlement failure or subsequent recordReferenceApplication failure in helper process only. Original methods restored afterward.
Final ai-workflow-recovery-browser-acceptance.json/log5pass,errors[],workspace c9d2c4342f1e1140e93dd51b. Two live writers see reference year update despite uncertain result. B appends a comment. A opens actual References Check panel, inspects/confirms recovery; same panel displays Applied1 and enabled remaining Publisher action. Clicking Publisher advances Applied2 and both users retain B comment. Separate post-settlement bookkeeping failure leaves accepted task with complete review; remaining publisher application succeeds through actual HTTP. Synthetic evidence is explicitly example.invalid; no online provider/model validation claimed.
First run failed after2checks because fixture seeded writing-assist-citation search-panel storage but expected ReferenceTools Check UI. Database diagnosis proved recovered review and appliedCount saved. Corrected fixture to reference-check storage and explicit Check tab. Preserved ai-workflow-recovery-wrong-panel-failure.json/log and failure screenshot. Also identified search-panel parent callback still absent: keep that and other task consumers open for next pass.
Regressions92pass; prior frontend9pass; syntax and diffchecks pass. Remaining: claim-specific live recovery, all task-parent consumers, no-ack ambiguity/process-kill/Redis-loss, Shell isolated drafts, project automation and P6 lifecycle. No full P3/W16 completion claimed. No real manuscript or remote changes; no commit/push. User original instance untouched.

### Recovery consumers and identity-scoped parent updates
Added recovered-task.ts: replaceRecoveredTask requires matching taskId/projectId and matching workspace presence plus logicalproject/workspace/branch/epoch. Null/cleared tasks are never resurrected. Task type now declares server workspaceIdentity. Search/Literature, AgentPanel, ReferenceTools, ConversationPanel, RequirementAdvice and GoalPanel current/review/history views receive full recovery result through scoped updates. No cross-task replacement or document write is added. Goal refresh still asks the existing goal service for state; task recovery does not declare the goal complete.
Validation: ai-recovery-consumers-ui-tests.log53pass (identity mismatch matrix, search full-task recovery, inspection, conversation and requirement-advice regressions). Production build2warnings/48472ms; isolated18082deployment92files/1336549bytes hash verified. Final ai-search-recovery-browser-acceptance.json/log6pass,errors[],workspace 96dea841782f6caf2f31adca. Search panel now replaces requested-field summary with recovered summary without reload. Switching to Check shows restored remaining Publisher action; user applies it, both editors retain B's newer comment. Atomic accepted continuation remains validated by injected later-bookkeeping failure. All entry callbacks are wired; only Search/Check have this real two-writer acceptance, so do not claim every consumer has browser crash coverage.
Changed frontend: shared recovery identity helper, Task type, seven consumer files; test helper/matrix/search regression and browser entry routing updated. Existing generic and specialized backend unchanged this turn. Records updated; no original instance or manuscript/remote changes, commit or push. Still open: real claim-specific recovery, no-ack/process-kill recovery, Shell isolated drafts, automatic sync and lifecycle/P1–P6 completion gates.

### Claim recovery and missing-acknowledgement real write acceptance
Added guarded ai-claim-recovery-fixture.mjs and ai-claim-recovery-browser-acceptance.mjs. Fixture builds claim evidence with buildClaimReview from explicitly synthetic supplied text and example.invalid source, invokes actual applyClaimSuggestion/service/document transaction/Mongo, and injects only accepted settlement failure in helper process. Two authenticated users edit a new synthetic branch.
Claim acceptance4pass,errors[],workspace bb40041cd14f2158f71444f5: both writers receive first correction despite failure; Check UI recovery restores claim review and the next suggestion applies; B's subsequent edit makes third suggestion return409 without modifying either editor; reload preserves first two corrections, unchanged third sentence and B's new text. This tests supplied synthetic evidence and actual mutation/recovery, not online evidence/model generation.
Added ai-noack-failure-fixture.mjs and ai-noack-browser-acceptance.mjs. Helper invokes actual write then injects acknowledgement-persistence failure; stored task is uncertain, acknowledgement absent, applicationRetention true and expiresAt absent. No-ack acceptance6pass,errors[],workspace 049f81f6aab8bc1de50fd69e: both writers see actual successful edit; inspection/download show matching text but null acknowledgement; no confirmation button; direct recovery and repeated accept both409; other user's inspection404; task/text remain unchanged after inspection/refusals. This establishes a real ambiguity case rather than merely seeding an uncertain task.
Important remaining boundary: no-ack task deliberately stays unresolved. Equal text is not a receipt. A complete manual resolution/adjudication workflow and physical process-kill/Redis-loss recovery remain unfinished. No generic or specialized recovery full-completion claim follows from these tests. Next work must add explicit non-replaying disposition with retained evidence or stronger durable transaction proof, then Shell draft isolation and remaining P1–P6 gates.
Production source unchanged this turn; only guarded fixture helpers copied into18082, tests and progress records added. No original instance, real manuscript, online model or external Git remote touched; no commit/push. git diff --check passes.

### No-ack manual disposition implemented; isolated tests only
Added ApplicationDisposition service and POST close-unconfirmed endpoint. Owner authorization before/after project-lock wait, exact task state reread and CAS, explicit decision string and inspection SHA256 required. Fingerprint includes task/proposal, original/current workspace, baseline/proposed/current document identity/version/content and acknowledgement (not observation timestamp). Changed review refuses409; valid acknowledgement routes user to acknowledged recovery. Same already-closed decision is idempotent. No document mutation dependency exists.
Closure stores status closed-unconfirmed plus manual disposition and complete reviewed observation. It neither marks accepted nor undoes/confirms the earlier mutation. Retention release/migration protect closed-unconfirmed evidence; goal advancement and specialized reference/claim continuation treat it as unresolved rather than successful. Inspection/download remain available after closure. Frontend adds explicit Close without retry explanation/button and propagates actual returned proposal status instead of hardcoding accepted.
Validation: ai-disposition-tests.log136pass (closure permissions/stale identity and content/CAS/idempotency, inspection/recovery/service, goal cannot auto-complete after manual closure, reference/claim regressions); ai-disposition-ui-tests.log21pass (explicit fingerprinted request, unconfirmed message, retained download, existing recovery identity cases). Syntax and diff checks pass. UI includes new status in Task proposal union; ReferenceTaskView keeps uncertain continuations disabled.
Not yet production-built/deployed, actual Mongo closure retention and double-user closure acceptance pending. Existing18082 still runs prior consumer build; no original instance/manuscript/remote changes, commit or push. Manual task closure is not proof no delayed server mutation could finish after a lost lease; physical crash/fencing durability and no-ack adjudication remain distinct. Next: isolated build/deploy plus real no-ack task closure, stale-inspection refusal after B edits, retained Mongo evidence and repeat refusal. Full P1–P6 scope unchanged.

### Manual no-ack disposition: two writers and Mongo retention verified
Built current frontend2warnings/50669ms (ai-disposition-ui-build.log), deployed only18082 (initial94files/1356784bytes; final CAS-fix overlay93files/677503bytes, hash verified in ai-disposition-fixture-deploy.log). Actual no-ack write fixture creates uncertain retained task after real mutation then acknowledgement-persistence failure. Browser test: initial inspection, B edits, A stale Close without retry fails409; reinspection permits explicit closure; B's close gets404; repeat same closure is idempotent200. Closed task remains downloadable as closed-unconfirmed, never accepted. Read-only Mongo/content helper also invokes retention housekeeping and proves applicationRetention remains true/expiresAt absent, original snapshots and reviewed observation retained, full current document content AND version unchanged by closure. Both reloaded editors retain earlier write plus B edit.
Final ai-disposition-browser-acceptance.json/log6pass,errors[],workspace 73925a3adc8663d91ba5ca70. Initial6check run also passed. CAS audit then found that spreading a proposal without acknowledgement did not require acknowledgement absence; added explicit exists:false/exact-value condition so a late journal cannot be ignored. Actual Mongo race fixture ai-disposition-race-mongo.log passes: acknowledgement inserted after old snapshot prevents stale closure, status remains uncertain and no disposition written. Final browser rerun verifies normal closure after this strengthening.
No physical process termination, delayed downstream mutation fencing or Redis-loss durability claim follows. Manual closure means do not retry, not proof of prior success/failure. Remaining full P1–P6 requirements persist. No original instance, manuscript or remote modifications; no commit/push.
Next implementation target: Shell isolated drafts. Current authoritative NativeGitRuntime line291 blocks terminalOpen in isolated workspaces; legacy terminalOpen line320 mounts repo.directory. TerminalContainer volume allowlist is bounded to native-git/<project> and protects Git metadata, but does not yet create a baseline-bound isolated draft or safe import transaction. Keep terminalOpen gate until draft creation/retention/review/application and actual two-writer tests pass.

### Shell draft durable preparation foundation
Added NativeGit/ShellDraftService.mjs. Server-owned operation UUID records bind logical project, workspace, epoch, owner and baseline file hashes/document versions/asset identities/folders. Preparation captures a consistent project snapshot, rechecks authorization/epoch, checks free capacity for two copies, persists preparing journal before filesystem writes, fsyncs independent baseline and work directories, then marks ready. Failure retains recovery-required record/files; repeated operation never recreates or overwrites a draft, including after service restart. Only work directory is intended for terminal mounting; baseline/control records remain siblings outside mount. Read/list/baseline APIs enforce owner+workspace and reject tampered baseline hashes. Public summary omits disk paths and detailed baseline data.
Validation: shell-draft-tests.log32pass,0fail (7new real filesystem cases plus25existing merge-draft cases using shared snapshot identity). Checks cover binary/nested contents and doc versions, independent copies, stale epoch before and during preparation, permission revoked while queued/after snapshot, retry and restart preserving draft edits, other-owner/workspace denial, baseline tampering, symlink collision refusal, capacity507 and invalid operation IDs. Temporary test directories are isolated and cleaned by tests. Syntax/import execution and git diff --check pass.
This is a service foundation, NOT an enabled terminal feature. No runtime routes/session lifecycle/review/import UI yet, and no Docker Full Access validation this turn. NativeGitRuntime terminalOpen anti-overwrite gate remains unchanged. No source deployed to18082 or original instance; no real manuscript/remote changes or commit/push. Next: durable terminal association/quiescence, immutable review snapshot and safe application through existing prepared transaction, then actual two-writer/container acceptance.
Exploration notes: initial guessed MergeDraft.mjs and WorkspaceEpochAdapter.mjs paths did not exist; resolved to MergeDraftService.mjs and WorkspaceEpochRuntime.mjs. Runtime epoch adapter uses existing numeric epoch service. Existing ProjectWorkspace.synchronize rewrites live Git worktree from editor, confirming it must never own the shell writable draft.

### Shell draft session attempts and sealed review service
Extended ShellDraftService with start/seal/review. Start persists unique sessionAttemptId and starting state before invoking runner; matching positive startup response required. Lost/mismatched startup response retains recovery-required/start; restart cannot silently start a second process. Seal persists stopping state, asks runner by durable attempt identity (not only ephemeral terminal id), requires matching quiescent:true, then records sealing/stoppedAt. Only after this acknowledgement does it read work files and copy a fsynced review directory outside writable mount. Existing review directory is never overwritten after interruption. Review validates retained baseline/review manifests; later scratch edits cannot change sealed diff. Capacity check reserves another snapshot; failures retain phase-specific recovery records. Epoch changes prevent startup but stopping still retains the old-bound draft with observed current epoch for later safe conflict handling.
Evidence: shell-draft-session-tests.log14pass,0fail. Actual filesystem tests plus controlled runner cover persisted-start ordering, duplicate prevention, response loss/restart stop-by-attempt, false/mismatched stop acknowledgement, sealed bytes independent of work edits, unchanged original baseline, epoch mismatch retention, symlink output refusal, corrupted review refusal and review-capacity507. node --check and git diff --check pass.
Runner calls are simulated in these tests: no Docker quiescence proof yet. Existing repository-terminal-runner still closes Docker CLI asynchronously and therefore does NOT satisfy the new stop contract. New service is not wired to production commands; terminalOpen remains gated. Next required work is a runner adapter with persistent attempt/container identity and verified process/container termination, including runner-restart/lost-response tests, before runtime/review/import integration. No deployment, real project/remote edits, commit or push this turn.

### Durable shell lifecycle: retry identity audit
Implemented NativeGit/ShellContainerLifecycle.mjs and native-git-shell-container-lifecycle.test.mjs. An existing-attempt Docker ENOENT previously fell through the record-missing catch; narrowed catch to owned-record lookup only. Canonical configuration fingerprint prevents reuse with changed work directory/image/mode. Container ID and labels bind retries/stops; AutoRemove must be false and restart policy no. Start acknowledgement loss remains uncertain and is never replayed. Stop does not yield a review permission unless exact container is observed exited/dead and not restarting. Tests use real durable task records and simulated Docker; 24 combined checks pass in shell-container-lifecycle-tests.log. Real runner lock, Docker integration and physical crash tests still required before terminal gate can open.

### Real container draft acceptance
shell-container-live-acceptance.log records4passing checks using current fixture image and a new isolated Docker named volume. Actual Python shell via docker attach wrote scratch proof; container inspection confirmed no host binds, no privileged mode, network none and no automatic removal/restart. Stop inspected exited state and replay was refused. Adapter and kernel-flock lock added; optional authenticated draft runner endpoints added but not deployed or tested through HTTP yet. Test deliberately does not mount the fixture project volume. Cross-process crash lock handling and safe import remain outstanding.

### Shell runner crash evidence
shell-attempt-lock-tests.log3pass includes actual independent Node process SIGKILL and stable-inode lock reacquisition. shell-runner-http-acceptance.log4pass includes loopback authenticated HTTP, isolated Docker scratch write, runner SIGKILL and fresh process reading same durable attempt to stop retained container, repeat-stop and denied-start-replay. Credentials generated in memory and not logged. This does not validate Docker-start response loss under physical process kill or the eventual Overleaf document import; those remain separate acceptance work. Original service instances and manuscript volumes untouched.

### Shell draft command boundary
Runtime now creates ShellDraftService from authoritative context root/project/owner/epoch/lock and maps runner owner fields through shellDraftTerminal. Schemas expose operation UUID/revision only, never mount path or permission-mode escalation. Four new tests check omission of internal record data, start gate/server policy, bounded overview and transport owner mapping; with14service regressions18pass. Safe import is not implemented by this wiring, and startEnabled is not set by runtime. Still need per-file review, transaction journal/recovery and frontend/session control integration before enabling startup.

### Shell review/application boundary
Sealed file previews now bind exact review fingerprint, reject unrelated paths, preserve binary hashes and avoid lossy/oversize text output. Application service uses prepared transaction and full snapshot identity (including document versions) before writes, durable per-document journal, workspace mutation block and epoch advancement. It applies uncommitted document edits and does not move Git refs. Tests25pass; transaction itself is simulated in this suite. Recovery implementation/runtime apply route/UI still missing, so service is not enabled. Fixture-only Buffer cloning failure retained separately before corrected passing run. Original manuscript and remote untouched.

### Shell recovery service evidence
Added preview/resume/preserve-current using durable journal plus live document identity and mutation ownership. Exact recorded checkpoint required to resume; content equality alone is insufficient. Preservation snapshots current content and fences prior epoch without modifying documents. Recovery settlement is idempotent by operation UUID; refusal retains original drafts and journals. Seven application/recovery tests passed in shell-recovery-tests.log with simulated document transaction, including stale preview/newer collaborator text and settlement failure. Runtime schemas/dispatch added but not deployed or tested in actual browser. Still no claim of complete P3 or Shell readiness.

### Recovery choices and UI
Preserve-current now remains authoritative after failed settlement; resume cannot silently reverse that decision. Prepared journal before failed mutation acquisition is recoverable without accepting a foreign pending operation.9backend application/recovery tests pass. New Shell drafts modal integrates retained draft selection, sealing, text/metadata preview, exact fingerprint application and explicit recovery controls.2UI tests pass; TimeoutNaNWarning observed. Not built/deployed or actual browser tested; launch/session controls still pending. Initial test file path failure corrected without changing production code.

### Shell isolated deployment checkpoint
Built frontend with2warnings55707ms and deployed100hash-verifiedfiles1397186bytes only to overleaf-git-collaboration-web18082.3draftUI+46SourceControl+30backend tests pass. Runtime distinguishes scoped Shell mutation recovery from merge recovery; other users see owner-needed message, no private task fields exposed. Async API-generation test rejects stale review after workspace change. Live multiwriter Shell acceptance and startup/session integration still pending; no completion claim follows from build/deploy.

### Live acceptance identifies unconditional epoch-disconnect
First real Shell browser run5pass (shell-draft-browser-first-pass.json) verifies owner scope, stale rejection, actual apply, persisted two-writer content and uncommitted Git state. Followup without reload fails: out-of-sync-modal intercepts interaction. Source confirms editor-manager-context epoch recover unconditionally captures recovery and disconnects; openDocs.hasUnsavedChanges exists but is not considered there. Current behavior is safe against old epoch writes but does not meet seamless collaborative continuation. Separate injected post-epoch failure script hits same limitation. Preserve all failed evidence. Next implementation must safely refresh clean documents/project identity and retain explicit recovery for buffered/unconfirmed edits, then repeat actual browser acceptance.

### Clean rejoin versus failed transaction distinction
New acknowledged-clean client rejoin passes normal Shell UI import without page reload (6checks,errors[]). Injected failure after epoch advance still leaves live editor not displaying server-applied marker. Repeated End navigation did not fix it; server snapshot confirms actual marker stored. Treat as unresolved browser/transaction refresh problem, not mere test artifact. Both failure traces retained. Safe fallback still exists for unacknowledged/unsaved clients; full failure-path acceptance incomplete.

### Destroyed editor diagnosis and lifecycle fix
Recovery diagnostics now confirm both clients reference destroyed=true CodeMirror instances, despite editable facet=true, readOnly=false and new full document bytes. Only CodeMirrorView destroys that instance; CodeMirrorEditor creates and retains it. ReviewPanelProviders conditionally changes the child hierarchy based on project features. Moved destruction to the owning CodeMirrorEditor effect, so child remount cannot destroy a retained instance. Preserved pre-fix shell-recovery-browser-destroyed-view-failure.json/log. Browser assertion now checks view is alive after rejoin.
Build shell-editor-lifecycle-build.log succeeded with2warnings43508ms; deployment only18082:101files955488bytes hashverified. Includes pending awaited write-state notifications and Shell repository invalidations. Backend run9pass18skipped (Redis-dependent preparation tests skipped without configured Redis); do not count skipped tests as validation. Actual interrupted browser acceptance running; no success claimed yet.

Lifecycle fix acceptance complete: normal browser6pass and interrupted recovery5pass, errors[] for both. Added explicit live-view assertion and post-recovery no-refresh collaborator typing, observed by the other account. Reload then validates persisted content and released mutation block. These exercise real Overleaf UI/HTTP/OT with helper-seeded private draft bytes; they do not prove terminal startup integration. No production deployment, commits or push.

Shell session bridge: introduced bounded draft commands, server-only session lookup, current-mode and epoch guards, explicit UI create/start/stop flow and retained-session attachment adapter.22backend+6frontend assertions pass; staged production build succeeds2warnings. Preserved source/test evidence under shell-session-* logs. Two exploratory reads guessed nonexistent repository-terminal.tsx and native-git-shell-runner-http.test.mjs; actual files are git-terminal.tsx and docs/git-collaboration/shell-runner-http-acceptance.mjs. No failed source modifications from those reads. Runtime startup remains false until fixture runner integration.

### Real terminal integration and mode acceptance
Deployed latest Shell UI/control build only18082 (shell-session-fixture-deploy.log100files1401698bytes). Dedicated runner run-shell-fixture.mjs binds127.0.0.1:47294 with persistent attempt state and secret in ~/.local/share/overleaf-acceptance/shell-fixture, outside repo. Web credential file /etc/overleaf/shell-fixture.json root:www-data0640, not mounted in shell. Fixture settings guard exact instance/database and endpoint; enables shellDrafts only there. Host gateway connectivity test returned403 for unauthenticated request.
Actual xterm input, no scratch-writing helper: workspace-write shell-terminal-browser-acceptance.json8pass; full-access10pass and auto-review10pass in their named JSON/log files, errors[]/complete=true. Two accounts verify private access, stale refusal after B edit, UI stop/seal/review/apply, no-refresh propagation, reload preservation and Git remains uncommitted. Full/auto inspect Docker actual mounts: one named volume at exact draft work directory, no bind or Docker socket, network none, rootfs mode as specified. These tests do not establish all remaining P1-P6 gates.
Found and fixed policy-switch scope gap: previously revoke used storage workspace rather than logical project; persisted containers could remain after runner restart. Runtime policy change now uses shared operation lock, revokes logical project and legacy workspace sessions, rechecks membership before saving. Runner revoke scans durable owner-scoped attempts, confirms stop via lifecycle; never relies solely on in-memory attachment map. shell-runner-revocation-acceptance.log4pass actual Docker includes SIGKILL/restart then revoke and refusal to restart old attempt. Redeployed only18082 (99files716014bytes), restarted only dedicated47294 runner after verifying PID command. Browser policy-downgrade regression running; record terminal outcome next. No production project/remote/commit/push changes.

Browser revocation outcome: shell-terminal-full-access-revocation-browser-acceptance.json12pass, complete=true/errors[]. Real policy downgrade confirms Docker stopped, old input409, repeated policy restore does not revive container; seal/review/application still preserves B edits and reaches both online editors. Dedicated runner remains live; no other runner ports or original app instances changed.

### Multi-tab terminal defects and fix
Confirmed opening another same-owner draft called openTerminal replacement and removed existing owner entries; poll also cleared shared output. Added independent draft sessions without replacing sibling attachments; legacy opens replace only legacy sessions. RepositoryTerminal keeps a bounded1MiB output ring with absolute cursors; explicit cursor polls are nondestructive while legacy no-cursor polling retains incremental behavior. Draft poll schema defaults cursor0; private session service forwards only bounded validated cursor; adapter keeps per-view position and ignores prior attachment completions. Closing/reopening view replays retained output; truncation is disclosed.
Tests shell-multitab-tests.log24pass0skip; shell-multitab-ui-tests.log8pass. shell-runner-multitab-acceptance.log5pass uses actual Docker, simultaneous different-workspace attempts, first session remains writable after second starts, cursor replay, SIGKILL/restart owner revoke stops both. Staged build and three-page/two-user browser acceptance pending. No original instance/remote changes.

Multi-tab browser outcome:12checks pass/errors[]/complete=true, including two same-owner viewers of the same terminal and separate collaborator; both viewers receive SHELL_READY, closing one does not stop session, remaining view receives subsequent output. Stale protection and fresh review/apply still pass. Production build2warnings; fixture-only deployment recorded. Persistent runner remains live on47294.

Reviewed UI timeout resolved by attachment readiness fix. Browser suite now4pass/errors[], including actual no-file-before-approval and exact private content after approval. No test-only delay or forced-click workaround was added. Permission tests use fresh synthetic branch; read-only/approval commands never mutate live document. Graph inspection next: current flat presence list renders every retained offline session (24h) alongside current sessions, screenshot shows297 entries; requirement calls for expandable same-user sessions, which remains to implement.

### P4 collaborator list grouping
Changed GitPresenceList: userId-based expandable groups; distinct session rows preserve full sessionId in title/data attribute, branch dirty state, editing and viewed commit. Online users ordered first; historical offline sessions collapsed separately and labelled Last editing/Last viewed. Scrollable group region max180px keeps retained24h history from consuming sidebar. Same display names never merge identities. No backend presence retention or permission changes.
Initial edit used wrong cwd and failed before writes. Initial test assertion used jsdom accessible-role query to infer collapsed details visibility; jsdom returned the descendant. Retained presence-group-jsdom-details-failure.log; tests now assert native details.open and grouping, with real browser visibility checks added. presence-group-tests.log8pass. Build presence-group-build.log2warnings60906ms; deployed only18082 (101files1448307bytes hashverified). presence-groups-browser-acceptance.mjs extends existing two-branch/three-session browser suite with grouping, collapsed offline visibility and bounded-height checks; running, no browser success claim yet.

P4 browser suite completed8checks/errors[]. Network loss removes online state, reconnect returns exact expected active count with branch/text intact. Screenshot has unrelated shared-task tooltip overlay; not claimed as complete visual review. User grouping and collapsed-state geometry verified directly in real browser.

### Automatic commit schedule foundation — 2026-11-11
New module services/web/app/src/Features/NativeGit/AutoCommitSchedule.mjs separates durable timer policy from the still-required prepared commit executor. Tests services/web/test/agent/native-git-auto-commit-schedule.test.mjs:10 passed (auto-commit-schedule-tests.log). Critical check: Git publication may succeed while recording completion fails; retain the running operation identifier and pause for reconciliation, never schedule another commit from an unproven result. Policy reconfiguration cannot discard that ID. Manual staged content, unsaved edits and recovery/conflicts pause before executor invocation. No runtime integration or production enablement claimed. Upcoming executor must independently revalidate HEAD, index and saved document identity at publication under the established prepared write barrier; scheduler callback assertions alone cannot prove overwrite safety.
P4 marker browser artifact rechecked complete=true,9passing checks,errors[]; presence-marker deployment hash verified100fixture files1404944bytes. This is scoped acceptance, not entire P4/P1-P6 signoff.

### Native automatic commit execution foundation — 2026-11-11
Added AutoCommitGit.mjs and native-git-auto-commit-git.test.mjs. Exact saved bytes are copied before async construction; native commit-tree uses service author and operation trailer; native update-ref compares expected HEAD; shared index.lock excludes manual Git staging while index is installed. Private temporary index is plumbing only, not a separate user staging area. Working-tree/live document bytes are never replaced. Journal prepared/published/complete contract supports later explicit reconciliation. An uncertain ref outcome retains lock rather than allowing automatic retry.
19 combined tests passed (9 real native repository tests,10 injected schedule tests); actual last-instant competing ref update leaves competitor HEAD intact. Successor-lock test caught/prevents cleanup deleting a new operation's lock after atomic index installation. Original environment-guard failure preserved; explicit allowlist and scratch cwd fixed. No real prepared Overleaf transaction, worker scheduling or UI acceptance in this step; do not enable production. Next: persistent scoped operation journal plus recovery before runtime wiring; guard must bind saved-document versions/epoch/auth/lease throughout publication.

### Automatic commit journal/recovery — 2026-11-11
AutoCommitRecovery uses existing atomic fsync-backed CollaborationTaskStore; records workspace/owner, candidate identity, revisions and terminal transitions. Git lock ownership checks include inode/device plus exact candidate-index hash. Explicit preview-bound recovery either installs a proven published candidate's index or cancels unpublished work; never moves a newer HEAD or replaces newer working-tree bytes. Terminal outcomes cannot authorize index mutation again. Execution now fsyncs index directory before complete journal.
25 tests passed in auto-commit-recovery-tests.log; includes actual persisted journal reload after injected publication interruption, retained private candidate lock, new working bytes preserved and repeated recovery. Native Git is real; collaborative guard remains injected and crash injection is not physical SIGKILL. Remaining early-lock-before-first-journal crash requires durable startup ownership/reconciliation; unidentified locks must remain untouched. Runtime integration and project-level schedule settlement are not yet implemented/enabled. Changed modules AutoCommitGit.mjs, new AutoCommitRecovery.mjs, native-git-auto-commit-git.test.mjs, and these progress artifacts. Original projects/remotes unaffected.

### Automatic commit recovery schedule settlement — 2026-11-11
AutoCommitSchedule.mjs now exports settleAutoCommitSchedule, accepting exact owner/revision/operation plus terminal record from scoped persistent journal. It disables automatic scheduling after recovery and retains operation/outcome/commit/journal revision in lastSettlement. Reconfiguration is explicit. Replay does not increment revision and cannot touch a newly configured schedule. Tests reject incomplete/foreign/stale/revoked recovery requests.
36 combined tests passed, including real filesystem reload of both journal and schedule around Git publication recovery. Evidence auto-commit-settlement-integrated-tests.log; targeted20case log auto-commit-settlement-tests.log. Runtime/UI/background worker remain unconnected and disabled. The early-lock-before-first-journal gap still requires startup ownership before enabling. Next service must wrap native executor in project.transaction({prepare:true,epoch}) under logical project lock and current workspace binding, with session recovery and workspace mutation guard; do not wire directly to default repository.

### Automatic commit early lock crash protection — 2026-11-11
AutoCommitGit now persists starting state before hard-linking its private ownership inode to shared index.lock. Directory and file sync ordering added; alias retained through ambiguous publication. AutoCommitRecovery checks both alias and shared inode, plus candidate hash once prepared. Starting-only recovery cancels without touching HEAD/index; cancelled/complete outcomes can clean their own retained alias. First candidate journal failure is therefore recoverable without guessing lock ownership.
37 tests passed in auto-commit-startup-tests.log. Physical SIGKILL test (not exception simulation) confirms child exit signal then reopens durable journal and recovers acquired lock while preserving original HEAD/index. Failure provenance auto-commit-startup-replay-error-failure.log captures initial EEXIST API mismatch fixed to409. Actual power-loss/filesystem durability not tested. Pre-journal private alias retention cleanup remains; runtime shared mutation guards/prepared transactions and integration tests still required. Original application/manuscripts/remotes untouched.

### Prepared automatic commit service — 2026-11-11
New AutoCommitService wraps native executor and explicit recovery in prepared project transactions. Binds snapshotIdentity (includes doc versions, identities, bytes and folders), workspace epoch/directory/branch; does not synchronize scratch bytes over live document files. Acquires workspace mutation ownership only after starting journal is durable, keeps it on transaction exit failure and releases only after completed transaction and terminal journal. Recovery uses current workspace and explicit preview revision/fingerprint, preserves newer collaborative content, and never duplicates commit. Native journal directory identity also added to prevent another worktree with equal refs/index satisfying recovery preview.
45tests pass in auto-commit-service-integrated-tests.log;8 new service cases use real Git and durable stores but injected preparation/lease adapter. Not real online client acknowledgements yet. Initial standalone7-case log auto-commit-service-tests.log retained. No runtime/worker wiring or deployment. Important remaining gap: schedule marks operation running before service preparation; if preparation fails before native starting journal, recovery needs persistent service attempt outcome rather than treating missing record as proof of no execution. Address before enabling, then real fixture multiuser test.

### Automatic commit preparation failures — 2026-11-11
Added requested journal stage before prepared client-save wait. AutoCommitJournal permits requested->starting/cancelled while keeping base Git/workspace identity immutable. A failed save barrier can now be explicitly cancelled using real persisted record, instead of an unexplained missing native journal. AutoCommitService labels only pre-record preflight errors as known-not-started; scheduler tracks dispatch and clears unused IDs only for proven non-dispatch. Once an attempt is durable, failures remain recoverable rather than silently retried.
48tests pass in auto-commit-preparation-tests.log, including physical native startup SIGKILL regressions, true filesystem requested-stage recovery, authorization-before-dispatch and late transaction failure distinction. Preparation/lease adapters still simulated in service tests. Runtime routes/config/worker/UI remain absent; no production enablement or original data changes. Next use existing discoverySchedule integration pattern but keep auto-commit stores workspace scoped and management authorization owner-only, recovery on recoveryLock rather than normal blocked mutation path.

### Automatic commit runtime/controller/worker integration — 2026-11-11
Added AutoCommitController.mjs and AutoCommitWorker.mjs; modified NativeGitRuntime, NativeGitRouter, GitCommands, RepositoryEvents and settings.defaults.js. Workspace-scoped auto-commit/<workspace>/schedule and tasks; owner-only configuration/recovery and fresh write policy. Worker runs without browser timers and verifies scanned logical project matches resolved workspace. Feature flag OVERLEAF_NATIVE_GIT_AUTO_COMMIT_SCHEDULER defaults false; no environment enabled/deployed. Recovery remains possible if new scheduling disabled. Events now include actual auto commits/recovery/configuration so branch Graph invalidates.
38 module/service tests pass in auto-commit-runtime-tests.log (5controller/schema+2worker+9service+22schedule); syntax/diff checks passed. Runtime import under real Overleaf and HTTP permissions are still unverified; no live worker/browsers in this step. Next implement frontend management using these commands, deploy only18082 and exercise two-user background commits/staging refusal/save failures/recovery. Native Git executor unchanged this turn, earlier real Git/SIGKILL evidence retains its prior scope.

### Automatic commit owner UI — 2026-11-11
Added auto-commit-settings.tsx and4 frontend cases. UI shows server policy revision, interval, pause explanation and explicit recovery preview; saves exact schedule revision and sends recovery task revision/fingerprint plus scheduleRevision. Changes disabled while operation pending. API-generation checks prevent late old-workspace responses from creating recovery controls in new workspace. Source control button available only prepared collaboration support; interrupted task notice now distinguishes automatic commit from merge/Shell. Native runtime classifies only matching workspace journal, no internal fields exposed.
4focused tests and50combined panel tests passed. Webpack staged build2warnings57282ms, auto-commit-ui-build.log. Existing jsdom warnings in panel log are not zero-console-error proof. Production original instances unchanged; not deployed to18082 yet. Next deploy fixture with updated build guard then validate actual HTTP owner/nonowner access, disabled policy, dedicated flag, due worker and concurrent two-writer/temporary manual-index pause/recovery. No end-to-end or P5 completion claim.

### Automatic commit fixture deployment and multiuser acceptance — 2026-11-11
Input staged auto-commit-ui build; deployed107files1483712bytes to overleaf-git-collaboration-web only, all hashes verified (auto-commit-fixture-deploy.log). Updated deployment guard/default settings inclusion. New auto-commit-browser-acceptance.mjs uses private existing synthetic accounts without exposing credentials.
Disabled suite3checks passed, complete/errors[]: actual owner/nonowner API access, scheduler-off enable refusal, settings UI unavailable. Enabled suite4checks passed, complete/errors[]: actual scheduled worker commits shared saved text using service author, both live editors retain it, staged manual edit pauses background task. Follow-up native Git inspection confirms no HEAD advance and staged text retained, recorded manualStageVerification in enabled JSON. Successful and previous failed synthetic task schedules are disabled; fixture feature flag remains enabled with strict site/database guard. Original instances/manuscripts/remotes unchanged.
Preserved failures: restart login readiness timeout and misuse of visual preview API for tex. Corrected test to commitFileDiff, reran only after terminal outcomes. This is actual Overleaf/browser/background-worker acceptance for normal and staged-refusal paths, not interrupted recovery/no-browser scheduling/automatic pull/push or complete P5. No code commit/push this turn.

### Automatic commit recovery UI and Graph read repair — 2026-11-11
Actual two-user recovery suite4checks complete/errors[] after injected prepared transaction exit failure following native commit. Persistent journal and mutation block retained; B cannot recover owner's task, but can keep writing; owner Settings preview/confirm clears block and disables policy. B newer content remains uncommitted on both pages and Git HEAD unchanged. Task resumed after initial failed acceptance and settled; no orphaned active test schedule left by this suite.
Graph command previously called workspace.run, unnecessarily exporting documents and returning409 while mutation pending. Changed GitCommands.graph to readHistory. One targeted test verifies history callback works with export forbidden. Module SHA256 verified in18082 and only web/web-api restarted; no frontend rebuild needed. Failure artifact auto-commit-recovery-graph-blocked-failure.* retained. Successful suite auto-commit-recovery-browser-acceptance.json/log. Injection helper strictly verifies fixture site/database/root name/branch prefix, no production fault route. Not a physical process-kill/browser recovery test (native SIGKILL coverage is separate earlier fixture). No commit/push or real manuscripts/remotes modified.

### P5 permission revocation actual browser acceptance
Fresh synthetic branch auto-permission-mwc7a4x5 in18082:4checks passed, complete=true, errors=[], process exit0. Actual background worker pauses permission-revoked with no operationId/commit after owner changes to read-only; configuration denied403; restoring original policy and waiting17seconds leaves schedule paused and HEAD unchanged, both editors retain marker. Owner explicitly disables schedule, original policy restored in finally. Evidence auto-commit-permission-browser-acceptance.json/log/mjs. No product code changed this turn. P1-P6 remain incomplete.

### Demo checker readiness fix deployed
Authenticated HTTP login/project/Graph all200,29project assets200; evidence demo-project-assets.json. Missing provider credentials previously still enabled per-sentence checker via saved.enabled. index.ts now also requires selected provider hasKey, except local agent which uses no user API key. This stops invalid automatic checks without changing stored user preference. Production build passed2warnings61673ms; first command used wrong cwd and is retained demo-checker-build-path-failure.log. Frontend-only deployment copied/hash-verified3files and restarted only18082web/web-api (demo-checker-deploy.log); login readiness200. No browser automation, manuscript edits or remote changes. Chrome hang cause remains unproven; do not claim this fixes observed loading failure. Full collaboration goal remains active/incomplete.

### Reviewed Pull connected and fixture deployed
Collaborative pull now composes existing remote discovery and shared merge preparation, returning reviewRequired/task; no document apply or push. Pins fetched after[remote ref] and rechecks owner/write authorization after fetch; missing/deleted/incomplete sources and collaborative rebase refused. Optional operationId accepted for retry identity, UI generates it and opens selected Shared merge tasks. /git pull uses same backend but renders task result; command-help wording still needs update. Dirty target handling remains existing explicit refusal until user commits/handles changes.
Evidence: reviewed-pull-tests.log4pass; reviewed-pull-ui-tests.log1pass confirms actual panel action selects returned task without apply. First UI expectation incorrectly assumed mergeDraftGet, retained reviewed-pull-ui-test-expectation-failure.log; corrected to assert displayed dialog/selected task. Build2warnings62079ms;3backend modules hashverified copied,3frontend artifacts hashverified/restarted only18082, login200. Live authenticated pull--rebase returns new specific409 (reviewed-pull-http.json) proving route wiring; no live remote fetch performed in this turn. Full remote-fetch->review->apply browser acceptance remains outstanding. No Chrome operations, original manuscript edits, commits or pushes.
User entry: Source Control > Repository actions > Pull > Fetch and review. Current restrictions: owner only for remote fetch, target changes must be explicitly handled, rebase remains unsupported. Full P1-P6 still incomplete.

### Paper Assistant reviewed Pull result deployed
/git pull now displays fetched/task status plus explicit files-not-updated message and Review merge task button opening existing CollaborationTasks modal. Server supplies collaboration capability; /git help pull explains defaults, owner fetch requirement, explicit apply and collaborative rebase refusal. Added post-response workspace guard; old workspace result cannot show a review button in new workspace.
Evidence slash-pull-review-tests.log7pass (four permission modes, direct review/no automatic apply, late workspace response, help). Build2warnings65455ms, slash-pull-review-build.log; runtime capability module hashverified,2frontend artifacts hashverified and deployed only18082, web/web-api restarted/login200 (slash-pull-review-deploy.log). No browser automation or original manuscript/remote changes. New UI not yet visually accepted by user; full remote fetch->resolve->apply acceptance remains pending. No commit/push. Full objective incomplete.

### Reviewed Pull actual HTTPS and two-account HTTP acceptance
Fresh synthetic branch reviewed-pull-1794408014/workspace5d8fd85688585379198a059a. Real local HTTPS remote was started only in fixture after confirming no running server. Four checks completed: B cannot fetch; A pull pins actual fetched tip617de503b105e43612faf5b74b213bef27feffc1 without target HEAD change; B sees identical task and same operation replay does not duplicate; owner claims/applies, competing B claim409, both accounts download actual project zip containing exact remote text and Git diff agrees. Taskfb93e554-490b-475a-8cc8-6afa5d3235a5 resolved. Evidence reviewed-pull-http-acceptance.json complete=true; final verification exit0. Script resumes same workspace/task after terminal assertion failures; no duplicate application.
Test expectation failures preserved: unfiltered Graph includes other branches; prior remote tip and hardcoded content were stale; project HTML is not document inventory. Fixed by branch-filtered graph, current remote commit-pinned content and authenticated project ZIP downloads. These were acceptance harness errors, not additional app fixes. First HTTPS launch path absent; copied task-owned script and started successfully; exact server process stopped at finish.
No browser/socket editing tested this turn; browser visual conflict flow still unverified. No original project/remote or production deployment changes, no commit/push. Goal incomplete.

### Category1 branches command repair and review setup
Found /git branches advertised but absent in backend schema/dispatch (actual HTTP400). Added strict branches command using readHistory, no document export. category-1-branches-tests.log2pass, backend-only deployment18082, web/web-api restarted. Authenticated HTTP successfully listed refs and prepared stable demo/shared and demo/independent workspaces from initial888b0cc commit; category-1-demo.json holds URLs. Existing five scenario evidence mapped in category-1-review.md; historical checks are not current visual acceptance. No user browser control. Category1 remains under review/remaining multi-file recovery checks; do not advance categories2–6 without user confirmation.

## 多文件离线恢复修复

连续文档错误现在先在内存中按文件ID汇总，再尝试持久化；即使浏览器存储失败，恢复窗口仍显示全部已捕获文件。相同文件名、不同ID分别保留；账号、工作区或代次变化后不混入旧副本。未添加自动回写。

修改源文件：`editor/local-recovery.ts`、`context/editor-manager-context.tsx`；针对性测试：`test/frontend/features/source-control/local-recovery.test.ts`。7项通过，其中新增2项覆盖连续存储失败与范围隔离。构建成功（2 warnings，47859ms）；2个部署文件哈希验证通过，仅重启18082 web/web-api；登录页HTTP200。证据：`category-1-multifile-recovery-tests.log`、`category-1-multifile-build.log`、`category-1-multifile-deploy.log`。

没有操作正式论文/远端；没有重跑浏览器自动化，页面交互尚未验证。第1类仍待重命名/重建恢复行为核对及用户演示确认，不进入第2类。

## 第1类：恢复文件名与身份

发现并修复：DocumentContainer.docName 原先始终为空。打开文档时填入文件名，文件树变更时按ID更新名字；已删除文档保留最后已知名字，不借用同名新文件的身份。修改 editor-manager-context.tsx、open-documents.ts；新增 workspace-epoch.test.ts 的改名/删除重建身份检查，连同恢复入口共13项通过。模块/组件检查不等同实际多人浏览器验收。

构建43261ms、2 warnings；仅18082部署2个文件并校验哈希、登录页200。证据 category-1-recovery-identity-{tests,build,deploy}.log。没有改正式论文、远端或其他实例。

浏览器能力再次检查仍返回 Browsers: The browser access host is unavailable；未控制用户Chrome。操作卡已写入 category-1-review.md。第1类仍未用户签收，实际浏览器演示尚未完成；不进入第2类。

## 第1类演示阻塞复核

上一轮：有进展（恢复文件名/身份修复并部署）。本轮：展示尝试受阻。CUA可初次读取Firefox新标签页；尝试导航18082/login在10秒超时并重置，重新获取Firefox窗口也超时。不能确认导航、登录或演示成功。没有使用其他自动化绕过，也没有控制/关闭Chrome。

同一展示能力阻塞已连续记录于多文件恢复、文件名身份恢复和本轮；本轮不继续创建功能或重复测试。下一步需要恢复可用浏览器控制连接，或用户通过18082反馈实际交互结果。第1类未签收，2–6类不启动。全局目标未完成。

## 自行验收：真实HTTP和实时连接（2026-11-11）

用户明确授权自行验收，无需用户配合测试；仍保留分阶段展示反馈。上一轮浏览器演示阻塞；本轮以真实协议会话获得新证据，不等同浏览器可视验收。

`category-1-live-protocol.mjs/json/log`：两个真实登录账号、三个WebSocket会话、两个独立测试分支。7项通过：独立加入；双向实时编辑收敛；个人切换不移动他人或串分支内容；新会话重连读取一致内容；错误代次写入拒绝且原文不变；撤权连接关闭且旧凭据读取/创建分支403；恢复权限后重新连接内容保留。

验收发现并修复 `services/real-time/app/js/Router.js`：WORKSPACE_EPOCH_STALE曾被序列化成通用内部错误，现在仅对白名单错误码返回固定的保存修改/重新加载提示，不泄漏原始内部错误。语法检查通过，部署到18082后真实协议返回正确code，staleErrorExplained=true。仅重启该实例real-time。

保留失败：first-attempt为脚本JSON换行比较错误；error-message为发现的产品错误；empty-event为协议脚本未兼容无参数事件。无参数事件导致脚本中断后立即恢复了测试成员，修复脚本再完整执行，最终权限恢复和重连已验证。脚本不输出密码或cookie。

未覆盖：真实浏览器离线缓冲/重连恢复窗口、页面布局和按钮交互；错误代次协议检查不能替代完整离线浏览器验收。正式论文、远端仓库和其他实例未修改。第1类尚不宣称全部完成。

## 浏览器控制故障定位

2026-11-11：用户要求自行重试现有Chrome/Firefox标签页。已重置CUA会话，并仅向精确匹配的SkyComputerUseService PID87907发送TERM；确认辅助进程由新PID66903重新启动，Chrome PID705和Firefox PID71142均未重启。20秒观测超时掩盖底层错误；延长观测后得到ScreenCaptureKit SCStreamErrorDomain -3811（audio/video capture failure）。系统日志确认TCC Allow，同时在捕获Firefox窗口68954时failed display lookup、found=0，窗口frame=(-2915,30,1440,870)。这是窗口到显示器映射/采集失败的直接证据，不能推断浏览器未启动，也不能据此断言所有权限正常或具体是哪台显示器断开。

Finder的AX状态可在1秒内读取，说明原生控制并非整体失效；Chrome/Firefox获取失败，Dock获取超时。未修改系统显示设置、屏幕权限、浏览器数据或论文内容。尚未恢复浏览器交互验收。


2026-11-12 00:30：现有Chrome/Firefox完成第1类五项主要交互场景，发现并修复分支Share成员操作ID错误（已部署18082）。协议测试漏doc导致的9条测试历史记录已备份修复，flush204；强制中断留下旧注册需显式session recovery，恢复后prepare通过。完整证据与组合场景限制见category-1-review.md最新节。两个窗口已恢复不同分支可编辑，B权限已恢复，未进入第2类、未提交推送。

## 第三类（2026-11-12）进行中

仅18082合成项目。发现并修复presence重新绑定丢失viewedCommit、过期记录占满容量阻止新连接；Graph无快照时增加明确重连提示。隐藏Graph对应文件diff，仍属历史查看，核对后保留。后端19项、前端12项通过。构建15554ms/2既有warnings，前端部署188文件校验哈希；重启18082 web/web-api/real-time。未改论文/远端。

过程纠错：首次容器测试的3个文件是旧空文件，只运行7项；复制当前文件重跑后19项。一次webpack版本查询工作目录错误、一次容器内rg缺失，仅诊断命令失败；使用已知绝对构建路径和ls继续。构建和部署本身成功。

## 第四类实施范围（用户补充：先补齐，再修复）

现有：AutoCommitService/Schedule/Worker实现保存快照提交；RemoteDiscovery实现只fetch不覆盖正文；ReviewedPull及MergeApplication实现人工审阅应用。缺少独立的自动pull/push策略和后台执行入口。

实施：增加按工作区持久化的自动同步策略，pull/push各自开关；绑定owner、remote fetch/push URL、目标分支。fetch后仅在干净工作区且可快进时自动应用，复用prepared写入与恢复日志；分叉生成共享审阅任务并暂停。推送固定候选OID、仅普通push；结果未知暂停并提供对账入口，禁止盲目定时重试。冲突/恢复/人工暂存阻塞自动任务。UI展示策略、暂停原因和任务入口。全部用合成项目及本地裸仓库验证，不能用模块通过代替浏览器验收。

## 第四类交付验收 2026-11-12

自动同步缺失实现已补齐并部署18082；双浏览器无刷新接收自动快进，后台检查点0c54016自动推送，冲突473d1011-c3fb-4d24-952a-04dfe9917bb3通知双端并阻止同步/检查点。测试本地HTTPS CGI需转发HTTP_CONTENT_ENCODING，否则较大fetch请求失败。详见category-4-review.md，保留冲突供交互。未进入第五类。

第四类复查修复：普通未提交编辑不再永久暂停同步，等待检查点后下一轮继续；discovery中断对账保留原操作ID与基线。12项检查通过，部署18082。手动暂存和冲突仍暂停，既有合成冲突保留。


## 2026-11-12 第五类

分支生命周期、设置继承、历史回退写入保护已补齐并部署18082；恢复membership缺陷及归档500已修复。15项针对性测试通过，实际归档403/恢复200、评论标签保留与编译成功。完整证据、首次失败与定点fixture修复、Firefox画面及永久删除/灾难恢复边界见category-5-review.md。未进入第六类、未提交推送。


## 第五类双浏览器互检预检

Chrome现有tab 1338389775可读取，当前工作区0c4b2aaed66f855478933cb9编辑器正常，无弹窗。Firefox运行中但cua.getApp两次30秒超时；授权过的AppleScript回退返回System Events -25211：osascript is not allowed assistive access。未绕过系统权限，未更换测试浏览器，未修改文档。互检尚未通过，未进入第六类。证据category-5-cross-browser-preflight.json。


## 第五类现有双浏览器互检完成

使用原Chrome/Firefox两位用户，锚定评论与回复双向同步、跨分支评论隔离、双端归档通知、恢复后历史标签/PDF保留、Firefox新增编辑在Chrome实时出现均已观察。修复自身归档后管理窗口误报Forbidden，以及原生确认框抑制导致无反馈；页面内确认重验通过。证据见category-5-cross-browser-review.md。本轮进入第六类改动盘点，未提交推送，未操作正式论文。


## 2026-11-12 第六类集成验收
修复取消归档误拦截与恢复审计用户ID；两文件部署18082。现有Chrome/Firefox跨分支隔离、过期合并防覆盖、冲突消解、全文一致、编译和历史检查通过。16项定向回归通过。详细证据与未验证范围见category-6-review.md。未提交/推送，未修改正式论文或真实远端。


## 2026-11-12 38项需求差距审计及G01
见gap-audit.md。识别8组缺口，备份/恢复/删除各自拆项。本轮只修共享远端管理权限，13项定向检查及原Chrome/Firefox角色互检通过。两文件部署18082；正常编辑仍双端实时同步。其余不并行展开，下一项为G02 Clone资源完整性检查。


## [克隆资源完整性] G02完成
2026-11-12：两生产文件部署18082，3项真实Git检查通过。原Chrome/Firefox拒绝不完整资源，普通分支Clone为两个独立项目并编译成功，无错误请求残留空项目。详见gap-02-review.md。G03未开始。

2026-11-12逐项交付：G03历史中断恢复、G04容量前检、G05合并编译验证分别完成实现与现有Chrome/Firefox验收。各自证据边界及失败记录见gap-03-review.md、gap-04-review.md、gap-05-review.md。下一项G06a一致性备份导出。所有部署仅18082，无实现提交推送。

G06a完成，证据与边界见gap-06a-review.md。现有双浏览器权限及下载验收通过；按用户要求自动进入G06b。

## G06 serial continuation — 2026-11-12
G06b隔离恢复关闭验收，见gap-06b-review.md。随后自动进入G06c，先完成内部删除绕过保护和未完成备份清理（gap-06c-review.md），再完成原项目之外的私有恢复库（gap-06c-vault-review.md）。部署仅18082；既有Chrome/Firefox完成所有者/协作者互检。没有提交推送，没有修改正式论文或其他实例。

整项目删除仍未开放，不能把以上子项等同G06c完成。下一步必须核对WritingAssistConversation/WritingAssistTask、DocumentDeletionReservation、NativeCommentDeletion、ProjectAuditLogEntry等原ProjectDeleter过期路径会清理的数据库内容；现有整项目备份metadata仅含正文/评论/聊天/标签，不能直接把这些持久数据全部删除。尤其个人Assistant对话带userId作用域，不能默认导出给项目所有者。需要保留原用户访问边界，再实现持久停写及级联回执。此项尚未实现/验证，G07/G08未启动。

## G07 webhook implementation (2026-11-12)
Official sources checked: https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries and https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks . Raw-body HMAC SHA256 required; GitHub delivery ordering is not guaranteed. Implementation treats each signed, repository-bound notification as a discovery wake-up only. No payload commit/ref may replace editor or branch state. Dedup by delivery plus body digest; bounded 256 receipts, older replay may cause an extra safe fetch, never rollback. Periodic checks retain missed-event coverage. Initial repository numeric identity pinned on first signed ping/push; URL and full name bound before first delivery. Config/secret rotation only owner; encrypted secret excluded from backups and removed with live repository. Local18082 cannot receive public GitHub callbacks; acceptance will explicitly use signed local HTTP deliveries, not claim production GitHub end-to-end.

2026-11-13 G08: documented read-only history evidence and pending final visible presence check in gap-08-readonly-review.md. Original B Editor role restored and verified through current Chrome Share UI. Live Chrome presence DOM captured separately; stale screenshot explicitly excluded. Native desktop currently locked (CGSSessionScreenIsLocked=Yes), so no fresh dual-browser visual acceptance claim. Existing queue unchanged.
