# EduAI-Prism 真实用户内测问题清单 R47

| 编号 | 严重级别 | 状态 | 问题 | 修复与验证 |
| --- | --- | --- | --- | --- |
| R47-DASH-001 | P1 | 已修复 | `/dashboard` 使用静态/示例概览，不能支撑真实学校内测判断 | 接入 `/api/dashboard` 与后端 `DashboardSnapshot`；API 与浏览器最终均 pass |
| R47-DASH-002 | P1 | 已修复 | 教师首页数据源摘要与 `/api/learning` 存在诚信周数据漂移 | 复用学习快照 `integrityWeekly`；`r47-dashboard-api-summary-final-r3.json` 通过 |
| R47-DASH-003 | P1 | 已修复 | 管理端审计行数因读 dashboard 后写审计而与 `/api/admin/analytics` 漂移 | 改为先写审计再生成 dashboard 快照；最终 API 对齐 |
| R47-DASH-004 | P2 | 已修复 | 首登引导可能覆盖 dashboard 并阻断真实点击 | `/dashboard` 排除全屏 onboarding；教师最近会话和快捷动作真实点击通过 |
| R47-DASH-005 | P2 | 已修复 | Dashboard 次级文字入口命中区偏小 | 关键文字入口加高；最终 browser smallTargets=[] |
| R47-DASH-006 | P2 | 已修复 | 管理视角 Tab 实测 71x29，不满足稳定命中区 | 加 `min-h-[40px] px-3`；最终实测 71x40 |
| R47-QA-001 | 测试问题 | 已修正 | API harness 误读 `/api/class.overview` 和 `teacher.recentChats` 字段 | 修正脚本后 `r47-dashboard-api-summary-final-r3.json` pass |
| R47-QA-002 | 测试问题 | 已修正 | Browser harness 将隐藏 skip-link 当作小目标，并把 quick action 误判成链接 | 过滤隐藏 skip-link，改点 `dashboard-quick-lesson` 按钮 |
| R47-QA-003 | 测试问题 | 已修正 | Browser harness 管理端等待和文案断言过窄 | 改为真实 Tab 点击并接受“后端快照”合法文案；最终 `final-r7` pass |

## 验收口径

本轮只把“返回值正确、页面内容读完、结果质量评审通过、桌面/移动端无交互缺陷”计为合格。单纯路由 200、按钮存在、截图存在不算产品通过。

