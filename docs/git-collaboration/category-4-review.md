# 第四类交付：自动任务、检查点及冲突联动

2026-11-12。仅部署 `127.0.0.1:18082`，没有修改正式论文或真实远端，没有提交/推送本项目源码。

## 本轮实现

- 新增分支级自动拉取/推送设置、持久任务、独立执行锁、配置版本检查、所有者和远端绑定校验。支持独立开启pull/push。
- 自动pull仅对干净工作区执行安全快进，复用防覆盖事务；分叉进入共享合并任务。push仅发送确定提交，不强推。
- 中断结果不自动重复执行；提供对账和显式重试同一提交入口。准备任务尚未落盘就失败时，也能解除待对账状态。
- 待处理共享合并/恢复任务阻止自动检查点和自动同步。远端重写/删除、目标变更、权限撤销、未提交内容会暂停，保留内容。
- 修复远端发现任务关闭/重开时丢失未完成操作身份的问题。

## 现场验收

项目 `6af40820d9a4263b7a7c0e12`，工作区 `5c8d5c627704bef88ea54585`，分支 `category4/autosync-20261112`。

1. Chrome中的真实设置界面开启自动pull；后台将测试远端 `ef32202` 快进应用。Chrome/Firefox未刷新均收到内容，复制全文一致（5781字符）。
2. Firefox编辑产生 `category4 B automatic checkpoint`，后台自动检查点提交 `0c54016`，随后自动push将测试远端推进至同一提交。
3. 外部clone与Firefox分别追加冲突内容。后台产生共享任务 `473d1011-c3fb-4d24-952a-04dfe9917bb3`，状态conflicted；两个浏览器自动显示同一个冲突通知。
4. 两边保留网页本地内容，不出现外部冲突内容。远端保留 `2bc85fc`，没有被本地覆盖。自动sync暂停，reason=`merge-review-required`；自动检查点随后暂停，reason=`recovery-required`。
5. 测试中本地HTTPS服务缺少压缩请求头转发，造成一次fetch失败；已修复服务并对账后重试。记录保留，不计为产品冲突流程成功。
6. 一次Chrome复制全文误取了非编辑器选择区；重新通过编辑器focus验证，保留无效及修正记录。

证据：`category-4-live-result.json`、`category-4-conflict-notice.png`。

## 验证范围

- `category-4-integrated-tests.log`：53项组合检查通过（自动同步、检查点、worker、发现计划、原有合并恢复）。
- `category-4-auto-sync-final-tests.log`：追加未落盘准备失败恢复后，自动同步9项全部通过。
- `category-4-build.log`：前端构建成功，2条警告。
- `category-4-backend-deploy.json`、`category-4-recovery-deploy.json`及`category-4-deploy.log`：部署及SHA核对。最终恢复修正已重启web和web-api加载。
- 针对本轮修改执行diff空白检查通过。

使用容器内本地HTTPS裸Git仓库模拟远端，没有验收真实GitHub网络/凭据失效的所有组合。推送回执丢失、明确重试、权限撤销等使用真实临时Git仓库模块测试验证，未声称每种故障均经过双浏览器操作。

## 操作入口与边界

Source Control → Repositories → Automatic pull / push…。Automatic commits…管理检查点。
自动任务由所有者管理，协作者共享合并通知。同一分支只有一份服务端计划，不依赖浏览器保持打开。冲突需人工解决/取消，然后明确重新启用；不会自动消解冲突。普通未提交修改进入waiting，检查点/手动提交完成后下一轮继续；手动暂存仍暂停。不会擅自提交这些修改。新远端分支先通过Publish发布。

当前两个浏览器保留冲突演示；两个后台计划均处于暂停状态。此交付不包含第五类的评论、历史、编译、归档与恢复，也不代表整个项目已完成。等待用户本类反馈，不自动进入下一类。

## 本轮生产文件

新增：
- `services/web/app/src/Features/NativeGit/AutoSyncSchedule.mjs`
- `services/web/app/src/Features/NativeGit/AutoSyncRuntime.mjs`
- `services/web/frontend/js/features/source-control/auto-sync-settings.tsx`

修改NativeGit目录中的 `AutoCommitService.mjs`、`AutoCommitWorker.mjs`、`RemoteDiscoverySchedule.mjs`、`MergeApplicationService.mjs`、`NativeGitRuntime.mjs`、`NativeGitRouter.mjs`、`GitCommands.mjs`、`RepositoryEvents.mjs`；修改 `services/web/config/settings.defaults.js`、`services/web/frontend/js/features/source-control/source-control-panel.tsx` 和合成实例配置 `docs/git-collaboration/fixture-settings.cjs`。

测试新增 `services/web/test/agent/native-git-auto-sync.test.mjs`；相关检查点/发现计划测试已追加。计划、笔记、category-4证据和测试服务/浏览器操作脚本保存在本目录。此前第一至三类及其他脏改动保留，其他实例未部署。

## 第四类后续修复（2026-11-12）

- 修复普通编辑让同步永久暂停：现在进入waiting，保留文档，不做stage/commit，下一间隔检查；提交后自动继续。手动暂存、真实冲突和结果不明仍暂停。
- 修复discovery阶段中断对账直接丢弃原检查的问题：复用原操作ID完成远端检查，保留fetch之前的引用基线，不应用文件；对账后仍需明确启用。
- 本次改动：AutoSyncSchedule.mjs、auto-sync-settings.tsx、native-git-auto-sync.test.mjs，以及本目录计划/记录。其余生产代码保留。
- category-4-fixes-tests.log：12项通过，包括等待后继续push、手动暂存暂停、检查回执恢复。使用临时真实Git仓库；未将这些新增故障用例声称为双浏览器端到端测试。
- category-4-fixes-build.log、category-4-fixes-deploy.json/log：构建成功（2条警告）、部署18082并核对后端哈希。现有Chrome/Firefox刷新加载新资源，保留之前的冲突演示。
