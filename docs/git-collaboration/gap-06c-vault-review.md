# 删除后恢复入口：独立恢复库

已实现、部署18082并通过现有双浏览器检查。整项目永久删除仍未开放。

## 行为
所有者在Project backups逐份选择Keep in recovery vault。副本位于原项目目录之外的recovery-vault/<owner>/<backupId>，每个文件重新校验，副本发布前再次核对所有者。独立入口/git-recovery按登录账号列出、下载、预览恢复；没有原Project查询依赖。恢复创建新私有项目，旧任务不重新运行。

## 验证
- gap-06c-vault-tests.log：3项通过，源目录完全移除后保留副本仍可读；其他账号404；源损坏或撤权不发布；撤权留下的临时副本不出现在列表。
- Chrome实际点击保留a854624f-fab6-4ac5-9b9a-c482241f9754，进入独立页面、预览并确认恢复。新项目a0172bd979f0006e49748cd3打开成功，显示之前A/B编辑标记；gap-06c-vault-browser-result.json、gap-06c-vault-editor.json/png。
- Firefox B访问同一恢复库URL提示Retained backup not found；gap-06c-vault-private.png（此截图是修正CSS之前，权限拒绝已生效）、gap-06c-vault-preview.png（样式修正后）。
- Chrome实际下载ZIP，36个文件长度及SHA256全部匹配；gap-06c-vault-download.json。Download目录保留用户可直接查看的文件。
- 发现默认CSP禁止表单与内联样式，最初点击未发送恢复请求。已保留默认禁止脚本/外部资源策略，仅允许同源表单和固定样式SHA256。修正后真实表单预览、确认、303跳转通过。
- 前端构建50135ms、2条警告，部署2份哈希校验文件；后端哈希gap-06c-vault-deploy.json，/login200。

## 限制
生产源项目尚未实际永久删除；源目录移除是临时目录模块验证。原论文和测试源项目均保留。恢复库副本尚无自动过期删除功能；永久删除需要先停写、保留完整依赖并逐步清理全部分支。恢复副本属于保留时的所有者账号，不自动授予项目协作者访问。
