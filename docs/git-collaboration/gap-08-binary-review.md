# G08 / W19 二进制冲突双浏览器验收

2026-11-13；仅18082合成项目，原Chrome A、Firefox B窗口。

- 工作区：`5f057c40ee42775e1f180e8f`；分支 `g08-binary-target`。
- 合并任务：`e0785e69-11ad-46ed-9019-02e61da95d65`，incoming `g08-binary-incoming`。
- 双端收到同一figure.png冲突；显示二进制选边而非文本编辑。
- A在Chrome选择Incoming并暂存，双方看到ready-to-apply。
- A租约到期后，B在Firefox取得租约并应用；Chrome同步显示resolved，提交`b6ba231a`。
- 实际项目blob与工作树图片SHA256均为`e79faaf7c7ab6e6c255f4e044855029c05b0544642f99242d0e465119e8df286`，等于incoming；工作区clean。
- 原项目gap02/plain的G06恢复和取消后编辑标记仍保留。

证据：gap-08-binary-shared-conflict.png、gap-08-binary-ready.png、gap-08-binary-task.json、gap-08-binary-fixture.json、gap-08-binary-result.json。

界限：本项复用已有二进制实现，没有新增产品代码；租约测试只证明到期接手，未证明有效租约期间并发抢占拒绝；未推送外部仓库，未验证图片渲染质量。
