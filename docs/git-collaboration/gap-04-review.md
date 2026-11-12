# G04 磁盘容量保护

2026-11-12：实现并部署18082，现有Chrome/Firefox显示空间不足提示，恢复配置后仓库加载成功。

## 修改
新增StorageCapacity：使用bavail而非bfree，检查可用inode，估算文件块/目录/临时文件和300MiB默认保留空间；允许服务端NATIVE_GIT_MIN_FREE_BYTES配置。新快照目录检查最近存在的祖先目录。
WorktreeFiles在删除旧路径前检查新增/替换容量；RecoverySnapshots写入前检查；MergeApplicationService在转移正文之前检查前像、后像和工作区写入；HistoryWorkspaceWrite在建立新任务前检查快照容量。NativeGitHandlers返回明确507，处理ENOSPC/EDQUOT；历史恢复界面识别507。

## 验证
- gap-04-storage-tests.log：3项检查通过（可用块/inode/多份快照；缺失目录与读取失败；不足时原文件不删、快照目录不创建）。
- gap-04-merge-tests.log：2项通过，包括真实Git合并容量拒绝后HEAD/正文/epoch不变，任务仍可应用，恢复空间后同一任务成功。
- gap-04-deploy.json：7文件SHA256匹配；仅18082服务重启。
- 临时提高18082服务端reserve，无磁盘填充；Chrome和Firefox点击Retry均显示明确容量不足信息，gap-04-capacity-refused.png。真实HTTP507见gap-04-http-refusal.json。
- 已删除临时环境覆盖，恢复默认300MiB；双端重新加载仓库，gap-04-restored.png/json，HTTP200。此前G03新文字仍在。

## 有界证据
预检不是空间预留；其他项目仍可能抢占空间。这里检查NativeGit所在文件系统，不宣称替MongoDB/外部对象存储预留容量。中途异常仍依赖持久日志，不自动删恢复快照；本次没有实际填满磁盘做内核ENOSPC注入。
重启时一次过早刷新显示502，服务就绪后已刷新恢复；一次遗留项目锁属于已退出pid50608，核实/proc不存在后CAS释放，仅测试项目，记录gap-04-expired-process-lock.json。不是产品正常写入锁清理功能。
正式论文、外部远端、18080/18081未修改，无提交推送。下一项G05合并后论文验证状态。
