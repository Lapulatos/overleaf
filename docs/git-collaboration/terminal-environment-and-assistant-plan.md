# Terminal 运行环境与实验平台实施方案

日期：2026-11-13。状态：待实施方案，不属于本次 Git 基础功能完成声明。

## 目标与入口

在 Overleaf 设置页新增独立导航项 **运行环境与实验平台**。用于在项目容器中安装工具、执行实验，通过 SSH 连接远端实验主机，并允许 Paper Assistant 操作指定 Terminal。所有设置用短标签、状态和必要提示表达；技术细节收进高级设置。

该页面分为六组：

| 分组 | 主要选项 | 权限 |
| --- | --- | --- |
| Docker 环境 | 镜像、架构、CPU、内存、磁盘额度、GPU | 管理员定义可用配置；用户选择允许的配置 |
| 网络访问 | 离线/允许联网、代理、DNS、软件源 | 管理员限制；用户在限制内开启 |
| SSH 主机 | 名称、地址、端口、用户名、凭据引用、主机指纹、连接测试 | 用户私有；共享主机需明确授权 |
| 安全与审批 | 四种 Assistant 权限模式、系统软件安装能力 | 环境权限与 Agent 审批分开 |
| Agent 接管 | 选择 Session、允许输入/执行、输出读取、停止接管 | 每次任务明确目标和授权范围 |
| 环境保留 | 停止后保留、保留期限、存储用量、删除环境 | 用户控制自己的环境；管理员设额度 |

页面上方显示实际生效配置；不可用 GPU 等选项禁用并说明原因。保存只影响新建 Session；现有 Session 保留原配置。需要重建时明确列出受影响会话，不能静默终止。

## 当前实现核对

实现入口：`services/web/app/src/Features/NativeGit/TerminalContainer.mjs`、`ShellDraftService.mjs`、`ShellContainerLifecycle.mjs`、`AccessPolicy.mjs`，以及 `services/agent/src/repository-terminal-runner.mjs`、`shell-docker-adapter.mjs`。

- Terminal 使用独立 Docker 容器和创建时的私有文件快照，记录分支、commit、已保存编辑状态。切换网页分支不会改写已有 Terminal 的环境。
- 当前创建参数固定网络关闭、1 CPU、768 MiB、128 PID，并限制 capabilities。Full Access 允许容器写入，但不等于完整 root 能力；apt 所需的身份切换和文件归属操作仍可能失败。
- 当前四种模式主要控制写入与审批，没有独立的管理员网络、资源、GPU 配置页面。
- Session 列表、历史回放、重命名、批量删除、来源和用户图标已存在。当前停止时保存的有限输出不等于完整持久日志；runner 重启后进程恢复仍需设计。
- 当前 Assistant harness 未接入指定 Terminal 的输入输出工具。SSH 客户端可用性、远程连接和凭据流程尚未完成验证。
- Terminal 私有快照与实时编辑分支不同。现有 Source Control 不会自动把私有环境改动写进正文。

## 配置与服务端约束

新增版本化 `TerminalEnvironmentProfile`：镜像摘要、架构、networkPolicy、代理/软件源引用、CPU、memory、pids、storage、GPU 申请、安装策略、保留策略。管理员提供默认值和上限；客户端不能直接传任意 Docker 启动参数。

Session 保存不可变 `environmentSnapshot`、profileVersion、owner、logicalProject、workspace、sourcePosition、runnerId、containerId、destination。每次启动按服务端政策计算 effectiveConfig，并显示实际值。修改模板不追溯改变运行中的环境。

审批模式与环境能力分开：Read Only 禁止项目写入；Ask for approval 对 Agent 命令请求批准；Approve for me 自动审查并在必要时询问；Full Access 允许授权环境内直接执行。任何模式都不能突破管理员环境上限。手动 Terminal 仍是交互终端，不变成额外 Command 表单。

联网使用明确的出站策略及 DNS/代理配置。普通 Docker bridge 并不自动限制内网访问；若产品承诺限制内网，必须另行实现并测试出口过滤。标准环境不开放宿主机网络、Docker socket 或 privileged。

系统软件安装由独立配置控制。在隔离测试容器验证 apt、pip、npm 所需的最小权限集（如 CHOWN、SETUID、SETGID、FOWNER，按实际包验证）；不能用开启 privileged 代替排查。容器内 root 可直接 apt，无需把 sudo 当作前置要求。并非所有依赖 systemd、内核模块的包都能支持。

GPU 通过 runner 能力探测提供可选设备和额度，不把 macOS GPU 直接等同于 Docker CUDA GPU。没有兼容运行时或设备时显示不可用，用户仍可用 SSH 连接有 GPU 的远程主机。

## Session 与文件生命周期

关闭面板仅隐藏；停止 shell、停止容器、删除列表记录和删除环境是不同动作。停止后保留已安装软件和文件；重新进入可启动新 shell，但不得声称恢复已退出进程的内存状态。删除环境前显示具体对象及是否有未保存文件。

将 PTY 托管与 HTTP runner 生命周期分离，Session 持久记录 runner/container 身份。重启恢复先核验容器身份和活性；不能凭旧列表显示 Running。输出按游标分段持久化，设容量/保留期并标注截断；历史使用只读终端渲染器。

Source Control 增加按 Session 来源查看变化的入口，自动检测私有环境中的文件变化。应用回源分支须校验创建基线、当前分支头和并发编辑状态；发生分歧则进入差异/合并，不能自动覆盖当前网页所在分支。用户无需在 Terminal 重复经历无内容的 Review 按钮。

## SSH 与实验主机

第一阶段使用容器中的 OpenSSH 客户端，通过同一 PTY 连接目标主机。主机卡片提供连接/断开、连接测试和凭据管理。终端标题持续显示远端主机、用户和路径；本地快照来源与远端工作目录分开显示。

私钥由服务端凭据存储管理、按会话短期提供，不放入模型上下文、前端持久存储或日志。首次连接显示实际主机指纹供用户与可信来源核对；指纹变化必须拒绝自动连接。禁止默认关闭 StrictHostKeyChecking，不默认转发宿主机 SSH agent。交互密码等敏感输入不能进入 Agent 输出或持久审计。

SSH 网络能力独立检查；离线时连接前直接说明如何启用允许的网络配置。远端端口、超时和断线状态明确显示。远端命令仍受远端账号权限约束；本地 Full Access 不提升远端权限。断开 SSH 不代表远程实验已终止。后续可支持跳板机、远程任务 ID、日志抓取和实验产物下载，另行定义生命周期。

## Paper Assistant 接管

在 `document-harness.mjs` 及对应后端适配器中增加明确工具契约：列出可访问 Session、选择并绑定、读取增量输出、写入输入、执行命令、发送中断、释放控制。每次调用校验用户、项目、Session 归属和授权；不开放任意宿主机 shell。

任务开始绑定具体 Session，分支切换不能悄悄切换目标。通过控制租约防止用户与 Agent 同时打字串行错乱；用户可随时收回控制。区分“向当前 PTY 输入”和“另起 exec”：后者共享文件但不继承当前 shell 的变量/目录，界面和工具返回必须说明。长任务用输出游标、超时和取消信号；中断命令不等于销毁容器。

SSH 连接后同一 PTY 可以操作远端，但必须把远端目标纳入授权范围，并在模型工具结果中携带目标身份。模型只能获取执行所需输出；凭据、令牌等应脱敏，不能依赖一句提示词保护密钥。

## 实施顺序与验收

1. **P0 配置基础**：服务端 Profile schema、持久化/API、管理员上限、runner 能力探测、每 Session 配置快照。测试越权参数、额度和版本稳定性。
2. **P0 环境可用性**：网络/安装策略生成 Docker 参数；用隔离容器测试 DNS、HTTPS、apt、pip、npm、只读拒绝和离线拒绝。记录实际生效限制，不更改用户现有容器。
3. **P0 设置界面**：Overleaf 设置新增上述独立项；四模式弹窗保持四个短选项，网络/安装状态来自实际配置。测试保存、权限、不可用设备与配置生效提示。
4. **P1 持久 Session**：托管 PTY、日志游标、停止保留、重开、runner 恢复、按额度清理。验证停止后软件/文件仍在、退出 shell 不伪装恢复、删除不影响其他 Session。
5. **P1 SSH**：基础镜像提供客户端，主机配置/凭据代理/known_hosts，测试真实受控远端的连接、指纹变更拒绝、断线和敏感输入不泄露。
6. **P1 Agent 接管**：实现工具桥接、目标授权、控制租约和中断；验证同一个 shell 的 cwd/变量、交互输出、多用户隔离、用户夺回控制、SSH 目标不漂移。
7. **P1 Git 文件衔接**：Session 变化检测及来源视图，验证切换 A/B 分支环境不变、并发编辑不覆盖、审查后回源分支。
8. **P2 实验平台**：对接远端任务提交/状态/产物，支持跳板机、多镜像和有 GPU 的 runner；先定义任务与 SSH 连接断开后的独立生命周期。

## 发布与回退

先在隔离 fixture 验证，再更新 18081、18082。前端、Web 服务、runner 分开发布；活动 Session 固定到原 runner，新 Session 使用新版本，待旧会话退出后再回收。禁止为发布重启正在承载会话的 runner。失败时回退默认 Profile/新会话路由，保留原容器、日志和文件。每阶段分别报告源码、自动测试、真实容器/SSH 验证及两端口部署状态。
