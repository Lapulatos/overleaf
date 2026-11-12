# G03 历史批量回退中断恢复

2026-11-12：已实现并在18082的现有Chrome A / Firefox B验收。

## 实现
HistoryRestoreJournal逐文件记录before/after，保留恢复前字节快照；重试前校验文件ID、版本、内容、根文档、编译器和工作区代次。仅事务成功退出才标为resolved；中断任务阻止新的Git仓库操作。Source Control → History recovery提供明确重试或保留当前文件，无自动覆盖。

## 实际验收
- 工作区48445a443f47da4c1f5de255，分支gap03/history-recovery-20261112，main.tex及second.tex。
- 先前失败任务349aac5a…通过Chrome的Retry historical restore完成两个文件恢复。
- gap-03-interruption-ready.log：真实RestoreManager完成首文件后注入异常，completed=1。任务c5a055d0…持久保留before/after。
- Chrome先打开预览，Firefox新增G03-B-newer-edit-preserve标记；Chrome提交旧预览被拒绝，截图gap-03-stale-preview.png。
- Firefox重新预览并选择Keep current files，任务resolved/kept-current-files；gap-03-firefox-kept.png、gap-03-journal-result.json。
- 两端刷新后，新文字保留，Firefox再输入G03-after-recovery-live-edit，Chrome实时看到，gap-03-live-edit-result.json/png。
- 4个定向日志测试通过，覆盖持久重建、过期预览、显式重试、事务结束失败；gap-03-tests.log。

## 边界及失败记录
首次真实恢复遇到内部请求失败，completed=0，保留gap-03-interruption.log，不算通过。容器历史服务认证配置修复和web/api就绪后，真实恢复成功。没有关闭认证或输出凭据。
此轮注入普通异常，不是操作系统SIGKILL；持久重建有模块测试。文件快照不是完整项目灾备。没有修改正式论文或外部远端，无提交推送。

## 修改范围
新增HistoryRestoreJournal.mjs、history-recovery.tsx及定向测试；修改HistoryWorkspaceWrite、RestoreManager、HistoryController、HistoryRouter、NativeGitRuntime、source-control-panel。部署记录gap-03-deploy.json、gap-03-finalization-deploy.json、gap-03-frontend-deploy.log。
