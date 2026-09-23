# EduAI-Prism 真实用户内测 R35：管理端智能体监控移动可用性与权限闭环报告

日期：2026-07-09  
范围：管理端智能体监控 / 移动端触控 / 状态流转 / 导出反馈 / 后端权限边界  
结论：通过。R35 已完成真实管理员操作链、移动端可用性修复、越权边界验证、静态验证与审阅门。

## 1. 本轮真实使用协议

本轮围绕管理端 `/admin/agents`，模拟学校管理员在真实产品中的操作：

1. 教师账号创建 R35 临时智能体，并提交审核，作为管理端待办数据。
2. 管理员桌面端登录 `/admin/agents`，等待真实列表返回。
3. 管理员切换“表格/看板”，点击“教学”分类筛选，并导出当前列表，必须有可见 CSV 反馈。
4. 管理员在表格中对临时智能体执行“通过发布 -> 停用 -> 重新发布”，每步都等待 API 状态返回。
5. 管理员读取审计日志，确认发布/停用状态变更有审计记录。
6. 管理员移动端打开同一页面，测量首屏可见按钮和链接的触控尺寸，并检查页面级横向溢出。
7. 学生账号尝试越权 PATCH/DELETE 智能体，教师账号尝试把已发布智能体拉回草稿，均必须被拒绝。
8. 教师账号清理 R35 临时智能体，确认 cleanup 返回 200。

最终日志：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/admin-agents-r35/logs/r35-admin-agents-R35_ADMIN_1783606102319.json`

## 2. 初始失败与修复

### R35-ADM-MOB-001：移动端管理页高频控件触控目标过小

基线结果：

- `verdict=fail`
- `mobileSmallTargets=18`
- 主要问题控件：
  - 顶部导航图标按钮宽度约 `38.9px`
  - 分类筛选按钮高度约 `25px`
  - “导出数据”按钮高度约 `28px`
  - AdminTabs 链接高度约 `29.3px`
  - “表格/看板”切换按钮高度约 `25px`

修复：

- [Topbar.tsx](D:/VB/LLM-School/app/components/shell/Topbar.tsx:102)：移动 topbar 图标按钮增加 `min-w-12 shrink-0`，避免 flex 收缩到 40px 以下。
- [AdminTabs.tsx](D:/VB/LLM-School/app/components/admin/AdminTabs.tsx:24)：管理端横向页签增加 `min-h-12`。
- [admin/agents/page.tsx](D:/VB/LLM-School/app/app/(shell)/admin/agents/page.tsx:85)：分类筛选、导出按钮、表格/看板切换统一提升到 `min-h-12`。

### R35-QA-001：预期 403 越权验证被脚本误判为 console error

基线中学生/教师越权 API 探测会在浏览器 console 出现 `403 Forbidden`，这是测试预期，不是产品异常。已修正 R35 脚本：预期 `403/Forbidden/404` 边界探测不再计入 unexpected console。

### R35-ENV-001：服务重启未注入生产会话密钥

第一次修复后复测卡在登录，日志显示 `EDUAI_SESSION_SECRET` 未配置。按既有规则用进程级临时 secret 重启本地服务，不写入磁盘。该问题属于测试环境启动问题，不计入产品缺陷。

## 3. 最终通过证据

| 检查项 | 最终结果 |
| --- | --- |
| 管理员桌面列表加载 | 通过，R35 临时智能体可见 |
| 分类筛选“教学” | `aria-pressed=true`，列表包含 R35 智能体 |
| 表格/看板切换 | `kanbanPressed=true` |
| CSV 导出反馈 | 页面出现 `CSV 已生成` |
| 审核通过 | API 状态返回 `pub` |
| 停用 | API 状态返回 `disabled` |
| 重新发布 | API 状态返回 `pub` |
| 审计记录 | `agent_status_pub` / `agent_status_disabled` 存在 |
| 学生详情/use | `200 / 200` |
| 学生 PATCH 状态 | `403` |
| 学生 DELETE | `403` |
| 教师 owner pub->draft | `403` |
| 移动端小目标 | `0` |
| 移动端页面级横向溢出 | `false` |
| console unexpected | `[]` |
| cleanup | `200` |

## 4. 验证与审阅门

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地服务：`http://127.0.0.1:4920`，最终进程 `57604`。
- R35 Playwright 真实使用最终复测：通过。
- code-review-graph：已刷新，159 files / 691 nodes / 6497 edges。
- 手工影响面审阅：通过，见：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/admin-agents-r35/logs/manual-impact-review-r35.json`

## 5. 产品体验结论

R35 修复后，管理端智能体监控页在手机上更适合真实管理员操作：筛选、导出、管理端页签、表格/看板切换都具备稳定触控目标；桌面端审核、停用、恢复、审计和后端权限边界保持正确。该修复范围很小，没有改变智能体状态机和权限语义。

## 6. 剩余注意事项

- 智能体表格在移动端仍是横向滚动的密集数据表，这是当前产品形态下可接受的操作型 UI；本轮已确认页面级横向溢出为 false。
- 本地浏览器环境不稳定捕获 Blob 下载事件，因此 CSV 以页面可见 toast 和导出内容反馈为验收依据。
- 工作区不是 git 仓库，无法提供 git checkpoint/PR diff；本轮使用 supervisor timeline、静态检查、Playwright 证据、code-review-graph 和手工审阅替代。
