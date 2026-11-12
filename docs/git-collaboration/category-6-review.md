# 第六类：最终集成验收与交付记录

日期：2026-11-12。环境：仅 127.0.0.1:18082，overleaf-git-collaboration-web，合成论文项目 6af40820d9a4263b7a7c0e12。使用用户已打开的 Chrome A 与 Firefox B；没有新建浏览器或重新登录。

## 结论

本轮限定的第六类集成互检通过。补齐两个实际缺陷并部署；前五类已有证据与本轮双浏览器结果共同构成交付记录。这不等于所有生产灾难恢复、网络故障组合和在线 AI 服务都已验证。

## 实现与部署

- services/web/app/src/Features/NativeGit/WorkspaceRoutes.mjs：允许逻辑论文项目取消归档。POST /Project/:id/restore 实际只清除 archived 状态，旧保护逻辑错误拦截了有分支的项目。内部子项目仍禁止直接生命周期操作；有分支的父项目永久删除仍明确拒绝。
- services/web/app/src/Features/Project/ProjectController.mjs：恢复审计传入实际用户 ID，而非对 ID 再读取 _id。
- 部署文件 SHA-256 见 category-6-deploy.json；只重启 18082 对应服务。未改变本轮以外的前端实现。

## 本轮验收

| 检查 | 结果与证据 |
|---|---|
| 取消归档 | 实际 Chrome 登录会话请求：archive 200、restore 200，内部子项目 restore 409，评论不变。category-6-project-restore.json。此项为会话接口验证，不冒充项目列表点击验证。 |
| 跨分支编辑隔离 | Firefox 编辑 source，Chrome target 不出现该标记。category-6-isolated-edit.json/png。 |
| 过期合并防覆盖 | 准备合并后 Firefox 继续编辑 target；Chrome 点击应用，被拒绝且旧任务 superseded，编辑保留。category-6-stale-merge.json/png。 |
| 未提交改动保护 | 重新准备时返回 409，要求先处理 target 未提交内容；提交后才继续。属于预期保护。 |
| 冲突消解 | 新任务产生 main.tex 冲突；Chrome 页面领取租约、填写同时保留两端内容的结果、保存并应用，任务 resolved。category-6-conflict-review.png、category-6-merge-applied.json。 |
| 合并实时传播 | 两端无手动刷新收到合并正文；从实际编辑器复制全文，均为 5,843 字节，SHA-256 相同且均包含双方标记。category-6-final-content.json。 |
| 编译 | 两端分别点击 Recompile，显示一页 PDF；Chrome 编译按钮恢复可用，无警报。category-6-dual-compile.png。 |
| 历史 | 两端进入 History，均出现 18:09 的 via Git 变更，并显示合并新增行。category-6-dual-history.png。 |
| 定向回归 | native-git-handlers 与 workspace-lifecycle：16 通过，0 失败/跳过。category-6-targeted-tests.log。两生产文件 node --check 通过。 |

测试分支：category6/source-20261112、category6/target-20261112。分支创建、暂存/提交和准备任务使用实际登录会话接口；编辑、冲突领取/保存/应用、编译和历史使用现有浏览器交互。不得将全部步骤描述为纯点击验收。

取证中的无效尝试：最初 Chrome 复制命令落到另一窗口，得到 33,778 字节的非编辑器内容，不作为一致性证据。显式前置正确窗口后重新复制，两端全文一致。完整正文哈希：95c870b163204a627f760109602447a32f3bda481fbb9907e8f5017905c31796。

## 前五类证据入口

1. category-1-review.md：工作区隔离、权限、重连。
2. category-2-review.md：防覆盖事务与中断恢复；包括过期 Shell 草稿双窗口演示。
3. category-3-review.md：跨分支协作者位置、历史查看、多会话及离开/重入。
4. category-4-review.md：自动提交/拉取/推送、检查点与冲突暂停；远端是隔离本地仓库。
5. category-5-review.md 与 category-5-cross-browser-review.md：评论、历史、编译、归档与恢复。后者补足原 Firefox 互检限制。

以上是已有证据引用，不表示本轮重复运行了所有前五类测试。

## 明确限制及交付范围

- 永久删除带分支的论文项目仍被阻止；没有提供整项目生产灾难备份恢复。取消归档不是删除后灾难恢复，纠正旧记录中的混淆。
- 在线 AI 生成缺少实际服务配置，未进行端到端验证；已有安全回写验证不能替代在线生成验证。
- 真实外部 GitHub 账户/远端的生产部署没有在本轮操作；未声称所有网络断开或存储故障组合都通过。
- 保留正式论文、真实远端、原始冲突现场、本地恢复副本及预先存在的工作树改动。未提交或推送源码；不得把当前约 924 项既有改动无差别纳入本轮提交。
- 本轮生产修改严格为上述两个文件；新增 category-6-* 证据，更新 task_plan.md、notes.md 与本报告。部署范围也仅这两个生产文件。
