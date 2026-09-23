# EduAI-Prism 真实用户内测 R43：聊天长链路、复制导出、历史恢复与移动端弱网闭环报告

生成时间：2026-07-09 10:29 PDT  
测试地址：http://127.0.0.1:4920  
本轮状态：通过  
最终证据日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\logs\r43-chat-longchain-R43_CHAT_LONGCHAIN_1783618038097.json`

## 一、本轮真实使用场景

本轮不是路由烟测，而是模拟一名真实教师在学校内部产品中的连续使用：

1. 通过可见登录页登录教师账号。
2. 在 `/chat` 点击“发起新对话”，必须捕获按钮返回的 POST `/api/chat/sessions` 结果。
3. 连续发送两轮真实教学沟通任务，等待 AI/API/UI 全部返回后再评审内容质量。
4. 复制整段对话，检查 Markdown 中包含两轮用户问题与 AI 回复。
5. 导出整段对话，检查下载 `.md` 文件可用、大小正常、包含两轮内容，并有可见导出反馈。
6. 离开到 `/dashboard` 后通过 `/chat?session=...` 恢复历史，检查桌面端消息数和内容。
7. 移动端同账号登录并恢复同一会话，在弱网延迟下发送第三轮压缩提醒任务。
8. 必须等待慢响应提示、最终回复、API 持久化读回、内容质量评审和清理返回值全部完成。

## 二、发现并修复的问题

### R43-CHAT-ONB-001：移动端深链恢复聊天时首次引导层延迟挂载，遮挡发送按钮

现象：移动端打开 `/chat?session=...` 后，引导层可能在页面恢复后延迟出现，覆盖聊天输入区，导致真实点击“发送”按钮失败。自动化兜底按 Enter 虽能触发请求，但不符合“真实用户按钮返回值必须正确”的内测标准。

修复：

- `app/components/onboarding/OnboardingGuide.tsx`
  - 增加本地 `dismissed` 状态，点击跳过/完成后立即卸载浮层，避免偏好持久化延迟继续拦截。
  - 全屏首次引导只允许出现在角色首页，并排除 `/chat`，避免聊天深链、历史恢复、移动端继续对话被教育性浮层打断。
  - 引导层关闭、跳过、上一步、下一步/进入按钮改为显式 52px 级别触控尺寸。

### R43-CHAT-TARGET-002：桌面侧栏“发起新对话”按钮实测高度偏低

现象：诊断中桌面侧栏“发起新对话”实测约 38.5px，第二轮修复后为 42px，仍低于更稳妥的 44px 触控基线。

修复：

- `app/components/chat/ChatSidebar.tsx`
  - 将侧栏“发起新对话”按钮改为显式 `52px` 高度。

### R43-HARNESS-003：回归脚本对真实按钮点击与尺寸约束不够严格

修复：

- `.codex-supervisor/qa-12h-20260708/chat-longchain-r43/r43-chat-longchain-realuse.js`
  - 新增新建对话按钮 `clicked === true` 断言。
  - 新增新建对话按钮返回 POST 201/sessionId 断言。
  - 新增新建对话按钮尺寸 `>=44px` 断言。
  - 新增移动端发送按钮 `clicked === true` 断言，避免 Enter 兜底误判为通过。
  - 引导层关闭后重新确认仍在 `/chat`，避免路由跳转造成误判。

## 三、最终通过证据

最终 R43 日志：

- RunId：`R43_CHAT_LONGCHAIN_1783618038097`
- Token：`R43LC_MRDS4M6P`
- Verdict：`pass`
- Issues：`[]`

关键返回值：

- 新建对话：POST `/api/chat/sessions` 返回 `201`，按钮真实点击 `clicked=true`，按钮实测 `52px`。
- 第一轮 AI：`200`，`messageId` 返回，内容通过目标/步骤/风险/家校沟通/结构化评审。
- 第二轮 AI：`200`，请求包含前文历史证据，内容通过上下文承接、群通知、个别沟通模板、隐私边界评审。
- 复制整段对话：可见，Markdown 包含 token 与两轮问题。
- 导出整段对话：可见，下载 `.md`，文件大小 `5483` bytes，包含两轮问题，页面有导出反馈。
- 桌面历史恢复：消息数 `4`。
- 移动端恢复后弱网第三轮：发送按钮真实点击 `true`，慢响应提示 `true`，最终返回 `200`，来源 `remote`，耗时约 `4554ms`。
- API 读回：第二轮后 `4` 条消息，移动端第三轮后 `6` 条消息。
- 清理：DELETE 返回 `200`，清理后读回返回 `404`。
- 控件尺寸/布局：桌面小目标 `0`，移动端小目标 `0`，移动端横向溢出 `false`。
- Console：相关错误 `0`。

截图证据：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\screenshots\r43-turn1-R43_CHAT_LONGCHAIN_1783618038097.png`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\screenshots\r43-turn2-R43_CHAT_LONGCHAIN_1783618038097.png`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\screenshots\r43-recovered-desktop-R43_CHAT_LONGCHAIN_1783618038097.png`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\screenshots\r43-mobile-recovered-before-R43_CHAT_LONGCHAIN_1783618038097.png`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\screenshots\r43-mobile-turn3-R43_CHAT_LONGCHAIN_1783618038097.png`

## 四、静态与审阅门禁

已通过：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- 生产服务重启：`http://127.0.0.1:4920`
- 登录 API 健康检查：教师账号返回 `200`
- `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`
- `python -m code_review_graph status --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`

图谱状态：

- Files：159
- Nodes：698
- Edges：6559
- Last updated：2026-07-09T10:29:21

手工影响面审阅：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\chat-longchain-r43\logs\manual-impact-review-r43.json`
- 结论：通过，未发现需继续修复的问题。

## 五、残留风险

1. 当前工作区不是 git 仓库，无法提供 git diff、checkpoint commit 或 PR 级审查；本轮使用 supervisor 记录、静态检查、运行证据、code-review-graph 与手工影响面审阅替代。
2. 本地生产构建/启动使用 QA 专用会话密钥，未写入 `.env.local`，也不是生产密钥；正式环境仍需配置真实强随机 `EDUAI_SESSION_SECRET`。
3. Node SQLite 实验性警告仍存在，但本轮未观察到应用运行失败。

## 六、结论

R43 已按真实用户、真实学校工作流完成闭环：按钮返回值、AI 内容质量、复制/导出、历史恢复、移动端弱网、持久化读回、清理和审阅门禁全部通过。该切片可判定为合格。
