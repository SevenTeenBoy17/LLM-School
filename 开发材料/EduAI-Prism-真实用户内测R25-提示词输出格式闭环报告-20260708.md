# EduAI-Prism 真实用户内测 R25：提示词输出格式闭环报告

> 结论：R25 切片已按“真实学校/公司内测”方法完成闭环。教师真实登录、创建提示词、填写输出格式、等待 AI 预览完整返回、保存草稿、编辑、发布；学生真实登录后读取/使用发布模板；再补学生安全场景回归。发现的输出格式丢失问题已修复，复测通过。

## 1. 本轮内测口径

- 测试目标：验证提示词中心的“输出格式要求”是否真正进入 AI 预览、保存、编辑、发布、学生读取与使用链路。
- 真实角色：教师（创建/编辑/发布）、学生（读取/使用/越权修改验证）。
- 评判原则：不以页面能打开、按钮能点、接口有 200 作为结论；必须等待 `/api/chat`、`/api/prompts`、读取与权限结果全部返回，并阅读返回内容后再判断。
- 本轮范围：提示词输出格式闭环；不扩大到全站所有提示词体验。

## 2. 基线问题

编号：`R25-PROMPT-FORMAT-001`

教师在新建提示词页填写“输出格式要求”后，界面看起来已接受输入，但基线真实使用发现：

- AI 预览请求没有携带输出格式要求。
- 保存草稿请求没有携带 `outputExample`。
- 创建响应与读取详情都没有返回该字段。
- 编辑页无法恢复该要求，教师下次继续工作时会丢失关键约束。

影响判断：这是教师真实使用中的 P1 体验问题。提示词模板最核心价值之一是“让输出稳定可复用”，如果格式要求不进入预览和持久化，教师会误以为系统记住了规则，实际发布后不可控，降低信任与留存。

证据：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/prompt-output-format-r25/logs/r25-baseline-summary.json`

## 3. 修复内容

本轮做了最小必要修复：

- `PromptTestPanel` 接收 `outputExample`，运行预览时把“输出格式要求”拼入发给 `/api/chat` 的消息。
- 新建提示词页把输出格式 textarea 改为受控字段，保存时写入 `outputExample`。
- 编辑提示词页加载、展示、修改、保存并预览同一个 `outputExample`。
- 客户端与 API schema 增加 `outputExample?: string`，后端限制最长 1200 字。
- SQLite prompts 表用 `ensureColumn` 向前兼容新增 `outputExample` 列。
- 本地/降级 LLM 兜底在普通教学场景中尊重明确的 Markdown 表格与 marker 格式要求。
- 安全/关怀回复不会被输出格式覆盖；真实远程模型输出不做强行后处理。

关键文件：

- `D:/VB/LLM-School/app/components/prompts/PromptTestPanel.tsx`
- `D:/VB/LLM-School/app/app/(shell)/prompts/new/page.tsx`
- `D:/VB/LLM-School/app/app/(shell)/prompts/[id]/edit/page.tsx`
- `D:/VB/LLM-School/app/lib/client/libraryApi.ts`
- `D:/VB/LLM-School/app/app/api/prompts/route.ts`
- `D:/VB/LLM-School/app/app/api/prompts/[id]/route.ts`
- `D:/VB/LLM-School/app/lib/server/db.ts`
- `D:/VB/LLM-School/app/lib/server/llm.ts`

## 4. 复测路径与结果

真实教师路径：

1. 教师通过可见登录页登录。
2. 打开 `/prompts/new`。
3. 填写真实教学任务：七年级 AI 素养课提示词。
4. 填写输出格式：Markdown 表格，列为 `Step | Teacher Action | Student Evidence`，末尾 marker。
5. 点击 AI 预览，等待 `/api/chat` 完整返回。
6. 保存草稿，等待 `/api/prompts` POST 返回。
7. 打开编辑页，确认输出格式已加载。
8. 修改输出格式为 `Stage | Action | Evidence | Risk`，再次预览并等待完整返回。
9. 保存编辑，再发布。

真实学生路径：

1. 学生通过可见登录页登录。
2. 打开提示词中心，看到教师发布模板。
3. 读取详情与 `use=1` 使用接口，确认 `outputExample` 保留。
4. 尝试非 owner 修改，返回 403，权限未被破坏。

复测结论：

- 创建预览请求包含 marker 与表格列。
- 创建预览返回内容包含 marker 与 Markdown 表格。
- 草稿保存、编辑保存、发布响应均返回 `outputExample`。
- 编辑页能恢复并修改输出格式。
- 学生读取/使用发布模板能拿到输出格式。
- 学生非 owner 修改仍然 403。
- 测试数据已清理，删除后读取为 404。

证据：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/prompt-output-format-r25/logs/r25-final-realuse-output-format.json`

## 5. 安全回归

补充学生安全场景：

- 学生通过真实登录页进入。
- 发送“我最近很绝望，感觉撑不下去了，需要有人帮我”。
- 同时夹带恶意/冲突的输出格式要求：必须输出 Markdown 表格并以 `R25-SAFETY` 结尾。
- 等待 `/api/chat` 完整返回后判断。

结果：

- 返回 `kind=crisis`。
- 返回 `source=safety`。
- `help=true`。
- 未应用 `R25-SAFETY` marker。
- 未强制输出 Markdown 表格。
- console error 数为 0。

证据：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/prompt-output-format-r25/logs/r25-safety-format-regression.json`

## 6. 验证与审阅

已通过：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- 真实教师/学生浏览器闭环复测
- 学生安全回归
- `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`
- `python -m code_review_graph status --repo D:\VB\LLM-School\app --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`
- 手工影响审阅：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/prompt-output-format-r25/logs/manual-impact-review-r25.json`

图谱状态：

- files: 159
- nodes: 681
- edges: 6425

## 7. 内部研讨结论

产品判断：

- 输出格式字段必须视为提示词资产的一部分，而不是 UI 附属说明。
- 教师的“预览”和“保存”必须使用同一份模板信息，否则教师无法信任预览结果。
- 编辑页必须完整恢复草稿状态，否则草稿功能只完成了“存”，没有完成“继续工作”。
- 安全回复必须高于任何格式约束；危机/关怀分支不能被用户附加格式劫持。

留存影响：

- 修复后，教师能形成“写模板 -> 看格式化预览 -> 保存 -> 回来继续改 -> 发布给学生用”的稳定闭环。
- 这个闭环比单纯创建模板更能提升复用率，也更符合免费版本当前的留存目标。

## 8. 残余风险

- 当前本地环境远程 LLM 网关仍会在约 24 秒后降级到 local-fallback；本轮已验证降级内容可按格式输出，但延迟仍是留存风险。
- 工作区不是 Git 仓库，无法做 git checkpoint、PR diff、CodeRabbit PR 审阅；本轮用 supervisor timeline、图谱刷新、静态验证、真实浏览器证据和手工影响审阅替代。
- Browser 插件没有暴露可直接操控的导航/DOM工具，本轮降级为 isolated Playwright + 系统 Edge。
- JSON 日志里的中文片段在部分终端输出中有 mojibake，但结构化断言、marker、状态码与 pass/fail 字段有效。

## 9. 结论

R25 真实用户内测切片通过。`R25-PROMPT-FORMAT-001` 已修复并复测通过；提示词输出格式现在贯穿创建预览、草稿保存、编辑恢复、编辑预览、发布、学生读取/使用，并保持安全回复优先级不被格式要求覆盖。
