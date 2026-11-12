# G06c 整项目删除验收

2026-11-12，限隔离18082与合成项目。G06c本项已完成；不代表G07/G08完成。

## 实现与边界
所有者从独立恢复库审核删除。逐分支停写并核对已保留备份；内容更新则拒绝删除。私人Assistant记录按原用户保留，不进入所有者共享论文备份。持久步骤日志支持继续；不可逆删除开始后只能恢复成新项目。原普通删除入口保持保护。保留备份、审计、恢复记录是有意保留，不承诺清除全部存储字节。

删除标记在epoch fence之前持久化，避免进程中断留下无所属操作的冻结。恢复标记后先排空已有更新再冻结；取消时排空并提升epoch，旧会话不能继续写入新代次。

## 实际验收
- Chrome确认删除合成根项目a0172bd979f0006e49748cd3及子工作区43042f1cc137163286102bb8。首次因准备事务的预期fence后置断言暂停，修复后通过页面Resume继续，15步骤完成；Mongo两个Project均不存在。源夹具848f4c03b61eeca597cdd540保留。
- 原项目已删除后，Chrome在恢复库通过表单恢复成30d83b036221e05b54505eb8并打开。
- Firefox B能下载自己的私人对话；Chrome所有者访问同一私人导出404。
- Firefox在备份后新增编辑，Chrome确认删除被快照不一致拒绝；Firefox收到停写与本地恢复提示。Chrome取消后原新编辑保留。
- 重新加载后Firefox新增标记同步到Chrome；Chrome新增另一标记同步到Firefox。截图gap-06c-cancel-coedit.png，两端均显示两行。
- 实际服务夹具模拟持久标记后、fence前的中断，恢复冻结并取消成功，epoch升至6：gap-06c-marker-recovery.log。
- 4项状态机定向测试通过：全冻结后才能删、备份不一致可取消、丢响应续做、撤权/备份损坏拒绝续做。

## 证据
- gap-06c-deletion-completed.json
- gap-06c-after-delete-restored.json
- gap-06c-private-download.json
- gap-06c-newer-edit-protected.png
- gap-06c-cancelled.json
- gap-06c-cancel-coedit.json / png
- gap-06c-marker-recovery.log
- gap-06c-deletion-deploy.json、gap-06c-deletion-ui-deploy.log

保留无效操作说明：最初Firefox测试文字进入地址栏，Chrome第一次粘贴未取得编辑器焦点，均未计为通过；重试成功截图为最终证据。未修改正式论文或远端。未覆盖全部跨服务进程终止排列，统一列G08已有故障矩阵，不新增编号。
