# Overleaf 多分支协作实现方案

状态：提交当前实现后制定的工程方案。基线提交 `af4096d`。本文的分支隔离、presence、协作事务、自动同步尚未实现，也未部署。

## 1. 推荐架构与选择理由

用户可见：一个论文项目、一个 Git 仓库。每个分支一个共享协作工作区；同分支用户实时编辑同一份工作内容，跨分支隔离。一个浏览器会话选择一个编辑工作区，同时可查看任意有权访问的历史提交。

推荐引入显式的三层身份：

| 身份 | 用途 | 不能混用的地方 |
|---|---|---|
| logicalProjectId | 项目列表、名称、成员、共享授权、仓库、远程配置、项目级策略 | 不直接作为所有分支的文档/编译命名空间 |
| workspaceId | 稳定的分支工作区标识；改名分支不改变它 | 不能直接使用易变的分支名作为身份 |
| storageProjectId | 工作区内部的 Overleaf 文档、文件树、历史、评论和编译命名空间 | 不是一个用户另建/另行共享的论文项目 |

落地方式：复用现有 Project 存储结构作为内部 workspace storage，并增加清晰的内部标记和父项目关系。它不出现在项目列表，不拥有独立成员/共享 token/计费额度。所有授权回溯 logicalProjectId。既有默认工作区保留原 projectId/docId/historyId，避免首次迁移重建论文文档；新分支获得新的存储身份和 docId。

选择这一方式，是因为当前 realtime、document-updater、history、comments、compile 已大量以 projectId/docId 隔离。为分支提供真正独立的存储身份，可继续复用现有协作算法，而不需要重写 OT。内部存储记录不是 Clone 功能创建的独立新论文项目。

两个备选：
- 只增加 Git worktree：改动小，但编辑器仍读同一 rootFolder/docId/房间，无法防覆盖，排除。
- 给所有下游服务全面新增 workspaceId 维度：语义直接，但协议/数据库/缓存迁移范围更大。长期可以演进，首版不同时重写全部服务。

内部存储方案不是绕过权限的捷径：项目列表、授权、删除、共享链接、配额和后台清理若有任何入口未区分两层身份，就不能开放此功能。

## 2. 当前源码依据与改动面

| 当前入口 | 已确认事实 | 所需改动 |
|---|---|---|
| NativeGitRuntime.mjs / WorkspaceStore.mjs | projectId 下只有一份 binding；凭据按 userId 保存 | 解析 logicalProject/workspace，按 workspace 保存绑定与未完成事务；仓库/凭据留在 logicalProject 下 |
| ProjectWorkspace.mjs | inspect/run 会将当前项目文档导出到工作区；checkout 切换该项目的文档 | 移除“切分支替换共享项目”语义，改为会话加入目标工作区；文档导出必须有版本边界 |
| Project.mjs / ProjectEditorHandler.mjs | 一个 rootFolder、rootDoc_id、compiler 与 _id | 内部存储标记；编辑器模型显式携带两层项目身份和 workspace/epoch |
| RoomManager.js / WebsocketController.js | 项目房间按 projectId，文档房间按 docId；socket 保存 project_id | 内容房间使用 storageProjectId，文档使用分支独立 docId；加入/编辑验证会话 workspace 与 epoch |
| AuthorizationManager.mjs / ProjectGetter.mjs / ProjectListController.mjs | 授权及查询以项目身份为中心 | 内部存储只能继承父项目授权；隐藏内部记录；父权限撤销使所有工作区连接和缓存失效 |
| DocumentManager.js / RedisManager.js | 文档读写及排队使用 projectId/docId | 延续独立 storage ID 隔离，同时增加 epoch/fencing 校验以拒绝旧会话写入 |
| ProjectWriteGate.js / ProjectWriteAccess.mjs | 现有排他写租约和 busy 广播 | 工作区级短事务、单调 fencing token、准备/排队排空/完成状态；不能只依赖锁超时 |
| HistoryManager.mjs / NativeCommentsService.mjs | 历史、评论使用 projectId/docId | 对应工作区存储；分支创建、合并、删除时明确迁移/保留规则 |
| ClsiManager.mjs 等编译模块 | 编译请求/缓存/历史版本含 projectId | 使用 storageProjectId 与 snapshotRevision；作废迟到的旧分支编译结果 |
| ConversationView / Git command panel / terminal runner | /git 使用当前编辑器；Shell 直接写 worktree | 所有任务捕获并校验 workspace/epoch；Shell 改用隔离草稿，提交时通过文档事务回写 |

## 3. 数据与接口契约

建议新增 WorkspaceRegistry 持久模型：

- `workspaceId, logicalProjectId, storageProjectId`。
- `kind: branch | detached-preview`；`branchRef` 使用完整 refs/heads/...，每项目一个 branchRef 最多一个活跃共享工作区。
- `state: preparing | ready | applying | conflicted | archived | failed`。
- `epoch`：工作区内容身份被批量替换时增加；不同于普通 OT 文档版本。
- `revision`：用于清单、状态与预览的比较更新。
- `head`：最后确认的提交；实际写操作仍需核对 Git ref。
- `originWorkspaceId, createdBy, createdAt`；创建请求带稳定 operationId，失败恢复不重复创建。

会话状态包含服务器签发的 sessionId、workspaceId、epoch 与用户身份；客户端不能仅提交任意 storageProjectId 来获得授权。所有写入必须校验 workspace 状态、成员权限、文档归属和会话代次。

用户 URL 保留逻辑项目，例如 `/project/P/workspace/W`。旧 `/project/P` 进入默认工作区。编辑器内部需要兼容现有以 projectId 为参数的组件，因此显式提供 logicalProjectId 和 storageProjectId，禁止继续使用含糊的单一“projectId”承担两种语义。

第一阶段必须完成路由清单：
- 内容/文件/文档/评论/历史/编译请求指向当前 storageProjectId，服务端授权回溯父项目。
- 项目名称/成员/共享/归档/删除/仓库管理请求使用 logicalProjectId；内部存储 ID 不能直接执行这些控制操作。
- 下载、图片、PDF、WebSocket、旧 Angular/原生 XHR 等不能依靠“仅为 fetchJSON 加一个 header”完成隔离；每种入口都有明确 scope。
- 旧匿名共享链接默认只进入原默认工作区，不能因增加分支而默默扩大访问范围。

## 4. 分支与编辑语义

### 4.1 新建与进入分支

1. 在仓库级 ref 锁下校验分支名/起点，捕获确切 commit。
2. 幂等创建 registry 的 preparing 记录、Git worktree 和内部文档空间。
3. 从提交内容初始化文件树和新 docId，映射 rootDoc 等文档引用；未提交编辑不应被暗中视为提交内容。
4. 只有初始化完整并验收后，才标记 ready 并允许加入。
5. 分支已存在则加入已有工作区；同分支不为每个用户各创建一份文档。

### 4.2 会话切换

先保存本会话缓冲并确认，释放旧 doc 订阅，加入新工作区/新 docId，取消旧编译、预览和 AI 响应。切换只改变本会话；不能把旧工作区的未提交改动搬到新分支，也不能替其他成员执行 stash。旧工作区内容和 index 原样保留。

分支工作区有脏内容时，界面明确提示“留在原分支”，不阻止成员正常离开。归档/删除工作区则需检查所有会话、未提交内容、未完成事务和恢复草稿。

### 4.3 历史查看

展开 Commit 或进入历史预览是只读查看，不改变编辑工作区。需要在旧提交上继续写作时，显式创建/选择分支。首版不提供多人共享的可写 detached HEAD，避免没有分支归属的协作修改。

## 5. 防覆盖事务与合并

同分支普通文本编辑继续使用既有实时协作协议。Git 批量回写走独立的 WorkspaceMutationCoordinator：

1. 捕获目标工作区身份、epoch、HEAD、文件身份和版本向量。
2. 远程请求、diff、合并计算放在隔离 Git 工作区完成，不长时间冻结编辑器。
3. 应用前发出 prepare barrier，在线会话排空已提交的编辑缓冲；服务器短暂阻止新操作入队并排空已接受队列。
4. 核对最新结构版本、docId/version、资源 hash、HEAD/index 指纹。任何相关变化使旧预览失效，重新计算或返回冲突。
5. 在有续租及 fencing token 的短事务中，经原生文档 API 写入，并记录每个步骤。
6. 完成后广播 workspace revision/epoch 和状态，客户端确认重载必要文档；只有所有阶段满足完成条件才显示成功。

建议的持久状态：`prepared → quiescing → applying-documents → documents-applied → ref-updated → published`，另有 conflict/failed/recovery-required。发生重启或租约丢失，旧写者不能继续提交；恢复依据日志判断已完成步骤，不重复运行已经产生提交的 Git 命令。

跨分支合并首版采用保守规则：仅合并来源分支已提交内容；目标工作区需要无未提交内容且完成保存检查。否则先明确处理工作区改动，不自动替用户 commit/stash/discard。计算期间允许继续编辑；最终检查失败则停止应用，不覆盖新编辑。

冲突先保存在独立合并任务中，不直接把 conflict markers 写进全员正在编辑的论文。解决后再次校验目标状态才应用。Git ref 使用 compare-and-swap，工作区与仓库锁采取固定顺序，避免互相等待死锁。

离线缓冲服务器无法提前获知：不得伪造保存确认。重连先验证 workspace/epoch，失配则将仍可恢复的内容提交为恢复草稿，不能直接重放。浏览器崩溃前完全未上传的数据能否持久恢复，需要独立定义本地存储、加密与留存政策，不能承诺绝对零丢失。

## 6. Shell / AI / /git 共用入口

- Shell 不再直接挂载 live worktree 作为可写目录，而是挂载带基线清单的隔离草稿。
- 命令结束后计算差异；只有通过 workspace/epoch/文件版本检查，才经协调器回写。发生同时编辑则保留双方版本，生成冲突/审阅项。
- Full Access 放宽的只是独立容器内部执行权限；不允许越过父项目授权、工作区归属或文档版本检查。
- AI 任务在开始时捕获工作区身份；切换分支后旧任务的结果不能应用到新工作区。
- Git 面板、/git 和后台任务使用同一后端命令服务。HTTP 提交身份包含 operationId 与工作区代次；UI 确认不是唯一防护。
- Shell 草稿不能因为 status 刷新或会话退出而被静默抹去；需要可恢复清单和明确的保留期限。

## 7. Git Graph 实时协作者位置

服务器推导实际编辑分支/HEAD；客户端只上报允许的查看意图。分别保存 editingWorkspace 和 viewedCommit，不能把“点开某提交”说成用户切换到了该版本。

Presence 以 sessionId 为键，不以 userId 为唯一键。字段包括用户显示身份、workspace、编辑 HEAD/dirty 状态、viewedCommit、单调更新序号、lastSeen 和连接状态。使用 Redis 共享状态，初次订阅完整快照，之后增量事件，断线/超时清理。心跳20秒、过期60秒作为可调初始值，不宣称网络零延迟。

内容事件继续走工作区房间；跨分支位置走独立 `git-presence:<logicalProjectId>` 房间，不能把其他分支正文广播到该房间。权限撤销时立即移除 presence 并断开相关工作区订阅。

Graph 显示：编辑头像在 branch/Working Changes 或确切 HEAD；历史查看用不同样式；多人头像堆叠；同用户多会话可展开。点击头像只定位/高亮节点，不 checkout。节点被过滤或未分页加载时显示定位入口。窗口像素坐标不作为用户位置，避免不同尺寸的 Graph 对不上。

## 8. 自动化、权限与论文特有行为

在前述隔离与恢复通过后，再提供 project/branch 范围的单一后台任务。任务有持久 operationId、租约、状态、下次执行时间、失败退避和负责人；不能由多个浏览器各自 setInterval 实现。

自动检查点、commit、fetch、pull、push 独立配置。默认先支持检查点/commit/fetch，远程 push 显式开启；pull 必须走上述协作事务。有未完成冲突、恢复、权限撤销或结果未知时暂停。禁止自动强推、硬重置或丢弃内容。

个人执行模式不等于项目管理权限。区分编辑、提交、管理共享分支、管理远程/自动任务、危险操作等能力；自动任务使用明确归属的凭据，成员离开/凭据失效有暂停和移交流程。

共享暂存区首版保留每工作区一个 index，增加内容指纹、提交预览和操作人记录；不暗中建立每用户不同 index。普通 commit 身份不能被描述成所有实际编辑者；自动提交使用明确机器人/服务身份，贡献记录从可信协作记录推导。

主文档/编译器/文件树/评论/历史必须有工作区归属。分支创建时复制论文内容与相应设置，重新映射文件 ID；评论和历史的继承/来源标识单独处理，不能直接复用源分支的可变评论记录。删除父项目时清理所有内部空间，清理前检查恢复事务并记录结果。编译缓存和迟到 PDF 响应不得跨工作区使用。

## 9. 迁移、回滚与上线门槛

- 功能默认关闭；先在独立合成项目启用，生产论文不做自动结构迁移。
- 为现有项目注册 default workspace，保留原文档/历史 ID 和当前 Git HEAD/index/未提交字节。
- 增加第二工作区后，不能简单关开关并把多个分支合成一份默认文档；回滚应禁止新切换、保留所有工作区，导出/备份后明确选择恢复入口。
- 每次迁移有幂等键、前后清单/哈希、状态与失败恢复路径。未 ready 的空间不被普通编辑 API 使用。
- 父项目授权、分享链接、项目列表/搜索、删除/恢复/归档、配额和后台清理均完成负向测试后才启用内部存储方案。

## 10. 分阶段实现顺序与可交付物

| 阶段 | 实现内容 | 必须通过的门槛 |
|---|---|---|
| P1 身份与权限基础 | WorkspaceRegistry、逻辑/存储身份解析、内部记录过滤、API scope 清单、default workspace 注册 | 旧项目内容/ID 不变；伪造 workspace、跨项目 docId、直接内部 ID 控制操作均被拒绝 |
| P2 独立编辑与会话切换 | 新分支初始化、文件树/docId/房间/编译隔离、个人切换、epoch 和旧响应拒绝 | 两用户不同分支互不影响；同分支实时协作；多标签页独立；离线重连不串分支 |
| P3 防覆盖统一事务 | 保存 barrier、版本向量、租约 fencing、持久操作状态、隔离合并、Shell/AI 草稿回写、暂存预览指纹 | 全部10项防覆盖场景；断网/重启/并发重命名/租约失效故障注入，字节与版本均可核对 |
| P4 Graph presence | 服务器位置推导、会话心跳、快照/增量广播、头像/查看状态/定位/过滤提示 | 三用户两分支多标签页；乱序事件、断线、权限撤销、分页/筛选均不显示错误位置 |
| P5 项目级自动任务 | 持久调度、单一执行者、分开的 commit/fetch/pull/push 策略、凭据归属和冲突暂停 | 重复调度不重复提交；中途远程成功但响应丢失时先对账；不执行强制覆盖 |
| P6 完整项目生命周期 | 评论/历史继承、主文档/编译配置、资源限制、归档/删除/导出、可恢复迁移 | 不泄露分支或成员数据；完整恢复演练；独立项目 Clone 与内部工作区创建清晰区分 |

P1 的权限和生命周期负向门槛不能推迟到 P6；P6 是完整用户体验和综合验收，不是补上最基本的隔离。P2/P3 完成前不向真实用户开放不同分支编辑；P3 完成前不允许自动 pull 或 AI 自动修改 live 文档。P4 可在隔离已成立后与后续调度开发并行，但不得把 presence 当成防覆盖机制。

## 11. 验证与可观测性

冻结至少三组项目：原有默认工作区、两分支三用户项目、独立 Clone 项目。记录用户会话/工作区/epoch、docId/version、结构版本、文件字节 hash、index tree、HEAD/ref、远程 ref、事务/任务 ID 和编译 snapshotRevision。

必须分别验证：A/B 同文件编辑；A/B 不同文件编辑；A 切分支而 B 留在原处；第三用户加入原分支；离线重连；旧请求到达新工作区；预览后暂存区改变；Shell 与页面并发；重命名后旧 doc 写入；多文件应用中断；重复任务；凭据撤销；权限撤销；跨项目伪造身份；合并后编译与评论行为。

阶段报告明确区分源码/单元/原生 Git/双浏览器真实协作/部署证据。没有双用户实际验收，不将功能标成“多人分支协作完成”。
