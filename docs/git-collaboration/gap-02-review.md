# [克隆资源完整性] G02交付记录

2026-11-12。输入：gap-audit.md G02、CloneRepository.mjs、WorktreeFiles.mjs及真实Git测试。

## 修改

新增CloneResources.mjs；修改CloneRepository.mjs。读取索引识别160000 gitlink（不依赖.gitmodules），明确拒绝submodule；识别标准/旧版LFS指针并列出缺失资源路径。创建项目之前检查，恢复旧克隆操作和目标导入前再检查。未实现自动LFS下载或递归submodule导入；用户需提供普通Git文件组成的完整论文分支。

LFS指针格式依据：[Git LFS官方规范](https://raw.githubusercontent.com/git-lfs/git-lfs/main/docs/spec.md)，2026-11-12查阅。识别小于1024字节、有version/oid/size的指针，空文件不拒绝。

## 验证

- native-git-clone.test.mjs共3项通过：普通克隆的部分导入重试；LFS和submodule各自在创建项目前拒绝、源修复后同operationId可重试。证据gap-02-tests.log。
- 两生产文件部署18082，SHA-256核对，gap-02-deploy.json；只重启web/web-api。
- 原Chrome A从Clone表单提交gap02/lfs，提示figure.pdf缺实际内容；原Firefox B提交gap02/submodule，提示assets不支持。gap-02-resource-refusals.png。
- 同一表单改为gap02/plain后两端均成功；各自点击Open cloned project，main.tex及根文档正确，两端点击Recompile显示PDF。gap-02-clone-success.png、gap-02-dual-pdf.png。
- 数据库只存在两条G02正常项目：2b98846dd6efda5b8a4ca636归A，4d8a470b070104c16742708f归B；无被拒绝请求的空项目，无gitWorkspace内部标记。gap-02-projects.json。
- Firefox克隆项目追加注释，Chrome克隆项目正文不变。gap-02-independent.json、gap-02-independent-edit.png。这是两个独立Clone项目的隔离检查，不冒充同项目实时协作。

## 无效尝试与边界

测试分支首次本地push因测试裸仓库不同UID被Git拒绝；只在隔离容器为该精确路径添加safe.directory后重试。HTTPS只为127.0.0.1:18445配置测试证书，不关闭TLS验证。Firefox自动填充了已有登录项，提交前清空用户名/令牌；未使用账户登录凭据访问Git。

当前范围仅Clone，不声称已补齐所有pull/merge资源策略或生产GitHub/LFS服务。测试用隔离容器HTTPS远端，没有操作正式论文/真实远端。源码未提交/推送。两窗口保留新克隆项目供查看。

改动生产文件：CloneResources.mjs、CloneRepository.mjs；测试：native-git-clone.test.mjs；文档：task_plan.md、notes.md、gap-audit.md和gap-02-*证据。其余功能及既有改动保留。下一独立项为G03历史批量回退中断恢复，尚未开始。
