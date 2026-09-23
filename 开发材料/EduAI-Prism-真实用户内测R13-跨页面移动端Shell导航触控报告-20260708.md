# EduAI-Prism 真实用户内测 R13：跨页面移动端 Shell 导航触控报告

日期：2026-07-08  
范围：移动端全局 Topbar、移动导航抽屉、通知菜单、设置菜单、页面标题上下文  
方法：真实角色登录，等待页面内容完整返回后，再测量触控目标、打开菜单、执行导航。

## 真实内测场景

本轮模拟真实校内移动端使用：

1. 学生账号进入 `/learn`，完成学习页 shell 检查。
2. 教师账号进入 `/dashboard` 与 `/class`，完成教学页和班级页 shell 检查。
3. 管理员账号进入 `/admin/audit`，等待真实审计内容返回后完成管理端 shell 检查。
4. 在真实浏览器中打开帮助 toast、通知 dropdown、设置 dropdown、移动导航抽屉，并通过抽屉导航到 `/class`。

## 初测问题

### R13-SHELL-001：移动端顶栏关键按钮触控目标不足

初测中，`打开导航 / 帮助 / 通知 / 设置` 在学生、教师、管理员页面均约为 `30-32px`，低于移动端主要触控目标。

### R13-SHELL-002：移动导航抽屉项高度擦边不足

移动抽屉导航项初测约 `39px` 高，真实手指点击存在误触风险，尤其在管理员抽屉中项目更多。

### R13-SHELL-003：学生与班级页面顶栏标题缺失上下文

`/learn` 显示泛化标题 `EduAI Prism · 学校 AI 平台`，并在移动端换行；`/class` 也缺少专属标题映射。真实用户进入页面后需要知道当前模块，而不是只看到品牌兜底文案。

### R13-SHELL-004：设置菜单与通知操作项触控高度不足

设置菜单项初测约 `34px`，通知菜单的 `全部已读` 约 `32px`。这些虽然在 dropdown 内，但仍是移动端真实可点项。

## 修复内容

- `Topbar.tsx`
  - 为 `/learn`、`/explore`、`/class` 增加标题映射。
  - 移动端顶栏主按钮改为 `h-12 w-12`。
  - 顶栏标题增加 `min-w-0 shrink truncate`，避免移动端换行挤压。
  - 通知 `全部已读` 与通知条目提升到 `min-h-12`。

- `MobileNav.tsx`
  - 移动抽屉导航项提升到 `min-h-12`。

- `dropdown-menu.tsx`
  - 通用 `DropdownMenuItem` 提升到 `min-h-12`，保证设置菜单、主题菜单等移动触控达标。

## 最终复测

最终真实浏览器复测结果：

- 学生 `/learn`
  - 页面返回并显示 `我的学习 · Learning`
  - 顶栏按钮均 `42 x 42px`
  - 移动抽屉导航项 `42px`
  - 无水平溢出，无 console error/warn

- 教师 `/dashboard` 与 `/class`
  - dashboard 稳定内容 `今日 AI 对话 / 教学快捷入口 / 首页` 返回
  - `/class` 显示 `班级学情 · Class Insight`
  - 抽屉精确点击 `班级学情` 后进入 `/class`
  - 顶栏按钮与抽屉链接均 `42px`

- 管理员 `/admin/audit`
  - 真实审计内容返回
  - 顶栏按钮与管理端抽屉链接均 `42px`
  - 无水平溢出，无 console error/warn

- Dropdown 复测
  - 通知 `全部已读`：`42px`
  - 通知条目：`93px`
  - 设置菜单项：全部 `42px`
  - `smallActionButtons=[]`，`smallMenuItems=[]`

## 证据文件

- 初测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-shell-nav\logs\r13-baseline-shell-audit.json`
- 跨角色复测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-shell-nav\logs\r13-final-shell-retest.json`
- 顶栏交互证明：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-shell-nav\logs\r13-final-interaction-proof.json`
- Dropdown 最终复测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-shell-nav\logs\r13-final-dropdown-retest-minh12.json`
- 手动影响面审阅：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-shell-nav\logs\manual-impact-review-r13.json`

## 静态与审阅门

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过
- 本地应用重启：`http://127.0.0.1:4920/login` 返回 200
- `code-review-graph build --repo app`：通过，`156 files / 650 nodes / 6241 edges`
- `code-review-graph status --repo app`：通过，`650 nodes / 6054 edges`

## 剩余风险

- `dropdown-menu.tsx` 是共享基础组件；本轮已验证移动端 shell 菜单和构建，但桌面端完整视觉回归应放到后续单独轮次。
- 当前 workspace/app 不是 git 仓库，无法做 git checkpoint 或 diff-based review；已用 code-review-graph 与手动影响面审阅替代。

## 结论

R13 已完成跨页面移动端 shell 触控与导航上下文修复。学生、教师、管理员三类真实角色在移动端的顶栏按钮、抽屉导航、通知菜单、设置菜单都已达到可触标准，并通过真实浏览器复测。
