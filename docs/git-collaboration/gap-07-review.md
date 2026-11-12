# G07 远端更新通知

2026-11-12，本项实现与18082限定验收完成。公网GitHub投递未验证：localhost无公网HTTPS入口。没有在任何外部仓库注册Webhook或推送。

## 实现
- 项目所有者在Automatic remote checks中启用/关闭通知或轮换秘密及URL。须已有启用的周期发现计划并绑定github.com远端。
- 原始请求体HMAC-SHA256验签；独立随机入口身份、项目所有者、Git远端URL/full_name及首次签名投递的repository.id绑定。秘密加密存储，仅创建响应显示一次。
- delivery ID与请求摘要去重，保留最近256个回执。超出窗口的旧通知最多重复fetch；不应用payload中的Commit/ref，因此乱序不回退正文/分支。
- 持久提前现有后台发现计划，随后写回执；进程中断不会出现已确认却丢唤醒的状态。worker重新fetch当前远端并经现有RepositoryEvents通知所有工作区。周期检查仍补漏。
- 不自动merge，不写编辑正文；Webhook配置不进入可恢复项目备份，删除活跃仓库时移除。

## 验收
- 6项定向测试通过，gap-07-tests.log。
- 真实本地HTTP：错误签名401、错误仓库403、有效通知202、相同payload新delivery去重200、旧commit提示202只触发当前远端检查；gap-07-http.log。
- Chrome所有者通过按钮启用；Firefox编辑者打开配置被拒绝；服务端直接webhookStatus/configureWebhook均403。gap-07-owner-editor.png、gap-07-role.log。
- 两端显示相同23:08:22检查记录，正文保留G06双向编辑标记。gap-07-shared-discovery.png。真实公开仓库仅fetch：octocat/Hello-World；模拟通知Commit不进入refs，实际master为7fd1a60b…，gap-07-discovery-result.json。
- 完成后测试Webhook和周期计划关闭，保留检查结果：gap-07-cleanup.json。18082前后端部署哈希与构建：gap-07-backend-deploy.json、gap-07-final-build.log、gap-07-final-deploy.log。

官方依据：https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries 及 https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/troubleshooting-webhooks 。后者明确投递可能乱序，因此以实际fetch为准而非信任事件顺序。
