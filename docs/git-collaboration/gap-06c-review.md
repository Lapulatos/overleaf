# G06c 保留清理与永久删除保护

状态：部分完成，未进入 G07/G08。

## 已实现并部署18082
- ProjectDeleter 服务层阻止分支项目/恢复项目进入旧删除、过期清理流程；账号删除在处理第一个项目之前预检完整清单，避免先删普通项目再碰到保护错误。
- 所有者可检查保留备份：完整备份始终保留；恢复任务引用（包括失败任务）始终保留；不足24小时的残片保留。
- 超过24小时的未完成、无引用残片可逐个审核清理。确认前重查目录指纹；先持久化回执并移入独立隔离目录，再删除该测试/残片目录；中断可依据回执继续。
- 无Git对象GC，不删除失败恢复生成的工作区，也不开放整论文永久删除。

## 检查
- gap-06c-retention-tests.log：7项通过，覆盖新旧残片、完整备份、恢复引用、变动后旧确认拒绝、权限、符号链接、隔离后回执丢失及重复调用。
- gap-06c-guard-fixture.log：真实内部deleteProject调用对测试父/子项目均拒绝，项目仍存在。
- gap-06c-protected-preview.png：现有Chrome显示保留理由和续做按钮；现有Firefox协作者被拒绝。
- gap-06c-cleanup-completed.png / gap-06c-ui-result.json：Chrome真实点击续做后状态completed，隔离残片已删除，完整备份和新残片仍在。
- 24小时老化通过定向模块中的注入时钟验证。浏览器续做使用gap-06c-cleanup-fixture.mjs构造的已审核隔离状态；没有宣称浏览器实际等待24小时或验证新清理确认按钮。
- gap-06c-build.log：构建56966ms，两条警告；2份前端文件哈希验证部署；最终/login200。首次构建工作目录错误记录在gap-06c-build-wrong-directory.log，随后更正。

## 剩余
整项目永久删除尚不能开放：必须提供父项目之外的备份/删除回执访问入口、持久停写所有工作区、处理后台任务与共享资源引用，然后才执行可重试级联。当前备份入口依赖活跃项目，直接删除父项目会使保留备份失去网页访问入口。

修改：NativeGit/DeletionRetentionGuard.mjs、BackupRetention.mjs、WorkspaceRoutes.mjs、NativeGitRuntime.mjs、GitCommands.mjs；Project/ProjectDeleter.mjs；source-control/project-backups.tsx；2份定向测试和本项目证据文档。未修改正式论文、远端仓库、18080/18081。
