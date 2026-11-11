# Overleaf collaboration and Git: proposed additions for approval

Status: source-based analysis, not a two-user browser acceptance test. These collaboration additions are NOT implemented in this pass. Existing permission modes, /git commands and graph alignment are separately authorized work.

## Three distinct synchronization layers

1. Browser ↔ Overleaf collaboration service: document operations and versions. This is what propagates A's edits to B. It must work whether either person enables Git automation.
2. Overleaf documents ↔ server Git worktree/index: project snapshot export and guarded document import. This is application integration, not a built-in Git capability.
3. Server Git repository ↔ remote Git hosting: fetch/pull/push. Push sends commits, not unsaved browser buffers or arbitrary working-tree edits.

Zero latency is impossible over a network. The useful guarantees are visible saving/offline/out-of-sync states, acknowledgement before claiming saved, eventual convergence after connectivity recovers, and explicit refusal/recovery rather than overwriting stale edits.

For A/B in the SAME Overleaf project, A enabling a project-level remote synchronization job should not require B to enable one. Both edit the same server project; B may have stale UI or unsent local edits, but does not intrinsically own a separate Git clone. For two independently cloned paper projects, neither realtime edits nor automatic merging is implied; those are distinct projects coordinated through Git.

## Current implementation evidence

- `NativeGitRuntime.mjs`: storage/binding/operation lock are scoped by project ID; credentials and access policy are scoped by user inside that project. Consequently branch/worktree/index are shared; permissions modes are not a project-wide collaboration authorization system.
- `ProjectWorkspace.mjs`: synchronize exports collaborative documents to the current worktree; stage/commit run after export. Checkout changes the project's shared editor binding. Mutations retain a durable before-image and pending transfer.
- `OverleafProject.mjs`: reads document content/version and asset hashes; validates file tree stability. Import preflights content and entity identity, takes exclusive write access, and writes through native document/entity APIs.
- `ProjectWriteAccess.mjs`, `ProjectWriteGate.js`: Redis lease blocks competing writes and announces `nativeGitWriteState` to the room. Browser context temporarily makes editors read-only. Version checks and pending-transfer recovery exist.
- `editor-operation.ts`: awaits buffered edits in the initiating browser. It does not collect acknowledgement of every collaborator's pending browser buffer.
- `source-control-panel.tsx`: refresh responds to local doc events/focus/visibility; there is no dedicated shared Git revision feed for all remote metadata changes.
- `RemoteOperations.mjs`: Sync is pull then push; failure stops push. No periodic native Git auto-commit/auto-push scheduler was found in the inspected module.
- `RepositoryTerminal.mjs` and runner: shell writes occur outside `project.apply`. `ProjectWorkspace.inspect/synchronize` subsequently exports editor content back to disk. Shell edits can therefore be overwritten instead of being imported. Existing write gate does not make an arbitrary shell session a collaborative writer.

## Proposed functions — approve separately

| ID / priority | Proposed function | Why needed / example | Why Overleaf-specific; current boundary |
|---|---|---|---|
| 1 / P0 | Shared project branch/workspace identity and operation announcements | A checkout changes what B is editing. Show current shared branch, initiator, operation and affected files to everyone; block stale actions. | A desktop Git working tree normally belongs to one working session. Here one binding drives many browser editors. Binding already shared; comprehensive shared revision/status delivery is missing. |
| 2 / P0 | Collaborative save barrier and consistent project snapshot | Before a content-changing operation, ask connected editors to flush/ack; establish a server document-version boundary. Do not wait forever for offline clients; explicitly exclude unacknowledged edits and handle them on reconnect. | Multi-document live content can change while it is being exported; file-tree stability alone is not an atomic text snapshot. Current initiator flush + per-document checks are useful but insufficient to claim all-user snapshot consistency. |
| 3 / P0 | Project generation/epoch on branch changes and offline recovery | B goes offline on branch X; A switches to Y. On reconnect, B's buffered X edits must not silently apply to Y. Preserve a recovery draft and show merge/reapply choices. | OT document versions and Git branch identity are different. Reconnect must check both. No project-epoch protocol identified. |
| 4 / P0 | Shell/AI file writes as guarded collaborative transactions | A shell edits main.tex while B edits it online. Detect both changes, compare to a baseline, preview/import through native APIs, and retain conflicts; never blindly overwrite either source. | Raw filesystem changes do not become collaborative document operations. This is the most direct currently identified integration gap, especially before autonomous AI shell editing. |
| 5 / P0 | Shared staging ownership and commit-content preview | A stages a paragraph; B stages another file or edits the same file. A must see exactly which bytes will be committed, who staged them and whether the preview became stale. | The current shared Git index is not a per-user staging area. Recommended first step is shared staging + versioned preview, not silently inventing per-user indices. |
| 6 / P0 | Project roles for shared Git operations | An editor with personal Full Access should not implicitly change the project's remote, force policy, or automation owner. Separate edit permission from manage-remote/manage-automation/checkout-destructive permission. | Personal execution mode and multi-user project authorization are different. Current Git routes require project write permission; this is not fine-grained shared-operation governance. |
| 7 / P1 | One server-side automation job per project/remote/branch | A enables automation once. B sees the same schedule/status; opening another tab does not create another timer. Use a lease, pause/resume, initiator and next-run visibility. | Browser-owned timers conflict in collaborative projects. Current native Git has manual Sync, not this scheduler. Recommend project-level automation with owner-controlled configuration. |
| 8 / P1 | Separate automatic checkpoint, commit, fetch and push policies | A collaborator may still be typing a broken equation. Automatic backup should preserve their draft without immediately publishing it. Define idle delay, max interval, scope/exclusions and push conditions separately. | Git commit/push remain ordinary Git; selecting a meaningful shared paper snapshot and managing draft publication is application policy. Default recommendation: checkpoints/commits first, opt-in remote push; no automatic destructive reset/rebase. |
| 9 / P1 | Shared conflict task with resolver ownership and automation pause | Pull conflicts should pause the job and show all users the same affected files, assigned resolver, base/current/incoming versions and continue/abort state. | Native Git conflict state exists, but simultaneous browser resolvers can overwrite each other. Current conflict tools need collaborative assignment/revision handling. |
| 10 / P1 | Durable operation journal, idempotent retries and recovery status | Push times out after remote acceptance, or the server restarts during file import. Show operation ID and completed phase; reconcile before retry rather than creating duplicate commits or restarting mutations. | Git has atomic ref updates, but document import + realtime notification + remote push is a multi-service operation. Pending-transfer recovery already exists and should be extended, not replaced. |
| 11 / P1 | Project-owned automation identity and credential lifecycle | If A's personal token expires or A leaves, B should see why sync stopped. Define service/owner identity, explicit transfer/revoke and safe credential status without sharing tokens. | Current remote credentials are per-user while the repo is shared. A background project job needs explicit ownership, unlike a single-user CLI. |
| 12 / P1 | Overleaf metadata and document-identity preservation policy | Git restores source files, but users also care about root document, compiler, comments/reviews, history and file IDs. Define which settings are versioned and how annotations survive rename/delete/recreate. | A Git tree does not represent the entire Overleaf project. Current bridge handles file bytes and entities; it is not a full project backup/restore contract. |
| 13 / P2 | Paper-specific sync exclusions, binary policy and compile checkpoint | Avoid tracking build intermediates/secrets, bound large figure transfers, and show whether a synchronized revision compiles. Failed compilation should not erase drafts. | File size/LFS concerns are general Git; LaTeX build outputs, root-document/compiler selection and shared paper checkpoint UX are Overleaf-specific. Current adapter has size/type limits, not a complete paper sync policy. |
| 14 / P0 validation | Two-user concurrency and interruption acceptance matrix | Exercise A/B simultaneous same-file edits, B offline during checkout, stage/commit races, shell writes, expired credentials, interrupted pull/import and multi-tab scheduling. | Component/native tests do not demonstrate realtime browser convergence. Verify document versions, exact bytes, index/tree/remote hashes and each user's visible state. This is validation for the above, not a separate Git command. |

## Recommended approval sequence

First confirm 1–6 and14: establish shared-state boundaries before automation. Then 7–11: safely schedule and recover remote synchronization. Finally12–13: complete paper-specific recovery and presentation policies.

Recommended product decisions: one shared branch per collaborative project; a separate project/workspace when users intentionally need independent branches; one server-owned sync job; visible shared status; no requirement that every participant enables Git sync; explicit recovery for offline edits rather than a promise of zero latency.

## 用户补充：防覆盖优先于自动同步

状态：新增设计约束和验收场景；未实现、未启用自动任务。

首要要求是不能静默覆盖任何参与者的未保存修改。发生冲突、版本过期或客户端状态不明时，应保留可恢复的双方内容，暂停有覆盖风险的操作并明确提示，不能以同步成功为理由选择一方覆盖另一方。

### 操作边界

- 普通 commit 记录暂存内容，push 发送提交，本身通常不替换浏览器正文；仍需要防止暂存内容被其他用户改变，以及提交包含哪些人的编辑不清楚。
- pull/merge、checkout、reset、stash apply/pop、discard、文件删除/重命名以及 Shell/AI 回写会改变工作内容，需要进入统一的防覆盖流程。不能只保护标为 Sync 的按钮。
- 同一项目的普通编辑可以继续并发。涉及回写时，只在必要的短事务中阻止新写入并核验版本；不要在整个远程网络请求期间冻结全部编辑器。
- 自动拉取先在隔离工作区准备结果，真正回写前再核验当前分支、项目代次、文件身份和文档版本。网络请求开始时的检查不能代替回写时的检查。
- 本地尚未上传的浏览器内容服务器无法提前知道。在线客户端需要保存确认协议；失联客户端不能被算作已保存。重新连接后先保存恢复草稿并检查项目代次，再决定如何重放修改。
- 多文件回写需要前置检查、恢复日志和对所有客户端可见的事务状态；单个文件写入有版本校验，不等于整篇论文获得原子快照。
- 所有入口使用同一后端规则：Git 面板、/git 指令、后台任务、Shell、AI。Full Access 仅放宽容器执行权限，不能作为绕过协作文档版本检查的理由。
- 自动化不得执行强制覆盖、自动丢弃、硬重置或自动选择冲突一方。遇到需要人工判断的情况，保留现场并暂停。

### 防覆盖验收矩阵（实施前冻结预期）

| 场景 | 必须观察到的结果 |
|---|---|
| A 修改同一文件尚未保存，B 触发自动提交/推送 | A 的本地编辑不被替换；提交明确对应已确认的快照，不宣称包含 A 尚未上传的内容。 |
| A 编辑 introduction.tex，B 编辑 methods.tex，任务导出整篇论文 | 两份编辑都保留；导出使用明确的版本边界，不能把较旧文件写回覆盖较新内容。 |
| 远程 pull 在下载期间，A 继续编辑目标文件 | 回写前检测新版本，重新计算合并或拒绝过期结果；不能使用旧快照直接覆盖。 |
| A 离线编辑分支 X，B 切换到 Y，A 重连 | 先保留 A 的恢复草稿；旧分支编辑不得无提示地重放到 Y。 |
| A 打开提交预览后，B 改变暂存区 | A 的旧预览失效或要求重新确认，不能静默提交不同的内容。 |
| A 重命名/删除文件，B 仍在编辑旧文件 | 按文件身份及版本发现冲突，保留 B 的编辑；不能仅凭相同路径当作原文件。 |
| Shell/AI 与浏览器同时修改文件 | 比较共同基线和双方版本，走协同回写；后续 status/refresh 不能悄悄抹去 Shell 修改。 |
| 回写多个文件时断网、重启或锁租约失效 | 呈现明确的未完成状态；能恢复或撤回，不能宣称整体成功，也不能重复执行已完成的 Git 变更。 |
| A/B 或多个标签页同时触发自动任务 | 同一项目只执行一个受控任务，其余请求排队或明确拒绝；不能发生重复提交或交错回写。 |
| 冲突、权限撤销、凭据失效或推送结果未知 | 暂停任务并保留内容/操作记录；不自动强推，不无限重试。 |

验收必须同时核对 A/B 浏览器缓冲、服务端文档版本与内容、Git index/tree/HEAD、远程提交和恢复记录。页面看起来相同、HTTP200或单用户测试通过都不足以证明防覆盖成立。
