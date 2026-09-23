# EduAI-Prism 真实用户内测 R47：首页仪表盘真实数据闭环报告

## 结论

R47 已通过。`/dashboard` 已从静态概览页升级为受保护的后端实时快照页，并通过真实教师、真实管理员、桌面与移动端回归验证。判断依据是等待 API 返回后再读取页面内容、源数据回读、点击落地、命中区、console 和横向溢出。

## 真实使用场景

- 教师：可视登录 -> 打开首页 -> 等待 dashboard 后端快照 -> 读取真实源数据 -> 点击最近会话进入 `/chat?session=...` -> 返回首页 -> 点击“生成教案”快捷动作进入 `/chat?seed=...`。
- 管理员：可视登录 -> 打开首页 -> 切换“管理视角” -> 等待管理端源回读 -> 读取会话、AI 返回、知识库、账号、审计、工单 -> 桌面和移动端检查交互命中区。

## 本轮修复

| 编号 | 问题 | 修复 |
| --- | --- | --- |
| R47-DASH-001 | 首页 KPI、课程、待办、最近会话、模型配额等存在静态/示例数据风险 | 新增 `DashboardSnapshot` 合同与 `/api/dashboard`，由后端真实数据生成 |
| R47-DASH-002 | 教师首页 `integrityWeekly` 曾与 `/api/learning` 读数不一致 | 教师首页源摘要复用学习快照里的 `integrityWeekly` |
| R47-DASH-003 | 管理员 `auditRows` 曾因 dashboard 读取后再审计造成对比漂移 | `/api/dashboard` 先写审计，再生成快照 |
| R47-DASH-004 | 首登引导层可能覆盖 `/dashboard`，阻断真实点击 | `OnboardingGuide` 排除 `/dashboard` |
| R47-DASH-005 | 次级文字链接命中区偏小 | 关键入口增加稳定命中高度 |
| R47-DASH-006 | 管理视角 Tab 实测高度 29px | 两个 Tab 增加 `min-h-[40px] px-3`，最终实测 71x40 |

## 关键证据

- API：`.codex-supervisor/qa-12h-20260708/dashboard-r47/logs/r47-dashboard-api-summary-final-r3.json`，`verdict=pass`。
- 浏览器：`.codex-supervisor/qa-12h-20260708/dashboard-r47/logs/r47-dashboard-browser-summary-final-r7.json`，`verdict=pass`。
- 静态验证：`npm run lint`、`npx tsc --noEmit`、`npm run build` 均通过。
- 结构图审查：`code_review_graph` 164 files / 749 nodes / 7330 edges。
- 手工影响审查：`.codex-supervisor/qa-12h-20260708/dashboard-r47/logs/manual-impact-review-r47.json`，`verdict=pass`。

## 最终读数

- 教师源回读：会话 29、用户提问 47、AI 返回 47、知识库 5、班级学生 6、待批改 3。
- 教师点击回跳：最近会话落到 `/chat?session=ses_mrdrj7vh_dm9o`；快捷动作落到 `/chat?seed=...`，seed 长度 38。
- 管理员源回读：会话 44、AI 返回 65、知识库 5、收藏/反馈 1、账号 4、审计 297/298、工单 10。审计数会随真实读取增加，属预期。
- UI 检查：桌面和 390px 移动端均无横向溢出、无 console error/warning、无启用态小命中区。

## 剩余风险

- 当前验证是本地 `http://127.0.0.1:4920`，没有做生产部署。
- 当前 workspace/app 不是 Git 仓库，无法形成 checkpoint commit 或 diff/PR review。
- 历史 QA 真实会话仍会作为真实数据出现在最近会话中，后续可增加测试数据归档策略。

