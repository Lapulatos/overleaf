# G08 人工暂存与自动提交

2026-11-13，仅18082合成工作区5f057c40ee42775e1f180e8f，原Chrome/Firefox。

- Chrome所有者开启一分钟计划；Firefox编辑者人工暂存main.tex。
- 真实后台任务暂停，reason=manual-index；前后HEAD及提交预览index指纹一致，人工暂存和正文保留。gap-08-auto-manual-result.json记录比对。
- 发现编辑者连计划状态也403；修复为已授权协作者可读取公共状态，配置及恢复仍要求所有者。前端对非所有者禁用修改控件。
- AutoCommitController六项检查通过，包括读取、修改拒绝和撤权后读取拒绝。首次默认授权回调遗漏造成两项失败，已修复；保留first日志。
- 前端构建通过，部署18082并校验资源哈希；原Firefox显示disabled及只读说明，原Chrome显示相同状态且可管理。截图gap-08-auto-manual-role-fixed.png。
- 测试计划已关闭，enabled=false、revision=3；main.tex测试标记仍暂存，未丢弃用户内容。未推送远端。

修改：AutoCommitController.mjs、NativeGitRuntime.mjs、auto-commit-settings.tsx及控制器测试。
本项没有覆盖所有多文件/中断组合；按用户收缩范围要求不继续扩展。
