# 需求差距审计与逐项交付

2026-11-12；输入 implementation-points.md、implementation-plan.md、notes.md、category-1 至 category-6 验收记录及当前 NativeGit/History 源码。需求已为 W01–W38（38项），不是28项。最近第六类通过仅指限定集成场景，不代表方案的全部门槛已通过。

## 当前交付口径（2026-11-13）

用户要求停止扩展罕见边界测试。G06c、G07已完成限定验收；G08按收缩范围收尾，未穷尽的原矩阵作为已知限制，不再作为本轮追加任务。见[当前交付说明](delivery-2026-11-13.md)。下表保留原审计依据。

## 单项队列

| 顺序 | 差距 | 当前证据/源码判断 | 本项完成判据 |
|---|---|---|---|
| G01 已完成本项 | 共享远端配置缺管理权限 | NativeGitRuntime 对自动任务检查owner，但 addRemote/removeRemote/connect/deleteRemoteRef 普通路径只有写权限；RemoteCredentials按userId隔离，不能误称共享凭据 | 共用runtime执行与锁后复核；Chrome所有者成功、Firefox编辑者403；保留普通提交和个人凭据能力 |
| G02 已完成本项 | Clone资源缺失检测 | CloneRepository→readWorktree只检查路径/字节/大小；没有LFS指针与gitlink完整性前检 | 在创建项目之前明确拒绝未取得资源；普通仓库仍可Clone；两浏览器验证错误和成功结果 |
| G03 已完成本项 | 历史批量回退缺持久恢复日志 | HistoryWorkspaceWrite有锁/flush/epoch，无逐文件持久步骤日志 | 中途失败明确阻止后续写入，保留前后像并可继续/恢复；不能自动覆盖较新编辑 |
| G04 已完成本项 | 合并/恢复空间不足前检 | RecoverySnapshots有fsync，ShellDraft有statfs，其他写入无统一容量预检 | 写前估算空间，拒绝不安全新事务；ENOSPC不能报告成功，已有快照保留 |
| G05 已完成本项 | 合并结果缺论文验证状态 | MergeApplicationService只记录resolved/resolutionCommit，没有独立编译snapshot与validationStatus | 显示未检查/检查中/成功/失败，绑定确定提交/正文版本；后来编辑使结果过期；错误不回滚正文 |
| G06a 已完成本项 | 一致性备份/导出 | 现有恢复快照是文件级，不是Git/正文/附件/评论/任务一体备份 | 可核对清单、哈希、refs和元数据；先只做可验证导出 |
| G06b 已完成本项 | 备份恢复代次 | 已实现私有新项目恢复及新身份/代次 | 双浏览器编辑与隔离通过；证据及范围见 gap-06b-review.md |
| G06c 已完成本项 | 永久删除/保留清理 | 独立备份、持久停写、私人记录隔离、可恢复级联及取消后协作通过 | 见gap-06c-deletion-review.md，限合成项目18082；完整故障排列仍属G08 |
| G07 已完成本项 | Webhook入口 | 已实现验签、绑定、去重、持久唤醒现有周期发现；乱序不应用payload refs | gap-07-review.md：真实本地HTTP及双端展示通过；公网GitHub回调未验证 |
| G08 收缩范围收尾 | 操作清单与生产故障证据未齐 | 有模块/多用户证据，但无每个菜单和/git的完整角色矩阵；在线AI缺配置 | 一次选一个动作或故障；实际结果、权限、失败副作用、双端证据逐项登记 |

G01不擅自收紧用户自己的凭据，也不将编辑者的正常写作/暂存/提交变成管理员权限。进一步危险分支操作、只读Graph能力和后台凭据负责人变更的完整角色矩阵仍列G08核对。

## 38项需求映射

“已有”指找到实现与有限证据，不表示全部故障条件验收。阶段P1–P6与按交付分类的第1–6类不是同一个编号体系。

| W编号 | 当前判断 | 证据/剩余 |
|---|---|---|
| W01 | 已有隔离与双端证据 | category-1/6；独立编辑与切换 |
| W02 | 已有共享refs/presence | category-3；不依赖push |
| W03 | 已有session级位置 | category-3；多标签页 |
| W04 | 已有重连/过期处理 | category-1/3；全部丢包排列未验收，G08 |
| W05 | 已有周期发现 | category-4；Webhook缺G07 |
| W06 | 已有获取/应用分离 | RemoteDiscovery、ReviewedPull；category-4 |
| W07 | 已有脏内容保护 | category-4/6 |
| W08 | 已有隔离合并 | category-6；不强推 |
| W09 | 已有持久任务/通知 | category-4/6；跨分支摘要完整角色矩阵G08 |
| W10 | 已有租约/fencing | MergeDraftService及模块检查；多人抢租全部UI路径G08 |
| W11 | 已有版本/ref验证 | category-6过期任务拒绝 |
| W12 | 已有发现重写/删除并暂停 | RemoteDiscovery/AutoSync；所有UI分支G08 |
| W13 | 已有持久任务与对账 | category-4 |
| W14 | 已有未知push结果对账 | category-4模块证据；真实网络回执丢失G08 |
| W15 | 普通commit原缺指纹，现已补齐 | gap-08-commit-review.md：按钮双端过期拒绝/新确认成功；菜单及/git共用预览，/git准备测试通过 |
| W16 | 已有隔离Shell/AI回写 | category-2；在线AI生成G08 |
| W17 | 已有epoch与恢复副本 | category-1 |
| W18 | 已有docId/单调版本 | category-1/2；全部结构变换G08 |
| W19 | 部分 | WorktreeFiles路径/类型与二进制草稿；大小写碰撞及二进制双端G08 |
| W20 | Git/Shell已有日志恢复；历史不足 | category-2、HistoryWorkspaceWrite；G03 |
| W21 | 已有撤权与后台复核 | category-1/4；全部历史/资源入口矩阵G08 |
| W22 | 已有内部空间控制拒绝 | WorkspaceRoutes/Scope；旧链接组合G08 |
| W23 | 已有分支评论/历史/编译 | category-5-cross-browser；迟到AI结果G08 |
| W24 | 归档/取消归档已有，永久删除不足 | category-5/6；G06 |
| W25 | 已有远端绑定/错误/个人凭据 | RemoteOperations/AutoSync；G01/G08 |
| W26 | 未实现Webhook | G07 |
| W27 | 导入资源检查不足 | G02；忽略文件保留已有 |
| W28 | 仅Shell容量前检 | G04 已完成本项 |
| W29 | 手动编译可用，任务验证状态缺 | G05 已完成本项 |
| W30 | 已有sourceRef/OID再检查 | MergeDraftService.validateTargetLocked；三种变更双端G08 |
| W31 | 部分工作区身份与持久任务已有 | WritingAssistWorkspaceIdentity、编译存储隔离；统一任务中心全链G08 |
| W32 | presence revision已有 | category-3；所有图/任务订阅交错G08 |
| W33 | 部分管理检查，普通远端命令缺口 | G01；完整角色矩阵G08 |
| W34 | 不主动清理保护现有草稿，但无完整备份/GC策略 | G06 |
| W35 | 已有项目锁与工作区唯一性 | BranchWorkspaces；同名删除重建和失败重试完整G08 |
| W36 | 已有epoch版本保护与兼容检查 | category-1/2；新旧部署组合G08 |
| W37 | 已实现独立项目恢复及新代次 | G06b；范围见 gap-06b-review.md |
| W38 | 已有人工暂存阻止自动任务 | category-4；完整多文件并发G08 |

## 执行边界

先只完成G01，部署18082，原Chrome/Firefox互检，再展示结果。其余不在同一批代码中推进。未触碰正式论文、真实远端、18080/18081或既有无关改动；不无差别提交。此审计不把“未找到完整证据”当作“源码一定缺失”。

## G01 本轮结果

- 新增 CommandCapabilities.mjs；修改 NativeGitRuntime.mjs：执行入口与等待锁后的授权复核共用能力判断。新增 native-git-command-capabilities.test.mjs。
- 13项定向测试通过，0跳过；包含所有者转移发生在锁等待中的拒绝。见gap-01-tests.log。生产两文件部署18082并核对SHA-256，见gap-01-deploy.json。
- 原Chrome所有者通过Repository → Remote → Add remote添加gap01-owner；原Firefox编辑者使用同入口添加gap01-editor被明确拒绝。实际列表只有前者，无后者；见gap-01-remotes.json、gap-01-role-comparison.png。
- Firefox随后编辑main.tex，Chrome无需刷新收到该行；见gap-01-collaboration.json、gap-01-writing-still-works.png。
- 所有者随后通过登录会话接口删除本轮添加的测试配置gap01-owner，返回200；未fetch/push测试地址。
- 无效尝试保留说明：首次重启使用supervisorctl但容器未安装，改用已有sv命令成功；Firefox首次填表剪贴板切换太快导致名称错误，修正为gap01-editor后再次提交仍被拒绝；首次输入未落入正文，第二次确认光标后成功，不将首次false当作同步故障通过。
- 本轮不宣称四种受限命令全部经过双端菜单验收：四种均有模块权限检查，实际双端菜单本轮覆盖addRemote；removeRemote为所有者会话接口，锁后撤权为模块证据。其余逐入口验证留在G08。
- G02及其他缺口均未开始实现。正式论文、真实远端和18080/18081不变，未提交或推送源码。


## G02 更新
Clone前资源检查与双浏览器验收已通过，见[克隆资源完整性记录](gap-02-review.md)。保守拒绝LFS指针/submodule，并非自动下载支持；下一项G03尚未开始。

G03已实现及双浏览器验收，见[历史批量恢复记录](gap-03-review.md)。G04进行中。

G04容量保护与两端提示验收完成，见[容量保护记录](gap-04-review.md)。G05开始。

G05已通过，见[合并编译验证](gap-05-review.md)。G06a正在检查一致性导出的数据范围及接口。

G06a导出已通过，见[一致性备份导出](gap-06a-review.md)。按顺序进入G06b隔离恢复及恢复代次。

G06b完成：见[备份恢复代次](gap-06b-review.md)。自动进入G06c，首先堵住内部删除绕过，随后实现引用保护清理及审核后的删除。
