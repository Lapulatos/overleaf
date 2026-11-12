# G05 合并结果编译验证

2026-11-12：实现、部署18082并完成双浏览器成功/过期/真实编译失败验收。

## 实现
新增MergeValidationService/Runtime，mergeDraftCompile命令和Shared merge tasks里的Check merged paper。先经prepared-write捕获不可变编译输入（文本与按hash访问的附件），留存request.json及哈希，再释放正文写锁调用CLSI。使用独立24位构建ID，避免覆盖编辑器PDF。状态为unchecked/checking/success/failed/stale；成功需要编译器success且存在output.pdf。
绑定合并提交、正文ID/版本/哈希、epoch、根文档、编译器及镜像；后续编辑或设置变化使结果过期。任务在其他页面以5秒轮询收敛。超时/中断检查显示失败并可重试。失败只改变validation，不回滚resolved合并。

## 验收
- 4项定向测试通过：输入与版本绑定；编译期间编辑/重复检查；编译失败及中断重试；无PDF不能算成功。gap-05-tests.log。
- frontend build成功，2条既有大小警告，64548ms；2前端资产及4后端模块部署记录gap-05-frontend-deploy.log/gap-05-deploy.json。
- 成功分支gap05/validation-20261112，工作区91594e5979df2adbe4fabd5a，任务40cbb73c-e538-49aa-a5ea-cd974f5b1455。Chrome和Firefox各点击Check merged paper均CLSI success，双端同一提交017c290e，gap-05-success.json/png。
- Firefox随后编辑（即使撤销/注释不改变语义，正文版本仍变化），Chrome/Firefox显示stale；gap-05-stale.json/png。
- 失败分支gap05/failure-20261112，工作区10359df4120e4d8f46e6115d，任务2ae2fb63-ecf1-4371-98eb-6a7f21d158d6。隔离源提交故意含未定义LaTeX命令，合并后点击检查CLSI失败，两端显示failed但任务仍resolved；原错误代码仍在，未自动回滚。gap-05-failure.json/png及gap-05-bad-source.mjs/log。

## 边界
真实编译很快，checking的并发/超时主要由定向测试验证，不声称已现场杀编译服务。当前展示状态及通用失败说明，不含独立日志/PDF下载入口。固定的完整编译请求仅保存在服务端，不在列表返回私有URL。没有修改正式论文/外部远端，没有实现仓库提交推送。

修改：MergeValidationService.mjs、MergeValidationRuntime.mjs、NativeGitRuntime.mjs、GitCommands.mjs、collaboration-tasks.tsx及定向测试。其他业务功能不扩展。本项完成后直接进入G06a一致性备份导出。
