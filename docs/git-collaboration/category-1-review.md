## 2026-11-12 00:30 本轮现场验收结果

现有Chrome账号A在independent分支，Firefox账号B在shared分支；两端恢复在线、可编辑。新增的同账号测试标签页已关闭。用户交互确认仍待进行，不推进第2类。

| 场景 | 本轮结果 |
|---|---|
| 同分支两用户实时编辑 | 通过，双方输入无需刷新互相出现 |
| 个人切换分支 | 通过，Source Control选择分支只切换A，B保持shared |
| 同账号双标签页隔离 | 通过，shared新增标记未进入independent |
| 断线并发编辑及本地副本 | 通过实际断连/重连保留双方文字；超时后Show Local File Contents包含未发送010标记，重载后Local recovery copies仍存在 |
| 撤权旧页面拒绝访问 | 修复后通过：分支Share撤权成功，Firefox自动退出编辑器；再次访问旧URL显示Restricted；已恢复B权限并重新进入 |

额外中断边界：强制终止real-time留下旧会话注册，普通prepare两次超时并拒绝推进（版本仍1），保留失败日志；从产品页面执行Recover collaboration sessions后版本升至2，两端均弹出Out of sync并保存本地副本。两端重载后prepare返回completed:true。该证据是“中断后显式恢复”，不等价于完整离线客户端跨版本合并验证；此前专门的offline-prepared-epoch记录仍为该组合场景的证据，本轮未把超时尝试算作通过。

部署：`share-project-modal/utils/api.ts`将当前分支页面的分享API映射至逻辑项目ID，覆盖邀请/成员/共享管理请求；3项身份解析测试通过，webpack构建成功（2个既有警告），部署器校验3个文件哈希，仅18082。实际Remove access页面重试成功。没有对外发送邀请。

截图：same-branch、independent、recovery-copy、revoked-fixed、access-denied、version-recovery、ready，均以category-1-chrome-firefox-为前缀。日志：category-1-sharing-build.log、category-1-sharing-deploy.log、category-1-ui-after-recovery-prepare.log。

本轮修改：生产前端api.ts；新增sharing-project-id.test.ts；修正category-1-live-protocol.mjs的doc字段；prepare-fixture-control.mjs仅额外允许指定验收分支（不允许初始化）；本验收记录、current-delivery、task_plan、notes及证据文件。未提交/推送；原论文实例、远端仓库及其他工作树修改未改动。

以下保留过程记录。

## 2026-11-12 当前 Chrome + Firefox 实际操作进展

用户已授权 AppleScript / 系统辅助功能控制。复用现有 Chrome（A）与 Firefox（B），Firefox 已通过登录界面切换到独立账号 B。

- 通过：同分支 A/B 两端分别输入，另一端无需刷新可见。截图 `category-1-chrome-firefox-same-branch.png`。
- 通过：A 通过 Source Control 分支选择器切换至 `acceptance/mwc9t9k4/independent`，B 仍保留 shared 内容；A 独立标记不出现在 B。截图 `category-1-chrome-firefox-independent.png`。
- 通过：Chrome 同账号第3/4标签页分别打开 independent/shared；shared 标签页新增 `UI-A-SECOND-TAB-SHARED-004`，independent 标签页仍有独立标记且没有该 shared 标记。
- 通过：Chrome DevTools离线并重启测试实例real-time后出现Lost Connection；离线输入UI-A-DISCONNECTED-009，Firefox在线输入UI-B-AFTER-DISCONNECT-009。恢复后两端复制读回均包含双方标记，长度均6267字符。证据 category-1-ui-reconnect-{chrome,firefox}.json。Firefox Work Offline和未切断旧WebSocket的早期尝试不算通过。版本变化后的恢复弹窗仍待复核。
- 发现真实UI问题：分支页面Share→Remove access→Confirm请求使用workspaceId，操作失败。正在补齐逻辑项目ID路由；此前协议验证通过不替代页面验收。

发现并修正验收脚本缺陷：`applyOtUpdate` 漏传 `doc`，造成测试分支9条历史记录无法处理、flush返回500。补齐脚本字段；将该测试分支队列完整备份到 `category-1-history-invalid-protocol-backup.json`，仅为验证过的9条 protocol 插入记录补齐文档ID，保留所有文本与队列顺序。原子比较后修复；实际 history flush 返回204。其他项目未更改。

以下为先前记录；旧的浏览器阻塞描述已被上述实际进展取代。

# 第1类：分支隔离、权限和离线重连

状态：已有基础验证；已准备独立展示分支，等待用户交互评审，不进入第2类。尚未声称全部底层风险验收完成。

## 查看入口
- [demo/shared](http://127.0.0.1:18082/project/6af40820d9a4263b7a7c0e12/workspace/883b7e53904f4d6535ff54e3)
- [demo/independent](http://127.0.0.1:18082/project/6af40820d9a4263b7a7c0e12/workspace/0dc635f28cb7eba6fb62356b)

两个分支来自相同初始提交，测试内容可独立修改。与正式论文无关。此轮未操作用户浏览器，自动登录尚未完成。

## 本次要确认的五个行为

| 行为 | 现有证据 | 用户评审 |
|---|---|---|
| 两位用户同分支编辑，内容实时一致 | presence-auto-reconnect-browser-acceptance.json | 待展示/确认 |
| 一人切分支，另一人的分支与内容不变 | presence-auto-reconnect-browser-acceptance.json | 待展示/确认 |
| 同一用户两个标签页独立选择分支 | presence-auto-reconnect-browser-acceptance.json | 待展示/确认 |
| 断线旧编辑不会覆盖新代次内容，提供本地恢复文本 | epoch-browser-acceptance.json、offline-prepared-epoch-browser-acceptance.json | 待展示/确认 |
| 撤销权限后，旧连接及排队请求不能写入 | presence-revocation-browser-acceptance.json、queued-revocation-browser-acceptance.json | 待展示/确认 |

上述是已保存的历史验收证据，本轮没有重跑所有浏览器场景，不能等同于当前浏览器展示成功。多文件同时恢复、重命名/删除重建的剩余边界仍在第1类内收尾；不另开类别。

## 本轮修正

`/git branches` 原先只有帮助项，后端返回400。已注册命令并使用只读仓库路径，恢复期间也不导出/覆盖文档。2项针对性检查通过；已部署18082并通过真实登录接口成功列出分支、创建/进入上述展示分支。

## 交互顺序

先展示同分支同步与跨分支隔离，收集布局、切换和提示反馈；再展示断线恢复与撤权。用户反馈修正并明确确认本类后，才进入第2类。

## 多文件离线恢复修复

连续文档错误现在先在内存中按文件ID汇总，再尝试持久化；即使浏览器存储失败，恢复窗口仍显示全部已捕获文件。相同文件名、不同ID分别保留；账号、工作区或代次变化后不混入旧副本。未添加自动回写。

修改源文件：`editor/local-recovery.ts`、`context/editor-manager-context.tsx`；针对性测试：`test/frontend/features/source-control/local-recovery.test.ts`。7项通过，其中新增2项覆盖连续存储失败与范围隔离。构建成功（2 warnings，47859ms）；2个部署文件哈希验证通过，仅重启18082 web/web-api；登录页HTTP200。证据：`category-1-multifile-recovery-tests.log`、`category-1-multifile-build.log`、`category-1-multifile-deploy.log`。

没有操作正式论文/远端；没有重跑浏览器自动化，页面交互尚未验证。第1类仍待重命名/重建恢复行为核对及用户演示确认，不进入第2类。

## 交互演示操作卡

先打开上方 `demo/shared` 与 `demo/independent` 两个测试分支链接。只使用测试项目。

1. 同一账号双标签页：在 shared 中打开一个文本文件，在末尾写一行测试注释，independent 不应出现该注释；两页各自刷新后分支应保持不变。
2. 两账号同分支：A和B同时打开 shared，在同一文件不同位置各加一行注释；两边应看到两行，且无需刷新。
3. A切到 independent 后继续编辑：B仍在 shared，B不应被切走，也不应看到 independent 的新增内容。
4. 断线恢复和撤权由演示者单独演示：避免用户自行操作浏览器网络设置或权限。展示旧修改的恢复入口、文件ID/名字，以及撤权后拒绝写入的提示。

目前浏览器访问工具仍报告 host unavailable，尚未实际完成上述演示；不能据此签收第1类。

## 第1类：恢复文件名与身份

发现并修复：DocumentContainer.docName 原先始终为空。打开文档时填入文件名，文件树变更时按ID更新名字；已删除文档保留最后已知名字，不借用同名新文件的身份。修改 editor-manager-context.tsx、open-documents.ts；新增 workspace-epoch.test.ts 的改名/删除重建身份检查，连同恢复入口共13项通过。模块/组件检查不等同实际多人浏览器验收。

构建43261ms、2 warnings；仅18082部署2个文件并校验哈希、登录页200。证据 category-1-recovery-identity-{tests,build,deploy}.log。没有改正式论文、远端或其他实例。

浏览器能力再次检查仍返回 Browsers: The browser access host is unavailable；未控制用户Chrome。操作卡已写入 category-1-review.md。第1类仍未用户签收，实际浏览器演示尚未完成；不进入第2类。

## 第1类演示阻塞复核

上一轮：有进展（恢复文件名/身份修复并部署）。本轮：展示尝试受阻。CUA可初次读取Firefox新标签页；尝试导航18082/login在10秒超时并重置，重新获取Firefox窗口也超时。不能确认导航、登录或演示成功。没有使用其他自动化绕过，也没有控制/关闭Chrome。

同一展示能力阻塞已连续记录于多文件恢复、文件名身份恢复和本轮；本轮不继续创建功能或重复测试。下一步需要恢复可用浏览器控制连接，或用户通过18082反馈实际交互结果。第1类未签收，2–6类不启动。全局目标未完成。

## 自行验收：真实HTTP和实时连接（2026-11-11）

用户明确授权自行验收，无需用户配合测试；仍保留分阶段展示反馈。上一轮浏览器演示阻塞；本轮以真实协议会话获得新证据，不等同浏览器可视验收。

`category-1-live-protocol.mjs/json/log`：两个真实登录账号、三个WebSocket会话、两个独立测试分支。7项通过：独立加入；双向实时编辑收敛；个人切换不移动他人或串分支内容；新会话重连读取一致内容；错误代次写入拒绝且原文不变；撤权连接关闭且旧凭据读取/创建分支403；恢复权限后重新连接内容保留。

验收发现并修复 `services/real-time/app/js/Router.js`：WORKSPACE_EPOCH_STALE曾被序列化成通用内部错误，现在仅对白名单错误码返回固定的保存修改/重新加载提示，不泄漏原始内部错误。语法检查通过，部署到18082后真实协议返回正确code，staleErrorExplained=true。仅重启该实例real-time。

保留失败：first-attempt为脚本JSON换行比较错误；error-message为发现的产品错误；empty-event为协议脚本未兼容无参数事件。无参数事件导致脚本中断后立即恢复了测试成员，修复脚本再完整执行，最终权限恢复和重连已验证。脚本不输出密码或cookie。

未覆盖：真实浏览器离线缓冲/重连恢复窗口、页面布局和按钮交互；错误代次协议检查不能替代完整离线浏览器验收。正式论文、远端仓库和其他实例未修改。第1类尚不宣称全部完成。
