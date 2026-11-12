# G06a 一致性备份导出 — 2026-11-12

已实现并部署到隔离18082；本项导出验收通过，恢复仍由G06b负责。

## 实现
- 所有者创建、列举、下载；协作者在服务端被拒绝。
- 导出全部工作区的正文/附件/文档版本与ranges、评论及聊天、历史标签、完整history chunks及其引用blobs。
- 导出共享Git objects/refs/reflogs/index与分支worktree记录，以及合并/Shell/历史恢复等持久任务与快照。
- 排除凭据、分享token、会话、Git配置/hooks及编译缓存。下载内容与排除项写入清单。
- 共享Git锁内捕获，重新检查文档版本、项目元数据、历史末端、文件目录及哈希；变化拒绝发布。先逐文件fsync并核验，再发布manifest。未完成目录不出现在列表。
- 限制1GiB/100000文件；拒绝路径越界、重复路径、符号链接及已发布归档修改。下载前再次校验哈希。

## 验收
- 3项归档测试通过：完整发布及发布后不可修改；变化/损坏不发布；路径/链接/容量限制。
- 现有Chrome A点击创建和下载，现有Firefox B打开同项目入口遭拒，直接访问下载URL也遭拒。
- 测试项目2b98846dd6efda5b8a4ca636（G02克隆验收项目），另建gap06/backup-second工作区8ce956496793314463d4ccea；不涉及正式论文。
- 从Chrome实际下载的ZIP逐项核验33个文件长度与SHA256，2个工作区，PNG、历史chunks/blobs、聊天、评论、历史标签均存在。
- 证据：gap-06a-owner-editor.png、gap-06a-forbidden-download.png、gap-06a-download.json、gap-06a-archive-tests.log、gap-06a-deploy.json。

## 边界与保留失败
- 多chunk历史与100000文件上限没有真实大项目压力验收；变化拒绝由定向测试验证，未声称两个浏览器精确同时触发备份窗口。
- 归档是该时间点的状态；之后编辑不会进入已发布归档。不会停止协作者编辑。
- 测试fixture初次ObjectId比较错误、label参数text误用及上传缺folder_id分别拒绝，修正后成功；首次构建复制路径错误中止重跑，未将失败构建部署。
- G06b恢复尚未实现，不能据本项放开永久删除。

后续恢复验收补充：新增 deletedDocuments 内容与代次捕获，最新备份4157f020-c298-4564-89e4-36bf89fecf1f含36文件；运行中Shell拒绝备份，执行限时5分钟，目录发布增加父目录fsync。见gap-06b-review.md。
