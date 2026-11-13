# 提交与部署差异复核（2026-11-13）

目标提交：5e9166eb81404f92867281321d2469065df92376。

## 结论

18081/18082 的完整部署未被本次提交完整覆盖。两容器的 92 个 NativeGit 后端文件 SHA256 与 HEAD 全部一致；两容器 manifest 与上次部署构建 manifest 相同。对该构建的源码与 HEAD 比较，发现 15 个未完整提交的前端文件；容器中另有 6 个 Plugin/WritingAssist 后端文件与工作区一致、与 HEAD 不同。这是提交范围被收窄造成的，不能声称远端完整复现部署。

另外 HEAD 中权限弹窗简化尚未部署；branch-workspaces 差异来自提交前空白清理，source-control.css 包含新权限样式，agent-panel.css 只提交了 Git Dock 部分。未重启服务或修改用户数据。

## 59 个失败记录的性质

- 48 个找不到界面元素：其中存在已经改名/移除的旧入口，例如 Automatic commits…、Search history、Create shell draft。但未经逐项复现不能全部归为旧测试。
- 3 个 undefined.length 异常：出现在合并任务/协作 Pull 路径，必须检查真实数据与测试 fixture，不能仅改文案消除。
- 3 个 done() 重复调用：属于上述异步异常后的重复报告，不是另三项独立功能。
- 3 个断言不一致：两个 Pull 调用参数断言及任务提示文案断言。
- 2 个查询匹配多个界面元素：status/Saved commit。

总计 59 个失败记录，不能解读为 59 个独立产品缺陷，也不能当作全部无害。当前仅完成日志归类，没有修复这批失败。完整前端结果为 180 passing / 59 failing。

## 逐项失败清单

- **1) automatic commit settings** saves branch interval with exact policy revision:
  - TestingLibraryElementError: Unable to find an element with the text: Automatic commits…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **2) automatic commit settings** blocks schedule changes until an explicitly reviewed recovery completes:
  - TestingLibraryElementError: Unable to find an element with the text: Automatic commits…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **3) automatic commit settings** does not expose settings when owner authorization fails:
  - TestingLibraryElementError: Unable to find an element with the text: Automatic commits…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **4) automatic commit settings** ignores a late recovery preview after switching API:
  - TestingLibraryElementError: Unable to find an element with the text: Automatic commits…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **5) shared collaboration tasks** requires a server-issued lease and submits its exact revision/generation when applying:
  - Uncaught TypeError: Cannot read properties of undefined (reading 'length')
- **6) shared collaboration tasks** requires a server-issued lease and submits its exact revision/generation when applying:
  - done() called multiple times in test <shared collaboration tasks requires a server-issued lease and submits its exact revision/generation when applying> of file [isolated snapshot]; in addition, done() received error: Error: Unable to find role="button" and name "Take resolution lease"
- **7) shared collaboration tasks** shows lease refusal without enabling apply or closing the task:
  - Unable to find role="button" and name "Take resolution lease"
- **8) remote discovery schedule settings** saves owner-selected interval and pinned revision, then refreshes server policy:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Automatic remote checks…"
- **9) remote discovery schedule settings** shows owner authorization errors without rendering editable settings:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Automatic remote checks…"
- **10) remote discovery schedule settings** allows disabling an existing policy when deployment scheduler is off:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Automatic remote checks…"
- **11) Paper Assistant Git command execution** offers shared merge review from slash pull without applying files:
  - Uncaught TypeError: Cannot read properties of undefined (reading 'length')
- **12) Native graph history navigation** filters branches inline and applies the selected branch without a modal:
  - TestingLibraryElementError: Unable to find an accessible element with the role "combobox" and name "Filter graph branches"
- **13) Native graph history navigation** searches native history beyond loaded rows and restores the snapshot when cleared:
  - TestingLibraryElementError: Unable to find an accessible element with the role "searchbox" and name "Search history"
- **14) Paper Assistant Git command execution** offers shared merge review from slash pull without applying files:
  - Error: done() called multiple times in test <Paper Assistant Git command execution offers shared merge review from slash pull without applying files> of file [isolated snapshot]; in addition, done() received error: Error: Unable to find role="combobox" and name "Task"
- **15) local recovery copy access** makes text available after unmount/remount without applying it to a project:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "13-11-2026 09:57:39 · version 2"
- **16) local recovery copy access** selects recovered content by document ID even when names match:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "13-11-2026 09:57:39 · version 2"
- **17) Git menu action audit** Repository actions: Commit sends correct native commit flags:
  - Unable to find role="dialog"
- **18) Git menu action audit** Repository actions: Commit (Amend) sends correct native commit flags:
  - Unable to find role="dialog"
- **19) Git menu action audit** Repository actions: Commit (Signed Off) sends correct native commit flags:
  - Unable to find role="dialog"
- **20) Git menu action audit** Repository actions: Commit Staged sends correct native commit flags:
  - Unable to find role="dialog"
- **21) Git menu action audit** Repository actions: Commit Staged (Amend) sends correct native commit flags:
  - Unable to find role="dialog"
- **22) Git menu action audit** Repository actions: Commit Staged (Signed Off) sends correct native commit flags:
  - Unable to find role="dialog"
- **23) Git menu action audit** Repository actions: Commit All sends correct native commit flags:
  - Unable to find role="dialog"
- **24) Git menu action audit** Repository actions: Commit All (Amend) sends correct native commit flags:
  - Unable to find role="dialog"
- **25) Git menu action audit** Repository actions: Commit All (Signed Off) sends correct native commit flags:
  - Unable to find role="dialog"
- **26) Git menu action audit** More changes actions: Commit sends correct native commit flags:
  - Unable to find role="dialog"
- **27) Git menu action audit** More changes actions: Commit (Amend) sends correct native commit flags:
  - Unable to find role="dialog"
- **28) Git menu action audit** More changes actions: Commit (Signed Off) sends correct native commit flags:
  - Unable to find role="dialog"
- **29) Git menu action audit** More changes actions: Commit Staged sends correct native commit flags:
  - Unable to find role="dialog"
- **30) Git menu action audit** More changes actions: Commit Staged (Amend) sends correct native commit flags:
  - Unable to find role="dialog"
- **31) Git menu action audit** More changes actions: Commit Staged (Signed Off) sends correct native commit flags:
  - Unable to find role="dialog"
- **32) Git menu action audit** More changes actions: Commit All sends correct native commit flags:
  - Unable to find role="dialog"
- **33) Git menu action audit** More changes actions: Commit All (Amend) sends correct native commit flags:
  - Unable to find role="dialog"
- **34) Git menu action audit** More changes actions: Commit All (Signed Off) sends correct native commit flags:
  - Unable to find role="dialog"
- **35) Git menu action audit** Pull, Push: Pull (Rebase)… dispatches the selected operation:
  - AssertionError: expected command to have been called with arguments { command: 'pull', remote: 'origin', branch: 'main', rebase: true }
- **36) Git menu action audit** Pull, Push: Pull from… dispatches the selected operation:
  - AssertionError: expected command to have been called with arguments { command: 'pull', remote: 'mirror', branch: 'source' }
- **37) Git menu action audit** Branch: Rename branch… dispatches the selected operation:
  - TestingLibraryElementError: Unable to find an element with the text: Rename branch…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **38) Git menu action audit** Branch: Delete branch… dispatches the selected operation:
  - TestingLibraryElementError: Unable to find an element with the text: Delete branch…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **39) shared remote discovery status** reviews the displayed remote commit and offers no merge action for deleted tips:
  - TestingLibraryElementError: Unable to find an element with the text: Remote update checks (1). This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **40) shared remote discovery status** reports malformed status instead of crashing the Source Control panel:
  - TestingLibraryElementError: Unable to find an accessible element with the role "alert"
- **41) shared remote discovery status** subscribes during initial load and ignores an older response arriving last:
  - TestingLibraryElementError: Unable to find an element with the text: newer. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **42) shared remote discovery status** removes stale data on access failure and reloads on reconnection or focus:
  - TestingLibraryElementError: Unable to find an accessible element with the role "alert"
- **43) session recovery dialog** requires acknowledgement and reuses operation identity after failure:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Recover collaboration sessions…"
- **44) session recovery dialog** resumes the server pending task:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Recover collaboration sessions…"
- **45) session recovery dialog** disables recovery when permission or task lookup fails:
  - TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Recover collaboration sessions…"
- **46) shell drafts** requires review before apply:
  - Unable to find role="button" and name "draft — review-ready"
- **47) shell drafts** requires explicit preservation and blocks unsafe resume:
  - Unable to find role="button" and name "draft — recovery-required"
- **48) shell draft workspace changes** ignores old review completion after changing workspace API:
  - Unable to find role="button" and name "old — review-ready"
- **49) shell draft creation and interrupted startup** prepares before starting and allows uncertain startup to stop and seal:
  - Unable to find role="button" and name "Create shell draft"
- **50) Native Source Control panel** opens shared review after collaborative Pull instead of applying files:
  - Uncaught TypeError: Cannot read properties of undefined (reading 'length')
- **51) Native Source Control panel** opens shared review after collaborative Pull instead of applying files:
  - Error: done() called multiple times in test <Native Source Control panel opens shared review after collaborative Pull instead of applying files> of file [isolated snapshot]; in addition, done() received error: Error: Unable to find role="combobox" and name "Task"
- **52) Native Source Control panel** commits all with sign-off through the shared menu after explicit confirmation:
  - Unable to find role="dialog" and name "Commit all changes (Signed Off)"
- **53) Native Source Control panel** shows the project name, publish launcher and hierarchical actions:
  - TestingLibraryElementError: Unable to find an element with the text: Create branch…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **54) Native Source Control panel** switches the diff immediately, ignores late responses and caches committed files:
  - TestingLibraryElementError: Found multiple elements with the role "status"
- **55) Native Source Control panel** amends explicitly with full message and captured branch/head:
  - Unable to find role="textbox" and name "Replacement commit message"
- **56) Native Source Control panel** refreshes status after a lost commit response without submitting the commit again:
  - Found multiple elements with the text: Saved commit
- **57) Native Source Control panel** renames a branch through the native command without creating a replacement branch:
  - TestingLibraryElementError: Unable to find an element with the text: Rename branch…. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **58) Native Source Control panel** stages a selected file, commits it and immediately renders the returned graph and remaining files:
  - Unable to find an element with the text: Update title on B. This could be because the text is broken up by multiple elements. In this case, you can provide a function for your text matcher to make your matcher more flexible.
- **59) workspace-wide Git task notices** shows a conflict without mounting Source Control and opens its shared task dialog:
  - AssertionError: expected 'Merge needs your review' to include '1 shared Git task needs attention'
