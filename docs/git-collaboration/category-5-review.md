# 第五类交付记录 — 2026-11-12

本轮先补齐分支生命周期功能，再修复实际缺陷，已部署18082。基础功能可交互；不宣称所有生命周期/灾难恢复场景完成。未进入第六类，未提交或推送源码。

## 已实现

- 分支独立评论、编辑历史、编译输出；新分支开始独立评论/编辑历史时间线，源分支记录仍保留，Git历史共享。
- 新分支继承当前工作区的根文档路径、编译器、镜像和拼写设置。来源提交记录所选分支实际HEAD。
- Source Control → Repositories → Branch workspaces：查找、打开、归档、恢复。归档/恢复仅所有者可执行，保留文档、评论、历史；待处理合并/回写/恢复任务阻止归档。
- 归档停止该分支自动任务，旧编辑会话冻结并显示 Branch archived 与返回项目入口；本地恢复副本保留。
- 归档和恢复共同使用受保护的会话版本切换，修复恢复后无法重新连接的问题。
- 历史文件/项目回退增加仓库锁、权限复核、在线写入准备及回退前历史保存。
- 父项目个人归档/取消归档保留分支。内部工作区不能直接执行父项目生命周期操作。

## 实际验证

仅合成项目6af40820d9a4263b7a7c0e12，未操作正式论文或真实Git远端。

- 15项针对性测试通过，0失败；前端构建成功，有2条构建警告。相关diff空白检查通过。
- 生命周期分支894090428e053202c817b990：归档200；归档后评论读取403；恢复200；评论和历史标签前后完全一致；恢复后编译success。证据category-5-final-acceptance.json。
- 跨分支评论存储隔离；独立历史ID、根文档ID；编译输出URL限定目标工作区。证据category-5-storage.json、category-5-target-comments.json、category-5-other-comments.json、category-5-compile.json。
- 历史文件回退返回200并产生新文档ID，证据category-5-history-revert-retry.json。此前尝试的编辑标记未实际写入，不能将其计为内容差异恢复验收。
- 修复后的来源验证：068323a4705d7cc1c659b9e9记录888b0cc9e350b59791859ea5a34c01215f2447e0，与选定旧提交一致。首次生命周期fixture记录旧来源错误，保留原证据未篡改。见category-5-final-workspaces.json。
- 后端11文件SHA核对，前端部署脚本核对生成文件，仅重启18082 web/web-api。见category-5-final-deploy.json、category-5-final-deploy.log。
- Chrome确认归档提示、恢复后编辑器以及新管理入口；Firefox最后阶段原生窗口读取失败cgWindowNotFound，不能算双浏览器最终画面验收通过。

## 失败与修复记录

首次恢复仅推进数据库epoch，未同步会话成员epoch，造成连接失败。代码改为归档/恢复均使用准备写入流程。合成fixture遗留epoch不一致在保留恢复快照、核对固定项目/分支/epoch及独占租约后定点修复；没有放宽生产检查。见category-5-repair-fixture.mjs及log。修复后再次归档/恢复通过。

归档读取原返回500，改为标准ForbiddenError后复测403。首次评论请求使用无效23位ID返回400，随后有效24位ID成功。一次Firefox地址栏导航过快将URL粘到测试文档，立即撤销并确认末行恢复；随后导航增加聚焦等待。未改正式论文。

## 明确限制

- 未完成锚定评论范围的完整UI交互与Firefox最终恢复画面验收；接口评论验证不能替代这些检查。
- 带子工作区的逻辑项目永久删除及已删除项目整体恢复仍被阻止，未实现级联永久删除/完整灾难恢复。
- 多文件历史回退已有写入保护，但没有新增持久化逐文件回退事务日志；中途进程崩溃的完整自动回滚未验收。
- 本轮不代表第六类完整多用户与全部故障组合验收通过。

## 路径与改动

输入：docs/git-collaboration/requirements.md、implementation-plan.md及现有源码。输出：本报告、task_plan.md、notes.md与category-5-*证据。

本轮生产/测试文件：

- services/web/app/src/Features/NativeGit/WorkspaceLifecycle.mjs
- services/web/app/src/Features/NativeGit/WorkspaceRoutes.mjs
- services/web/app/src/Features/NativeGit/BranchWorkspaces.mjs
- services/web/app/src/Features/NativeGit/NativeGitRuntime.mjs
- services/web/app/src/Features/NativeGit/GitCommands.mjs
- services/web/app/src/Features/NativeGit/RepositoryEvents.mjs
- services/web/app/src/models/Project.mjs
- services/web/app/src/Features/Project/ProjectCreationHandler.mjs
- services/web/app/src/Features/Collaborators/CollaboratorsGetter.mjs
- services/web/app/src/Features/History/HistoryController.mjs
- services/web/app/src/Features/History/HistoryWorkspaceWrite.mjs
- services/web/frontend/js/features/source-control/branch-workspaces.tsx
- services/web/frontend/js/features/source-control/source-control-panel.tsx
- services/web/frontend/js/features/ide-react/context/editor-manager-context.tsx
- services/web/test/agent/workspace-lifecycle.test.mjs
- services/web/test/agent/native-git-branch-workspaces.test.mjs

未改动：正式论文、真实Git远端、18080/18081部署。保留其他已有脏改动和第四类冲突现场。
