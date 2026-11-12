# G08 / W15 共享暂存区过期提交保护

2026-11-13；部署仅18082；原Chrome A、Firefox B；工作区5f057c40ee42775e1f180e8f。

发现：旧审计的“已有共享index指纹”不适用于普通commit；该入口只对amend检查HEAD/branch，普通和菜单提交没有绑定审核内容。

实现：GitRepository增加commitPreview，以HEAD、branch、operation、提交选项及index条目生成指纹；all另绑定工作区文件字节。在项目锁内提交前重验，失败409且不暂存或提交。公共commit命令必须提供指纹。按钮、菜单、amend及Paper Assistant /git commit都获取并保存预览，旧确认不会自动替换为最新指纹。界面列出待提交文件。

修改：GitRepository.mjs、GitCommands.mjs、NativeGitRuntime.mjs；source-control-panel.tsx、git-slash-command.ts；native-git-repository.test.mjs、git-slash-command.test.ts。

验收：
1. 2项仓库测试：其他人新增暂存文件后拒绝且HEAD/index不变；all绑定实时内容及选项，普通暂存提交保留较新的未暂存编辑。
2. 1项公共命令schema测试拒绝无指纹提交。
3. /git解析与准备5项通过，包括all/signoff确认绑定。
4. 原Chrome暂存main.tex并打开提交确认；原Firefox取消暂存；Chrome旧确认显示拒绝，双方正文保留，截图gap-08-commit-stale-refusal.png。
5. Firefox重新暂存，Chrome重新审核后成功，提交b387d60d4efaaf646816bf4e5d47e2bffe380924，父提交仍是原b6ba231a，拒绝未产生额外提交。截图gap-08-commit-fresh-success.png。
6. 生产前端构建通过（2条既有warning），部署资源逐文件哈希验证。

边界：/git本轮为准备逻辑测试，未冒充完整Paper Assistant交互；旧客户端未提供指纹会拒绝，需要刷新。未推送远端或改正式论文。自动提交使用独立事务，不通过人工commit接口。

失败记录：首次前端测试命令从错误工作目录执行且暂存目录没有测试文件；改在仓库services/web运行既有mocha环境后5项通过。
