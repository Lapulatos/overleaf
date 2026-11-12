# 第三类：Git Graph协作者位置与断线同步

2026-11-12。修复和18082部署完成；双浏览器验证已完成下面列出的流程，等待用户反馈，不进入第四类。

## 本轮修改

1. presence绑定重新建立时，重放当前工作区正在查看的提交。此前状态仅靠一次性事件传递，新的订阅者可能错过已有查看位置。
2. Redis容量检查忽略已经超过保留期的会话，允许新连接触发清理。此前满1000条时先拒绝更新，即使大部分已经过期，也需要另一个客户端先读取快照才能恢复。真正容量溢出仍拒绝，且不偷偷改变revision。
3. Graph拿不到presence快照时显示明确的重连提示，避免空白被误解成没有其他协作者。

既有位置模型保持：以Overleaf服务端工作区为准，不以远端最后push为准；未推送分支也可显示。编辑分支/HEAD与查看历史分开；同一用户多个标签页保留独立会话。离线位置标为last seen，不冒充在线。

## 现场验证

使用原Chrome、Firefox及合成项目`6af40820d9a4263b7a7c0e12`，没有更改论文文本或远程仓库。

- Chrome A在`acceptance/mwc9t9k4/shared`，Firefox B在`acceptance/mwc9t9k4/independent`。Chrome自动收到B的新位置，没有push。
- A打开提交`2081459aec035243c7af2fcfd1fa6a92b357f66c`。两个页面能显示A的“Viewing history 2081459a”，同时A的编辑位置仍为shared，HEAD仍为`888b0cc9e350b59791859ea5a34c01215f2447e0`。
- A临时新增标签页到independent，显示A有两个在线会话、各自分支不同。关闭临时标签页后，A原shared会话保留。
- Firefox“Work Offline”没有立即切断已有本地连接，最初仍能看到旧在线信息，因此最初观察不算断网通过。稍后Chrome观察到B为0 online、旧会话转离线；A仍在线。脱机设置已恢复。
- Firefox离开页面再返回independent，新会话`2TM2rQHr…`出现，旧会话保持离线；最终两位用户各1在线会话。此项证明重新进入后的正确同步，不宣称本轮已证明所有网络条件下的无刷新自动重连。

正常心跳20秒、异常失联60秒判过期；在线接收方下一次心跳也会触发清理，异常掉线显示可能需要约60–80秒。正常退出会主动发布离线状态。不是通过GitHub轮询来同步协作者位置。

证据：`category-3-browser-result.json`（最终DOM断言）、`category-3-history-positions.png`、`category-3-offline.png`、`category-3-ready.png`。

## 验证与部署

- 前端12项通过：事件乱序、断线后忽略旧回包、generation变化、查看意图重放、工作区范围隔离、多会话及离线呈现。
- 后端19项通过：Redis顺序/离线/保留期/容量、socket会话、位置与权限处理。无跳过。
- 构建成功，2个既有警告。前端188文件部署哈希验证；GitPresenceStore单独核对SHA-256一致。
- 仅重启18082的web、web-api、real-time服务。未修改其他实例、正式论文或远端；本轮没有提交/推送。
- 日志：`category-3-{frontend-tests,backend-tests,build,deploy}.log`。

输入为当前工作树；生产修改文件：
- `libraries/redis-wrapper/GitPresenceStore.js`
- `services/web/frontend/js/features/source-control/git-presence-state.ts`
- `services/web/frontend/js/features/source-control/git-presence.ts`
- `services/web/frontend/js/features/source-control/graph-history.tsx`

测试修改：`services/web/test/agent/native-git-presence.test.mjs`；新增`services/web/test/frontend/features/source-control/git-presence-state.test.ts`。

输出为本报告、计划/notes更新及上述日志截图。保留第二类和其他既有工作树修改。

## 过程限制

Graph隐藏时可能正在查看文件diff，这仍属于历史查看；核对后没有修改此行为。测试项目积累的离线会话仍保留24小时，并折叠展示，不清空历史来美化截图。原生菜单自动化曾超时，停止了卡住的自动化并重启System Events，未重启或杀死浏览器；最终已恢复Firefox在线设置。当前未额外验证RedisCluster或真实公网网络故障。
