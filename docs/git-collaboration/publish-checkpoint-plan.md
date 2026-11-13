# Git 基础功能提交检查点（2026-11-13）

## 范围
用户授权提交并推送 Git 基础功能到现有 feature/writing-assist 分支。包含 Git UI、Terminal 会话、恢复、预览及必要的 Assistant Dock 接入。不包含插件库改动、本地部署配置、原始日志/截图/备份、取消的 auto-sync remote 修复。

## 步骤
- [x] 检查本地分支、远端、工作区和已有验收记录。
- [x] 明确暂存清单，检查依赖、敏感数据和差异。
- [x] 运行针对性回归，在独立暂存树验证实际提交内容。
- [x] 更新阶段状态与后续环境设置方案。
- [ ] Commit、普通 fast-forward push，核对远端 SHA。

## 边界
Git 基础功能阶段基本完成不等于所有场景已验证。SSH、网络/资源设置、Agent 接管仍为规划。不得重启 Terminal runner 或修改用户论文来验收。

## 提交前验证结果

- 暂存快照独立导出到 `/tmp/overleaf-git-publish-check`，其依赖链接到现有 node_modules，不使用工作区未暂存的插件源码。
- 后端 10 个文件首次运行 91 项：90 通过、1 失败。失败为既有 HTTP 授权测试缺少 commit fingerprint；补齐合法请求字段后该文件 13/13 通过，其他文件此前 78/78 通过。没有删掉断言或放宽接口。
- 10 个针对性前端测试文件：28/28 通过，覆盖 Session 操作、跨分支定位、图标、历史回放、缩放、合并入口及终端适配器。
- 完整 Source Control 前端测试：180 通过、59 失败。已观察到旧按钮文案/入口选择器、fixture 与 JSDOM 布局 API 问题；尚未逐项归因，不能把全部失败都判定为无害。
- 独立快照 production webpack 成功；39 warnings，包括链接工作区依赖的 export 警告和构建大小警告。本次不将这些产物部署到用户实例。
- git diff --cached --check 通过；新增差异与两次已有待推送提交未检出所检查的私钥/GitHub token 特征。该扫描不是完整安全审计。
- 远端 feature/writing-assist 是本地 HEAD 的祖先，普通 fast-forward push，不 force、不合并 main。

原始日志仅本地保留（不上传运行路径和完整诊断）：
- `git-publish-backend-tests.log` SHA256 `6159d7ba4d9e5729a1c955bd03aeafd0c39cb9972f298ff5534a9b1b6fd318f8`
- `git-publish-handler-rerun.log` SHA256 `0f38123101db92af7487c7b9d565fa03c25bb7b701f8fca75d4844b36e36e167`
- `git-publish-targeted-ui.log` SHA256 `5805953b8d3639a8b3307cd8b603001256ab0a4146e5109b292c96ad6da38258`
- `git-publish-frontend-tests.log` SHA256 `f7ddbb89630bfa410cbc14dc7eb98932472f8ac075a74e46f627f3528fbf425b`
- `git-publish-build.log` SHA256 `9a24b56f11a9ed927734d106d66fa19f62f470cde07bca17f09e3c1e6fa4b36d`

## 精确提交清单

- `docs/git-collaboration/README.md`
- `docs/git-collaboration/basic-git-checkpoint.md`
- `docs/git-collaboration/publish-checkpoint-plan.md`
- `docs/git-collaboration/terminal-environment-and-assistant-plan.md`
- `services/web/app/src/Features/NativeGit/AutoCommitIndicators.mjs`
- `services/web/app/src/Features/NativeGit/GitCommands.mjs`
- `services/web/app/src/Features/NativeGit/GitRepository.mjs`
- `services/web/app/src/Features/NativeGit/MergeDraftService.mjs`
- `services/web/app/src/Features/NativeGit/NativeGitHandlers.mjs`
- `services/web/app/src/Features/NativeGit/NativeGitRuntime.mjs`
- `services/web/app/src/Features/NativeGit/SearchScore.mjs`
- `services/web/app/src/Features/NativeGit/ShellContainerLifecycle.mjs`
- `services/web/app/src/Features/NativeGit/ShellDraftCommands.mjs`
- `services/web/app/src/Features/NativeGit/ShellDraftService.mjs`
- `services/web/app/src/Features/NativeGit/ShellSessionWorkspace.mjs`
- `services/web/app/src/Features/NativeGit/TerminalAccess.mjs`
- `services/web/app/src/Features/NativeGit/TerminalIndicators.mjs`
- `services/web/app/src/Features/NativeGit/TerminalUserError.mjs`
- `services/web/frontend/js/features/ide-react/components/layout/editor.tsx`
- `services/web/frontend/js/features/ide-react/components/modals/local-recovery-copies.tsx`
- `services/web/frontend/js/features/ide-react/components/modals/out-of-sync-modal.tsx`
- `services/web/frontend/js/features/ide-react/context/ide-react-context.tsx`
- `services/web/frontend/js/features/source-control/access-mode.tsx`
- `services/web/frontend/js/features/source-control/api.ts`
- `services/web/frontend/js/features/source-control/auto-commit-indicator.tsx`
- `services/web/frontend/js/features/source-control/auto-commit-settings.tsx`
- `services/web/frontend/js/features/source-control/auto-sync-indicator.tsx`
- `services/web/frontend/js/features/source-control/auto-sync-settings.tsx`
- `services/web/frontend/js/features/source-control/blame-view.tsx`
- `services/web/frontend/js/features/source-control/branch-picker.tsx`
- `services/web/frontend/js/features/source-control/branch-workspaces.tsx`
- `services/web/frontend/js/features/source-control/clone-repository.tsx`
- `services/web/frontend/js/features/source-control/collaboration-tasks.tsx`
- `services/web/frontend/js/features/source-control/commit-graph.tsx`
- `services/web/frontend/js/features/source-control/conflict-editor.tsx`
- `services/web/frontend/js/features/source-control/discovery-schedule.tsx`
- `services/web/frontend/js/features/source-control/editor-graph.tsx`
- `services/web/frontend/js/features/source-control/file-preview.tsx`
- `services/web/frontend/js/features/source-control/git-command-panel.tsx`
- `services/web/frontend/js/features/source-control/git-presence-list.tsx`
- `services/web/frontend/js/features/source-control/git-terminal.tsx`
- `services/web/frontend/js/features/source-control/graph-history.tsx`
- `services/web/frontend/js/features/source-control/graph-settings.tsx`
- `services/web/frontend/js/features/source-control/history-recovery.tsx`
- `services/web/frontend/js/features/source-control/ignored-files.tsx`
- `services/web/frontend/js/features/source-control/merge-branch-picker.tsx`
- `services/web/frontend/js/features/source-control/preview-zoom.tsx`
- `services/web/frontend/js/features/source-control/project-backups.tsx`
- `services/web/frontend/js/features/source-control/read-only-history.tsx`
- `services/web/frontend/js/features/source-control/remote-discovery-status.tsx`
- `services/web/frontend/js/features/source-control/remote-settings.tsx`
- `services/web/frontend/js/features/source-control/reset-dialog.tsx`
- `services/web/frontend/js/features/source-control/search-score.ts`
- `services/web/frontend/js/features/source-control/session-recovery.tsx`
- `services/web/frontend/js/features/source-control/shell-drafts.tsx`
- `services/web/frontend/js/features/source-control/shell-terminal-api.ts`
- `services/web/frontend/js/features/source-control/source-control-panel.tsx`
- `services/web/frontend/js/features/source-control/source-control.css`
- `services/web/frontend/js/features/source-control/stash-manager.tsx`
- `services/web/frontend/js/features/source-control/terminal-history.tsx`
- `services/web/frontend/js/features/source-control/terminal-indicators.tsx`
- `services/web/frontend/js/features/source-control/tool-action.tsx`
- `services/web/frontend/js/features/source-control/types.ts`
- `services/web/frontend/js/features/source-control/webhook-settings.tsx`
- `services/web/frontend/js/features/source-control/workspace-task-notice.tsx`
- `services/web/frontend/js/features/source-control/worktree-manager.tsx`
- `services/web/frontend/js/features/source-editor/extensions/writing-assist/agent-panel.css`
- `services/web/frontend/js/features/source-editor/extensions/writing-assist/assistant-dock.tsx`
- `services/web/frontend/js/features/source-editor/extensions/writing-assist/conversation-panel.tsx`
- `services/web/test/agent/auto-commit-indicators.test.mjs`
- `services/web/test/agent/auto-sync-indicators.test.mjs`
- `services/web/test/agent/native-git-handlers.test.mjs`
- `services/web/test/agent/native-git-merge-draft.test.mjs`
- `services/web/test/agent/native-git-shell-container-lifecycle.test.mjs`
- `services/web/test/agent/native-git-shell-draft.test.mjs`
- `services/web/test/agent/shell-session-workspace.test.mjs`
- `services/web/test/agent/terminal-history-replay.test.mjs`
- `services/web/test/agent/terminal-indicators.test.mjs`
- `services/web/test/agent/terminal-user-error.test.mjs`
- `services/web/test/frontend/features/source-control/auto-commit-indicator.test.tsx`
- `services/web/test/frontend/features/source-control/auto-sync-indicator.test.tsx`
- `services/web/test/frontend/features/source-control/branch-workflow.test.tsx`
- `services/web/test/frontend/features/source-control/git-presence-list.test.tsx`
- `services/web/test/frontend/features/source-control/git-terminal.test.tsx`
- `services/web/test/frontend/features/source-control/preview-zoom.test.tsx`
- `services/web/test/frontend/features/source-control/project-terminal-sessions.test.tsx`
- `services/web/test/frontend/features/source-control/session-bulk-delete.test.tsx`
- `services/web/test/frontend/features/source-control/shell-terminal-api.test.ts`
- `services/web/test/frontend/features/source-control/terminal-history.test.tsx`
- `services/web/test/frontend/features/source-control/terminal-indicators.test.tsx`

未暂存内容均留在工作区，包括 Plugin/Skill 改动、取消的 auto-sync 修复、本地配置及原始产物。发布结果以本分支提交记录与远端 HEAD 核对为准。
