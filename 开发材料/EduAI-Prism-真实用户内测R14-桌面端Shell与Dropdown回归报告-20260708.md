# EduAI-Prism 真实用户内测 R14：桌面端 Shell 与 Dropdown 回归报告

日期：2026-07-08  
范围：桌面端 Topbar、侧边导航、通知 dropdown、设置 dropdown、管理员审计筛选 tabs  
方法：真实角色登录，等待页面内容完整返回后，再打开菜单、点击导航和筛选控件、读取结果并评价。

## 真实内测场景

本轮承接 R13 风险：上一轮为了修复移动端 shell 触控，调整了共享 dropdown item 高度，因此必须在桌面端复测是否造成密度、遮挡或溢出副作用。

真实流程如下：

1. 学生账号通过登录页进入 `/learn`，等待 `我的学习 / Learning` 返回后，打开通知和设置菜单。
2. 教师账号通过登录页进入 `/dashboard`，等待 `首页 / 今日 AI 对话` 返回后，打开通知和设置菜单。
3. 教师在桌面侧边栏点击 `班级学情`，进入 `/class` 并等待 `班级学情 / Class Insight` 返回。
4. 管理员账号通过登录页进入 `/admin/audit`，等待审计页面内容返回后，打开通知和设置菜单。
5. 管理员逐个点击 `高风险 / 待处理 / 已忽略 / 全部` 筛选 tabs，验证选中状态、行内容和溢出。

## 初测发现

### R14-QA-001：Browser DOM snapshot 能力降级

内置 Browser 的 `domSnapshot()` 在登录页触发 `incrementalAriaSnapshot` 运行时错误。该问题属于测试能力降级，不作为产品缺陷。R14 改用同一浏览器中的只读 DOM evaluate、可见控件 locator、截图和 console logs 继续取证。

### R14-AUDIT-001：管理员审计桌面筛选 tabs 高度不足

真实管理员进入 `/admin/audit` 后，审计页 `全部 / 高风险 / 待处理 / 已忽略` tabs 初测约 `29px` 高。  
这些 tabs 是真实管理员筛查审计记录的高频控件，不应在桌面端压到低于 32px 的可点击下限。

### R14-QA-002：滚动内容 offscreen 误报

初测中部分元素被 naive viewport 检查标记为 offscreen，经复核为页面长内容、侧栏页脚、下方卡片位于首屏以下，属于正常滚动内容，不是 dropdown 遮挡或横向溢出。复测脚本已将滚动内容与 overlay/dropdown 失败分开。

## 修复内容

文件：`D:\VB\LLM-School\app\app\(shell)\admin\audit\page.tsx`

- 将 4 个审计筛选 `TabsTrigger` 的桌面端高度从 `md:min-h-0` 调整为 `md:min-h-10`。
- 保留移动端 `min-h-12`，不回退 R12/R13 的移动可触性修复。
- 未修改全局 `Tabs` 组件，避免影响其他页面密度。
- 未修改共享 `dropdown-menu.tsx`，因为 R13 的 dropdown 修复在 R14 桌面复测中没有造成失败。

## 最终复测

### 桌面 Shell / Dropdown

- 学生 `/learn`
  - 页面内容完整返回。
  - 顶栏按钮无小尺寸问题。
  - 侧边导航无小尺寸问题。
  - 通知和设置 dropdown 均可打开，无 offscreen、无过小菜单项。
  - 无横向溢出，无 console error/warn。

- 教师 `/dashboard`
  - 页面内容完整返回。
  - 通知和设置 dropdown 均可打开。
  - 侧边栏点击 `班级学情` 后进入 `/class`。
  - `/class` 内容完整返回。
  - 无横向溢出，无 console error/warn。

- 管理员 `/admin/audit`
  - 页面内容完整返回。
  - 通知和设置 dropdown 均可打开。
  - 审计筛选 tabs 最终实测约 `35px` 高，高于桌面 32px 下限。
  - `高风险 / 待处理 / 已忽略 / 全部` 均能点击并进入 selected/active 状态。
  - 无横向溢出，无 console error/warn。

## 证据文件

- 初测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\desktop-shell-dropdown\logs\r14-desktop-shell-dropdown-realuse.json`
- 修复后复测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\desktop-shell-dropdown\logs\r14-desktop-shell-dropdown-postfix.json`
- 管理员筛选功能复测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\desktop-shell-dropdown\logs\r14-admin-audit-tabs-function-postfix.json`
- 手动影响面审阅：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\desktop-shell-dropdown\logs\manual-impact-review-r14.json`
- 截图目录：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\desktop-shell-dropdown\screenshots`

## 静态与审阅门

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过
- 本地应用重启：`http://127.0.0.1:4920/login` 返回 200
- `code-review-graph build --repo app`：通过，`156 files / 650 nodes / 6241 edges`
- `code-review-graph status --repo app`：通过，`650 nodes / 6054 edges`
- 手动影响面审阅：通过

## 剩余风险

- 当前 workspace/app 不是 git 仓库，无法做 git checkpoint 或 diff-based review。
- Browser `domSnapshot()` 在本轮降级，已用同一浏览器 evaluate、locator、截图、console logs 补证。
- 本轮只关闭桌面 shell/dropdown 与管理员审计筛选 tabs，不代表全部长耗时 AI 任务、导出下载事件和桌面全页面视觉均已完成。

## 结论

R14 已完成桌面端 shell/dropdown 回归，并修复管理员审计页桌面筛选 tabs 触控高度不足问题。修复后，三类真实角色的桌面 shell、通知菜单、设置菜单、教师侧边栏导航、管理员审计筛选均通过真实浏览器复测。
