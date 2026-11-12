# 当前：[历史批量回退中断恢复] G03

- [x] 核对恢复入口：当前逐文件删除重建，中断无持久任务；单文件同样可能中途失败。
- [ ] 写前保存快照、逐步骤持久日志；未完成恢复阻止新Git/历史覆盖操作。
- [ ] 提供明确恢复预览/确认，重新验证正文版本；不得自动覆盖中断后的新编辑。
- [ ] 定向故障测试、部署18082、原Chrome/Firefox互检。
- [ ] 更新证据后自动进入G04容量保护（不等待用户催促）。

按用户新要求串行连续推进，所有更新以[功能名称]开头；不并行铺开实现。

# 当前：[克隆资源完整性] G02

- [x] Clone创建前、重试及导入前检查LFS指针与submodule。
- [x] 3项真实Git测试通过；两文件部署18082并核对哈希。
- [x] 原Chrome/Firefox分别验证拒绝、普通Clone成功、独立项目及PDF编译。
- [x] 证据见gap-02-review.md，保留两个新项目展示；G03尚未开始。

沿用expression-skill、planning-with-files、daily-coding；只使用合成仓库，不修改真实论文/远端。

# 当前：38项需求差距审计，按单项实现与双浏览器验收

- [x] 对照38项需求生成gap-audit.md：8组剩余工作，备份/恢复/删除拆为3个独立项。
- [x] 已逐项向用户列明；只实现G01共享远端管理权限。
- [x] G01部署18082，13项检查通过，Chrome所有者成功/Firefox编辑者拒绝，编辑仍实时同步。下一项G02尚未开始。

不扩大并行任务，不操作正式论文/真实远端，不无差别提交既有改动。沿用 expression-skill、planning-with-files；以下为历史记录。

# 第六类：最终验收与交付整理（当前）

本轮执行顺序（用户授权先补齐再用原Firefox/Chrome互检）：
1. 核对现有路由和前五类证据，修复发现的功能缺口，不把设计阶段P6与当前交付第六类混为一谈。
2. 部署18082，双窗口验证恢复后的同分支编辑、跨分支隔离和项目恢复入口。
3. 验证共享合并/冲突任务与过期防覆盖、保留本地恢复内容；补足最终证据矩阵。
4. 列出已验证、缺失及明确禁止的操作，整理交付文件范围；不无差别暂存现有924项改动。

已修复并双端验收：旧报告把 POST /Project/:id/restore 误认为删除项目灾难恢复；真实代码仅清除 archived 标记。该入口曾被工作区保护层误拦截，现已修复并部署18082。永久删除仍不可冒充完整灾备恢复。

- [x] 第五类原Chrome/Firefox互检通过，修复归档误报及确认框无反馈。
- [x] 盘点当前改动数量，保留现有工作树；见category-6-inventory.json。
- [x] 汇总前五类证据、未验证及被阻止的生命周期边界，见category-6-review.md。
- [x] 完成限定集成互检及两文件部署记录；源代码尚未提交/推送。

本轮第五类双端证据见category-5-cross-browser-review.md；未提交/推送。

当前结论：第六类限定集成验收通过；双端正文5843字节且哈希相同，过期合并拒绝、冲突消解、编译、历史均有证据。永久删除/灾备及在线AI仍有明确限制，不宣称全生产场景完成。以下为历史记录，不作为当前进度。

# 双浏览器第五类互检（已完成本轮交互范围）

- [x] 原Chrome/Firefox窗口可操作，A/B两位用户确认。辅助功能在本轮恢复可用。
- [x] 同分支评论双向交互、跨分支评论隔离；双端历史和编译显示已核对，存储隔离沿用第五类接口证据。
- [x] 双端归档通知、恢复后内容保留及实时编辑通过。
- [x] 修复归档误报和原生确认框抑制并重验，已进入第六类。

仅18082合成项目，不操作正式论文。沿用expression-skill与planning-with-files。

# 第五类：先补齐生命周期功能，再修复（2026-11-12）

- [x] 核对评论、历史、编译设置/结果、归档、恢复的已有实现和缺口。
- [x] 补齐分支生命周期接口与必要界面入口，保持授权/防覆盖边界。
- [x] 修复缺陷并执行针对性隔离、恢复验证。
- [x] 部署18082并验证Chrome及实际接口；Firefox最终画面读取失败，未算作通过。
- [ ] Firefox最终恢复画面、锚定评论完整交互及整项目灾难恢复尚未完整验收。

见category-5-review.md；本类基础功能已补齐并修复，不宣称所有生命周期场景完成。

仅合成测试项目；保留第一至四类及全部既有脏改动，不进入第六类、不提交推送。

# 第四类修复复查（2026-11-12）

- [x] 修复未提交编辑导致自动同步永久暂停；手动暂存、冲突仍暂停。
- [x] 修复发现阶段中断对账遗漏原任务；保留原始远端变化基线。
- [x] 定向测试、部署18082并核对浏览器设置及原冲突现场。

保持现有论文和测试冲突不变，不进入第五类、不提交推送源码。

# 当前任务：第四类——自动任务、检查点与冲突联动（2026-11-12）

用户授权继续第四类。范围限定18082合成项目；远端操作使用本地测试裸仓库，不写用户真实远端。

- [x] 核对自动提交、远端发现、拉取/推送及任务通知的现有实现和开关。
- [x] 先补齐独立自动拉取/推送策略、持久后台执行、结果对账和UI入口。
- [x] 再统一修复重复执行、冲突阻塞、过期配置/权限、失败恢复中的实际缺陷。
- [x] 用隔离Git远端验证检查点、远端更新、冲突暂停及重试，不覆盖在线编辑。
- [x] 部署18082，用现有Chrome/Firefox展示任务与冲突状态，记录完成与限制。

沿用planning-with-files和daily-coding，保留前3类及其他既有改动；不自行进入第五类或提交代码。


第四类已补齐实现并部署18082；53项组合检查通过，追加恢复检查后自动同步9项通过。Chrome/Firefox现场验证自动快进、检查点、自动推送、冲突通知和暂停。完整证据及限制见category-4-review.md。保留冲突现场供用户交互，不进入第五类。

以下为前类记录：

# 当前任务：第三类——Graph协作者位置与断线同步（2026-11-12）

用户明确要求继续第三类。仅使用18082、既有合成项目和Chrome/Firefox；保留第二类改动，不提交、不推送。

- [x] 核对服务端presence、Graph渲染、断线失效与重连逻辑。
- [x] 修复定位、历史查看、多会话、陈旧状态中的实际缺陷。
- [x] 针对性检查及双浏览器验证：跨分支未推送位置；查看历史不改变编辑位置；多标签页；断线/重连状态恢复。
- [x] 部署18082、展示结果，记录准确范围后等待反馈，不进入第四类。

验收范围：31项检查通过；Chrome/Firefox跨分支、历史查看、多标签页与离开/重入通过。异常离线经过超时才更新，未宣称所有网络条件的无刷新重连完成。见category-3-review.md。等待用户反馈，不进入第四类。

以下为上一类记录：

# 当前任务：第二类——防覆盖事务与中断恢复（2026-11-12）

用户已明确要求继续第二类。第一类保留已有现场验收记录。本轮仅在18082及合成测试项目工作，不推送、不改正式论文。

- [x] 核对合并、AI、Shell写回的版本检查、事务状态和下游写入，列明四项验收证据。
- [x] 修复下游写入时租约已失效仍可写入，以及恢复已完成但收尾失败后的重复恢复问题。
- [x] 验证旧请求拒绝、恢复幂等；增加真实暂停进程和独立临时Redis重启检查。
- [x] 部署四个生产文件到18082，核对SHA-256；现有Chrome/Firefox完成过期Shell草稿防覆盖演示。
- [ ] 用户交互反馈及本类确认；未进入第三类。

本次四项验收：合并并发编辑、AI/Shell过期草稿、旧写入中断后失效、重复恢复幂等。模块/集成测试94项通过；另有独立Redis重启检查和双浏览器Shell演示。证据层级及未覆盖范围见 [category-2-review.md](category-2-review.md)。这些结果不代表所有存储故障组合或在线AI生成都已端到端验收。

以下为历史计划：

# 当前执行约定：六类顺序交付，逐类交互确认

用户最新要求：每一类完成后，先在18082展示实际操作，收集用户反馈并修正，再进入下一类。此前的并行推进方式停止；已有实现保留，不倒退。仅处理阻止当前类展示的跨类缺陷，其他发现归入后续相应类别，不增加新的交付类别。

| 顺序 | 交付类别 | 当前状态 |
|---|---|---|
| 1 | 分支隔离、权限及离线重连 | 当前唯一实施重点；已有基础，尚未完整验收/用户确认 |
| 2 | 防覆盖事务、中断恢复 | 保留已有实现，待第1类确认后收尾 |
| 3 | Graph协作者状态与断线同步 | 保留已有实现，等待前类确认 |
| 4 | 自动拉取/推送、检查点、冲突联动 | 保留已部署Pull及自动提交，等待前类确认 |
| 5 | 评论、历史、编译、归档与恢复 | 等待前类确认 |
| 6 | 完整多用户验收、提交和最终部署 | 等待前类确认 |

第1类展示必须包括：
1. 同一项目两位用户同分支编辑，内容实时一致。
2. A切换分支不改变B正在编辑的分支；两分支修改分别保留。
3. 同一用户多标签页分别处在不同分支，不串内容。
4. 断线期间的本地修改重连后不静默覆盖新内容，有明确恢复入口。
5. 撤销编辑权限后旧页面/请求不能继续写入；恢复访问后状态明确。

每类交付：在18082提供可用入口和可见演示；报告本类完成项、未完成项及必要限制；等待用户实际交互反馈；修正后明确请求本类确认，不自行视为已确认。界面无法展示时如实报告展示阻碍，不用模块测试数代替交付。

以下为原实施历史，保留证据，不代表仍按历史顺序推进。

# Git collaboration implementation preparation

Original order: organize requirements, commit the baseline, then derive the implementation plan. A later explicit request authorized pushing the baseline and plan; that push is complete.

- [x] Inventory current code and exclude dependencies, secrets and generated runtime/build material from the checkpoint.
- [x] Record confirmed requirements, implemented features and known gaps in requirements.md.
- [x] Verify the checkpoint and create a local implementation commit.
- [x] After the checkpoint, analyze branch identity, document storage, realtime rooms, history, compile, permissions and lifecycle routes.
- [x] Produce implementation-plan.md with migration, operation semantics, acceptance gates and phased delivery.

Execution boundary: preserve running projects, manuscripts and unrelated local artifacts. Do not enable automatic sync or change production workspace identities during the baseline commit/design pass. This task record distinguishes design from implemented behavior.

Baseline committed: af4096d,941 files. After-commit design complete in implementation-plan.md; implementation stages P1–P6 are not marked complete and are not enabled. The original design pass did not migrate live data. The baseline and original plan were subsequently pushed with explicit authorization.

## Authorized implementation run

The user now explicitly requests implementing P1–P6 and multiple-user integrity tests. Prior baseline/design commits were subsequently pushed to origin/feature/writing-assist. Preserve user's project data; use synthetic acceptance projects/users. No further push requested.

- [ ] P1: workspace registry/storage identity, inherited authorization, internal project filtering and control-operation guards.
- [ ] P2: per-session branch joining, isolated documents/history/compile, stale/offline session protection.
- [ ] P3: version-guarded collaborative changes, merge and Shell/AI draft reconciliation.
- [ ] P4: real-time per-session graph presence, separate edit/view positions.
- [ ] P5: durable project/branch automation with conflict/recovery gates and ownership.
- [ ] P6: comments/history/settings/archival/recovery lifecycle and migration compatibility.
- [ ] Multiple independent browser users, same/different branch tests, concurrency and interruption acceptance.

Initial safety gates: preserve default project IDs and data; feature disabled until synthetic isolation tests pass; automatic pull and AI writeback disabled until anti-overwrite acceptance passes.

## Discussion consolidation (2026-11-11)

- [x] Separate server-local branches, remote-tracking refs, live edits and collaborator presence.
- [x] Define external push discovery, fetch/apply separation, and local-deployment polling fallback.
- [x] Define shared conflict notification, resolver lease, stale-resolution validation and recovery states.
- [x] Consolidate 28 risks and map them to P1–P6 and eight acceptance groups.
- [x] Update README/requirements/plan status to match partial implementation and real test evidence.

Historical checkpoint before the verified progress below: foundational P1/P2 changes exist; native tests11 pass. Four synthetic users authenticated and same-branch A/B edits converge. Cross-branch initialization has a403 rejection still to locate. No phase is marked fully accepted. Native graph invalidation was added after the144-test frontend run and needs its own verification. Next code step: locate initialization rejection, complete independent-workspace browser acceptance, then P3 transaction/conflict service. This document consolidation does not authorize declaring later phases complete.


### Verified progress after consolidation

- [x] Locate initialization403 and correct internal-storage TPDS export boundary.
- [x] Correct realtime join to inherit parent permissions without granting access to preparing storage.
- [x] Run10 real-browser isolation/access/revocation scenarios with four accounts.
- [x] Run41 related platform unit tests; preserve failures and tested source hashes.
- [ ] Next: offline/stale-operation tests and P3 mutation/merge-draft coordinator; P1/P2 full completion still requires their remaining gates.

Previous goal turn classification: progress (durable consolidation). This continuation: progress (platform fixes plus new multi-user evidence). No external/user blocker; keep all six phases active.

## Current documentation request

Scope: consolidate the conversation and additional failure cases into implementation points and one plan. Preserve existing source changes and acceptance artifacts; no new implementation/deployment claims in this documentation pass.

- [x] Read existing requirements, implementation points, plan and recorded acceptance evidence.
- [x] Consolidate earlier UI/command requirements and distinguish generic Git from Overleaf integration.
- [x] Add overlooked concurrency cases and map each to implementation stages and acceptance.
- [x] Verify numbering, local links and document consistency; report changed files.

Documentation verification: W01–W34 are unique and continuous; relative Markdown links in the six changed documents resolve. Existing acceptance JSON contains10 passing checks; no tests were rerun in this documentation pass.

## P3 merge draft implementation checkpoint

Previous goal turn: progress (discussion consolidation updated authoritative requirements/plan). This goal turn: progress (isolated merge draft service, command dispatch and29 passing targeted tests). Goal remains active; no phase is declared complete.

- [x] Durable task records with atomic rename/fsync and workspace scope checks.
- [x] Native Git merge runs in a separate locked worktree, preserving live documents/HEAD/index.
- [x] Task revision and actor/session lease generation guard conflict resolution.
- [x] Stale document versions, source refs and index invalidate previews; cancelled/failed drafts retained.
- [x] Validated merge-draft command schemas and runtime dispatch; invalidation broadcasts added.
- [x] Native Git/service/handler regressions:29 pass; initial source-deletion failure preserved.
- [ ] Validate runtime endpoints in the isolated application; connect task UI and shared notifications.
- [ ] Implement recoverable document/ref application with epoch/fencing and offline acceptance.
- [ ] Implement explicit interrupted-draft reconciliation, then full P3 multi-user/fault-injection acceptance.

Automatic live apply and AI writeback remain closed. No commit, push or deployment in this checkpoint.

## P3 application checkpoint

Previous goal turn: progress (draft implementation and29 tests). Current turn: progress (transaction-scoped adapter, journaled application coordinator and fault tests). Full objective remains active.

- [x] Add lease-checked project transaction capability and per-file write boundaries.
- [x] Add journaled merge application with document snapshots, epoch adapter requirement, Git ref CAS and pending-export block.
- [x] Verify native Git + modeled transaction failures and adapter calls; host57 pass/3 skipped, then all4 live Redis gate tests pass.
- [ ] Implement explicit recovery/reconciliation and durable snapshot-directory handling.
- [ ] Wire persistent epoch and stale-session rejection through realtime/document queues, then enable the application endpoint in the isolated fixture.
- [ ] Complete multi-user application/conflict UI acceptance and all remaining P1–P6 gates.

The coordinator is not exposed to users yet. It cannot be enabled without the real epoch adapter and offline/anti-overwrite acceptance. No commit/push/deployment in this checkpoint.

## Active recovery implementation plan

Previous goal turn: progress (coordinator and fault evidence). Continue P3 without enabling production application.

- [x] Persist directory-flushed snapshots and document checkpoints for recovery.
- [x] Implement explicit recovery preview bound to current doc identities/versions, epoch, HEAD and index.
- [x] Resume only verified checkpoints; provide an explicit preserve-current escape path for ambiguous partial writes.
- [x] Test interrupted phases, stale recovery previews, external ref/index movement and repeated recovery.
- [x] Record evidence and remaining session/epoch/UI integration requirements.

Recovery checkpoint:62 targeted tests passed,0 skipped. Tests cover native Git plus modeled document transactions and separate adapter tests; they do not establish live browser recovery. No new external blocker. Continue with persistent workspace epochs/session admission, then runtime endpoint and UI acceptance. P1–P6 remain incomplete overall.

## Epoch admission foundation checkpoint

Previous goal turn: progress (recovery service and62 tests). This turn: progress (persistent epoch adapter, atomic Redis admission and realtime validation; tests below). No phase is marked complete.

- [x] Add opt-in project fence flag/epoch, database CAS adapter and monotonic Redis mirror.
- [x] Block Redis admission before changing the database epoch; mirror failure must remain fail-closed.
- [x] Compare session epoch with edit metadata; atomically check current epoch and write lease before queue insertion.
- [x] Verify151 realtime unit tests;5 epoch tests against isolated Redis; host6 pass/3 Redis cases skipped and separately covered.
- [ ] Bind epoch to browser document creation (never overwrite it on reconnect), hydrate it on authorized joins, and retain rejected pending edits.
- [ ] Revalidate/quarantine stale queued operations at the document-updater consumer and drain queues before epoch advancement.
- [ ] Activate only the synthetic fixture and exercise actual offline reconnect and application/recovery UI.

Flag gitWorkspaceFenceEnabled defaults false. Nothing was activated or deployed. Application/AI auto-write gates remain closed.

## Browser epoch and queued-operation checkpoint

Previous goal turn: progress (epoch admission foundation). This turn: progress (document-bound epoch, reconnect preservation, queue quarantine and tests).

- [x] Hydrate enabled epochs on authorized project join and return them with the model/doc join.
- [x] Bind ShareJsDoc to its initial epoch; reconnect compares before catch-up and never relabels old operations.
- [x] Preserve stale-session text before pending/inflight cleanup, through the existing editor recovery error path.
- [x] Atomically separate stale queued operations into recovery storage before trimming; continue only matching operations.
- [x] Verify frontend4, consumer51, realtime151, web41 and isolated Redis7 tests.
- [ ] Activate/update only the synthetic fixture and run real offline/reconnect/application scenarios.
- [ ] Add authenticated recovery-queue retrieval and durable retention/export UX; validate Redis failure/restart durability.
- [ ] Complete prepare barrier, runtime application/recovery endpoints, shared task UI and all remaining phases.

The fence flag remains off. Component tests do not complete multi-browser offline acceptance.

## Isolated epoch browser acceptance

Previous goal turn: progress (browser/queue source and component tests). This turn: active fixture integration and real browser evidence.

- [x] Compile changed frontend locally; avoid large Docker build with limited disk headroom.
- [x] Deploy/hash-check only task-owned18082 fixture files and restart its four relevant services.
- [x] Enable epoch fencing only on the synthetic fixture root; execute5 two-browser reconnect/recovery/resume checks.
- [x] Re-run the existing10 four-account branch/permission checks with the updated fixture.
- [ ] Freeze artifacts and identify remaining acceptance gaps.

The first reconnect test was too permissive (matched a reconnect banner); it is retained as an invalid acceptance attempt. The corrected test requires the out-of-sync modal, opens its local-text textarea, validates the text, then reloads and verifies new edits propagate.

## Discussion consolidation — 2026-11-11

Scope: consolidate the user conversation and additional risk analysis into the existing implementation documents; preserve ongoing source changes and earlier evidence.

- [x] Read the existing requirements, risk register and six-stage plan.
- [x] Add missing concurrency/backup/migration cases with explicit implementation and acceptance mapping.
- [x] Reconcile historical acceptance statements with the latest retained failure evidence.
- [x] Verify document references and risk identifiers; report documentation-only changes.

Documentation validation: W01–W38 appear once each in sequence; local Markdown links checked. Application source and test artifacts were not modified in this consolidation pass.

## Dark theme steering — 2026-11-11

- [x] Inspect Source Control, Plugins and References styling and existing theme tokens.
- [x] Replace non-themed semantic colors and fixed state surfaces; keep layout unchanged.
- [x] Validate light/dark rendered panels and compile frontend.

Epoch fixture overlay deployment completed (54 files hash verified). Branch/reconnect reruns remain pending while handling the reported theme regression.

Final checkpoint: all three panels checked in both themes using source CSS; final webpack production build succeeded with2 warnings. Epoch reconnect rerun completed5 checks with no page errors; four-account rerun10 checks passed. Full goal remains active; next required work is the prepare barrier and application/recovery integration.

## Exclusive document queue drain

Previous goal turn: progress (theme source correction and repaired multi-user/epoch evidence).
- [x] Drain all queued batches under the document lock before a token-bearing read/write.
- [x] Reject expired privileged queue consumers rather than consuming after their lease disappears.
- [x] Test multi-batch, no-progress and lease-loss behavior; retain unchanged ordinary editing behavior.
- [x] Validate on isolated Redis and record remaining prepare-barrier/UI work.

Queue-drain checkpoint:55 document consumer unit tests and8 isolated Redis epoch tests passed. Ordinary reads retain their bounded batch behavior; exclusive Git reads/writes drain accepted updates and recheck the lease before invoking the document operation. No production deployment. Remaining: browser prepare acknowledgements, project-wide barrier/queue integration acceptance, durable rejected-edit retrieval, application/recovery endpoints and UI, plus remaining P1–P6 requirements.

## Live queue drain acceptance

- [x] Update only the isolated document-updater code and verify deployed hashes.
- [x] Seed25 legitimate sequential OT operations in the synthetic document queue under an exclusive lease; read through the real HTTP adapter and check bytes/version/empty queue.
- [x] Record live evidence and remaining browser prepare barrier requirements.

Live queue checkpoint:25 real queued operations applied in full before protected HTTP read; exact text/version verified. Reconnect regression5 functional checks passed after revealing CodeMirror virtualized tail content, but3 page-level Internal Server Error messages remain unclassified; this is not a clean browser acceptance. Failure artifacts retained. Next: classify these errors, then implement durable prepare membership/acknowledgement before application endpoints.

## History contract correction

- [x] Trace page errors to project-history: injected fixture edits omitted doc ID.
- [x] Preserve and repair only the malformed synthetic history entries; correct fixture generator.
- [x] Re-run queue drain plus history flush and browser acceptance with detailed error capture.

History correction checkpoint: malformed fixture updates repaired with original records retained; corrected queue+history test passed. Browser5 checks passed with no uncaught page errors and no captured history/Git5xx; separate writing-assist requests still fail because fixture AI services are unconfigured. Full goal remains active.

## Shared preparation acknowledgements

- [x] Implement Redis-shared operation/epoch/session acknowledgement state, sticky failure, server deadline and single claim.
- [x] Verify multi-worker confirmation, stale identity, negative acknowledgement, expiry and missing state.
- [ ] Integrate authoritative realtime session membership/join admission and browser buffer acknowledgement before exposing merge application.

The primitive is not a write lease and is not yet enabled in runtime. Membership cannot be supplied by public clients or inferred from cursor presence.

Preparation checkpoint:4 actual Redis tests passed with separate worker connections and0 skipped. Previous turn was progress (history fixture correction); this turn adds shared preparation state plus executable race/failure evidence. Runtime membership and client acknowledgement are still required; do not expose application based on this primitive alone.

## Browser preparation integration

- [x] Bind preparation requests to current project/epoch and synchronously pause editing before buffer flush.
- [x] Keep pause until exact completion; reject overlap, unsaved/failed/expired requests; cancel on disconnect or context disposal without clearing content.
- [x] Verify acknowledgement order, timeout, stale identity, overlap and disposal using the bound handler.
- [ ] Connect authenticated realtime acknowledgements and authoritative membership before runtime application.

## Atomic membership and claim revalidation

Previous goal turn: progress (six source-style browser states revalidated).
- [x] Verify atomic server registry admission/preparation snapshot with independent Redis workers.
- [x] Revalidate claimed preparation against membership, deadline and authoritative epoch mirror.
- [x] Accept late negative acknowledgements as sticky failure after claim.
- [x] Run real Redis tests:12 passed,0 skipped.
- [ ] Wire authenticated realtime membership/acknowledgements and invoke revalidation under the application write lease.

The registry must be bootstrapped with admission closed; missing state must not be silently reinitialized. Crashed-worker sessions still require explicit reconciliation. No runtime preparation enablement or production deployment in this checkpoint. Full P1–P6 goal remains active.

## Authenticated realtime preparation wiring

Previous goal turn: progress (atomic registry and post-claim invalidation with12 Redis tests).
- [x] Add default-off project preparation flag, exposed only for fenced workspaces.
- [x] Register server socket identity before project room admission; clean up disconnect/room-admission races.
- [x] Reject document join/update during pending registration.
- [x] Receive preparation acknowledgements using authenticated context, never client identity fields.
- [x] Validate controller regression suite:135 passed, including8 new preparation cases.
- [ ] Bootstrap/reconcile membership safely and run actual browser prepare requests across workers.
- [ ] Integrate prepare orchestration, lease and snapshot checks into merge application/recovery.

No flag enabled, runtime deployed, or external repository changed. Full goal remains active.

## Preparation orchestration

Previous goal turn: progress (authenticated realtime admission and135 controller tests).
- [x] Sequence registered preparation, broadcast, confirmations, exclusive lease and pre-action revalidation.
- [x] Release exact operation on completion/failure; retain original errors when cleanup also fails.
- [x] Add explicit opt-in `withPreparedProjectWrite` runtime adapter with persisted flags/epoch checks.
- [x] Validate7 orchestration unit cases and14 real Redis cases (12 prior +2 orchestration integration).
- [ ] Bootstrap and reconcile membership; run actual multi-browser preparation acceptance.
- [ ] Connect merge application/recovery to prepared transactions with epoch-advance lifecycle.

No production deployment or automatic application enabled. Full goal remains active.

## Real browser preparation acceptance

Previous goal turn: progress (orchestration unit and Redis integration tests).
- [x] Deploy only isolated18082 fixture;66 files hash verified (2,501,824 bytes).
- [x] Stop the sole fixture realtime process, initialize empty registry at epoch8, enable preparation for the guarded synthetic root, restart realtime.
- [x] Run two authenticated browser users through registration, save confirmation, actual read-only states, exclusive action and resumed editing.
- [x] Disconnect one participant during preparation; require failure, release surviving editor, rejoin and verify collaboration.

Result:9 browser checks passed with0 uncaught page errors; `prepare-browser-acceptance.json`. The protected callback verifies preparation while holding the real lease but does not apply a merge. Production bootstrap/reconciliation and merge epoch-transition lifecycle remain unfinished. Only fixture preparation enabled; normal instance unchanged.

## Prepared transaction epoch transition

Previous goal turn: progress (9 real two-user preparation checks).
- [x] Atomically replace old session registry only after the next epoch mirror is published; keep join admission blocked until preparation finishes.
- [x] Revalidate claims against intentional advanced epoch; refuse failed/foreign/missing-state transitions.
- [x] Provide epoch advancement inside prepared write capability; final assertion prevents swallowed transition failure from reporting success.
- [x] Route native merge application through prepared project transactions; unconfigured adapter fails closed.
- [x] Run16 Redis tests,9 orchestration tests and32 merge/adapter regression tests, all passed.
- [ ] Integrate recovery with prepared epoch lifecycle and expose reviewed application endpoints/UI.
- [ ] Validate actual merge application with multiple browser users and explicit old-session transition handling.

Source integration is not deployed in this checkpoint. Current18082 still runs prior9-check browser overlay at epoch8. Full goal remains active.

## Client notification after prepared epoch transition

Previous goal turn: progress (prepared merge adapter and epoch registry transition).
- [x] Broadcast advanced epoch after leaving the write lease, before preparation completion.
- [x] Lock old editors and capture all open-document snapshots without clearing pending operations or forcing reload.
- [x] Ignore malformed, old, repeated and other-project notifications.
- [x] Run16 frontend protocol tests and9 orchestration tests.
- [x] Compile frontend and deploy only isolated fixture.
- [x] Verify two browsers receive notification, expose recovery text and reload into the next generation.

Full goal remains active; actual document merge/recovery acceptance remains required.

Notification checkpoint:16 frontend tests,9 orchestration tests, production webpack build (2 warnings) and4 real two-user browser epoch-transition checks passed.59 fixture files hash verified. Synthetic root advanced from epoch8 to9. No merge document replacement tested yet; recovery integration and remaining P1–P6 still required.

## Prepared recovery and command dispatch

Previous goal turn: progress (client notification and4 live epoch-transition checks).
- [x] Prepare current authoritative epoch before recovery; fingerprint checked again inside the transaction.
- [x] Require transaction epoch advancement for both application/recovery; remove direct advancement fallback.
- [x] Add strictly validated apply/recovery-preview/recover command dispatch with repository policy and prepared-integration checks.
- [x] Test32 merge/adapter cases,10 handlers and10 orchestration cases.
- [ ] Validate these new commands against actual fixture HTTP/runtime and two browsers.
- [ ] Build shared conflict/recovery user interface and complete remaining P1–P6 work.

Source checkpoint only; no deployment this turn. Full goal remains active.

## Actual HTTP merge application with two browser users

Previous goal turn: progress (prepared recovery and command dispatch).
- [x] Deploy latest application/recovery source only to18082.
- [x] Prepare synthetic source branch and commit; invoke prepare/claim/apply through actual authenticated HTTP.
- [x] Fix runtime identity-function shadowing exposed by first HTTP attempt.
- [x] Verify both browsers reload merged contents, epoch advancement, clean Git worktree and cleared mutation state.

Result:4 live browser checks passed,0 uncaught page errors. Root now epoch10. `merge-browser-acceptance.json` records task/source identities; initial runtime failure and restart-readiness failure retained. Still required: live failure recovery/conflict resolution, shared UI, multi-worker reconciliation and remaining P1–P6 scope.

## Shared conflict UI and real two-user conflict resolution

Previous goal turn: progress (successful actual HTTP merge).
- [x] Create true same-position Git conflict and validate shared task/resolver ownership through real HTTP (6 passed).
- [x] Add Source Control shared-task dialog, lease claim/renewal, isolated conflict editor, apply/cancel and recovery preview/explicit actions.
- [x] Route isolated-workspace Merge selection to draft preparation; report prepared-write availability from server status.
- [x] Test8 UI cases and45 existing panel cases; production build passed with2 warnings.
- [x] Deploy only18082 and run real dual-user conflict UI clicks (6 passed,0 page errors).
- [ ] Validate actual interrupted merge and recovery UI; implement remaining multi-worker lifecycle and P1–P6 requirements.

Fixture root epoch12 after API conflict and UI conflict applications. Failed UI locator attempts retained their synthetic branches/tasks without applying. Full goal remains active.

## Live recovery after interruption and newer collaborator edits

Previous goal turn: progress (shared conflict UI and6 real browser checks).
- [x] Inject failure only in a guarded fixture process after real document writes and epoch advancement.
- [x] Resume through actual recovery UI; retain original commit and avoid duplicate epoch (6 browser checks).
- [x] Add a newer collaborator edit, verify unsafe resume disabled, explicitly preserve current content (7 browser checks).
- [x] Replace misleading legacy Retry banner for pending merge with a direct recovery-task entry; targeted UI test passed.
- [x] Finish banner build/deployment verification.

Both browser suites have0 uncaught page errors. Fixture root now epoch14; pending mutation cleared, latest collaborator text remains uncommitted after preserve-current. Full goal remains active; hard-crash/multi-worker reconciliation, automation/presence and other P1–P6 requirements remain.

Recovery banner checkpoint: production build passed with2 warnings;58-file overlay hash verified on18082. Re-ran6 live recovery checks via Review interrupted merge banner, all passed with0 page errors. Fixture epoch15, recovery finished and Git clean. Original pre-banner6-check evidence preserved separately.

## Explicit stale-session recovery

Previous goal turn: no progress (status report only); current source rechecked.
- [x] Add atomic registry recovery requiring a live exclusive write token and an advanced epoch mirror (durable advancement remains the caller obligation).
- [x] Verify lost lease, wrong generation, concurrent joins and idempotent retries against Redis (20 passed, 0 skipped).
- [ ] Integrate durable snapshot/journal, authenticated recovery command and browser recovery notification.
- [ ] Validate actual worker/process crash with multiple users.

No timeout-based session deletion or production enablement. Full P1–P6 objective remains active.

Recovery orchestration next checkpoint: implement dedicated durable task/snapshot service, retry after database advancement without a second increment, reject overlapping recovery IDs, and test failure boundaries before wiring public runtime commands.

Session recovery service checkpoint: previous turn was progress (atomic Redis primitive and20 tests). Added internal SessionRecoveryService with dedicated durable tasks, immutable snapshot revisions, one-epoch retry after publish/membership failure, overlapping-operation rejection and post-lease notification.6 service tests passed using real filesystem and injected epoch/lease adapters. Runtime endpoint/adapters and hard-crash browser validation are still pending; no production deployment.

Session recovery runtime checkpoint: wired owner-only sessionRecover/sessionRecoveryList commands, actual project write token, queue-draining project read, epoch adapter and post-lease client notification. Pending recovery records block ordinary repository-lock operations.17 handler/service tests pass; runtime syntax checks pass. Actual runtime/browser acceptance and UI entry remain pending. Pending merge/transfer plus stale membership is explicitly refused for now and needs coordinated recovery (do not claim complete crash recovery). No deployed source changes this turn.

## Coordinated merge/session recovery

Previous turn: progress (runtime command integration).
- [x] Validate pending merge identity/branch/workspace before session reset.
- [x] Durably link session epoch advancement into the existing merge journal before resolving the session task.
- [x] Allow only explicitly linked epoch in merge preview; retain document identity/version and Git checkpoint checks.
- [x] Verify resume with original commit after linked transition and reject newer collaborator edits (29 combined tests passed).
- [x] Verify failed journal linking remains pending and retries without duplicate epoch (7 service tests passed).
- [ ] Deploy backend to isolated fixture; exercise owner/editor commands, actual worker crash, shared UI entry.

Legacy pending file transfers remain explicitly refused. Full P1–P6 remains incomplete.

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

## Session recovery UI

Previous turn: progress (7 actual worker-crash browser checks).
- [x] Add recovery dialog entry to enabled branch repositories and failed-load state.
- [x] Load owner-authorized task list; resume unfinished operation ID, retain ID after network errors.
- [x] Explain reload/unsent-edit handling, require explicit acknowledgement, expose errors and manual reload.
- [x] Three frontend interaction tests passed (existing Browserslist/TimeoutNaN warnings).
- [ ] Finish production build, deploy fixture and click recovery through real browser UI.

Initial test command used an incorrect service-relative output path and exited before tests; corrected path run passes.

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

## P4 collaborator presence

Previous turn: progress (combined crash recovery acceptance).
- [ ] Implement shared session-scoped position store, monotonic snapshots, offline state and disconnect tombstones.
- [ ] Verify multi-tab identity, late packets, timeout and Redis-reset snapshot generation.
- [ ] Wire authenticated realtime/server position derivation and independent presence room.
- [ ] Add Graph positions and multi-user browser acceptance.

Presence is informational only; it never authorizes document writes.

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

## P4 Graph position presentation

Previous turn: progress (editor presence subscription and heartbeat).
- [x] Show per-session editing/history markers on corresponding commit rows.
- [x] Add participant list with dirty/branch/history/offline lastSeen and multi-tab distinction.
- [x] Locate filtered/unloaded commits by querying history, focusing row without checkout.
- [x] Six client/presentation tests pass.
- [ ] Complete production build and dedicated fixture overlay.
- [ ] Validate live multi-user presence, permission revocation and reconnect.

## P4 first live Graph presence acceptance

Production build passed with2 warnings (49880ms);75 fixture files hash verified.
Six frontend and12 backend tests pass. Deployed only18082. Three real dual-user
browser checks passed: both users see two editing positions without remote push;
closing B changes A's view to offline last-seen. Evidence presence-browser-acceptance.json/log.
Graph renders per-session edit/history markers and participant list; clicking
position locates/focuses the commit, fetching missing filtered history without checkout.
Cross-branch/multi-tab, history viewing, revocation and reset/ordering full browser
acceptance remain pending. No production/manuscript/remote changes.

## P4 cross-branch acceptance continuation

Previous status-only turn: no progress. Screenshot and source confirm the narrow sidebar hides Graph shortcuts; More changes actions retains View Git Graph. Preserve failed evidence and use the visible overflow entry in acceptance.
- [x] Rerun three-session/two-branch acceptance through history viewing and tab closure.
- [x] Record runtime branch activation overlay hash and acceptance result.
- [ ] Continue permission revocation and reconnect checks.

P4 checkpoint: seven live browser checks pass, zero page errors. Includes network-loss expiration and explicit reload restoring branch/text without duplicate online sessions. Evidence presence-branches-browser-acceptance.json/log. This does not prove transparent automatic reconnect or permission revocation. Earlier failures preserved. Full P1–P6 goal remains active; no commit/push or deployment to the original instance.

## P4 permission revocation acceptance
- [x] Open owner/root and collaborator/new branch; confirm two live positions.
- [x] Remove fixture collaborator through real owner API; verify disconnect/offline within10s and403 on workspace/Git reads.
- [x] Restore only that fixture member in finally; preserve evidence and failure logs.

Revocation measured89ms in accepted run; one child websocket closed. Fixture membership readback confirms restoration. Automatic reconnect browser run now pending; prior explicit-reload acceptance remains distinct.

P4 reconnect checkpoint: seven checks pass in presence-auto-reconnect-browser-acceptance.json/log, zero page errors. Network recovery required no test-driven refresh/navigation. Revocation and basic automatic reconnection now accepted in synthetic fixture. Remaining P4 coverage includes sidebar history intent, permission-level changes, stale/unknown state during interrupted mutations, and generation reset/order browser acceptance. P1–P6 remain incomplete.

## Offline buffer after prepared epoch transition
Previous turn made progress: revoked-member and automatic reconnect browser evidence.
- [x] Two users edit; disconnect A and retain unsent text, acknowledge newer B text.
- [x] Wait for actual disconnected session unregister, then prepare/drain B and advance epoch through current transaction path.
- [x] Reconnect A: reject stale replay, expose full local text, verify server B content and resume after explicit reload.

Offline/prepared epoch browser acceptance:5checks passed, epoch21→22. A local text recoverable; B server text preserved; stale text absent from fresh editor; explicit reload resumes collaborative edits. Two generic JSON page errors remain unattributed; failed HTTP responses are writing-assist500/503. This is bounded five-invariant evidence, not a clean whole-page or complete W17 acceptance.

## Durable local recovery snapshots
- [x] Add append-only browser snapshots scoped by user/workspace/epoch; report storage failure, never silently prune old recovery text.
- [x] Save before error teardown and on epoch invalidation; expose saved copies after reload with explicit download/removal and no automatic application.
- [x] Verify storage isolation, multiple snapshots, quota/corruption behavior and component interactions; build/browser acceptance follows.

Durable recovery checkpoint:14tests, production build and74file fixture hashes pass. Five real browser checks pass including both accounts reopening recovery copies after actual Reload editor and downloading validated JSON content/original epoch. Zero page errors in accepted run. Explicit per-document identity and multi-file/rename recovery reconciliation remain incomplete; full goal active.

## Recovery document identity
- [x] Persist original docId/name/version/epoch/content for every captured open document, including the failing document after it leaves the registry.
- [x] Keep legacy recovery entries readable; reject ambiguous duplicate IDs; expose individual file content without implicit path matching or application.
- [ ] Test same-name/different-ID recovery and version preservation; build and browser validation.

Recovery identity checkpoint:16tests passed; production build2warnings/50854ms;68fixture files hash verified.5real browser checks passed, errors[], including original docId/OT version/epoch and content in downloaded JSON and per-document UI after reload. Multi-file/rename/delete-recreate browser acceptance still outstanding; full P1–P6 goal active.

## Concurrent document failures
Inspection found that React batches setDocError to only the last failure; earlier documents can leave OpenDocuments before the effect saves them.
- [x] Capture all error content before pending-op cleanup, persist each event synchronously, then update modal state.
- [ ] Regress generic/stale failures and two consecutive documents; rerun focused recovery tests and build.
- [ ] Continue actual multi-file/rename acceptance after this loss window is fixed.

Concurrent-error checkpoint:17focused tests and production build pass.6live offline/error checks pass, including persisted original text/epoch after actual reload. This is single-failing-document browser evidence; simultaneous multi-file errors and rename/recreate remain unverified. Overall goal active.

## Multi-file and same-name recreation browser acceptance
- [x] Two same-account tabs edit different fixture documents, prepare/advance, then reload and retain two independent copies.
- [x] Rename original, create another document with old name, verify distinct ID/empty new content and unchanged old recovery records.
- [x] Verify per-document selector keeps original IDs; do not delete original content.

Multi-file checkpoint:4browser checks passed with errors[], including acknowledged doc:saved for each original file and explicit empty/editable assertion for recreated file. Evidence recovery-multifile-browser-acceptance.json/log. Same-name recreation after rename accepted; deletion/recreation and multiple failing documents in one tab remain unverified. Goal still incomplete.

## Delete/recreate identity acceptance
- [x] Extend multi-file test to delete only its newly-created second document after recovery bytes verified; recreate same name with different docId.
- [x] Verify empty replacement, unchanged backups, and old-ID text retained after reload.
- [x] Continue P5 external update discovery after bounded recovery acceptance.

## P5 remote discovery foundation
- [ ] Add explicit fetch-only operation under shared repository lock; immutable target identity and durable before/after task state.
- [ ] Retain old remote tips before rewrite/prune; classify new/advanced/rewritten/deleted refs without touching index, local HEAD or files.
- [ ] Owner-authorized runtime command and graph invalidation; test against independent local remote and dirty worktree.
- [ ] Scheduler, task listing/UI, webhook, automatic commit/pull/push remain required subsequent integration.

## P5 continuation checkpoint
Previous status turn verified the failing remote-discovery fixture; no implementation was claimed.
- [x] Create clone target before GitRepository construction and retain initial failure evidence.
- [x] Bind durable discovery tasks to initiating account; verify retry, revocation after fetch, and dirty-worktree invariants.
- [ ] Record delete/recreate six-check acceptance and discovery results before scheduler integration.

## Remote discovery verified checkpoint
Six real Git integration checks pass in remote-discovery-tests.log (0 failures): dirty files/index/HEAD unchanged despite hostile configured refmap; upstream rewrite/deletion retained; pre-fetch revocation and target mismatch rejected; operation ID bound to initiating account; post-fetch revocation retains resumable before snapshot; unavailable remote fails then retries the same durable task after restoration. Initial fixture-construction failures retained in remote-discovery-initial-fixture-failure.log. Syntax checks and git diff --check pass.
Delete/recreate recovery browser evidence is now recorded: six checks pass, errors[], in recovery-recreate-browser-acceptance.json; replacement is empty with different docId and old recovery bytes survive reload.
Remote discovery is code plus isolated real-Git evidence, not deployed/browser/runtime-route acceptance. Scheduler, task list/UI, project-wide notifications, webhook/polling, auto commit/pull/push and remaining P1–P6 gates remain outstanding. No manuscript changes, commit, push, or original-instance deployment in this continuation. Next: expose authorized task status and update notifications, then integrate project-level scheduling with ownership and cancellation checks.

## P5 shared discovery status
Previous continuation made verified progress: six real-Git checks passed. Current next steps:
- [ ] Add public discovery projection and shared list command with membership recheck inside lock.
- [ ] Exclude remote URL, account identity and retained internal snapshots from responses.
- [ ] Validate authorization changes during query and strict command input; wire UI/notifications subsequently.

## Shared remote-discovery status checkpoint
Added RemoteDiscoveryStatus.mjs public allowlist projection and remoteDiscoveryList command. Runtime rechecks named membership before lock, inside lock, and after task read; shared tasks use logical-project storage. Discovery responses now omit remote URL, credential owner and internal before/after snapshots. Tests exercise nested-field filtering, ordering, revocation at all three checkpoints and strict command schema, alongside six existing real-Git cases:10 pass,0 fail in remote-discovery-status-tests.log. NativeGitRuntime syntax and git diff --check pass.
This is helper/schema and real-Git evidence, not runtime-route/browser notification acceptance. Existing repository invalidation already covers discoverRemote; UI subscription, shared task display and scheduling still require implementation. No deployment, commit/push, or manuscript changes. Full P1–P6 goal remains active.

## Shared discovery UI
- [ ] Add status panel subscribed before initial read; refresh on repository events, focus, reconnect, and bounded status polling.
- [ ] Ignore stale responses and discard displayed tasks when access/status refresh fails.
- [ ] Test out-of-order responses and notification refresh; build before fixture deployment.

## Remote discovery UI checkpoint
Added remote-discovery-status.tsx under Source Control repositories for collaboration-enabled projects; it subscribes before the initial query, refreshes on repository invalidation/focus/online/visibility and15s visible-page status polling, and ignores old responses after newer requests or unmount. Queries only status: no periodic fetch or editor writes. Socket reconnect now emits the same local repository invalidation. Failures clear displayed task data, and malformed responses produce a panel error.
Validation:4 component checks pass in remote-discovery-ui-tests.log; combined initial3 checks plus46 existing Source Control cases passed (49 total) in remote-discovery-panel-regression.log. The initial regression failed because an old generic mock returned merge-task objects for the new query; corrected the mock to dispatch by command and retained remote-discovery-panel-mock-failure.log. jsdom CodeMirror geometry diagnostics remain in regression log; do not equate it to a clean browser run. Final production build succeeded with2 warnings in54460ms (remote-discovery-ui-build.log).
Changed production files: source-control/remote-discovery-status.tsx, source-control/source-control-panel.tsx, ide-react/context/ide-react-context.tsx. Tests: remote-discovery-status.test.tsx, source-control-panel.test.tsx. No fixture/original deployment or real manuscript edits this turn; next step is hash-verified fixture overlay and multi-user notification/status acceptance, then automatic discovery scheduler. Full P1–P6 objective remains incomplete.

## HTTPS remote and multi-user status acceptance
Previous turn completed UI,49 regression checks and final build.
- [ ] Deploy validated assets/backend only to18082 with hash verification.
- [ ] Create a task-owned HTTPS Git remote and independent external clone within fixture container.
- [ ] Verify owner discovery, editor denial, shared live status and unchanged editor content.

## HTTPS remote multi-user acceptance
Deployed only to overleaf-git-collaboration-web18082:72files/2533198bytes hash verified (remote-discovery-fixture-deploy.log). Build guard now targets remote-discovery-ui-build.log.
Guarded remote-discovery-fixture.mjs creates an independent external clone and bare remote under /tmp/discovery-status-20261111-a, adds an external-only file and pushes there. Loopback HTTPS uses a one-day certificate with endpoint-scoped sslCAInfo; TLS verification remains enabled. No GitHub/manuscript repository touched. Server process was stopped after acceptance; synthetic remote files, task records and endpoint-specific trust configuration remain for repeatability. Future fetch from those acceptance remotes requires restarting the fixture server.
remote-discovery-browser-acceptance.json/log:5checks pass,errors[]. remote-discovery-cross-branch-browser-acceptance.json/log:5checks pass,errors[]; B workspace4632e2ba3e73977fd23bdcc6 on presence-revocation-mwbx848d, A root/main. Each run verifies editor403 on discovery; owner fetches actual HTTPS remote commit; both pages show same commit; B receives socket-driven invalidation; authorized task snapshots agree without URL/owner leaks; editor content remains unchanged; reload reconstructs durable status. This validates server discovery/status/notification across two workspaces, not scheduled automation or merging incoming content.
Full P1–P6 objective remains incomplete. Next implement project-level discovery scheduling with durable policy, ownership recheck and single-flight execution, then external-change-to-reviewed-merge workflow. No commit/push or deployment to original instance.

## Durable remote discovery scheduling
Previous turn verified same/cross-branch HTTPS discovery and notifications. Implement project-owned policy under the repository lock: CAS revision, pinned remote URL/account, durable operation ID, due time/backoff and paused authorization failures. Test two contenders, crash/retry identity, disable and target changes before wiring background worker/UI.

## Durable discovery scheduler implementation checkpoint
Added RemoteDiscoverySchedule.mjs: durable CAS policy revision, pinned remote URL and actor, persisted operationId before fetch, due time, exponential retry capped1h, explicit pause on400/403/409, and disable under the shared repository lock. runDueDiscovery retains operationId across failures/restarts and does not apply editor files. NativeGitRuntime exposes owner-only configuration/status commands and a scheduled execution entry; current owner, deleted state and access policy are checked before scheduled fetch and during discovery authorization.
Added RemoteDiscoveryWorker.mjs, started once per router process only with nativeGit.enabled and nativeGit.discoveryScheduler. Scans configured logical-project directories; skips overlapping scans; shared project lock serializes due execution across processes. Publishes existing invalidation after task progress. New env setting OVERLEAF_NATIVE_GIT_DISCOVERY_SCHEDULER defaults off. No new worker enabled or deployed this turn.
Validation:16 tests pass (6 schedule cases +4 shared-status cases +6 real-Git discovery cases) in discovery-schedule-tests.log;2 worker tests pass in discovery-worker-tests.log. Covers due-time competing callers, durable running retry identity, backoff, owner/URL changes, disable/CAS, post-fetch revocation, scan scope and stop/nonoverlap. Runtime/router/module syntax and diff whitespace checks pass. Tests do not yet prove real multi-process lock behavior or background runtime integration.
Next: owner settings UI and isolated scheduled HTTPS/multi-user acceptance without an open browser triggering execution; inspect lifecycle/archive policy before broader rollout. Automatic commit/pull/push and all remaining P1–P6 requirements remain outstanding. No manuscript changes, commit/push or original-instance deployment.

## Scheduler configuration and closed-browser acceptance
- [ ] Add owner configuration UI with revision-aware save and deployment availability.
- [ ] Run focused UI tests/build, deploy only isolated fixture and enable its scheduler.
- [ ] Configure one-minute policy, close all browsers, advance independent HTTPS remote, and verify durable scheduled fetch without editor changes.

## Owner schedule UI and closed-browser acceptance
Added discovery-schedule.tsx dialog, launched from Remote update checks: owner-only policy load, remote/interval inputs, CAS revision save, explicit unavailable-server state and ability to disable existing policies even when deployment scheduling is off. Runtime rejects enabling when scheduler deployment is off. UI tests7passed; scheduler/worker regression8passed. Final production build2warnings/52130ms.72fixture overlay files/1210058bytes hash verified.
Fixture-only settings now enable the server scheduler. Real browser configured one-minute checks, awaited first scheduled completion, closed every test browser, then an independent external clone pushed3e5b957 to the loopback HTTPS remote. Without browser participation the service fetched the new tip; reopening showed it and preserved editor content. Policy disabled afterward via revision-guarded API. discovery-schedule-browser-acceptance.json/log records4passing checks,errors[],complete:true. Initial attempt hit login readiness during restart and was retained as discovery-schedule-startup-failure.json/log; HTTP200 plus email field confirmed before retry. Temporary HTTPS process stopped after disabled-policy verification.
Production changes: discovery-schedule.tsx, remote-discovery-status.tsx, NativeGitRuntime.mjs. Fixture-only changes: fixture-settings.cjs, deployment build guard, browser acceptance script/logs. Formal instance, real manuscripts and external Git repositories unchanged. No commit/push.
Remaining: real competing worker/crash acceptance, lifecycle/archive decisions, automatic commit/pull/push, remote-update-to-reviewed-merge handoff, shared conflict notifications and all remaining P1–P6 gates. Full goal remains active.

## Remote update review handoff
- [ ] Bind preparation to the displayed source commit and reject changed remote refs before exporting editor content.
- [ ] Add review actions from discovered non-deleted remote tips into shared merge tasks.
- [ ] Ensure periodic status queries bypass editor save/write-busy gating; test stale source and unchanged live contents.

## Remote update to reviewed merge handoff
Added per-tip review action in RemoteDiscoveryStatus, wired through SourceControlView to mergeDraftPrepare with the displayed expectedSourceOid. Deleted refs have no merge action. Preparation validates the source before workspace export and again before constructing the draft; retries bind expectedSourceOid to the original request. Existing application validation continues to supersede drafts when the tracked source advances/deletes, preserving the previous draft. No direct merge/apply bypass added.
Inspection also found remoteDiscoveryList/discoverySchedule periodic queries went through withSavedEditor and toggled local write-busy state. Added these queries plus fetch-only discovery/configuration to the no-editor-save command path; merge draft preparation still waits for local edits to save.
Verification:25 merge/draft/application/recovery tests pass in remote-review-tests.log; final extra source check covered by2 targeted pin regressions in remote-review-pin-regression.log.5UI tests pass in remote-review-ui-tests.log, including exact ref/OID handoff and absent review button for deleted tip. Production build2warnings/57929ms in remote-review-ui-build.log. Syntax/diff checks pass.
This turn changes GitCommands.mjs, MergeDraftService.mjs, source-control-panel.tsx, remote-discovery-status.tsx and their focused tests; no fixture deployment, real manuscript modification or commit/push. Browser review handoff and pending-task conflict notifications remain next; full P1–P6 goal incomplete.

## Live remote review acceptance
Deploy validated review build to18082, create a new synthetic branch from the preserved base, join two users, create a draft from remote-tip UI, then advance remote and verify stale application is refused with retained draft. Include application/recovery in repository invalidations.

## Live remote review stale-application acceptance
Deployed reviewed build to18082 only;72files/1211154bytes hash verified. Added mergeDraftApply/mergeDraftRecover to repository invalidation commands so completion/recovery/failure can refresh other project rooms.
remote-review-browser-acceptance.json/log:4checks pass,errors[]. Two accounts join newly-created synthetic branch remote-review-mwbzcc53/workspace c68d97c105c3c17b0996bff1 from preserved888b0cc base. Actual review button creates isolated draft8892f6ff-d74c-4d1c-b82a-daee101ee1ab pinned to displayed remote tip; second user sees the same task. External HTTPS remote advances; discovery refreshes tracking ref; actual claim/apply UI refuses stale preview and retains superseded draft. Both editors retain original text; both report clean working trees and current branch ref still points to888b0cc.
Initial run's final assertion incorrectly used graph[0] from all-ref history as current HEAD, failing after the first3checks; retained remote-review-head-assertion-failure.json/log. Corrected to status.branch plus refs/heads/<branch> commit; full rerun passed. Synthetic branches/drafts retained, no original documents or real external repos touched. Temporary HTTPS service stopped.
Next: proactive shared conflict/task notices without requiring opening task dialog, and successful remote-reviewed application/multi-user concurrency coverage. Full P1–P6 goal remains active; no commit/push or original-instance deployment.

## Proactive workspace task notices
- [ ] Mount notices outside selected rail panels for fenced workspaces; list authorized current-workspace tasks only.
- [ ] Subscribe before initial read, reject old responses, refresh on reconnect/focus and bounded polling.
- [ ] Open shared task resolver from notice; verify clear-on-completion and authorization failure.

## Workspace-wide conflict notification acceptance
WorkspaceTaskNotice now mounts in EditorManagerProvider for fenced workspaces, independent of selected sidebar. It queries only current-workspace mergeDraftList, subscribes before initial read, refreshes on repository invalidation/reconnect/focus/visible-page polling, discards superseded responses, clears details on failed authorization and opens the existing shared task resolver. Completed/cancelled/superseded tasks leave the active-attention list. Prepare capability is typed from existing gitWorkspacePrepareEnabled metadata. Notice uses theme variables and does not initiate merge or editor writes.
Four component checks pass; production build2warnings/54747ms. Deployed80files/2398748bytes to18082 with hashes verified. Actual two-user browser run creates distinct new source/target branches and commits different synthetic main.tex contents; both users then join target with Source Control unmounted. Conflict preparation triggers visible notice on both; B opens resolver from notice, claims/cancels draft; both notices disappear and both editor texts remain unchanged. workspace-task-notice-browser-acceptance.json/log:3checks pass,errors[], target workspace c5e887e25176155eb95cab66.
Changed source: workspace-task-notice.tsx, editor-manager-context.tsx, project-metadata.tsx and source-control.css. Tests and scoped fixture deployment/evidence under docs/git-collaboration. No real manuscript or remote modifications; no commit/push or formal-instance deployment.
Remaining: successful remote-reviewed application across active editors, explicit permission changes while request waits, additional lifecycle/automation and P1–P6 gates. Goal remains active.

## Successful remote merge across active writers
Use a new synthetic branch from preserved base; two writers prepare/apply fetched remote tip, a third tab remains on root. Verify both writers reload into new epoch and see added remote file, resume same-file collaboration, and root tab stays unchanged.

## Successful reviewed remote application across active writers
remote-apply-browser-acceptance.json/log:6checks pass,errors[]. A/B join new synthetic branch remote-apply-mwbzmqfn/workspace5bc8aa8336f87b8fca89e6f6 from preserved base. Actual remote-tip review button prepares pinned draft; both users inspect task; A claims/applies through UI. Both old editors require explicit Reload editor, then share the same new branch commit with clean status and resolved task. Both file trees show external-update.txt with exact expected external text. B edits the newly-added document and A receives it in real time. A third tab remains on root: unchanged text, unchanged current-branch commit, no reload prompt. This is explicit reload/resume behavior, not seamless editor replacement.
First run passed preparation/application but then toggled an already-open file tree closed. Screenshot confirmed hidden sidebar; retained remote-apply-sidebar-toggle-failure.json/log and corrected to click File tree only when target file is not visible. Full rerun passed. No source changes this turn: acceptance script and progress/evidence only. Synthetic merged branches and subsequent collaboration edit retained; no actual manuscript changes, commit/push to implementation repository, or deployment.
Remaining priorities: request-time authorization during waits, real competing scheduler/crash acceptance, safe Shell/AI writeback and automatic commit/pull/push, complete project lifecycle and remaining P1–P6 gates. Goal remains active.

## Authorization after queue waits
- [ ] Wrap repository/recovery lock acquisition with fresh project write/member authorization.
- [ ] Recheck shared merge list/get/conflict reads before returning data.
- [ ] Test revocation during lock wait and during task-store reads; retain mutation/recovery regression coverage.

## Authorization across waits and transaction checkpoints
Added AuthorizedOperationLock.mjs and wrapped NativeGitRuntime repository/recovery locks: recheck current write permission and named membership after acquiring the shared project lock. Shared merge list/get/conflict reads recheck authorization before returning data. Document transaction guards now verify lease, current authorization, then lease again; existing partial-write journal/recovery handling remains in place if permission disappears mid-transaction.
Validation:31tests pass in authorization-wait-tests.log (6 new queue/read cases plus25 merge/recovery regressions). Final checkpoint helper tests7pass in authorization-checkpoint-tests.log, including lease expiry during authorization lookup. Runtime/module syntax and diff checks pass.
Deployed only18082 using prior validated frontend artifact. authorization-remote-apply-browser-acceptance.json/log:6real-browser checks pass,errors[], confirming normal two-user remote review/application, new-file editing and independent root branch continue to work with authorization rechecks. This does not yet prove live HTTP revocation precisely during lock wait/partial document transfer; only controlled tests cover those timings so far.
Changed production: AuthorizedOperationLock.mjs, NativeGitRuntime.mjs, MergeDraftService.mjs. Added tests and isolated acceptance evidence; no real manuscript changes, implementation commit/push or original-instance deployment. Full P1–P6 goal remains active; next live queued-revocation and competing-worker/crash tests, then safe Shell/AI writeback and remaining automation/lifecycle.

## Live queued revocation acceptance
Guarded fixture helper holds actual nativeGitProject Redis lock and observes only contention on its exact key (no unrelated monitor data emitted). Use authenticated HTTP request with no editor pages/polling, revoke B while request is pending, release lock, verify403/no branch and restore synthetic membership.

## Live HTTP queued-revocation acceptance
Guarded queued-revocation-lock-fixture.mjs takes the real nativeGitProject Redis lock on the synthetic root, exposes only locked/contender/released signals and holds no production data. Two authenticated browser contexts stay off editor pages; B begins createBranch while lock is held. Redis contention is observed and HTTP request remains unresolved; A removes B through actual project-membership API; lock releases; B receives403 and no branch is created. Helper exits0 and member restoration is separately read back in finally.
queued-revocation-browser-acceptance.json/log:3checks pass,errors[],responseStatus403,membershipRestored:true. Initial preflight used unsupported branches command and got400 before contention; retained queued-revocation-command-schema-failure.json/log and corrected to existing GET status endpoint. This verifies real lock-wait revocation, not revocation midway through a multi-file application.
Only test helpers, acceptance scripts/evidence and progress records changed this turn; current production code from previous turn was exercised. No manuscript changes, implementation commit/push or new deployment. Full P1–P6 goal remains active; competing scheduler/crash tests and safe Shell/AI writeback remain major next items.

## W16 AI workspace identity binding
Previous status-only turn made no implementation progress. Current source audit: AI proposals compare document version/content but tasks do not persist workspace epoch; terminalOpen is gated for isolated workspaces and legacy terminals point to repository worktrees.
- [x] Persist server-captured logical project/workspace/branch/epoch identity on AI tasks and expose it with results.
- [x] Refuse epoch/identity changes across snapshot preparation and before proposal mutations; recheck current authorization.
- [x] Exercise stale epoch, missing legacy identity, snapshot races and unchanged identity with focused regression tests.
This is prerequisite identity protection, not a substitute for prepared transactional writeback. Keep Shell gate and automatic AI application gate closed; subsequent work must implement isolated Shell drafts and unified prepared transactions/recovery.

### W16 identity checkpoint evidence and remaining transaction work
Implemented WritingAssistWorkspaceIdentity.mjs, controller server-record lookup, persisted WritingAssistTask.workspaceIdentity and AgentService snapshot/pre-write identity checks plus authorization rechecks. API results carry original workspace identity. Missing old task identity is rejected for fenced workspaces; archived/preparing workspaces are refused. Create/edit/bibliography/delete paths all check before dispatch. Known pre-mutation epoch/permission refusal preserves its explicit error instead of reporting an uncertain write; deletion retries with earlier ambiguous outcome retain conservative recovery handling.
Validation:70 Node tests passed (service, goals, workspace identity), controller/model syntax and git diff --check passed. Includes changed project/workspace/branch/epoch, legacy task, snapshot race, authorization/epoch change during document read, stale create/delete paths. Initial failure retained in ai-workspace-identity-initial-failure.log: existing catch erased error identity; fixed before final run. The broader skill-plugins test could not initialize because default standalone settings omit mongo.url; excluded from the focused run, not claimed passing.
No deployment, commit/push, model calls or manuscript changes this turn. This is NOT atomic W16 completion: a race remains between the last check and mutation dispatch. Next: use existing prepared workspace barrier and project lock around acceptance, pass the lease into underlying writes, preserve durable application outcome for retries; audit every specialized task producer (citations/references/conversions) to capture identities rather than simply unblock legacy tasks. Isolated Shell drafts/export and safe transaction import still absent. Full P1–P6 goal remains active.

## W16 prepared AI acceptance
- [x] Hold the logical-project Git lock and workspace preparation/write lease around proposal validation and mutation.
- [x] Recheck server identity and authorization after lock/preparation waits; retain document CAS and proposal outcome records.
- [x] Avoid reacquiring the structure lock in reviewed deletion when the prepared writer already owns it.
- [x] Test admission ordering, stale/expired lease, denied authorization and service settlement, then assess isolated deployment/browser validation.

### W16 prepared AI acceptance evidence
Added WritingAssistWriteTransaction.mjs and wired AgentService acceptance through controller adapters: logical-project nativeGitProject lock, then existing withPreparedProjectWrite barrier and exclusive write token. Rechecks identity/permission after waits and lease before/after mutation. Existing DocumentUpdaterHandler async-context token forwarding and expected-version CAS remain in use. Reviewed deletion reuses an already-owned structure lock after asserting its lease to avoid recursive acquisition. Proposal is accepted only after transaction returns; post-action lease/release failure is classified uncertain and replay remains refused.
Focused service/goals/identity/transaction tests:80pass,0fail. Adapter regressions:27pass,18skip (Redis-dependent cases not enabled in this invocation); no claim that skipped tests passed. Syntax/diff checks pass. Deployed77files/577671bytes, hash verified, only18082. ai-prepared-write-browser-acceptance.json/log:3pass,errors[] on new workspace84e60cc382fa5a196d2858e5/ai-write-mwc0a4w3. Two authenticated users see accepted edit without reload, B's newer edit rejects old AI snapshot and stays visible on both, accepted task cannot replay. These are real HTTP/database/OT writes with a guarded preseeded proposal, NOT online model generation validation.
First browser run wrote successfully but tested only currently rendered top-of-file text; timed out because appended line was offscreen. Retained ai-prepared-write-viewport-failure.json/log and screenshot; reran after scrolling both editors to end. Fixture's automatic writing checks also logged missing API key (not this acceptance path); browser pageerror list in successful run is empty. Synthetic branches/tasks retained. No real manuscript changes, external Git push, implementation commit/push or original-instance deployment.
Remaining W16: all specialized AI task producers must capture identity; interrupted/uncertain edit/create operations need user-facing durable recovery; creation/deletion/permission/lease-loss require live multi-user acceptance; independent Shell drafts and transaction import absent. Other P1–P6 requirements remain open. Current single-text acceptance success does not prove full W16 or enable automatic pull.

## W16 specialized AI producer identity
- [x] Capture identity before citation/reference snapshots and recheck after provider work.
- [x] Derived field/claim applications inherit and verify the original review identity; never relabel old evidence with current epoch.
- [x] Pass original evidence identity to report-task creation and check it before task persistence/submission.
- [x] Wire literature/Zotero/reference controllers and run producer plus acceptance regressions.

### Specialized AI task producers: implementation and isolated tests
Audited all WritingAssist proposal-producing store.create sites. Citation preview captures server identity before reading documents; completion and report reference tasks preserve the identity from before evidence work; derived reference-field and claim-correction applications inherit the source review identity and verify it both before snapshot and before creating the application task. Literature, Zotero and reference controllers inject the server identity reader. AgentService validates internal expectedWorkspaceIdentity before task persistence, so a later tasks.create cannot silently rebind older reference evidence to a new epoch. Missing old identities still fail closed in fenced workspaces.
Validation: ai-specialized-identity-tests.log103pass,0fail (citation, reference apply, claim review, reference workspace/verification, agent service). New checks cover identity persistence, epoch/permission change during citation snapshot, epoch change during all3 reference provider modes, partial reference batch identity inheritance, stale claim/reference application, and older report evidence rejected before persistence. Nine changed production modules pass node --check; git diff --check passes. No deployment or external source/model calls this turn: source/provider responses are controlled test fixtures. Previous real browser acceptance remains evidence only for the previously deployed generic acceptance path; these new producer changes are not yet browser-validated.
Changed source: AgentController/AgentService, CitationService, ReferenceService, ClaimReview, ReferenceApply, ReferenceController, LiteratureController, ZoteroController. Updated5testfiles plus service.test.mjs, this plan and notes/evidence. No manuscript or remote repository changes, commit/push or live instance changes. Next: deploy producer adapters to18082 and exercise new bibliography creation/field application through real multi-user flow, then durable ambiguous-write recovery and isolated Shell drafts. Full P1–P6 scope remains incomplete.

## W16 specialized live acceptance
- [x] Deploy specialized producer modules to18082 only.
- [x] Use real reference-import HTTP path without enrichment to create a bibliography; both users observe it.
- [x] Use guarded synthetic reference evidence to exercise real field-apply HTTP path and stale-epoch rejection.
- [x] Verify same-branch collaborative edits persist; retain failures and separate seeded evidence from online source/model validation.

### Specialized reference browser acceptance and HTTP classification fix
Deployed specialized producer adapters only to18082. Real references/import HTTP request (enrich:false, synthetic BibTeX) creates a pending bibliography proposal with server workspace identity. Real task acceptance creates acceptance-refs.bib visible/editable by both users. Guarded ai-reference-review-fixture.mjs inserts explicitly synthetic reference evidence, constrained by fixture DB/root name/new ai-write branch; no online metadata/model result is claimed. Real references/apply HTTP path updates year on both live editors; subsequent publisher application preserves B's appended comment; B changing year2025→2026 makes the old reviewed correction fail409 rather than overwrite2026. Old-epoch review also fails409 with both pages unchanged.
First run passed3checks then exposed real HTTP classification bug: workspace guard threw plain Error, controller only recognized AgentError, so refusal became500. Preserved ai-reference-http-classification-failure.json/log and screenshot. Extracted shared AgentError into WritingAssistErrors.mjs, reexported through AgentService, and used it for all workspace identity/refusal errors. Regression explicitly checks class identity and404/409. No generic error masking.
Final ai-specialized-http-regression.log:114pass,0fail; syntax/diff checks pass. Final fixture overlay85files/630572bytes hash verified. Final ai-reference-browser-acceptance.json/log:5pass,errors[]; workspace 05891ea204f119b617ed3053/ai-write-mwc0jk4l. Prior corrected4check run also passed; final run adds actual competing field modification. Test branches/tasks retained. No real manuscript or external Git remote changes; no implementation commit/push or deployment to user's original instance.
Remaining: ordinary/create uncertain outcome recovery UI and retention, live deletion/permission/lease-loss tests, specialized claim/literature/Zotero provider end-to-end coverage, isolated Shell drafts and remaining P1–P6 automation/lifecycle. Full goal remains active.

## W16 interrupted AI application retention
Current store audit: only deletion acceptance removes expiresAt. Edit/create proposals can remain applying/uncertain while their seven-day task TTL still removes snapshot evidence.
- [x] Atomically retain edit/create task before dispatch; share retention release predicates with deletion.
- [x] Preserve all applying/uncertain operations when migrating old expiration records; never restore expiration while any proposal is unresolved.
- [x] Verify actual Mongo predicates with concurrent proposals, mixed deletion/edit tasks, and migration fixtures.
- [ ] Keep ambiguous outcomes non-replayable; follow with explicit user-facing inspection/recovery, not blind retries.

### Interrupted edit/create retention implemented and verified
Extended shared DocumentDeletionTaskRetention lifecycle: claimApplication atomically marks non-delete proposal applying, sets applicationRetention and unsets expiresAt; controller uses it before any edit/create dispatch. releaseCompleted considers ALL applying/uncertain proposals and both retention flags, so mixed deletion/edit tasks cannot release each other's evidence. Model persists applicationRetention. Migration preserves interrupted proposals before assigning ordinary TTLs; known TTL indexes are removed before rewrite because Mongo's TTL monitor runs independently from stopped web servers. Unexpected TTL policies fail without changes; interrupted migration leaves readiness false and can be rerun. Migration errors use shared AgentError503. No automatic retry of ambiguous mutations was enabled.
Actual Mongo test initially passed6checks then failed collection readiness. Preserved ai-application-retention-index-failure.log. Clarification: actual fixture collection had ONLY _id index, no compatible expiresAt TTL (initial commentary said old index, corrected after inspecting migration log). Stopped18082web+web-api and verified bothdown, ran guarded fixture-only migration, then deployed and restarted; original instances untouched. ai-application-retention-migration.log shows before/after indexes and0old application-retained tasks in that collection. Existing application data was not deleted by migration.
Final evidence: ai-application-retention-mongo.json/log7pass,including12parallel claim/release races and mixed task retention; isolated test collection ai_application_retention_acceptance_12f16b91f6f64ac08938782e0642a8e0 retained. ai-retention-regression.log86pass,0skip; syntax/diffchecks pass. ai-retention-browser-acceptance.json/log3pass,errors[],workspace 09f442d96514bec3d4db54ff: normal two-user prepared acceptance, stale snapshot refusal, duplicate apply refusal remain valid after schema/index/claim changes. These are synthetic tasks, not actual server-kill recovery or online model tests. Final source deployed only18082; no real manuscript/remote modifications or implementation commit/push.
Next: explicit read-only inspection and durable recovery disposition for applying/uncertain edit/create proposals; do not infer prior successful application merely from content equality or replay pending effects without a receipt. Existing uncertain snapshots are retained, but UI recovery remains unfinished. Shell drafts and remaining P1–P6 scope still open.

## W16 interrupted write inspection
- [x] Add owner-authorized read-only inspection for non-delete applying/uncertain proposals; compare preserved baseline/proposal with current document identity/version and workspace epoch.
- [x] Recheck permissions and observation consistency; never infer successful prior write solely from equal content or modify proposal state.
- [x] Expose inspection and downloadable recovery snapshot in task cards; keep automatic replay unavailable.
- [x] Test changed/missing/replaced/renamed documents, stale epochs, revoked access and UI behavior.
Explicit recovery disposition/receipts remain subsequent work; this step gives users inspectable evidence without mutating it.

### Interrupted AI write inspection delivered
Added WritingAssistApplicationInspection.mjs and GET task/proposal/inspection endpoint, exposed through AgentService/controller/router. Owner-scoped task lookup and project authorization before/after observation; two document observations plus epoch comparison refuse mixed snapshots. Returns baseline/proposed/current snapshots and missing/replaced/renamed/content comparison, observed time and original/current workspace identities. Always readOnly:true,confirmed:false,canRetry:false. No write/settlement/replay. Equality is not a mutation receipt. Task results include their original projectId for correct frontend routing.
New ApplicationInspection UI in non-delete applying/uncertain proposal cards: Inspect write, read-only explanation, workspace mismatch, diffs, refresh and downloadableJSON. Reinspection clears old data; abort/unmount discards late results. No accept/retry option.
Evidence: ai-inspection-backend-tests.log66pass; ai-inspection-ui-tests.log7pass; production build2warnings/48511ms; isolated deployment89files/1324647bytes hash-verified. ai-inspection-browser-acceptance.json/log4pass,errors[],workspace 0c4b2aaed66f855478933cb9: actual task card opens inspection; download parses full original/proposed/current evidence; second authenticated collaborator gets404 for owner's private task; both editors and uncertain task status remain unchanged. Fixture seeds uncertainty deliberately, not proof of hard-crash recovery.
Failures retained: initial apply_patch failed validation and made no edits; frontend test file initially used wrong working-directory path (test-path-failure log), then old fetch-mock API/HTTP-method-case assertions failed (fetch-mock-failure log), corrected against installed API. First webpack attempt used unstaged source due to relative copy path; unstaged-build log retained and excluded; copied absolute current sources and rebuilt successfully.
Production changes: ApplicationInspection backend/frontend modules,AgentService,AgentController,WritingAssistRouter,agent-task-result.tsx. Tests,guarded fixture helper/browser script,deployment list and records added. No original manuscript or remote modifications; no implementation commit/push. Next: explicit recovery disposition/transaction receipts and hard-crash tests; independent Shell draft isolation and remaining P1–P6 work still open. Read-only inspection is NOT full write recovery.

## W16 server acknowledgement journal
DocumentManager.setDoc applies OT then awaits flushDocIfLoaded/flushAndDeleteDoc. Redis mutation alone is not durable document/history completion.
- [x] Persist a server-acknowledged record after edit/create call returns, before marking accepted; bind operation/task/workspace/document and baseline/proposed hashes.
- [x] Keep application record retained on lease-release/settlement failure and expose only validated acknowledgement during inspection.
- [x] Test acknowledgement ordering, mismatched receipt refusal and no-ack ambiguity; continue toward recovery disposition/actual interruption acceptance.
This record proves a successful server call response, not complete project-history durability or resolution of crashes before acknowledgement persistence.

### Server acknowledgement journal and injected settlement failure
Added WritingAssistApplicationAcknowledgement.mjs. Successful non-delete mutation returns before recordApplicationAcknowledgement CAS persists operation/task/user/project/workspace identity, path/document/version and SHA256before/after values plus acknowledgedAt. CAS requires the exact applying proposal and no existing acknowledgement. Final accepted settlement happens afterwards. Inspection validates all binding fields/hash values before exposing a summary; it still never infers success from current byte equality or changes state. UI/download distinguish server acknowledgement from unresolved final task settlement.
Validation: ai-acknowledgement-tests.log71pass; UI8pass; production build2warnings/47622ms; deployment90files/1327758bytes hash verified only18082. Guarded ai-acknowledged-failure-fixture.mjs creates synthetic pending edit and invokes actual agentService/DocumentUpdater/preparation/DB path, injecting only accepted-status settlement failure in that helper process. Verifies uncertain status, server-acknowledged journal,applicationRetention:true and noexpiresAt. No production web monkeypatch persists.
Final ai-acknowledgement-browser-acceptance.json/log5pass,errors[],workspace 929a13f86bacf34459e059f8: BOTH active writers receive actual edit despite settlement failure; real task card opens inspection; downloadedJSON includes validated acknowledgement and snapshots; second user404; subsequent inspection/download leave text/status unchanged. Initial4check run passed; final adds explicit both-editor delivery verification. No online model calls or physical process kill in this test.
Changed production: new ApplicationAcknowledgement module, AgentController/AgentService, ApplicationInspection backend and frontend. Tests and guarded fixture/browser scripts plus deployment/progress records updated. No actual manuscript/remote changes or implementation commit/push. Remaining: explicit safe task-state recovery using validated acknowledgement, actual process termination around each journal boundary, ambiguous no-ack handling and durable history/Redis-loss verification. Shell drafts and full P1–P6 scope remain incomplete.

## W16 acknowledged task-state recovery
- [x] Add owner-authorized recovery serialized behind existing logical-project lock; reread and validate acknowledgement, CAS only task state.
- [x] Make repeated recovery idempotent; reject missing/mismatched acknowledgement, deletion protocol and revoked access. Do not write editor contents or replace newer edits.
- [x] Add explicit confirmation UI and refresh displayed proposal state.
- [x] Verify actual injected-settlement-failure recovery with two live writers and retained newer edits.
No-ack ambiguity, process-kill boundaries and complete history durability remain separate required work.

### Acknowledged recovery implementation and focused verification
Recovery service/controller/route now support owner-only task-state recovery using an exact validated server acknowledgement, serialized on the logical-project lock. Fresh reads after lock acquisition and CAS refuse changed proposals; repeated accepted recovery retries retention cleanup without document mutation. Frontend confirmation is explicit and only offered with an acknowledgement. It clears evidence on failed recovery and aborts/ignores late responses on close, unmount or task identity change. Proposal card keys include project/task/proposal identity to prevent local accepted state leaking between tasks.
Focused evidence: ai-recovery-tests.log84pass,0fail; ai-recovery-ui-tests.log8pass. New recovery service tests cover both interrupted states, missing/tampered receipt, deletion exclusion, noncompleted task, changed epoch binding, owner scoping, permission revocation while queued, stale receipt after lock wait, CAS refusal and idempotency. UI tests cover explicit-only POST, confirmed status, failure clearing and late response after close. node --check and git diff --check pass.
Failure retained: ai-recovery-fixture-alias-failure.log initially12pass/1fail because the in-memory receipt shared the workspace identity object with the task; corrected the test fixture to serialize/clone the receipt as Mongo persistence does. Initial frontend command ran from repository root and exited127 (wrong relative binary path); rerun from services/web passed. No production failure inferred from these harness errors.
NOT YET VERIFIED: actual Mongo recovery CAS/retention cleanup, two-writer recovery preserving newer edits, new production build/deployment, task parent-view refresh and process-kill boundaries. Recovery changes remain local/uncommitted, not deployed to18082 or the user's instance. Full P1–P6 objective remains incomplete; next checkpoint is real Mongo and two-writer acknowledged recovery acceptance. No manuscript or remote repository mutations this turn.

### Acknowledged recovery: real Mongo and two-writer acceptance
Built current frontend (ai-recovery-ui-build.log, webpack2warnings/46376ms), then deployed only18082 with91files/1332643bytes hash-verified (ai-recovery-fixture-deploy.log). Added guarded read-only ai-recovery-record-fixture.mjs and ai-recovery-browser-acceptance.mjs. Actual mutation uses existing injected-settlement-failure helper; after its acknowledged write, B appends newer text through the live editor before A inspects/confirms recovery.
Final ai-recovery-browser-acceptance.json/log:8pass,errors[],workspace 83c92c7ef7b3b81ce25b5563. Actual UI confirmation traverses owner-authorized HTTP/service/logical-project lock/Mongo CAS, updates accepted status, and repeat POST succeeds idempotently. Collaborator B receives404 for both private inspection and recovery. Mongo inspection verifies preserved acknowledgement, recorded recovery disposition, removed applicationRetention and renewed expiry. Full document SHA256 AND document version remain identical to the inspection taken after B's newer edit, proving recovery/repeat did not rewrite the document. Both browser editors retain original acknowledged edit and B's newer edit after reload. Initial8check run passed; final run adds full-content/version assertions.
This verifies the acknowledged settlement-failure recovery path, NOT no-ack ambiguity, physical process kill, full history durability, parent specialized workflow reconciliation or Shell draft support. Remaining P1–P6 requirements continue unchanged. No original instance, real manuscript or external remote touched; no commit/push. Next: resolve no-ack crash outcomes and parent workflow state, then isolated Shell draft transactions and remaining lifecycle/automation gates.

## W16 specialized workflow recovery metadata
- [ ] Persist derived reference/claim outcome metadata before dispatch, bound to proposal id and after hash.
- [ ] Apply validated outcome fields atomically with recovery settlement, including already-accepted cleanup retries.
- [ ] Test interruption before post-write bookkeeping and reject mismatched outcome bindings.
- [ ] Verify UI parent task refresh and real specialized recovery; do not equate generic recovery with completed specialized workflow.

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

## Recovery task consumers
- [ ] Share strict task/project/workspace identity matching across recovery callbacks.
- [ ] Update search, conversation, requirement-advice and goal current/history views without replacing unrelated tasks.
- [ ] Verify mismatched/late task responses and actual parent UI updates; build before deployment.

### Recovery consumers and identity-scoped parent updates
Added recovered-task.ts: replaceRecoveredTask requires matching taskId/projectId and matching workspace presence plus logicalproject/workspace/branch/epoch. Null/cleared tasks are never resurrected. Task type now declares server workspaceIdentity. Search/Literature, AgentPanel, ReferenceTools, ConversationPanel, RequirementAdvice and GoalPanel current/review/history views receive full recovery result through scoped updates. No cross-task replacement or document write is added. Goal refresh still asks the existing goal service for state; task recovery does not declare the goal complete.
Validation: ai-recovery-consumers-ui-tests.log53pass (identity mismatch matrix, search full-task recovery, inspection, conversation and requirement-advice regressions). Production build2warnings/48472ms; isolated18082deployment92files/1336549bytes hash verified. Final ai-search-recovery-browser-acceptance.json/log6pass,errors[],workspace 96dea841782f6caf2f31adca. Search panel now replaces requested-field summary with recovered summary without reload. Switching to Check shows restored remaining Publisher action; user applies it, both editors retain B's newer comment. Atomic accepted continuation remains validated by injected later-bookkeeping failure. All entry callbacks are wired; only Search/Check have this real two-writer acceptance, so do not claim every consumer has browser crash coverage.
Changed frontend: shared recovery identity helper, Task type, seven consumer files; test helper/matrix/search regression and browser entry routing updated. Existing generic and specialized backend unchanged this turn. Records updated; no original instance or manuscript/remote changes, commit or push. Still open: real claim-specific recovery, no-ack/process-kill recovery, Shell isolated drafts, automatic sync and lifecycle/P1–P6 completion gates.

## Claim recovery live acceptance
- [ ] Seed explicitly synthetic evidence on an isolated branch and invoke actual claim application with settlement failure.
- [ ] Recover in Check UI, apply next suggestion, then reject remaining stale suggestion after another writer edits.
- [ ] Verify both editors and retain failure evidence; no online-model or physical-crash claims.

### Claim recovery and missing-acknowledgement real write acceptance
Added guarded ai-claim-recovery-fixture.mjs and ai-claim-recovery-browser-acceptance.mjs. Fixture builds claim evidence with buildClaimReview from explicitly synthetic supplied text and example.invalid source, invokes actual applyClaimSuggestion/service/document transaction/Mongo, and injects only accepted settlement failure in helper process. Two authenticated users edit a new synthetic branch.
Claim acceptance4pass,errors[],workspace bb40041cd14f2158f71444f5: both writers receive first correction despite failure; Check UI recovery restores claim review and the next suggestion applies; B's subsequent edit makes third suggestion return409 without modifying either editor; reload preserves first two corrections, unchanged third sentence and B's new text. This tests supplied synthetic evidence and actual mutation/recovery, not online evidence/model generation.
Added ai-noack-failure-fixture.mjs and ai-noack-browser-acceptance.mjs. Helper invokes actual write then injects acknowledgement-persistence failure; stored task is uncertain, acknowledgement absent, applicationRetention true and expiresAt absent. No-ack acceptance6pass,errors[],workspace 049f81f6aab8bc1de50fd69e: both writers see actual successful edit; inspection/download show matching text but null acknowledgement; no confirmation button; direct recovery and repeated accept both409; other user's inspection404; task/text remain unchanged after inspection/refusals. This establishes a real ambiguity case rather than merely seeding an uncertain task.
Important remaining boundary: no-ack task deliberately stays unresolved. Equal text is not a receipt. A complete manual resolution/adjudication workflow and physical process-kill/Redis-loss recovery remain unfinished. No generic or specialized recovery full-completion claim follows from these tests. Next work must add explicit non-replaying disposition with retained evidence or stronger durable transaction proof, then Shell draft isolation and remaining P1–P6 gates.
Production source unchanged this turn; only guarded fixture helpers copied into18082, tests and progress records added. No original instance, real manuscript, online model or external Git remote touched; no commit/push. git diff --check passes.

## No-ack manual disposition
- [ ] Add owner-authorized close-without-retry, serialized under logical-project lock and bound to a freshly reviewed snapshot.
- [ ] Preserve closed-unconfirmed distinction, evidence retention and blocked automatic/specialized continuation; never mark accepted or write documents.
- [ ] Add explicit UI explanation/confirmation, stale-inspection refusal and download after closure.
- [ ] Verify actual no-ack write with two users, stale review and repeated closure.

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

## Shell isolated draft implementation
- [ ] Create durable owner/workspace/epoch-bound draft records with baseline bytes/versions outside writable container mount; retain interrupted preparation.
- [ ] Integrate terminal lifecycle with independent draft directory; persist session association and prevent duplicate/racing writers.
- [ ] Stop/quiesce before immutable review snapshot; compare current versions and import through prepared transaction with journal/recovery.
- [ ] Add UI and /git review/apply/discard actions, permission checks, real two-writer/container/Full Access validation.
Terminal gate stays closed until all dependent paths are implemented and verified.

### Shell draft durable preparation foundation
Added NativeGit/ShellDraftService.mjs. Server-owned operation UUID records bind logical project, workspace, epoch, owner and baseline file hashes/document versions/asset identities/folders. Preparation captures a consistent project snapshot, rechecks authorization/epoch, checks free capacity for two copies, persists preparing journal before filesystem writes, fsyncs independent baseline and work directories, then marks ready. Failure retains recovery-required record/files; repeated operation never recreates or overwrites a draft, including after service restart. Only work directory is intended for terminal mounting; baseline/control records remain siblings outside mount. Read/list/baseline APIs enforce owner+workspace and reject tampered baseline hashes. Public summary omits disk paths and detailed baseline data.
Validation: shell-draft-tests.log32pass,0fail (7new real filesystem cases plus25existing merge-draft cases using shared snapshot identity). Checks cover binary/nested contents and doc versions, independent copies, stale epoch before and during preparation, permission revoked while queued/after snapshot, retry and restart preserving draft edits, other-owner/workspace denial, baseline tampering, symlink collision refusal, capacity507 and invalid operation IDs. Temporary test directories are isolated and cleaned by tests. Syntax/import execution and git diff --check pass.
This is a service foundation, NOT an enabled terminal feature. No runtime routes/session lifecycle/review/import UI yet, and no Docker Full Access validation this turn. NativeGitRuntime terminalOpen anti-overwrite gate remains unchanged. No source deployed to18082 or original instance; no real manuscript/remote changes or commit/push. Next: durable terminal association/quiescence, immutable review snapshot and safe application through existing prepared transaction, then actual two-writer/container acceptance.
Exploration notes: initial guessed MergeDraft.mjs and WorkspaceEpochAdapter.mjs paths did not exist; resolved to MergeDraftService.mjs and WorkspaceEpochRuntime.mjs. Runtime epoch adapter uses existing numeric epoch service. Existing ProjectWorkspace.synchronize rewrites live Git worktree from editor, confirming it must never own the shell writable draft.

## Shell session and sealed review state machine
- [ ] Persist unique start attempt before runner call; refuse duplicate start after ambiguous response.
- [ ] Stop by persisted attempt identity and require matching positive quiescence acknowledgement before reading work files.
- [ ] Durably preserve sealed review snapshot outside terminal mount; failed stop never yields review/apply-ready.
- [ ] Implement runner adapter/container proof and runtime UI wiring after service-state tests.

### Shell draft session attempts and sealed review service
Extended ShellDraftService with start/seal/review. Start persists unique sessionAttemptId and starting state before invoking runner; matching positive startup response required. Lost/mismatched startup response retains recovery-required/start; restart cannot silently start a second process. Seal persists stopping state, asks runner by durable attempt identity (not only ephemeral terminal id), requires matching quiescent:true, then records sealing/stoppedAt. Only after this acknowledgement does it read work files and copy a fsynced review directory outside writable mount. Existing review directory is never overwritten after interruption. Review validates retained baseline/review manifests; later scratch edits cannot change sealed diff. Capacity check reserves another snapshot; failures retain phase-specific recovery records. Epoch changes prevent startup but stopping still retains the old-bound draft with observed current epoch for later safe conflict handling.
Evidence: shell-draft-session-tests.log14pass,0fail. Actual filesystem tests plus controlled runner cover persisted-start ordering, duplicate prevention, response loss/restart stop-by-attempt, false/mismatched stop acknowledgement, sealed bytes independent of work edits, unchanged original baseline, epoch mismatch retention, symlink output refusal, corrupted review refusal and review-capacity507. node --check and git diff --check pass.
Runner calls are simulated in these tests: no Docker quiescence proof yet. Existing repository-terminal-runner still closes Docker CLI asynchronously and therefore does NOT satisfy the new stop contract. New service is not wired to production commands; terminalOpen remains gated. Next required work is a runner adapter with persistent attempt/container identity and verified process/container termination, including runner-restart/lost-response tests, before runtime/review/import integration. No deployment, real project/remote edits, commit or push this turn.

## Durable shell container runner
- [ ] Record scoped attempt before docker create; deterministic container name/labels; no auto-remove or restart.
- [ ] Separate synchronous create/start acknowledgement from interactive attach; never retry ambiguous start.
- [ ] Inspect exact container identity and started state before stop; keep never-confirmed start ambiguous.
- [ ] Test state machine, then wire to authenticated runner with cross-process serialization and live Docker acceptance.

### Shell container lifecycle state machine verified locally
Previous goal turn was a status report, not implementation progress. Resumed existing durable runner work. ShellContainerLifecycle now persists attempt before create/start, binds canonical configuration SHA256, validates container labels/name/id and no-restart/no-auto-remove policies, and requires observed exited/dead state after stop. Fixed an audit finding: ENOENT from Docker inspect of an existing running record must not be mistaken for a missing durable record and permit recreation. Retry with different mount/mode/configuration or replacement container is refused. Lost start response retains uncertain record; never-started ambiguity cannot produce quiescence acknowledgement.
Evidence: shell-container-lifecycle-tests.log24pass0fail (10new lifecycle cases plus14draft regressions), durable filesystem record tests with simulated Docker. Tests cover service reconstruction, missing known container, changed config/scope/replacement, lost start response, never-started timeout, policy/label tampering, stop returning while running, concurrent identical starts. These do not prove actual Docker process termination or cross-process serialization. Remaining: production cross-process lock, bounded Docker adapter and authenticated runner wiring, real container acceptance, safe transactional import and UI. No deployment/commit/push or real manuscript/remote edits. Full P1–P6 goal remains active.

### Real Docker shell adapter and opt-in runner entrypoints
Previous goal turn made implementation/test progress. Added services/agent/src/shell-attempt-lock.mjs (Python flock holder, stable inode, bounded acquisition, EOF release), shell-docker-adapter.mjs (bounded create/start/inspect/stop without retries, separate attach). Runner adds authenticated draft-start/draft-stop only when OVERLEAF_TERMINAL_DRAFT_STATE is configured. Input actor/logical project must match authenticated request owner fields; mount is restricted to native-git/<logical>/drafts/<draftId>/work and disallows metadata/extra directories. Existing legacy terminal actions unchanged. Runtime isolated terminal gate remains closed.
Real Docker acceptance: shell-container-live-acceptance.mjs/log4pass. Uses image of18082 fixture, freshly created dedicated temporary named volume, temporary server journal and UUID container; no existing project volume mounted. Two concurrent starts return same container; inspected full-access container has network none, no privileged/bind mounts, single scratch volume, no restart/autoremove; interactive Docker attach writes proof.txt; reconstructed service stops exact container and rejects restart. Dedicated test container/volume/temp journal removed by scoped finally cleanup. This is actual Docker adapter lifecycle evidence, not runner HTTP, parent SIGKILL or full two-writer import validation. New runner routes are syntax checked, not deployed or end-to-end verified. Next: independent-process lock/death and authenticated runner restart tests, then runtime draft preparation/sealing/transactional import/UI. No original instance/manuscript/remote modifications, commit or push.

### Runner HTTP and process death acceptance
Prior turn made implementation progress. Added shell-attempt-lock.test.mjs:3pass in shell-attempt-lock-tests.log. Independent Node process holds kernel lock; competing caller times out without entering operation; SIGKILL of holder parent releases via pipe EOF; next caller succeeds using same lock inode. Callback error releases lock, separate attempt works, symlink lock target is refused without modifying target.
Added shell-runner-http-acceptance.mjs/log4pass using actual authenticated runner on ephemeral loopback port, new dedicated named volume/carrier and fixture image. Tests deny wrong token/invalid mount/other owner, repeated draft-start returns same session, real HTTP input writes scratch proof, runner SIGKILL + fresh runner with same durable state allows exact container stop, repeated stop remains confirmed, start replay rejected. Test-specific container/carrier/volume/state removed. Added runner ready IPC message and configurable host for isolated acceptance. Fixed stale owners entries when openDraft replaces same-owner terminal, avoiding return of a closed session. No production deployment or real project mounts.
This verifies runner death after a confirmed live write, not every Docker in-flight timeout window. Frontend integration, version-checked transaction import, multiwriter draft acceptance remain outstanding; isolated terminal gate stays closed. Next: connect ShellDraftService to runner via existing client and expose prepare/start/seal/review with safe import/recovery rather than direct live write.

### Shell draft runtime command integration
Prior turn progressed real runner/process tests. Added ShellDraftCommands.mjs and strict GitCommands schemas for shellDraftList/Get/Prepare/Start/Seal/Review; NativeGitRuntime constructs owner/workspace-bound ShellDraftService with logical-root drafts directory and persistent shell-draft-tasks, existing project lock/auth/epoch, and terminalRequest adapter for draft-start/stop. Fenced isolated workspace required. Runtime deliberately does not enable start until safe-import/UI acceptance; safe preparation/list/get/seal/review can be dispatched. Review overview returns paths/status/byte sizes, not all document buffers or internal manifests. Start dispatch uses server policy.mode only, no client mount/identity/mode override.
Validation: shell-draft-command-tests.log18pass0fail (4new dispatch/summary/owner mapping/start-policy tests+14service regressions). Runtime and schema syntax check, git diff --check pass. No HTTP Overleaf command-route/frontend acceptance or deployment yet. Existing terminalOpen gate unchanged. Next: bounded per-file sealed diff, transactional application/recovery, scoped terminal session controls and UI, then two-writer acceptance. No commit/push or original project changes. Exploratory TerminalClient.mjs guess was absent; actual transport is TerminalAccess.mjs.

### Sealed per-file review and Shell application foundation
Prior turn made command integration progress. Added ShellDraftReview with baseline/document-version/revision/epoch-bound SHA256 fingerprint, bounded text previews (1MiB per side), binary/invalid UTF8 metadata and hashes, absent-versus-empty distinction. shellDraftFile strict schema routes through verified sealed review; no arbitrary filesystem reads. Review overview includes fingerprint.
Added ShellApplicationService (not routed/enabled): prepared transaction checks full current snapshot identity plus epoch against baseline, validates retained manifests, journals before each write/after checkpoints, blocks repository mutation through workspace store, advances prepared epoch, leaves changes uncommitted. Interrupted transaction or settlement retains recovery-required; no automatic rollback or replay. Existing Shell startup gate stays closed until recovery service/UI and actual multiwriter acceptance.
Validation: shell-application-tests.log25pass0fail (4application+3review+4command+14draft). Real filesystem snapshots with simulated prepared transaction cover success, identical-byte but newer collaborator version refusal, revoked auth/stale fingerprint, lost write response retaining actual changed bytes and mutation block. First test fixture used structuredClone(Buffer), producing Uint8Array rejected by production validator; preserved shell-application-fixture-buffer-failure.log, corrected fixture to Buffer copies. Runtime syntax and diff check pass. No real Overleaf application/browser proof, deployment, commit/push. Next: application recovery reconciliation and explicit UI/runtime dispatch, including mutation-block settlement failures and actual two-writer tests.

### Shell application recovery and runtime dispatch
Previous turn made review/application progress. Added ShellRecoveryService: owner/workspace scoped preview binds revision/current snapshot identity/epoch/mutation owner. Resume requires exact recorded checkpoint (including versions) and original or immediately advanced epoch. Uncertain already-written bytes do not match old checkpoint and cannot resume automatically. Explicit preserve-current retains live snapshot, does not rewrite documents, advances epoch to fence old clients, journals completion and releases only its own workspace mutation. Recovery operation UUID supports completed retry without duplicate writes; failure/settlement retains recovery-required.
Added strict shellDraftApply/RecoveryPreview/Recover schemas and NativeGitRuntime dispatch. Application/recovery require prepared workspace integration and mutations require repository write policy. Startup remains closed. No UI or real Overleaf HTTP acceptance yet.
Evidence shell-recovery-tests.log7pass (4application regressions+3recovery checks): newer collaborator content survives stale-preview refusal then explicit preservation; repeat preservation is idempotent; post-transaction settlement failure resumes without duplicate document write; foreign mutation owner cannot be released. Real snapshot files, simulated transaction. Syntax and git diff --check pass. Remaining: frontend review/recovery/session controls, real multiwriter import/epoch event propagation, recovery after failure before mutation ownership acquisition, physical in-flight downstream crash/Redis tests. No deployment/commit/push or original project changes.

### Shell recovery edge cases and initial review UI
Previous turn made recovery implementation progress. Fixed pre-acquisition failure: journal prepared with no mutation owner can reacquire only when no pending transfer/foreign mutation; fingerprints bind acquisition state. Fixed preserve-current settlement failure: persistent recovery.mode prevents later resume from overwriting deliberately preserved collaborator content. shell-recovery-tests.log now9pass including both cases.
Added source-control/shell-drafts.tsx and Source Control entry. Retained drafts can refresh/select, stop+seal, inspect sealed per-file preview, apply exact reviewed revision/fingerprint, inspect recovery and explicitly preserve or resume (unsafe resume disabled). Text rendered as React text, binary/large-file previews metadata only. Startup remains gated; no new shell launch from UI yet. API/project remount resets dialog; initial list ignores stale response.
Validation shell-drafts-ui-tests.log2pass (review-before-apply exact identity and explicit preservation with unsafe resume disabled); test runner emits TimeoutNaNWarning, no assertion failures. Initial test creation used duplicated services/web path under services/web cwd and failed; corrected path and reran. git diff --check clean. UI not production-built/deployed/browser-verified yet. Next: stale async selection/action audit, distinguish shell vs merge mutation recovery notices, terminal session controls, build/deploy isolated fixture, real multiwriter application/recovery tests. No commit/push or original project modifications.

### Shell UI stale responses, recovery routing and isolated deployment
Prior turn made recovery/UI progress. ShellDrafts send now rejects responses from prior API generation, run ignores stale errors/finally, API change resets busy/selection/error. New UI test resolves an old review after switching API and proves apply controls/error cannot appear in new workspace. NativeGitRuntime.status classifies only scoped shell tasks and exposes mutationKind/canRecoverMutation without owner details. Source Control routes shell recovery to Shell drafts for owner and explains owner action to collaborators; ordinary merge recovery unchanged.
Evidence: shell-drafts-ui-tests.log3pass; shell-source-control-ui-tests.log46pass; shell-integrated-backend-tests.log30pass. Initial root-cwd frontend test attempt failed resolving frontend/js/utils/meta, corrected to services/web cwd; unrelated fixture library warnings remain in logs. Production staged build shell-drafts-ui-build.log succeeded2warnings55707ms. Updated deploy script build guard to this log. Deployed only18082: shell-drafts-fixture-deploy.log100files1397186bytes hash verified, web/web-api/real-time/document-updater restarted. This deploy includes new Shell service modules/UI but startup gate still closed. No real browser/two-writer shell application acceptance yet. Next: actual fixture draft generation + browser review/apply/recovery, scoped terminal session controls, then startup gate acceptance. Original instance/manuscript/remotes untouched; no commit/push.

### Real two-writer Shell application acceptance and live-refresh defect
Previous turn made isolated deployment progress. Added shell-scratch-fixture.mjs guarded to synthetic DB/root/shell-write-* branch/owner-ready draft; it modifies only private work/main.tex, no live document. shell-draft-browser-acceptance first run5pass, preserved shell-draft-browser-first-pass.json: other writer403 on private review; B edit makes A old draft409; new draft applied via actual Shell drafts UI and prepared transaction; both reload retain shell+B text; no mutation block and Git remains uncommitted. This is real Overleaf HTTP/OT/UI, but scratch bytes seeded by helper (not terminal launch).
Stronger no-reload test exposed real lifecycle defect: epoch advance unconditionally invokes bindWorkspaceEpochChange recover callback in editor-manager-context.tsx214-227, freezes/disconnects and shows out-of-sync modal even for clean prepared clients. Modal overlays Shell review; neither successful import nor post-epoch injected failure can continue editing without reload. shell-draft-browser-acceptance.json/log and shell-recovery-browser-acceptance.json/log retain this failure; do NOT claim live-refresh or recovery-browser acceptance passed. First no-reload attempt had ambiguous Close locator (header/footer), retained shell-draft-browser-close-locator-failure.log; corrected to modal footer before detecting actual out-of-sync overlay.
Added guarded shell-interrupt-fixture.mjs and recovery browser script; helper performs real application then injected failure after prepared epoch advance, leaves recovery-required. Recovery test also stops at epoch modal before continued B edit, no recovery UI success claimed. All processes terminal. Next priority: safe clean-session rejoin/epoch transition, preserving unsaved local documents when required; never simply suppress modal or relabel old ShareJS documents. Then rerun no-reload + recovery multiwriter tests. No original manuscript/remotes touched, no commit/push.

### Prepared clean-client epoch rejoin
Prior turn produced actual acceptance evidence and identified epoch-modal defect. Added preparation acknowledgement callback active only during frozen/saved operation; release/disconnect clears entitlement. Epoch event carries target epoch. Clean transition requires acknowledged current epoch, exactly next generation and no buffered/inflight edits. It detaches old OT instances (never relabels), reconnects transport/project metadata, force-opens a fresh document and unfreezes only after success. Unsaved/unacknowledged/out-of-order/failing transitions retain prior recovery-modal/local-text path;30second timeout returns to recovery. Connection context exposes explicit non-forced workspace reconnect; OpenDocuments refuses cleanup when unsaved.
Validation shell-epoch-transition-tests.log17pass; staged build shell-epoch-ui-build.log2warnings47796ms. Deployed only18082, shell-epoch-fixture-deploy.log100files1381929bytes hashverified. Actual shell-draft-browser-acceptance.json/log6pass,errors[]: owner isolation, stale refusal, UI apply, BOTH online editors updated without reload, reload persistence, uncommitted Git changes with mutation block cleared. Prior epoch-modal failure logs retained. Production original instance unchanged. Recovery-browser re-run currently pending; record terminal outcome next. Initial test-edit command used wrong cwd and was corrected to absolute paths; no production edit from failed command.

### Epoch rejoin acceptance outcome: normal passes, interrupted path remains defective
Normal browser6checks passed with errors[] after clean rejoin implementation. Recovery-browser re-run remains FAILED at first applied-marker visibility, before preservation. Initially suspected virtualized viewport reset and changed test to repeatedly navigate document end while waiting; failure persisted (shell-recovery-browser-acceptance.json/log), so do not attribute to locator alone. Read-only server snapshot of failed workspace main.tex confirmed version1 and appended shell-check-interrupt-mwc3uniu while browser did not show marker. This is a remaining post-epoch-throw online document refresh defect; no recovery UI success claim. Original viewport timeout saved shell-recovery-browser-viewport-failure.log; previous epoch-modal failures retained separately.
Next: inspect browser fresh-document/connection state during injected post-epoch failure, compare it with server snapshot, fix failed-transaction rejoin before enabling Shell. Also verify timeout/unmount recovery behavior and unsaved-client negative path.17protocoltests and normal6browserchecks remain valid but insufficient for P3 completion. No production deployment, commit or push; updated code remains in isolated18082 only.

### Active editor lifecycle repair
Previous turn: status-only, no implementation progress. Current diagnostic acceptance is terminal failed. Both clients report CodeMirror destroyed=true while permission/write=true, editable facet=true and fresh document bytes present. CodeMirrorView destroys the parent-owned EditorView when its subtree unmounts; the parent retains that dead instance.
- [x] Move instance destruction to the owning CodeMirrorEditor lifecycle.
- [x] Build/deploy only isolated18082 and rerun interrupted and normal two-writer acceptance.
- [ ] Record results, preserve failures, continue Shell startup and remaining P1-P6 gates.

### Editor lifecycle repair verified in two browsers
Current turn: progress. Parent-owned destruction fixed dead EditorView reuse. Updated isolated18082 only. Normal shell-draft-browser-acceptance.json6pass/errors[]/complete=true. Interrupted shell-recovery-browser-acceptance.json5pass/errors[]/complete=true: actual post-epoch failure reaches both online clients; only owner can inspect recovery; newer collaborator edit disables resume; explicit preservation succeeds; both editors remain alive/editable and continue collaborating without reload; reload persistence and mutation release confirmed. Pre-fix diagnostic failures preserved. Backend9pass18skipped (Redis fixture not configured for that invocation), build2warnings, git diff --check clean.
Remaining priority: full Shell start/input/stop/seal/review/apply UI and runner deployment on isolatedfixture, actual terminal-generated modifications rather than scratch helper; epoch transition timeout/unmount and unsaved negative acceptance; physical downstream crash/Redis loss tests, then remaining P4-P6 and broad completeness audit. Startup gate remains closed. No new commit/push or production manuscript/remote changes.

### Active Shell session controls
Previous turn: progress; destroyed-editor fix passed normal6 and recovery5 real browser checks. Next implement draft-scoped poll/input/reviewed-command/resize controls, with owner/workspace/state/epoch/policy checks and strict schemas, then connect UI and real runner. Startup remains gated until integrated terminal acceptance.

### Draft session controls and terminal UI implemented
Current turn: progress. Added strict shellDraftPoll/Input/Run/Resize schemas and dispatch. ShellDraftService.session resolves private runner ID under owner/workspace lock, rechecks project authorization, rejects nonrunning tasks, old epochs and changed permission modes before input/run/resize, enforces reviewed-mode command path, and rechecks access before returning output. Startup checks fresh policy inside lock. Poll remains available on old epoch/policy for retained output; explicit seal confirms stop.
UI now prepares and starts a draft, attaches existing GitTerminal through a draft-only API adapter, and explicitly stops/seals. Closing terminal view detaches only; dialog explains session remains running. Startup/stop failurePhase is public so uncertain attempts can be stopped from the UI. Added nativeGit.shellDrafts=false default; opt-in requires prepared transaction support; not enabled anywhere.
Evidence: shell-session-controls-tests.log22pass0fail0skip; shell-session-ui-tests.log6pass; shell-session-ui-build.log2warnings44287ms. Syntax/diff checks pass. These new changes are local, NOT deployed or integrated with actual terminal in18082 yet. Prior normal6/recovery5 browser acceptance remains for previous fixture deployment. Next: deploy scoped runner with persisted attempts and fixture-only token/endpoint, enable shellDrafts only18082, run browser-generated terminal modifications through review/apply plus concurrent B-edit refusal and stop/recovery. Do not claim startup/full Shell acceptance or P3 completion. No commit/push or production changes.

### Active real terminal acceptance
Previous turn: progress, scoped controls/UI and22backend+6UI tests. Deploy latest build only18082; run dedicated loopback47294 runner with credentials/state outside repository and enable only fixture. Exercise actual xterm input on synthetic branch with two writers, seal/apply and stale refusal. No user manuscript/remote modifications.

### Actual container terminal safe-writeback accepted in fixture
Current turn: progress. Dedicated loopback47294 runner uses persisted attempt records and private external credentials; only guarded18082 config opts into shellDrafts. Source build deployed and hashes verified. Actual xterm-generated modifications pass workspace-write8checks, Full Access10checks, auto-review10checks; all complete=true/errors[]. Full/auto tests verify actual container has only private scratch named-volume mount, no host binds/docker socket, network none. B's newer edit blocks stale A draft; reviewed fresh draft applies to both editors without reload and persists.
Policy-switch defect found/fixed: serialize revocation with starts, revoke logical project scope, stop durable attempts after runner restart before accepting new policy. Standalone real Docker restart/revocation4checks pass; full-access policy-downgrade browser12checks pass/errors[]/complete=true, including stopped container and rejected old-session input followed by preserved review/apply. Latest fixture deployment shell-revocation-fixture-deploy.log99files716014bytes. Runner remains running via run-shell-fixture.mjs (tool session2135), fixture-only startup enabled; production default remains false. No commits/push or original manuscripts/remotes touched.
Next priorities: review-mode rejection/approval details and read-only browser behavior, terminal multiple-tab/session output and lifecycle edge cases, epoch transition unmount/timeout and unsaved-client negative path, physical in-flight downstream failure/Redis-loss coverage; then remaining P4 presence, P5 automation, P6 lifecycle and W01-W38 full audit. P3 and full objective remain incomplete.

### Active multi-tab terminal correctness
Previous turn: progress, actual browser mode/revocation acceptance. Inspection finds two defects: opening a second draft closes same-owner first terminal; poll destructively empties shared output so tabs consume each other's bytes. Implement independent draft attachments and bounded cursor-based replay, preserve legacy polling semantics, validate multiple consumers and simultaneous drafts before fixture deployment.

### Multi-tab terminal repair accepted
Current turn: progress. Independent draft sessions no longer replace same-owner siblings. Bounded output ring with per-view cursor stops destructive poll loss; adapters reset cursor when reopening and ignore old attachment completions. Legacy polling retains incremental behavior. Truncation is visible.
Evidence: shell-multitab-tests.log24pass0skip; shell-multitab-ui-tests.log8pass; actual Docker shell-runner-multitab-acceptance.log5pass including simultaneous different-workspace drafts and restart/revoke both. Build shell-multitab-ui-build.log2warnings45257ms. Deploy only18082:100files1402986bytes hashverified; restart only dedicated47294 runner (now tool session2722). Browser shell-terminal-workspace-write-multitab-browser-acceptance.json12pass/complete=true/errors[]: same account's two tabs both receive complete output, closing one retains usable session, second account edit still blocks stale apply, fresh reviewed apply reaches both online editors and survives reload. No original app/manuscript/remotes changed; no commit/push.
Next: remaining read-only/reviewer rejection cases and P3 stale/offline/unmount/physical-fault gates; P4-P6 still require full implementation/acceptance. Do not equate these Shell tests with overall completion.

### Active permission-mode acceptance
Previous turn: progress, multi-tab repair accepted. Verify real browser read-only scratch enforcement and reviewed-command approval binding (foreign owner, changed command, missing approval), then record remaining phase gaps against plan. Use fresh synthetic branch only.

Permission-browser current outcome: terminal failure after3checks. Read-only scratch write refused and apply403; reviewed pwd automatic/raw input409; foreign owner403 and tampered command token409 passed. Browser explicit approval step timed out waiting for Approve this command; reason not yet established (could be stale access-mode UI/session attachment). shell-permission-browser-acceptance.json/log retain failure. Do not claim this suite complete. One synthetic reviewed draft may remain running; inspect and stop/seal it before next fixture runner restart. User requested status during work.

### Active reviewed terminal readiness repair
Previous turn: status report and failure record, no implementation change. Evidence: reviewed command remained in textarea without error or approval. execute silently returns when sessionId absent, yet submit was enabled before async attachment. Add explicit ready state, set sessionId only after active check, and generation-guard review response/error/finally. Validate delayed startup and stale callbacks, then repeat permission browser suite.

### Reviewed terminal readiness and permission modes verified
Current turn: progress. Fixed interactive review submit before async terminal attachment: ready state disables textarea/submit until active session is attached; late inactive opens cannot overwrite current session id; review responses/errors/finally are generation-guarded. Prior failed approval screenshot/JSON/log preserved.
Validation: shell-terminal-ready-tests.log8pass; staged build shell-terminal-ready-build.log2warnings57010ms; fixture-only deployment100files1403189bytes. Actual shell-permission-browser-acceptance.json4pass/complete=true/errors[]: read-only container write denied and apply403; reviewed read-only pwd automatic/raw input409; foreign owner403 and tampered approval409; before explicit UI approval actual target file absent, afterwards correct draft bytes sealed and both live workspaces unchanged. Earlier synthetic unsealed attempt was stopped through policy revocation at test start. No production changes/commit/push.
Next: P4 same-user multi-session expansion and offline-session clutter (observed297 retained sessions in fixture screenshot; store intentionally retains24h, cap1000), preserving actual per-session branch/history distinctions. Remaining P3 fault/offline lifecycle gates, P5 automation and P6 still incomplete; no phase-wide completion claim.

### Active P4 session grouping
Previous turn: progress, review readiness and permission acceptance. Implement per-user groups keyed by userId, separate live sessions from collapsed retained offline sessions, preserve sessionId and editing/history distinction, bound sidebar height. Initial edit command ran in services/web instead of repository root and failed before writing; corrected to root. Old tests from that command are not new-change evidence.

### P4 same-user grouping and offline display accepted
Current turn: progress. Collaborator list now groups by stable userId, shows distinct online session rows with branch/history identity, and collapses retained offline history labelled Last editing/Last viewed. Same display names remain separate users. List max180px avoids pushing sidebar content out.
Evidence: presence-group-tests.log8pass; build2warnings60906ms; isolated18082 deployment101files1448307bytes hashverified. presence-groups-browser-acceptance.json8pass/complete=true/errors[]: three sessions/two branches without remote push; same-user separate positions; actual browser offline descendants invisible until expanded, list height<=180; branch document isolation; history view separate; tab close; network expiry; reconnect restores branch/text and correct active count. Screenshot captured but partly obscured by unrelated shared-task tooltip, so use browser assertions as visibility evidence, not that screenshot as full visual signoff.
No new backend retention changes, original projects/remotes untouched, no commit/push. Remaining: graph node marker grouping/working-changes placement and P4 complete audit; P3 fault/lifecycle gates, P5 automatic commit/pull/push, P6 comments/history/compile/archive and migration remain uncompleted.

### Active P4 node marker grouping
Previous turn: progress, grouped list accepted with8browser checks. Node markers still render once per retained session. Group by user, editing/viewing role, connection state and dirty editing state; mark uncommitted editing as based on HEAD rather than implying saved commit content. Preserve full individual positions in collaborator list and tooltips. Verify many stale sessions do not create hundreds of avatars.

### P4 marker acceptance and active P5 automatic commit scheduling
Previous goal turn: status-only (no implementation progress). Revalidated marker browser artifact:9 checks passed, complete=true/errors[]. Fixture deploy100files1404944bytes; marker grouping accepted within that scope.
Next: implement durable per-workspace auto-commit schedule, revision/owner checks, manual-index and recovery guards, and interrupted-run pause (never blind retry an uncertain commit). Add targeted state-machine tests before any runtime enablement. Actual saved-snapshot/HEAD/index CAS executor and UI integration remain required; do not enable automatic commits until those are validated.

### P5 automatic commit schedule foundation
Progress: added AutoCommitSchedule.mjs with workspace-scoped durable policy, revision CAS under shared repository lock, owner authorization, interval validation, explicit manual-index/unsaved/conflict/recovery pause, required saved snapshot/HEAD/index identities, and persisted operation UUID before dispatch. Restarted running operations and ambiguous outcomes pause instead of blind retry. Completion-store failure preserves the operation ID; reconfiguration cannot erase pending reconciliation.
Validation: auto-commit-schedule-tests.log10pass0fail0skip, including simulated successful commit followed by persistence failure, interrupted running state, manual-index protection and revoked owner. git diff --check passed. These are state-machine tests with injected executor/store, NOT native Git CAS or real multiuser automation acceptance.
Not connected to runtime/UI or deployed/enabled. Required next work: prepared saved-snapshot executor with native Git HEAD/index CAS and explicit service author; durable reconciliation of uncertain commit outcomes; owner configuration UI/worker wiring; actual multiuser tests. P1-P6 remain incomplete. No commit/push or original project changes.

### Active P5 native commit executor
Previous turn: progress (durable schedule and10 targeted tests). Implement native candidate creation from an immutable saved snapshot, manual index exclusion, HEAD/index/branch comparison, and index.lock protection through publication. Persist candidate and before/after publication checkpoints so a crash between ref update and index installation cannot be silently retried. Validate using real temporary Git repositories. Runtime prepared barrier integration and reconciliation remain separate required gates.

### P5 native automatic commit candidate/publication foundation
Progress: AutoCommitGit.mjs builds candidate from copied saved snapshot in private temporary construction index, uses explicit service author, checks shared manual index/operation/branch/HEAD, owns native index.lock through publication and installs candidate index without overwriting working files. Durable journal callback records prepared/published/complete; update-ref uses expected old HEAD. Unknown publication retains lock/checkpoint for reconciliation. Fixed cleanup ownership so it cannot remove a subsequent operation's index.lock after installation.
Validation: auto-commit-git-tests.log19pass0fail (9 real temporary native Git repository tests +10 schedule tests). Covers saved snapshot versus newer worktree, human staging, document-version guard failure, head changes before final inspection and at actual CAS, publication journal failure, external lock, successor lock, unchanged snapshot. Initial simple-git environment guard failure preserved in auto-commit-git-environment-failure.log; fixed by allowing only module-generated private Git environment fields and explicitly using scratch working directory. git diff --check passed.
Not runtime-wired, deployed or enabled. Guard/journal remain injected contracts; real Overleaf preparation/epoch/version integration, durable reconciliation including lock ownership and late failures, scheduler worker/UI, multiuser browser acceptance still required. No production manuscript/remote changes or commit/push. Full P1-P6 objective remains incomplete.

### Active P5 interrupted commit reconciliation
Previous turn: progress (native executor and19 tests). Add durable scoped journal adapter and explicit recovery preview bound to current ref/index/lock identity. Finish index installation only for the recorded published candidate; cancel unpublished work without changing HEAD; refuse foreign locks or changed branches. Test real filesystem journal reload and repeated recovery, then connect to prepared runtime in a later checkpoint.

### P5 durable candidate journal and explicit reconciliation
Progress: added AutoCommitRecovery.mjs with workspace/owner-scoped CollaborationTaskStore journal, immutable candidate identity and state transitions. Executor checkpoint now records lock device/inode as well as index hash. Recovery preview binds record revision, branch/HEAD/index and lock identity; completes proven publication or cancels unpublished candidate without moving HEAD/rewriting working files. Foreign locks/newer heads/terminal-state inconsistency refuse mutation. Repeated completed recovery is idempotent. Index directory fsync added before completion journal.
Evidence: auto-commit-recovery-tests.log25pass0fail0skip (15 real native Git/filesystem tests +10 schedule tests), including reopened persisted journal after injected publication interruption, worktree preservation, substituted lock, scope rejection, cancellation, newer head and terminal-state restrictions. Syntax and diff checks passed.
Limits: injected failure rather than SIGKILL; caller still must own repository lock and prepared barrier. Crash before first candidate checkpoint can leave an unidentified index.lock; do not auto-delete it. Need durable startup/mutation ownership before runtime enablement, schedule settlement after explicit recovery, saved snapshot/epoch/lease integration, worker/UI and actual multiuser acceptance. No deployment/commit/push; full P1-P6 goal remains active.

### Active P5 recovery-to-schedule settlement
Previous turn: progress (durable journal/recovery and25 tests). Add explicit schedule settlement accepting only terminal, scoped persistent journal outcomes for its exact pending operation. Keep policy disabled after settlement; require deliberate reconfiguration to resume. Verify replay, stale operation/revision, foreign owner/workspace and incomplete outcome rejection. Runtime remains disabled.

### P5 recovery schedule settlement verified
Progress: settleAutoCommitSchedule checks current owner/revision/pending operation and terminal scoped durable journal outcome; clears only that operation, records settlement provenance, disables the timer and requires deliberate configure to re-enable. Exact repeat is idempotent; old settlement cannot disable a reconfigured policy or clear a newer operation. Revoked owners/incomplete outcomes/cross-workspace or cross-owner records rejected.
Validation: auto-commit-settlement-tests.log20pass; auto-commit-settlement-integrated-tests.log36pass0fail0skip (16 real native/filesystem tests plus20 schedule cases). New integrated case reloads persistent interrupted Git journal, refuses early settlement, performs explicit index recovery, settles schedule and reloads policy from disk still disabled with correct commit identity. git diff --check passed. Existing standalone recovery contracts now have schedule settlement, but runtime command/UI wiring remains absent.
Inspection confirms runtime createOverleafProject exposes prepared transactions and epoch adapter; integration must use current workspace repository binding, not default repository, and guard against session-recovery/mutation ownership. Next: durable pre-candidate lock ownership, then prepared executor service and runtime integration. No deployment/commit/push or production data changes; full objective remains incomplete.

### Active P5 startup lock ownership
Previous turn: progress (schedule settlement and36tests). Persist starting checkpoint with private inode identity before hard-link acquisition of index.lock. Retain alias through uncertain outcomes so inode identity remains verifiable. Extend recovery for starting-only interrupted operations; test physical SIGKILL after lock acquisition before candidate preparation. Runtime still disabled pending prepared transaction integration.

### P5 startup lock ownership and physical kill acceptance
Progress: executor creates operation-specific ownership file, syncs it/directory, persists starting checkpoint, then atomically hard-links index.lock and syncs directory before work. Unknown outcomes retain ownership alias, preventing inode recycling. Journal allows starting->prepared/cancelled with immutable base identity; recovery validates alias+lock inode and candidate hash (starting cancellation uses proven ownership). Unchanged snapshots journal cancellation. Terminal recovery cleans a retained ownership alias if needed. Retrying an existing ownership file returns409 and preserves it.
Evidence: auto-commit-startup-tests.log37pass0fail0skip (17 real Git/filesystem cases +20 schedule cases). New actual child-process SIGKILL test waits for IPC proof of lock acquisition, kills exact child, checks exit signal, reloads starting journal and explicitly cancels; HEAD/index unchanged, owned lock and alias removed. Initial replay test failure (plain EEXIST instead of409) preserved auto-commit-startup-replay-error-failure.log and fixed. Final rerun covers added directory fsync. Syntax/diff checks pass.
No unidentified shared index.lock gap remains for this executor's startup ordering; a pre-journal crash can leave only its private operation file, not a shared Git lock. Future retention cleanup of such private artifacts still needs implementation. Runtime/UI/worker integration, prepared document/version/epoch guards, mutation settlement and browser multiuser automation remain pending. No deployment/commit/push; P1-P6 incomplete.

### Active P5 prepared automatic commit service
Previous turn: progress (startup ownership + physical kill acceptance). Add service wrapping current workspace repository in prepared document transaction, binding preview to epoch/document identities/HEAD/index. Acquire persistent mutation ownership only after starting journal is durable. Keep interrupted mutation blocked for explicit recovery; clear only after transaction and terminal journal completion. Test current workspace selection, identical-byte version changes, other mutation refusal and preparation failure.

### P5 prepared automatic commit service and recovery
Progress: added AutoCommitService.mjs with public lock-owning and scheduler lock-already-held entry points. Preview and execution enter project.transaction({prepare:true,epoch}); bind saved document ids/versions/bytes/folders, workspace epoch, branch/directory and native HEAD/index. Current workspace repository is selected from binding. Guard rechecks authorization, lease, document identity and mutation ownership; starting journal precedes persistent beginMutation. Only successful transaction exit plus terminal journal releases ownership. Explicit prepared recovery completes/cancels matching task then releases block, without rewriting live documents or duplicating commit.
Also bound native journal/recovery to exact repository directory, preventing cross-worktree replay with coincidentally identical refs/index.
Evidence: auto-commit-service-integrated-tests.log45pass0fail0skip (previous37 plus8 service cases). Service cases use actual Git/filesystem stores but simulated collaborative preparation/lease. Covers identical-byte newer versions, stale epoch/branch, foreign mutation, failed client preparation, revoked owner, late exit failure retained, explicit recovery preserving newer live bytes and repeated recovery. Syntax/diff checks passed.
Remaining before enablement: scheduler failures before first native journal can retain operationId without native record; need persistent service attempt outcome/reconciliation. Runtime instantiate/gates/commands, owner UI, durable worker routing, real Overleaf prepared barrier and multiuser acceptance still pending. No deployment/commit/push or production data changes. P1-P6 incomplete.

### Active P5 preparation attempt provenance
Previous turn: progress (prepared service and45tests). Persist requested journal before prepared transaction; permit only requested->starting/cancelled with stable branch/HEAD/index identity. Distinguish scheduler failures before executor dispatch from uncertain dispatched outcomes. Verify preparation failure can be cancelled and schedule settled without native commit or index mutation.

### P5 preparation attempt provenance verified
Progress: AutoCommitService writes scoped requested journal before entering prepared transaction. Journal transitions requested->starting/cancelled retain base directory/branch/HEAD/index identity. Save-confirmation failure now has explicit cancellable outcome without native mutation. Service preflight failures before recorded attempt are tagged trusted autoCommitNotStarted; scheduler also tracks whether executor was invoked. Only proven non-dispatch clears unused operationId; persisted/dispatched unknown outcomes retain recovery ID. Late transaction errors cannot acquire the not-started tag.
Evidence: auto-commit-preparation-tests.log48pass0fail0skip; actual saved-preparation failure -> persisted requested -> explicit cancel preserves HEAD and clears only own block. Scheduler authorization loss between running record and callback clears unused ID; opaque dispatch failures still retained. All native startup SIGKILL/recovery/settlement regressions included. Syntax/diff checks passed.
Runtime and UI remain unwired; next integrate command schemas, owner-only config/recovery APIs, workspace-scoped stores and background worker under feature gate, then isolated actual Overleaf multiuser acceptance. Pre-journal private artifact retention cleanup still pending. No deployment/commit/push; full P1-P6 objective incomplete.

### Active P5 runtime and command integration
Previous turn: progress (preparation provenance and48tests). Add strict owner-managed schedule/recovery commands, workspace-scoped context/controller and gated scheduled runtime entry point. Validate gate, command inputs and exact recovery settlement behavior before enabling any server worker. Worker/UI and actual fixture acceptance follow.

### P5 runtime command/controller/worker integration
Progress: strict autoCommitSchedule/configureAutoCommitSchedule/autoCommitRecoveryPreview/autoCommitRecover command schemas; AutoCommitController enforces owner authorization, gated enablement, public status, explicit recovery then exact schedule settlement, locked scheduled dispatch. NativeGitRuntime constructs workspace-scoped schedule/task stores, checks current logical owner/write policy, prepared workspace support and scheduler gate; scheduled entry verifies scanned parent scope. NativeGitRouter starts AutoCommitWorker only when nativeGit+autoCommitScheduler enabled. Default env gate false. Worker scans configured valid project/workspace IDs, avoids in-process overlap, dispatches through shared runtime lock and publishes authorized repository invalidation. Added event names for commit/recovery/config updates.
Evidence: auto-commit-runtime-tests.log38pass0fail0skip (controller/command schema5,worker2,service9,schedule22). Includes disabled-server behavior, owner rejection, arbitrary client scope rejection, recovery while disabled, due execution once, scanner stop/non-overlap. Runtime/router/modules syntax and diff checks passed. These are module tests and service fixtures, NOT an imported full runtime HTTP/actual browser worker acceptance. Native Git SIGKILL regression suite was not rerun because native executor unchanged this turn.
Next: owner UI config/recovery integration and fixture-only deployment with actual runtime/worker tests. Full production enablement not authorized by test evidence yet; original instances unchanged. No deployment/commit/push. Remaining P3/P4/P5/P6 gates unchanged, objective incomplete.

### Active P5 automatic commit UI
Previous turn: progress (runtime/controller/worker wiring and38tests). Add owner settings/status and explicit pending-operation recovery UI; protect against stale API responses on workspace switch. Route automatic commit mutation notices correctly rather than presenting merge recovery. Run focused UI tests before production build/fixture deployment.

### P5 owner settings and recovery UI built
Progress: auto-commit-settings.tsx exposes branch interval, scheduler availability/status/reason, pending-task preview and explicit recovery. Pending operation blocks schedule edits; unknown recovery action is disabled. Generation guards ignore stale load/save/preview/error/finally across API changes/unmount. SourceControlView adds entry for prepared workspaces and routes auto-commit mutation notice separately from merge/Shell. Runtime status/initialize identify scoped auto-commit journal tasks; type union extended. Auto config/recovery API bypasses per-tab save wrapper because server owns prepared barriers.
Validation: auto-commit-ui-tests.log4pass; auto-commit-panel-tests.log50pass (existing46+new4), existing jsdom/library warnings remain; webpack auto-commit-ui-build.log compiled2warnings57282ms. Source files copied to existing staged build directory; runtime syntax/diff checks passed. No deployment or actual browser visual/worker/multiuser acceptance yet. No commit/push; original instances/manuscripts/remotes untouched.
Next: update fixture deploy build guard and include new runtime/default setting; deploy only18082, verify feature-off UI and owner permission first, then fixture-only flag and background multiuser acceptance. Worker route/import and actual prepared acknowledgement still need verification before declaring P5 complete.

### Active P5 isolated runtime acceptance
Previous turn: progress (owner UI,50 frontend tests,production build). Deploy only guarded18082 from auto-commit-ui-build; initially retain scheduler disabled. Verify actual HTTP owner/nonowner permission and UI unavailable state, then fixture-only enablement and two-writer scheduled commit/staging-pause tests. Preserve all failures.

### P5 automatic commit real browser/worker acceptance in isolated fixture
Progress: deployed only18082, auto-commit-fixture-deploy.log107files1483712bytes hashverified, production build guard updated; defaults included. Disabled-server actual browser suite3pass/complete=true/errors[]: owner status, nonowner403, enable503, unavailable UI. Enabled only guarded fixture-settings.cjs (exact18082/database); restarted fixture web/web-api.
Enabled real two-user suite4pass/complete=true/errors[]: owner-only policy; background worker (not direct invocation) commits B saved text under service author; both editors retain text; manual staging pauses reason manual-index. Additional direct read-only native Git verification on this synthetic workspace confirms HEAD unchanged and manual staged marker retained; proof stored in acceptance JSON. Test policy disabled at finish; prior failed-test policy also explicitly disabled before rerun. No remote push or original project edits.
Failures preserved: enable restart readiness timeout before login (auto-commit-enable-restart-readiness-failure.*); test mistakenly requested visual commitFilePreview for tex and got400 after successful commit (auto-commit-text-preview-test-failure.*), corrected to commitFileDiff. These failures were terminal before reruns. Settings gate remains enabled onlyfixture; production default false.
Remaining P5: actual browser interrupted-task recovery/permission-loss/no-browser operation tests, owner configuration UI enabled-path acceptance, automation cleanup/transfer, separate checkpoint/pull/push workflows. Full P1-P6 audit and other phase gates remain. No commit/push of implementation.

### Active P5 unattended worker and enabled owner UI acceptance
Previous turn: progress (actual disabled3/enabled4 browser checks and native staged preservation). Create fresh synthetic branch, configure through owner UI, close all contexts, observe persisted worker completion with no browser sessions, reopen and verify committed collaborator marker. Disable schedule at completion. No direct invocation of scheduled runtime.

### P5 unattended browser acceptance and incoming Skill installer defect
Unattended suite4pass/complete=true/errors[]: owner enables via UI, all contexts closed at2026-11-11T14:01:24.081Z, background completion14:01:39.015Z, reopened A/B text and service-authored diff verified, owner disables via UI. Commit ea5a62acacdfdaea52f8e1dca00c3b5797cee96f in synthetic branch only. Artifact auto-commit-unattended-browser-acceptance.json/log. No app code changed for this test; schedule disabled. Next P5 recovery/permission tests remain. User now reports Skill installer GitHub rate limit; investigate scoped installer defect while preserving full collaboration objective.

### Active P5 real interrupted automatic commit recovery
Previous turn: progress on reported Skill installer defect; Git unattended4checks already terminal successful. Resume P5 with guarded synthetic branch helper injecting prepared transaction exit failure after native commit. Verify durable paused task, B ownership refusal, newer collaborative edits preserved, actual owner recovery UI, disabled schedule and no duplicate HEAD.

### P5 automatic commit recovery real browser acceptance
Progress: guarded auto-commit-interrupt-fixture.mjs injects prepared transaction exit error after actual native publication in fresh auto-recover synthetic branch. Actual UI suite4pass/complete=true/errors[]: persisted published-but-paused task, nonowner recovery403, owner review/confirm completes and disables schedule, newer B text retained uncommitted while HEAD unchanged. Resumed original retained task after failure rather than abandoning it.
Found genuine Graph issue: graph command used workspace.run (document export) and thus failed409 during recovery. Changed to workspace.readHistory; graph-recovery-read-tests.log1pass proves no export, fixture-only module copy SHA256 verified and web/web-api restarted (graph-recovery-read-deploy.log). Original failure evidence preserved auto-commit-recovery-graph-blocked-failure.json/log. Auto-commit-recovery-browser-acceptance.mjs supports resuming unfinished synthetic task after terminal failure.
No implementation commit/push or original project/remote changes. Schedule disabled after recovery. Further P5 gates: permission-loss/browserless restart/owner transfer and auto pull/push/checkpoints; broader P3/P4/P6 remain. Full objective incomplete.

### Active P5 permission revocation browser acceptance
Previous goal turn was no progress on collaboration (Skill status only). Verify actual worker observes owner read-only policy, creates no commit, preserves collaborative text and remains paused after write permission restoration. Use fresh synthetic branch in18082; restore original policy in finally and disable test schedule.

### P5 permission revocation actual browser acceptance
Fresh synthetic branch auto-permission-mwc7a4x5 in18082:4checks passed, complete=true, errors=[], process exit0. Actual background worker pauses permission-revoked with no operationId/commit after owner changes to read-only; configuration denied403; restoring original policy and waiting17seconds leaves schedule paused and HEAD unchanged, both editors retain marker. Owner explicitly disables schedule, original policy restored in finally. Evidence auto-commit-permission-browser-acceptance.json/log/mjs. No product code changed this turn. P1-P6 remain incomplete.

### Active demo loading investigation
User resumed implementation. Browser automation remains stopped after user-reported Chrome hang. Authenticated HTTP login/project/Graph succeed;29project assets return200 (demo-project-assets.json). Found separate actual issue: saved default enabled=true with hasKey=false enables per-sentence checker, producing repeated missing-key errors. Gate automatic checker on selected provider readiness; do not claim this explains browser hang. Build/deploy only18082.

### Demo checker readiness fix deployed
Authenticated HTTP login/project/Graph all200,29project assets200; evidence demo-project-assets.json. Missing provider credentials previously still enabled per-sentence checker via saved.enabled. index.ts now also requires selected provider hasKey, except local agent which uses no user API key. This stops invalid automatic checks without changing stored user preference. Production build passed2warnings61673ms; first command used wrong cwd and is retained demo-checker-build-path-failure.log. Frontend-only deployment copied/hash-verified3files and restarted only18082web/web-api (demo-checker-deploy.log); login readiness200. No browser automation, manuscript edits or remote changes. Chrome hang cause remains unproven; do not claim this fixes observed loading failure. Full collaboration goal remains active/incomplete.

### Active reviewed Pull entry
Connect collaborative Pull API/menu to remote discovery followed by existing shared merge task. Pin fetched source commit; no document application or push. Rebase remains explicitly refused. Owner/write authorization checked before and after fetch. Preserve manual review/apply. Verify routing and UI before fixture deploy.

### Reviewed Pull connected and fixture deployed
Collaborative pull now composes existing remote discovery and shared merge preparation, returning reviewRequired/task; no document apply or push. Pins fetched after[remote ref] and rechecks owner/write authorization after fetch; missing/deleted/incomplete sources and collaborative rebase refused. Optional operationId accepted for retry identity, UI generates it and opens selected Shared merge tasks. /git pull uses same backend but renders task result; command-help wording still needs update. Dirty target handling remains existing explicit refusal until user commits/handles changes.
Evidence: reviewed-pull-tests.log4pass; reviewed-pull-ui-tests.log1pass confirms actual panel action selects returned task without apply. First UI expectation incorrectly assumed mergeDraftGet, retained reviewed-pull-ui-test-expectation-failure.log; corrected to assert displayed dialog/selected task. Build2warnings62079ms;3backend modules hashverified copied,3frontend artifacts hashverified/restarted only18082, login200. Live authenticated pull--rebase returns new specific409 (reviewed-pull-http.json) proving route wiring; no live remote fetch performed in this turn. Full remote-fetch->review->apply browser acceptance remains outstanding. No Chrome operations, original manuscript edits, commits or pushes.
User entry: Source Control > Repository actions > Pull > Fetch and review. Current restrictions: owner only for remote fetch, target changes must be explicitly handled, rebase remains unsupported. Full P1-P6 still incomplete.

### Active Paper Assistant reviewed Pull result
Show non-applied result and direct task-review button after /git pull; reuse existing CollaborationTasks modal, carry server capability and reject late results from old workspace. Update command help to explain owner requirement, review/apply and unavailable collaborative rebase. Build/deploy after focused command-panel verification.

### Paper Assistant reviewed Pull result deployed
/git pull now displays fetched/task status plus explicit files-not-updated message and Review merge task button opening existing CollaborationTasks modal. Server supplies collaboration capability; /git help pull explains defaults, owner fetch requirement, explicit apply and collaborative rebase refusal. Added post-response workspace guard; old workspace result cannot show a review button in new workspace.
Evidence slash-pull-review-tests.log7pass (four permission modes, direct review/no automatic apply, late workspace response, help). Build2warnings65455ms, slash-pull-review-build.log; runtime capability module hashverified,2frontend artifacts hashverified and deployed only18082, web/web-api restarted/login200 (slash-pull-review-deploy.log). No browser automation or original manuscript/remote changes. New UI not yet visually accepted by user; full remote fetch->resolve->apply acceptance remains pending. No commit/push. Full objective incomplete.

### Reviewed Pull actual HTTPS and two-account HTTP acceptance
Fresh synthetic branch reviewed-pull-1794408014/workspace5d8fd85688585379198a059a. Real local HTTPS remote was started only in fixture after confirming no running server. Four checks completed: B cannot fetch; A pull pins actual fetched tip617de503b105e43612faf5b74b213bef27feffc1 without target HEAD change; B sees identical task and same operation replay does not duplicate; owner claims/applies, competing B claim409, both accounts download actual project zip containing exact remote text and Git diff agrees. Taskfb93e554-490b-475a-8cc8-6afa5d3235a5 resolved. Evidence reviewed-pull-http-acceptance.json complete=true; final verification exit0. Script resumes same workspace/task after terminal assertion failures; no duplicate application.
Test expectation failures preserved: unfiltered Graph includes other branches; prior remote tip and hardcoded content were stale; project HTML is not document inventory. Fixed by branch-filtered graph, current remote commit-pinned content and authenticated project ZIP downloads. These were acceptance harness errors, not additional app fixes. First HTTPS launch path absent; copied task-owned script and started successfully; exact server process stopped at finish.
No browser/socket editing tested this turn; browser visual conflict flow still unverified. No original project/remote or production deployment changes, no commit/push. Goal incomplete.

### Category1 branches command repair and review setup
Found /git branches advertised but absent in backend schema/dispatch (actual HTTP400). Added strict branches command using readHistory, no document export. category-1-branches-tests.log2pass, backend-only deployment18082, web/web-api restarted. Authenticated HTTP successfully listed refs and prepared stable demo/shared and demo/independent workspaces from initial888b0cc commit; category-1-demo.json holds URLs. Existing five scenario evidence mapped in category-1-review.md; historical checks are not current visual acceptance. No user browser control. Category1 remains under review/remaining multi-file recovery checks; do not advance categories2–6 without user confirmation.

## Category 1 multi-file recovery continuation
Previous turn: no progress (delivery agreement restatement). This turn fixes in-memory recovery retention across consecutive document errors when browser storage fails. Two added targeted cases pass (7 total); initial test-edit command used wrong working directory and was corrected before the 7-case run. Build succeeded (2 warnings, 47859ms); deployed 2 hash-verified files to18082, login HTTP200. Browser interaction not verified. No category advance.

## Category 1 recovery file identities
Previous turn: progress (multi-file recovery fix deployed). Current source audit found docName initialized empty and never populated. Populate on open and track file-tree renames by ID; retain last known name after deletion. 13 focused epoch/recovery UI checks pass, including new rename/recreate identity case. Browser inventory rechecked: browser access host still unavailable; did not access native Chrome. Build/deploy complete: 43261ms, 2 warnings, 2 hash-verified files on18082, login200. Interactive demonstration remains unavailable; category1 not signed off.

## 第1类演示阻塞复核

上一轮：有进展（恢复文件名/身份修复并部署）。本轮：展示尝试受阻。CUA可初次读取Firefox新标签页；尝试导航18082/login在10秒超时并重置，重新获取Firefox窗口也超时。不能确认导航、登录或演示成功。没有使用其他自动化绕过，也没有控制/关闭Chrome。

同一展示能力阻塞已连续记录于多文件恢复、文件名身份恢复和本轮；本轮不继续创建功能或重复测试。下一步需要恢复可用浏览器控制连接，或用户通过18082反馈实际交互结果。第1类未签收，2–6类不启动。全局目标未完成。

## 自行验收：真实HTTP和实时连接（2026-11-11）

用户明确授权自行验收，无需用户配合测试；仍保留分阶段展示反馈。上一轮浏览器演示阻塞；本轮以真实协议会话获得新证据，不等同浏览器可视验收。

`category-1-live-protocol.mjs/json/log`：两个真实登录账号、三个WebSocket会话、两个独立测试分支。7项通过：独立加入；双向实时编辑收敛；个人切换不移动他人或串分支内容；新会话重连读取一致内容；错误代次写入拒绝且原文不变；撤权连接关闭且旧凭据读取/创建分支403；恢复权限后重新连接内容保留。

验收发现并修复 `services/real-time/app/js/Router.js`：WORKSPACE_EPOCH_STALE曾被序列化成通用内部错误，现在仅对白名单错误码返回固定的保存修改/重新加载提示，不泄漏原始内部错误。语法检查通过，部署到18082后真实协议返回正确code，staleErrorExplained=true。仅重启该实例real-time。

保留失败：first-attempt为脚本JSON换行比较错误；error-message为发现的产品错误；empty-event为协议脚本未兼容无参数事件。无参数事件导致脚本中断后立即恢复了测试成员，修复脚本再完整执行，最终权限恢复和重连已验证。脚本不输出密码或cookie。

未覆盖：真实浏览器离线缓冲/重连恢复窗口、页面布局和按钮交互；错误代次协议检查不能替代完整离线浏览器验收。正式论文、远端仓库和其他实例未修改。第1类尚不宣称全部完成。


2026-11-12 00:30：现有Chrome/Firefox完成第1类五项主要交互场景，发现并修复分支Share成员操作ID错误（已部署18082）。协议测试漏doc导致的9条测试历史记录已备份修复，flush204；强制中断留下旧注册需显式session recovery，恢复后prepare通过。完整证据与组合场景限制见category-1-review.md最新节。两个窗口已恢复不同分支可编辑，B权限已恢复，未进入第2类、未提交推送。

## G03 continuation: serial delivery (2026-11-12)
- [x] G01 shared remote permissions and G02 clone resource integrity verified previously.
- [x] G03: defer success until write transaction exit; include epoch in recovery preview fingerprint; recover retained failed attempt using UI; inject one-file interruption; Chrome/Firefox stale preview rejection and explicit recovery.
- [ ] After G03 passes, proceed directly to G04 capacity protection; then G05/G06/G07/G08 in audit order. No user prompt required between items.
Current retained task 349aac5a-586d-4b05-9511-8eb238d9fb90 failed during main.tex before after-step; not a passed fault-injection check.

G03结果：见gap-03-review.md。两端交互通过，自动进入G04：统一恢复快照容量前检、合并应用前检和磁盘写满错误处理；定向测试后部署18082并双浏览器检查。

G04完成：gap-04-review.md。测试reserve已撤销，18082 HTTP200。现在G05：为合并完成后的编译添加绑定提交/正文版本的验证状态，检查中/成功/失败/过期，不回滚正文。

G05完成：gap-05-review.md，成功/过期/失败双端可见，失败不回滚。G06a启动：先落实可核对的Git/文件/元数据一致性导出；G06b恢复和G06c删除仍不开放，逐项实现。

### G06a executable plan
1. Add bounded archive writer: safe relative paths, reject symlinks/duplicates, hash every entry, write completion manifest only after source revalidation; failed captures never become downloadable.
2. Capture all logical-project workspaces, current docs/ranges/assets, history chunks and referenced blobs, comments/chat, shared Git objects/refs and referenced recovery/task data. Exclude credentials, access tokens and ephemeral sessions explicitly.
3. Hold shared repository lock, use optimistic revalidation across captured documents/metadata/control files before publishing. If collaborators changed any input, reject and retain live contents; no automatic overwrite.
4. Owner-only create/list/download entry and frontend; inspect generated archive hashes and two-browser owner/editor behavior on isolated18082.
5. Only after G06a passes start G06b restore generations. Do not remove permanent-delete protections (G06c) prematurely.

G06a完成：33个下载文件逐项哈希验证、两工作区及评论/聊天/标签/PNG通过，Chrome所有者/Firefox协作者权限交互通过。G06b开始：先明确历史、文档ID、评论线程、Git任务和会话代次的恢复映射，再实现隔离恢复入口；恢复验收前保持永久删除保护。

G06b完成：gap-06b-review.md。7项测试及双浏览器编辑/隔离/私有访问通过，旧任务404，旧文档ID拒绝。18082登录200。

### G06c executable plan
1. Inspect all project deletion/expiration entry points and prevent internal jobs bypassing branch retention.
2. Inventory retained backups, failed restores, tasks and Git references; build a conservative cleanup preview that protects referenced or active data.
3. Implement owner-reviewed cleanup with fingerprint revalidation and durable receipts, confined to eligible retained artifacts.
4. Implement project deletion only with verified external retention receipt, workspace write drain and retryable cascade; test only synthetic projects.
5. Deploy18082 and verify owner/editor interactions in existing Chrome/Firefox. Do not mark full G06c complete after only guard/preview.

G06c部分完成（未标整项完成）：内部ProjectDeleter、账号批量预检和过期删除增加同一保留保护；未完成备份残片清理已部署18082。7项定向检查通过；Chrome续做已审核的中断清理成功、Firefox协作者拒绝。生产保留24小时限制，浏览器续做夹具仅在独立脚本模拟时间并预先隔离测试残片，未修改服务器时钟或放宽生产门槛。完整备份、恢复引用、Git对象不被清理。证据gap-06c-protected-preview.png、gap-06c-cleanup-completed.png、gap-06c-ui-result.json、gap-06c-guard-fixture.log。
下一步仍为G06c：整项目删除需要项目之外的可访问备份/删除回执入口、所有工作区持久写入停用及分步级联；现有仅项目内备份入口不能在父项目删除后使用，不得直接开放删除。

G06c下一子项：独立恢复库已编码，RecoveryVault/RecoveryVaultRouter存储在native-git/recovery-vault/<authenticated-owner>/，不依赖原Project记录。备份副本逐文件校验且重新检查所有者权限；提供所有者独立列表、下载、显式预览恢复。BackupRestoreService增加可信服务器适配器和明确目标存储根目录；不接收客户端路径。3项vault定向检查通过。当前构建gap-06c-vault-build.log中，尚待部署与双浏览器验收；整项目永久删除仍未开放。

独立恢复库子项完成：gap-06c-vault-review.md。真实Chrome保留/下载36项哈希/表单确认恢复并打开新项目a0172bd979f0006e49748cd3，Firefox B私有访问404。发现并修复默认CSP导致的样式及表单阻断，只允许同源表单+固定样式哈希。下一步仍G06c整项目删除：需先核对AI数据库任务/对话等持久数据是否纳入保留副本，再实现所有工作区持久停写与可重试级联；不能用普通ProjectDeleter绕过保护。

### 范围冻结（2026-11-12，用户要求逐项完成）
剩余编号固定为G06c、G07、G08；实现细节与验收缺陷写在原编号下，不新增交付项。
G06c当前唯一目标：所有者审核整项目删除；先冻结全部分支、核对独立保留副本，再按持久步骤删除；中断可继续，正式论文不参与验收。
本步先实现可恢复删除状态机与定向故障检查，然后接入现有恢复库与两浏览器页面；未完成整条路径前不解除旧删除入口保护。

G06c当前进度：ProjectDeletion.mjs持久步骤状态机已实现；native-git-project-deletion.test.mjs四项通过（先冻结/核对再删、可逆阶段取消、删除响应丢失续做、撤权/备份损坏停止）。尚未接入真实删除适配器或页面，未部署此模块，不算G06c完成。下一步保持原项：生产适配器必须实现持久停写、私人记录原用户保留、逐资源幂等清理，然后原Chrome/Firefox互检。无新增交付编号。

G06c本项完成：gap-06c-deletion-review.md。删除、删除后恢复、私人导出隔离、较新编辑拒绝删除、取消后双向协作通过；持久标记后中断恢复实测通过。自动进入G07，不新增编号。G07执行：读取现有周期发现和权限配置；添加验签/仓库绑定/持久去重入口，通知仅触发fetch发现而不修改正文；定向重复/乱序检查后部署18082并双浏览器观察。

G07完成限定验收：gap-07-review.md。6项定向、真实签名HTTP、双浏览器所有者/编辑者权限和共享发现展示通过；本地无公网回调，未注册外部Webhook。测试计划已关闭。现在G08：先复用已有菜单及/git操作清单，按尚无双端证据的操作逐个检查；第一项只读协作者Graph访问，随后现有管理/失败副作用矩阵。不重跑已足够的G01–G07证据，不新增交付编号。

G08第一项（只读协作者Graph）进行中：发现HTTP和runtime统一canWrite导致Viewer历史403，已实现immutable-history命令白名单、只读status不导出正文、只读Graph/详情/文件差异界面。Chrome Share将合成项目30d83b036221e05b54505eb8的B暂改Viewer，Firefox详情/文件diff通过；真实runtime暂存/提交/终端/webhook均403，refs不变。当前B仍为Viewer，必须验收后恢复Editor。另修Viewer presence误报重连：read权限授权读取位置、Redis保留readOnly字段、UI显示Viewing。3项位置测试+1项真实Redis序列化测试通过，最终前端部署中；待两浏览器presence交互再签收本项。下一项仍G08现有共享远端管理角色矩阵（changeRemote核对），未开始修改。

2026-11-13 G08只读历史续验：Chrome实时DOM已显示A Editing/B Viewing，两在线会话；已通过Share界面将B恢复原Editor并回读确认。最终双窗口位置验收仍待完成，不能使用旧presence截图。系统只读检查确认CGSSessionScreenIsLocked=Yes；CUA两浏览器均cgWindowNotFound，连接host unavailable。记录gap-08-readonly-review.md。按用户顺序要求，不提前进入changeRemote；解锁后续验当前项，完成后自动下一项。

2026-11-13 00:21：G08只读历史双窗口最终验收通过，gap-08-readonly-presence-live.png；两端A Editing/B Viewing一致，B已恢复Editor并刷新。进入同一G08下一项：changeRemote补所有者权限、锁等待后重新授权，并验证编辑者拒绝且远端配置不变。

2026-11-13 00:34：G08共享远端管理changeRemote补漏完成；7项定向、真实runtime403+配置字节不变、Chrome所有者保存/Firefox编辑者可见拒绝通过。gap-08-remote-review.md。继续核对G08原有失败/覆盖矩阵的未验证项，不新增范围。

G08 removeRemote双端通过：Firefox拒绝，Chrome临时配置g08-remove-fixture删除成功并回读仅剩原配置；既有g07-webhook未删除。继续原W19大小写/二进制冲突保护核对，先确定现有实现缺口。

G08/W19当前执行：Overleaf路径查找默认忽略大小写，而WorktreeFiles只检查精确路径冲突。先在共享validateFiles前检中拒绝大小写/Unicode规范化冲突（含目录前缀），保留单独大小写重命名；测试验证失败发生在任何写入前；部署18082后用合成冲突分支检查双方提示和正文未变。

G08/W19路径冲突子项完成：gap-08-path-review.md；双端拒绝冲突分支，正文/当前分支保留，未分配工作区。6项路径检查、原5项分支检查及新1项Linux前置分配检查通过。下一步仍W19二进制冲突共享预览与选边应用，不新增编号。

G08/W19二进制选边通过：gap-08-binary-review.md；Chrome选择incoming、Firefox接手应用、两端resolved，项目blob与worktree哈希均等于incoming，原分支编辑保留。下一项G08/W15共享暂存区过期提交：核对预览指纹与实际入口，原两浏览器验证别人改变暂存内容后旧确认被拒绝。

G08/W15完成限定验收：gap-08-commit-review.md。发现普通commit原无index指纹，已补公共命令强制指纹+各前端入口。原Chrome确认、Firefox取消暂存后旧确认409；重新审核提交成功b387d60d，正文保留。2项仓库、1项schema、5项/git准备测试通过。接着W38人工暂存与自动提交：用同一合成工作区启用一分钟计划，Firefox人工暂存，核对计划暂停且index/HEAD不变，验收后关闭计划。

2026-11-13 用户明确收缩范围：不再增加罕见边界组合，当前已复现小修完成后直接交付。G08人工暂存/自动提交已验证暂停且HEAD/index不变；协作者状态读取补漏部署并双端确认，计划关闭。见gap-08-auto-manual-review.md。原完整矩阵未穷尽，按用户要求移作已知限制；本轮功能修改收尾，进入源码/测试/文档本地提交。交付说明delivery-2026-11-13.md。
