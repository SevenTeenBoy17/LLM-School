# EduAI Prism 真实用户内测 R8：跨角色会话隔离与深链体验报告

时间：2026-07-08 PDT  
范围：教师、学生、科研、管理员跨角色会话隔离；学生访问教师私有会话深链；全局搜索结果隔离。  
方法纠偏：本轮不以路由 200、按钮存在、静态截图作为产品结论；所有判断均等待 UI、API、搜索结果完整返回后再评估。

## 真实内测场景

真实资料对象：教师王思远的 R7 长会话 `ses_mrcewhie_11b8`，标题含 `R7-mobile-longsession-fixed-1783535358364`，内容包含班级学情假设、分层教学流程、课堂诊断题、h 符号易错讲解、课后家校沟通话术。

验收标准：

- 教师本人应能恢复该会话，并能通过全局搜索找到。
- 学生、科研、管理员不应在会话列表、会话详情、动态路由详情、全局搜索中看到该教师私有会话。
- 学生若访问教师会话直达链接，应看到明确的无权限/不存在提示，不泄漏目标 token、教师姓名、班级资料或上一条旧会话内容。

## 发现并修复的问题

R8-FE-001：学生访问无权限教师会话深链时，后端已正确返回 404，UI 不泄漏教师内容，但会静默显示学生最近会话，且 URL 保留非法 session 参数。这会让真实用户误以为自己正在查看该深链会话。

修复：

- 在 `app/app/(shell)/chat/page.tsx` 增加 `sessionNotice` 和 `skipAutoLoadRef`。
- 当存在 `session` 深链参数时，禁止首次进入自动加载最近会话。
- 当会话详情加载失败时，清空 activeId/messages/feedback/favorites，显示“该会话不存在，或你没有权限访问。已为你开启新的对话。”。
- 用 `router.replace("/chat")` 加 `history.replaceState` 清理非法 query，避免地址栏持续误导。

## 最终验证

静态与构建：

- `npm run lint` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。
- `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph` 通过，最终图谱 156 files / 645 nodes / 5999 edges。

后端/API：

- 教师：登录 200；会话列表含目标；`/api/chat/sessions?id=ses_mrcewhie_11b8` 200；`/api/chat/sessions/ses_mrcewhie_11b8` 200；搜索命中 1 条目标会话；assistant 内容长度 1806。
- 学生：登录 200；目标详情 query/path 均 404；列表不含目标；搜索无目标。
- 科研：登录 200；目标详情 query/path 均 404；列表不含目标；搜索无目标。
- 管理员：登录 200；目标详情 query/path 均 404；列表不含目标；搜索无目标。

浏览器真实使用：

- 教师桌面搜索：真实点击全局搜索入口，输入 R7 token，等待检索返回，命中历史会话，无横向溢出，无 console error/warn。
- 学生移动登录：真实登录页输入 student / Student@123，进入 `/learn`。
- 学生直达教师会话：访问 `/chat?session=ses_mrcewhie_11b8` 后等待页面稳定，最终 URL 为 `/chat`；显示无权限/不存在提示；不出现目标 token、目标 session id、王思远、班级学情假设、家校沟通话术；不残留学生旧会话消息；无横向溢出，无 console error/warn。

## 证据文件

- `.codex-supervisor/qa-12h-20260708/cross-role-isolation/logs/api-cross-role-r8-final.json`
- `.codex-supervisor/qa-12h-20260708/cross-role-isolation/logs/browser-final-r8.json`
- `.codex-supervisor/qa-12h-20260708/cross-role-isolation/screenshots/teacher-search-r8.png`
- `.codex-supervisor/qa-12h-20260708/cross-role-isolation/screenshots/student-search-final-r8.png`
- `.codex-supervisor/qa-12h-20260708/cross-role-isolation/screenshots/student-invalid-session-final3-r8.png`

## 结论

R8 跨角色会话隔离和无权限深链体验已通过。后端授权边界有效，前端现在能以真实用户可理解的方式处理无权限深链，不再把旧会话误展示为目标会话。

残余风险：本地生产测试使用进程内临时 `EDUAI_SESSION_SECRET`，未写入磁盘；若长期运行 `next start`，需要正式配置稳定强随机会话密钥。
