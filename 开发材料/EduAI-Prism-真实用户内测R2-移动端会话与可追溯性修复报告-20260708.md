# EduAI Prism 真实用户内测 R2 修复报告

日期：2026-07-08  
范围：移动端 `/chat` 真实研究员场景、会话恢复、AI 返回可追溯性、旧接口兼容  
状态：R2 闭环已通过；12 小时全量内测目标仍在进行中

## 1. 本轮纠偏后的内测口径

本轮不再把“页面能打开、接口 200、按钮可见”直接判定为产品通过，而是按真实用户/真实学校内部使用路径验证：

1. 使用研究员账号从登录页真实登录。
2. 在 390 x 844 移动视口进入 `/chat`。
3. 打开移动端最近会话。
4. 选择真实研究任务会话：“移动端真实使用二次验证：请给七年级数学 AI 辅助学习数据采集表列出 4 个最关键字段、填写频率、隐私边界，并给 3 条教师复盘建议。”
5. 等待 UI、API、AI 历史内容全部返回后，再评价内容完整性、追溯性和体验。

## 2. 发现并修复的问题

### R2-MOB-001：移动端缺少高频会话管理入口

真实移动端用户进入 `/chat` 后，原先主要依赖桌面侧栏，会造成历史会话恢复路径弱。已补充移动端“发起新对话 / 最近会话”入口，支持选择会话、置顶和删除。

涉及文件：

- `D:\VB\LLM-School\app\app\(shell)\chat\page.tsx`

验证结果：

- 移动端可见“发起新对话”和“最近会话”。
- 点击“最近会话”后目标历史会话可见。
- 点击目标会话后空态消失，历史内容恢复。

### R2-AI-002：研究员数据采集类回答不够结构化

真实研究员任务要求“字段、填写频率、隐私边界、教师建议”，原 fallback 内容不足以支持教研试点。已扩展研究员 fallback，在数据采集表类 prompt 下返回可直接使用的表格与执行建议。

涉及文件：

- `D:\VB\LLM-School\app\lib\server\llm.ts`

验证结果：

- 返回内容包含字段、填写频率、填写口径、隐私边界。
- 包含隐私与伦理边界。
- 包含 3 条教师可立即执行/复盘建议。

### R2-API-003：会话详情接口在移动恢复链路中不稳定

真实使用中发现移动端会话列表可见，但详情恢复曾失败。已补充稳定 query 详情接口 `/api/chat/sessions?id=...`，客户端读取、删除、更新都使用该接口。

涉及文件：

- `D:\VB\LLM-School\app\app\api\chat\sessions\route.ts`
- `D:\VB\LLM-School\app\lib\client\chatApi.ts`

验证结果：

- query 详情接口返回 `{ session, messages, feedback, favorites }`。
- 客户端恢复目标会话后 prompt 与 answer 均可见。

### R2-AUDIT-004：历史恢复缺少 AI 来源与耗时追溯

真实研讨时需要知道回答来自真实模型、本地兜底还是网关降级，以及等待了多久。已为新 assistant 消息持久化 `source` 和 `durationMs`，并在消息气泡展示。

涉及文件：

- `D:\VB\LLM-School\app\lib\server\db.ts`
- `D:\VB\LLM-School\app\app\api\chat\route.ts`
- `D:\VB\LLM-School\app\lib\client\chatApi.ts`
- `D:\VB\LLM-School\app\components\chat\MessageBubble.tsx`
- `D:\VB\LLM-School\app\lib\types.ts`

验证结果：

- 目标会话恢复后展示 `24.0s · 网关降级`。
- API 返回 `source: "local-fallback"` 与 `durationMs: 24014`。
- 旧历史消息无法反推历史耗时，这是保留风险，不做伪造回填。

### R2-COMPAT-005：旧路径 rewrite 导致详情接口返回列表

为兼容 `/api/chat/sessions/:id` 曾增加 rewrite，但真实 API 复核发现旧路径返回 200 却没有 messages，实际被改写成列表接口。已移除该 rewrite，让现有动态路由 `/api/chat/sessions/[id]` 直接作为旧路径事实来源。

涉及文件：

- `D:\VB\LLM-School\app\next.config.ts`
- `D:\VB\LLM-School\app\app\api\chat\sessions\[id]\route.ts`

验证结果：

```json
{
  "legacyStatus": 200,
  "queryStatus": 200,
  "legacyMessageCount": 2,
  "queryMessageCount": 2,
  "legacyAssistantSource": "local-fallback",
  "legacyAssistantDurationMs": 24014,
  "parity": true
}
```

## 3. 最终验证证据

静态与构建：

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过，`EXIT_CODE=0`
- Node SQLite experimental warning 为非致命运行时提示，不影响构建结果

运行时 API：

- `http://127.0.0.1:4920/login`：200
- `/api/chat/sessions?id=ses_mrc9yagx_3woh`：200，2 条消息
- `/api/chat/sessions/ses_mrc9yagx_3woh`：200，2 条消息
- 旧/新路径 source、duration、内容一致

真实浏览器移动端：

- URL：`http://127.0.0.1:4920/chat`
- 视口：390 x 844
- 账号：`research`
- 结果：prompt、字段表、填写频率、隐私边界、教师建议、来源和耗时均可见
- 空态：false
- 横向溢出：false
- console error/warn：0

证据文件：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-realuse\logs\mobile-chat-r2-legacy-path-api-verify-after-removal.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-realuse\logs\mobile-chat-r2-final-browser-verify.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\mobile-realuse\screenshots\mobile-chat-r2-final-post-rewrite-removal.png`

截图：

![移动端会话恢复证据](D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/mobile-realuse/screenshots/mobile-chat-r2-final-post-rewrite-removal.png)

## 4. Review Gate

code-review-graph：

- full build：156 files / 642 nodes / 6116 edges
- status：156 files / 642 nodes / 5944 edges
- diff review 降级原因：当前 workspace 与 app 目录不是 git 仓库

人工复核：

- 会话读取先校验 `getSession(user.id, id)`，未发现越权读取。
- PATCH / DELETE 使用 userId 边界，未发现越权修改/删除。
- `source` / `durationMs` 为非破坏性新增列，旧数据保留。
- 动态旧路径与 query 新路径已做一致性复核。

## 5. 剩余风险与下一轮

本轮只完成 R2 移动端会话恢复与可追溯性闭环，不代表 12 小时全量内测结束。

下一轮建议：

1. 学生端真实场景：危机求助、作业代写拦截、长答案学习支架。
2. 教师端真实场景：备课、出题、班级数据、导出与知识库联动。
3. 管理员端真实场景：模型治理、权限、审计、安全工单。
4. 研究员端继续：长时间多轮研究任务、历史会话检索、导出和反馈闭环。
