# EduAI Prism 真实用户内测 R41：通知与全局搜索闭环报告

生成时间：2026-07-09 08:39 PDT  
轮次：R41 notification and global search real-use QA  
状态：通过

## 1. 本轮目标

本轮验证高频跨角色入口：通知、全局搜索、搜索结果导航与移动端入口。判定标准不是“菜单能打开”，而是：

- 教师创建真实会话和真实智能体样本，管理员审批/停用/恢复，产生真实通知事件。
- 通知菜单必须等待 `/api/notifications` 返回，并读取返回标题、正文、未读数。
- 点击单条通知必须等待 PATCH 返回 `{ ok: true, unread }`，并复查该通知 `read=true`。
- “全部已读”必须等待 PATCH 返回，并复查最终 `unread=0`。
- 全局搜索必须等待 `/api/search` 返回，会话和智能体结果必须能点击并导航到正确 `/chat` URL。
- 无结果搜索必须返回空数组，并展示可读的无匹配提示。
- 桌面和移动端都必须有可见搜索入口，通知菜单、搜索弹窗和移动 Dashboard 可点击目标不得小于严格 40px。

## 2. 基线问题与修复

R41-SEARCH-001：搜索结果按钮实际高度 38.5px，低于严格触控目标。  
修复：`app/components/shell/CommandPalette.tsx` 搜索结果行增加 `min-h-[44px]`。

R41-MOBILE-SEARCH-002：移动端 Topbar 没有可见全局搜索入口，只能依赖键盘快捷键。  
修复：`app/components/shell/Topbar.tsx` 增加移动端搜索图标按钮，复用同一 `eduai:open-search` 事件。

R41-DASHBOARD-CTA-003：移动 Dashboard 的“发起新对话”按钮高度 28px。  
修复：`app/app/(shell)/dashboard/page.tsx` 为该高频 CTA 增加 `min-h-[40px]`，不全局放大所有 `Button size="sm"`，避免布局回归。

R41-QA-001：第一轮脚本误将全局搜索 dialog 当作输入框。  
修复：R41 Playwright 脚本改为明确定位 `input[aria-label*="搜索"]`，并为临时会话增加清理步骤。

## 3. 最终真实内测路径

测试脚本：
`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/notification-search-r41/r41-notification-search-realuse.js`

最终通过日志：
`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/notification-search-r41/logs/r41-notification-search-R41_NOTIFY_SEARCH_1783611461814.json`

真实流程：

1. 教师账号 `teacher` 登录，创建唯一会话 `R41NS_MRDO7NW6 教师跨端搜索会话样本`。
2. 教师创建唯一智能体 `R41NS_MRDO7NW6 通知搜索智能体`，提交审核。
3. 管理员账号 `admin` 登录，通过 API 状态流转：`review -> pub -> disabled -> pub`，生成真实教师通知。
4. 教师打开 `/dashboard` 通知菜单，等待通知内容出现。
5. 点击单条通知，等待 PATCH 返回，并复查通知 read 状态。
6. 点击“全部已读”，等待 PATCH 返回，并复查最终未读数。
7. 打开全局搜索，搜索唯一 token，等待 `/api/search` 返回会话结果，点击并进入 `/chat?session=...`。
8. 再搜索智能体名称，等待 `/api/search` 返回智能体结果，点击并进入 `/chat?agent=...`。
9. 搜索无匹配 token，确认 API 空数组和 UI 无结果文案。
10. 移动端教师打开 Dashboard，确认全局搜索按钮可见，并扫描移动端小目标。
11. 清理临时智能体和临时会话。

## 4. 最终证据

- 最终 verdict：`pass`
- issues：`[]`
- 教师会话创建：`201`，sessionId `ses_mrdo7y68_anrf`
- 教师智能体创建：`201`，agentId `agt_mrdo7y6m_j088`
- 智能体提交审核：`review`
- 管理员审批：`pub`
- 管理员停用：`disabled`
- 管理员恢复：`pub`
- 通知内容：`智能体已通过审核`
- 通知正文：包含唯一智能体名称，并说明“已发布，面向师生开放”
- 单条通知点击：PATCH `200 { ok: true, unread: 2 }`
- 单条已读持久化：通过
- 全部已读后：`unread=0`
- 通知菜单小目标：`[]`
- 会话搜索结果：返回 `kind=session`，点击后 URL `/chat?session=ses_mrdo7y68_anrf`
- 智能体搜索结果：返回 `kind=agent`，点击后 URL `/chat?agent=agt_mrdo7y6m_j088`
- 无结果搜索：API 返回 `[]`，UI 展示无匹配文案
- 搜索弹窗小目标：`[]`
- 移动端搜索入口：可见
- 移动端小目标：`[]`
- 相关 console/page error：无
- 清理：临时智能体 `200 { ok: true }`，临时会话 `200 { ok: true }`

静态与构建：

- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- `npm run build` 通过

审阅门：

- `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows`
- build 输出：159 files / 693 nodes / 6705 edges
- 手工影响审阅：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/notification-search-r41/logs/manual-impact-review-r41.json`

## 5. 结论

R41 已按真实用户/真实学校内测标准通过。通知链路现在能够从真实智能体审批事件生成通知，教师可读取、点击单条、全部已读，并等待返回值和持久化结果。全局搜索能够返回真实会话和智能体结果并完成导航；移动端已补齐可见搜索入口，搜索结果和 Dashboard 高频按钮也满足触控目标。

整体 12 小时内测目标继续保持激活，下一轮继续挑选新的真实业务切片执行“真实使用 -> 等待返回 -> 内容评审 -> 修复 -> 复测”。
