# 第二类交付：防覆盖事务、中断恢复

日期：2026-11-12。状态：本轮修复、针对性验收和18082部署完成，等待用户交互反馈。未进入第三类，未提交或推送。

## 实现结果

1. **旧写入失去租约后仍可能落盘**：请求入场检查不能保护后来暂停的请求。在document-updater真正执行Redis文档写入的同一Lua操作中再次检查项目写入token。token消失或被替换时拒绝写入，保留新文档。
2. **恢复完成但释放阻塞失败后的重试**：Shell和合并恢复已经持久化完成记录时，相同operationId只完成本任务的收尾。不会再应用文档、创建提交或推进epoch，也不能释放其他任务的阻塞。

## 四项验收与证据

| 验收项 | 本轮结果 | 证据边界 |
|---|---|---|
| 合并预览后其他人继续编辑 | 旧预览、源提交变化、编辑后撤销、恢复快照变化均拒绝旧写回 | 临时真实Git仓库及文档适配器测试；本轮未重复完整双浏览器合并流程 |
| AI/Shell草稿过期 | Shell在Chrome实际运行命令并封存；Firefox继续编辑后，Chrome应用被拒绝。AI状态检查/确认/恢复测试通过 | Shell双浏览器真实界面；AI为模块测试，未调用在线模型 |
| 写入中断后旧请求失效 | 真实子进程SIGSTOP，租约过期后SIGCONT，旧写入拒绝；临时Redis重启后旧请求也拒绝 | 使用生产下游组件和独立测试数据；未杀死正在服务用户的Redis |
| 恢复重试幂等 | Shell/合并完成后释放失败，相同请求重试不重复写入、提交或推进epoch | 故障注入集成测试；不代表全部跨Mongo/Redis/Git故障组合 |

日志：
- `category-2-downstream-process.log`：7通过（含3个下游防覆盖检查）。
- `category-2-recovery-after.log`：36通过（合并/Shell恢复）。
- `category-2-ai-recovery.log`：25通过（AI事务/恢复）。
- `category-2-ai-stale.log`：26通过（AI检查/确认/处置）。
- `category-2-redis-restart.log`：独立Redis重启检查通过；重启间隙的ECONNREFUSED属于预期连接中断。
- 合计94项测试通过，无失败、无跳过；独立Redis检查与浏览器演示另计。

保留失败证据：`category-2-downstream-before.log`、`category-2-shell-before.log`展示修复前失败；`category-2-redis-restart-timeout.log`是测试协调信号超时的无效尝试，不计入通过。`category-2-deploy.log`保留最初服务路径错误，随后使用实际runit服务名完成重启。

## 18082可见演示

项目：Branch collaboration synthetic acceptance。
工作区：`acceptance/mwc9t9k4/shared`，storage ID `e862a1d037cf8d10f1d4336e`。
入口：http://127.0.0.1:18082/project/6af40820d9a4263b7a7c0e12/workspace/e862a1d037cf8d10f1d4336e

Chrome为A、Firefox为B，使用原有标签页。A在私人Shell草稿执行 `printf '\n%% category2-shell-stale\n' >> main.tex`，封存并预览后，B向共享文档添加 `% category2-B-newer-edit`。A点击Apply reviewed changes，页面显示：

> Collaborative workspace changed; keep this draft and prepare a new review

截图：[拒绝过期草稿](category-2-stale-shell-refused.png)。随后通过编辑器全选复制检查完整文本：B标记存在、Shell标记不存在。剪贴板已恢复，编辑器未修改。草稿已停止并封存，未留运行中的Shell。

## 文件与部署

输入：当前工作树的写入保护、Shell/合并恢复实现及既有验收测试。

生产改动（均已复制到18082容器，SHA-256逐一一致）：
- `libraries/redis-wrapper/ProjectWriteGate.js`
- `services/document-updater/app/js/DocumentDeletionFence.js`
- `services/web/app/src/Features/NativeGit/ShellRecoveryService.mjs`
- `services/web/app/src/Features/NativeGit/MergeRecoveryService.mjs`

测试改动：
- `services/web/test/agent/native-git-downstream-fence.test.mjs`（新）
- `services/web/test/agent/native-git-shell-application.test.mjs`
- `services/web/test/agent/native-git-merge-draft.test.mjs`

输出：本报告、`task_plan.md`当前任务段、上述日志/截图及`category-2-redis-restart.mjs`测试脚本。

仅重启18082的web、web-api和document-updater服务。未改18080/18081/80实例、正式论文、远程仓库或其他既有工作树修改；无前端改动，无前端重建。临时Redis6387已关闭，原Redis6379 PONG正常。针对性语法检查及diff空白检查通过。

## 限制

新增原子token校验面向启用NativeGit、非RedisCluster、携带项目写入token的文档更新。不能据此宣称所有Mongo结构变更或RedisCluster路径都获得相同原子性。本轮没有验证在线AI生成或完整生产灾备恢复。保留现有自动同步开放限制，不借本轮验收扩大开关范围。
