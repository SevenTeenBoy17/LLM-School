# EduAI-Prism 真实用户内测 R15：教师长任务家校材料闭环报告

日期：2026-07-08  
范围：教师端 AI 对话、长任务离开/返回、家校沟通会材料质量、复制与导出带走、后端持久化、兜底生成策略  
方法：模拟真实学校教师使用，而不是只做按钮、路由、静态截图检查。每次评价必须等待 UI/API/AI/导出结果全部返回后再判断。

## 本轮真实场景

角色设定：王思远老师，初三数学教师。  
真实任务：为初三(3)班二次函数单元复习课后的家校沟通会生成完整材料包，并要求包含会议议程、3 分钟开场白、学情数据摘要、三类学生成因分析、家长沟通话术、后续 7 天跟进表，以及可直接复制到会议纪要的 Markdown。

真实使用路径：

1. 通过可见登录流程进入教师账号。
2. 在 `/chat` 新建真实会话，不复用历史会话。
3. 输入完整教师任务，而不是短 smoke prompt。
4. 发送后离开到 `/dashboard`，模拟教师临时切换工作。
5. 等待后端会话结果真正完成并持久化。
6. 返回精确会话 `ses_mrclun6h_j8vt`。
7. 阅读完整返回内容，再评价材料质量。
8. 尝试复制和导出，确认教师能把材料带到会议纪要或校内 OA。

## 初测发现

### R15-FEAI-001：家校沟通会材料被通用教研会兜底误匹配

初测使用 `R15-FRESH-1783546759342` 真实教师提示词。系统在离开页面后完成生成并可返回会话，但返回的是通用“教研会/内测复盘”材料包，不是家校沟通会材料包。

缺陷表现：

- 缺少明确的“**三类学生成因分析**”。
- 重点偏向“AI 内测复盘/教研流程”，不是面向家长的沟通会。
- 虽然页面恢复、后端持久化、按钮可用，但材料意图不匹配，因此按真实使用标准判定为失败。

根因判断：教师本地兜底只区分通用课程/会议，`家校、家长、沟通会、沟通话术、会议纪要` 等真实教师意图被通用会议模板吞掉。

### R15-QA-001：自动剪贴板与截图取证属于测试环境能力限制

Browser 环境中自动剪贴板读取保留了旧 R7 内容，但产品弹出的手动复制对话框包含正确 R15-FIX Markdown。导出复测中 Browser 包装层没有 `screenshot()` 能力，未拿到该步骤截图。两者记为测试能力限制，不直接判定为产品缺陷。

## 修复内容

文件：`D:\VB\LLM-School\app\lib\server\llm.ts`

- 新增 `localTeacherFamilyMeetingPack()`，专门生成家校沟通会材料包。
- 在教师本地兜底分支中，将家校沟通会意图优先于通用会议意图匹配。
- 保留原 `localTeacherMeetingPack()` 处理教研会/研讨/会议复盘。
- 保留原 `localTeacherLesson()` 作为非会议类默认教学兜底。
- 模板中明确加入隐私边界：不排名、不采集家庭隐私、不把一次测试当标签。

关键影响面：

- `localTeacherFamilyMeetingPack`：`app/lib/server/llm.ts:247`
- 家校意图优先级：`app/lib/server/llm.ts:366`
- 通用会议兜底仍在：`app/lib/server/llm.ts:304`
- 普通教案兜底仍在：`app/lib/server/llm.ts:99`

## 修复后复测

复测提示词：`R15-FIX-1783547030151`

完成证据：

- 教师可见登录完成，进入 `/dashboard`。
- 新建会话后输入完整家校沟通会材料任务。
- 发送后离开到 `/dashboard`。
- 后端结果完成后返回精确会话：`ses_mrclun6h_j8vt`。
- 等待耗时：`26116ms`。
- assistant 内容长度：`2189`。
- 来源标记：`local-fallback`。
- 生成耗时：`24013ms`。
- 页面返回后无永久生成态、无横向溢出、无 console error/warn。

内容质量检查全部通过：

| 检查项 | 结果 |
| --- | --- |
| 会议议程 | 通过 |
| 3 分钟开场白 | 通过 |
| 学情数据摘要 | 通过 |
| 三类学生成因分析 | 通过 |
| 针对家长的沟通话术 | 通过 |
| 后续 7 天跟进表 | 通过 |
| 可复制 Markdown 结构 | 通过 |
| 隐私与未成年人保护边界 | 通过 |

复制带走检查：

- 自动剪贴板在 Browser 环境中保留旧内容，判定为环境限制。
- 产品手动复制弹窗打开成功。
- 手动复制文本长度：`2429`。
- 手动复制文本包含 `R15-FIX-1783547030151` 和完整 assistant Markdown。
- 复制闭环按产品 fallback 通过。

导出带走检查：

- 重新打开已完成会话。
- 确认完整 R15-FIX 内容仍在页面中。
- 点击 `导出整段对话`。
- 等待页面返回可见状态：`已导出整段对话为 MD 文件`。
- 导出闭环通过。

## 静态与审查门

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地应用重启后健康检查：`http://127.0.0.1:4920/login` 返回 200。
- `code-review-graph build`：通过，`156 files / 651 nodes / 6247 edges`。
- `code-review-graph status`：通过，`651 nodes / 6060 edges / 94 flows / 20 communities`。
- Git diff-based review：不可用，因为当前 workspace/app 不是 Git 仓库。
- 手工影响面审查：通过。

## 证据文件

- 初测失败证据：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-long-carryout\logs\r15-fresh-baseline-real-teacher-long-carryout.json`
- 修复后真实流程复测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-long-carryout\logs\r15-postfix-real-teacher-long-carryout.json`
- 修复后导出专项复测：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-long-carryout\logs\r15-export-focused-postfix.json`
- 手工影响面审查：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-long-carryout\logs\manual-impact-review-r15.json`
- 最终汇总证据：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\teacher-long-carryout\logs\r15-final-real-teacher-long-carryout.json`

## 结论

R15 已按纠正后的真实内测方法完成闭环：真实教师任务完整使用、离开再返回、等待后端与 AI 结果完成后再评价、发现内容意图缺陷、完成修复、复测内容质量、复制带走和导出带走。

本轮修复后，教师端在外部模型不可用或降级时，能诚实返回家校沟通会所需的可用 Markdown 材料包，并能通过手动复制 fallback 与 MD 导出带走。整体 12 小时 QA 目标仍在进行中，本轮只关闭教师长任务家校材料闭环这一块。
