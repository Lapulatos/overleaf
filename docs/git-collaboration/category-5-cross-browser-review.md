# 第五类双浏览器互检（2026-11-12）

使用现有 Chrome 窗口 1338385201 的第三个标签页和现有 Firefox 窗口，分别为 Branch A Fixture 和 Branch B Fixture。仅18082合成项目。

## 已观察到的结果

- Firefox 原 Out of sync 页面刷新后恢复；本地恢复副本保留。
- Chrome 在首行创建锚定评论；Firefox 不刷新收到并回复；Chrome 不刷新显示 B 的回复。
- Firefox 切换另一工作区后无该评论；Chrome 原工作区仍保留。切回后评论和回复重现。
- Chrome 从分支管理界面归档当前分支，两端均收到 Branch archived，保留本地恢复副本。
- 从父项目界面恢复分支后，两端重新进入成功；历史 UI 均显示原标签及历史回退记录。
- 两端均显示 PDF，并分别点击 Recompile。
- 恢复后 Firefox 编辑器追加测试注释，Chrome 滚动到末尾看到同一注释，无需刷新。

## 发现并修改

归档成功后管理窗口重新请求已归档工作区，误报 Forbidden。自身归档成功后现在关闭管理窗口，保留专门的归档通知。

浏览器原生确认框在多窗口操作中出现抑制而无反馈，改为页面内 Confirm archive / Confirm restore，并保留 Cancel。

修改文件：services/web/frontend/js/features/source-control/branch-workspaces.tsx。构建成功（2条警告），仅部署18082，部署日志 category-5-cross-deploy.log。最后复测通过：Confirm archive 后仅保留 Branch archived 通知，管理窗口已关闭，没有 Forbidden；从父项目 Confirm restore 后状态 ready，双端重新进入编辑器成功。见 category-5-archive-ui-retest.json 与 category-5-dual-archive-fixed.png。

## 证据

- category-5-dual-comment-reply.png
- category-5-dual-isolation.png
- category-5-dual-archived.png
- category-5-dual-history.png
- category-5-dual-restored-edit.png

原生 cua 两次读取超时，随后用户已授权的 AppleScript 辅助功能恢复可用。目标浏览器在第三屏，前两屏截图不作为验收证据。未重建浏览器、重新登录或清除恢复副本。

本轮第五类双浏览器互检通过，第六类已开始文件范围盘点。现有源码有106项已跟踪改动和817项未跟踪条目，不能全部无差别暂存；清单摘要见category-6-inventory.json。尚未提交、推送。

这些结果不代表整项目永久删除、灾难恢复或所有中断组合已通过；这些限制仍保留在完整交付检查中。
