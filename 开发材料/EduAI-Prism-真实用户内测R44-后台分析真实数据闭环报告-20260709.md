# EduAI-Prism 真实用户内测 R44：后台分析真实数据闭环报告

时间：2026-07-09  
环境：本地生产服务 `http://127.0.0.1:4920`  
角色：学校管理员、学生、未登录访客  
链路：管理员登录 -> `/admin/analytics` -> 后端聚合读回 -> 页面内容质量审阅 -> 移动端触控与布局回归

## 结论

R44 通过。后台分析看板已从静态样例数值升级为管理员专用真实后端聚合接口 `/api/admin/analytics` 驱动，页面显示、API 返回体、权限边界、移动端触控目标和控制台健康均已回归通过。

本轮不把“页面能打开”当作合格，而是等待 API 返回完整聚合内容后读取并审阅数值含义。检查中发现并修复了 2 个问题：

- `R44-ANALYTICS-001`：活跃账号 KPI 曾把历史审计中的临时用户也计入，导致 `近 7 日活跃账号=5` 大于 `全量 4 个账号`。
- `R44-ANALYTICS-002`：窄视口下顶栏与刷新按钮测得约 42px，低于 44px 触控基线。

## 已完成优化

1. 新增管理员专用接口：`GET /api/admin/analytics`
   - 未登录返回 `401`
   - 学生等非管理员返回 `403`
   - 管理员返回真实聚合数据，包括 KPI、近 7 日调用、部门账号分布、采纳漏斗、满意度、热门智能体、模型回复占比、热力图、系统状态和来源读回。

2. `/admin/analytics` 页面改为真实接口驱动
   - 移除旧静态样例 KPI：`在线用户 892`、`模型调用 24,812`、`¥412` 等不再出现。
   - 增加“后端实时”“API /api/admin/analytics”“数据来源读回”等可信标识。
   - 保留未开通的时间筛选、部门筛选、导出报告按钮，并通过禁用状态和 title 诚实说明。

3. 移动端/窄视口触控优化
   - 分析页操作按钮改为固定 `48px`。
   - 共享顶栏图标按钮改为固定 `48px`，避免 rem 受全局字号影响后实际测量低于 44px。

## 关键证据

- 管理员 `/api/admin/analytics`：`200`
- 学生 `/api/admin/analytics`：`403`
- 未登录 `/api/admin/analytics`：`401`
- 最终 KPI：活跃账号 `4 / 4`、模型调用 `112`、估算 Token `1.8万`、知识库可检索率 `100%`、安全/越权事件 `88`、今日成本估算 `¥0.21`
- 来源读回：账号 `4`、会话 `44`、消息 `130`、智能体 `8`、知识库文件 `5`、审计日志 `207`、安全工单 `10`、反馈 `1`
- Browser 回归：无 console error/warn、无横向溢出、启用按钮小于 44px 数量为 `0`
- 静态检查：`npm run lint` 通过；`npx tsc --noEmit` 通过；`npm run build` 通过
- code-review-graph：`160 files / 711 nodes / 6915 edges`

## 变更文件

- `app/lib/server/db.ts`
- `app/app/api/admin/analytics/route.ts`
- `app/app/(shell)/admin/analytics/page.tsx`
- `app/components/admin/AdoptionFunnel.tsx`
- `app/components/admin/HourHeatmap.tsx`
- `app/components/shell/Topbar.tsx`

## 残余风险

- 当前成本仍为本地公式估算，并已在页面标明“估算”。后续若接入真实计费网关，应替换为真实账单来源。
- 报告导出、时间筛选、部门筛选仍未开通，但页面已诚实禁用，没有伪交互。
- 本地 SQLite 使用 Node experimental API，构建/运行会出现实验性 warning，不影响本轮功能。
