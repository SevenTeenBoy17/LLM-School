# EduAI-Prism 真实用户内测 R20：提示词跨角色治理闭环报告

时间：2026-07-08 16:03-16:20 PDT  
范围：提示词中心 `/prompts`、新建提示词 `/prompts/new`、提示词 API `/api/prompts` 与 `/api/prompts/[id]`

## 1. 本轮真实使用场景

本轮模拟“清波实验中学信息科技教研组”真实内部使用：

1. 教师登录后台，在提示词中心新建一个“暂存草稿”。
2. 等待保存结果返回后，检查该草稿在教师端、学生端、管理员端的可见性。
3. 再通过真实 UI 发布一个提示词模板，验证学生/管理员是否可以读取和使用。
4. 通过 API 验证非创建者不能修改或删除提示词。
5. 清理所有 R20 临时数据，确认三类角色列表中不再残留测试模板。

本轮遵守纠偏后的内测方法：不以路由 200、按钮存在、静态截图作为结论，必须等待 UI/API 结果完整返回后再判断。

## 2. 发现的问题

### R20-PROMPT-GOV-001：暂存草稿实际被公开发布

严重级别：P1  
状态：已修复

基线证据：

- 教师通过真实 UI 点击“暂存草稿”。
- API 返回该提示词 `status: "pub"`。
- 学生列表可见：`studentFound: true`。
- 管理员列表可见：`adminFound: true`。
- 学生/管理员详情读取均返回 200。

证据文件：

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\prompt-governance-r20\logs\r20-draft-leak-baseline.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\prompt-governance-r20\screenshots\r20-teacher-draft-saved.png`

## 3. 修复内容

修复文件：

- `app/lib/types.ts`
- `app/lib/client/libraryApi.ts`
- `app/lib/server/db.ts`
- `app/app/api/prompts/route.ts`
- `app/app/api/prompts/[id]/route.ts`
- `app/app/(shell)/prompts/new/page.tsx`
- `app/app/(shell)/prompts/page.tsx`

修复点：

1. 新建提示词支持 `status: "draft" | "pub"`。
2. “暂存草稿”写入 `draft`，“提交发布”写入 `pub`。
3. `/api/prompts` 只返回公开模板，外加当前用户自己的草稿。
4. `/api/prompts/[id]` 对非创建者隐藏草稿详情。
5. 非创建者即使知道草稿 ID，PUT/DELETE 也返回 404，避免泄露草稿存在。
6. 已发布提示词仍保持跨角色可读、可使用。
7. UI 中给草稿增加“草稿 / 仅自己可见”提示，校内模板计数只统计公开模板。

## 4. 复测结果

草稿复测：

- 教师真实 UI 保存草稿后提示：`已保存草稿...仅自己可见`。
- 教师列表可见该草稿，状态为 `draft`。
- 学生列表不可见。
- 管理员列表不可见。
- 学生详情读取：404。
- 管理员详情读取：404。
- 学生尝试修改：404。
- 管理员尝试删除：404。

发布复测：

- 教师真实 UI 点击“提交发布”。
- 学生列表可见已发布模板。
- 管理员列表可见已发布模板。
- 学生 `?use=1` 使用后 `uses` 从 0 增至 1。
- 学生尝试修改已发布模板：403。
- 管理员尝试删除教师模板：403。
- 教师删除临时模板后，学生详情读取：404。

证据文件：

- `r20-postfix-api-governance.json`
- `r20-postfix-published-governance.json`
- `r20-final-cleanup-sweep.json`
- `manual-impact-review-r20.json`

## 5. 验证命令

已通过：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- 本地生产模式重启：`http://127.0.0.1:4920`
- code-review-graph：156 files / 657 nodes / 6113 edges

## 6. 内部研讨结论

产品角度：

- “暂存草稿”是教师真实备课中的高频动作，如果草稿被学生或管理员提前看到，会直接损害信任。
- 修复后，“草稿”和“发布”在数据层、API 层、UI 层语义一致。

教学场景角度：

- 教师可以放心保存未完成模板。
- 已发布模板仍可被学生和管理员检索使用，不影响校内共享价值。

技术角度：

- 本轮修复没有引入新表或复杂审核流，只补齐已有 `status` 字段的真实语义。
- 后续若要做完整“草稿编辑 -> 提交审核 -> 管理员发布”流程，可复用本轮的状态字段。

## 7. 残余风险

- 当前 UI 还没有完整的“编辑草稿并发布”页面；API 已支持状态更新，但前端编辑工作流需单独排期。
- PowerShell 管道传中文请求体时可能出现编码问题；后续 API 自动化应使用 Unicode escapes 或 UTF-8 文件输入。

结论：R20 提示词跨角色治理闭环已通过，整体 12 小时真实内测仍继续进行。
