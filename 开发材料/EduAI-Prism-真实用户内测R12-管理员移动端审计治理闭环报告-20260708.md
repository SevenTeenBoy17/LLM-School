# EduAI-Prism 真实用户内测 R12：管理员移动端审计治理闭环报告

日期：2026-07-08  
范围：管理员移动端安全审计、越权记录回读、安全工单可读性、CSV 导出反馈  
方法纠偏：本轮不以路由 200、按钮存在、静态截图作为结论；必须由真实角色完成任务，并等待 UI/API/导出状态完整返回后再评价。

## 真实内测场景

模拟校内安全治理例会前的真实使用链路：

1. 学生账号 `student / Student@123` 登录。
2. 学生尝试访问受保护页面 `/admin/audit`。
3. 系统将学生带回 `/learn`，同时由 proxy 写入真实越权审计记录。
4. 管理员账号 `admin / Admin@123` 在 390 x 844 移动视口登录。
5. 管理员进入 `/admin/audit`，等待真实 `/api/audit` 与 `/api/safety/tickets` 内容渲染完成。
6. 管理员查看最新越权记录、浏览真实审计卡片、安全工单、执行样例筛选搜索，并点击导出。

最终证据显示：学生越权产生了 `2026/7/8 13:49:40 · u-student · /admin/audit · unauthorized_access · 拒绝`，管理员移动端回读到 `68` 条服务端审计记录和 `4` 条安全求助工单。

## 发现与修复

### R12-ADM-MOB-001：样例审计卡头在手机上被挤压

问题：`安全审计日志` 卡片头部沿用横向 `CardHeader`，390px 下说明文字被 tabs 挤成窄列，管理员难以理解“样例数据”和“真实记录”的边界。

修复：在审计页局部将卡头改为移动端纵向堆叠，桌面端仍保持横向结构。位置：[audit/page.tsx](/D:/VB/LLM-School/app/app/(shell)/admin/audit/page.tsx:146)。

### R12-ADM-MOB-002：真实审计与工单在手机端只能横向看宽表

问题：服务端真实审计和安全工单原本只提供宽表横滑。真实管理员在移动端处理安全事件时，需要一眼看到时间、结果、用户、路径和动作；宽表会降低研判效率。

修复：移动端新增真实审计卡片和工单卡片，桌面端继续使用宽表。位置：[audit/page.tsx](/D:/VB/LLM-School/app/app/(shell)/admin/audit/page.tsx:226)。

### R12-ADM-MOB-003：关键页面控件触控目标不足

问题：导出、筛选、搜索、工单跟进等页面内关键控件初测为约 `28-35px` 高，工单“跟进”按钮曾只有约 `33 x 21px`。

修复：页面内关键移动控件提升到 `h-12/min-h-12`。最终浏览器实测：导出、筛选、搜索、跟进按钮均为 `42px` 高，`smallPageTargets=[]`。位置：[audit/page.tsx](/D:/VB/LLM-School/app/app/(shell)/admin/audit/page.tsx:103)。

### R12-ADM-EXP-004：Blob 下载事件不可见时，管理员缺少页面级导出确认

问题：浏览器未捕获 Blob 下载事件时，真实管理员无法判断 CSV 是否生成。

修复：导出后增加页面级 `role="status"` 状态：`已生成 68 条真实审计 CSV`。位置：[audit/page.tsx](/D:/VB/LLM-School/app/app/(shell)/admin/audit/page.tsx:120)。

## 验证证据

- 浏览器真实复测日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-mobile-audit\logs\r12-final-browser-retest.json`
- 筛选搜索复测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-mobile-audit\logs\r12-final-filter-search-check.json`
- 顶部视口截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-mobile-audit\screenshots\r12-admin-mobile-audit-final-viewport.png`
- 真实审计卡片截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-mobile-audit\screenshots\r12-admin-mobile-audit-final-real-cards.png`
- 手动影响面审阅：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\admin-mobile-audit\logs\manual-impact-review-r12.json`

## 静态与审阅门

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过
- 本地应用重启：`http://127.0.0.1:4920/login` 返回 200
- `code-review-graph build --repo app`：通过，`156 files / 650 nodes / 6241 edges`
- `code-review-graph status --repo app`：通过，`650 nodes / 6054 edges`

## 剩余风险

- In-app Browser 对 Blob CSV 下载仍未发出可捕获的 download event；本轮以页面级成功状态、无控制台错误、真实数据内容作为替代证据。
- 顶部移动导航图标属于全局 shell，实测仍偏小；本轮未改全局导航，建议进入下一轮跨页面移动导航触控回归。
- 当前 workspace/app 不是 git 仓库，无法做 git checkpoint 或 diff-based review；已用代码图构建和手动影响面审阅替代。

## 结论

R12 已完成并修复管理员移动端审计治理的主要真实使用问题。现在管理员可以在手机上完成“越权事件回读、真实审计研判、安全工单浏览、CSV 导出确认”的闭环。整体 12 小时真实内测目标仍继续进行。
