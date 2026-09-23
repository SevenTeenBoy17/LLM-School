# EduAI Prism 真实用户内测 R21：提示词草稿编辑发布闭环报告

时间：2026-07-08 16:21 -> 16:33 PDT  
范围：教师提示词草稿保存、返回列表、编辑、发布、跨角色可见性与权限边界  
方法：模拟真实学校教师使用，不用页面 200、按钮数量或静态截图代替产品结论；所有 UI/API 返回完成后再判断。

## 真实场景

教师王思远在备课/教研中创建提示词模板，先暂存草稿，稍后回到提示词中心继续编辑并发布。发布后，学生和管理员可以查看/使用模板，但不能修改或删除教师创建的模板。

## 内测结论

已修复并验证通过。

本轮确认了一个真实工作流缺口：教师可以保存草稿，也能在 `/prompts` 看见“仅自己可见”的草稿卡片，但返回列表后没有编辑或发布入口。对真实教师来说，这会导致“只能删除重建”，影响留存和复用。

修复后：

- 自建提示词卡片出现“编辑并发布 / 编辑模板”入口。
- 右侧详情面板为自建模板提供编辑入口。
- 新增 `/prompts/[id]/edit` 编辑页，加载服务端模板数据后再渲染表单。
- 编辑页支持保存草稿和发布模板。
- API/DB 原有 owner 权限边界保持不变。

## 已修改文件

- `D:/VB/LLM-School/app/app/(shell)/prompts/page.tsx`
- `D:/VB/LLM-School/app/app/(shell)/prompts/[id]/edit/page.tsx`

## 证据

- 浏览器真实教师流程：登录 teacher -> `/prompts` -> 保存草稿 -> 返回列表 -> 点击“编辑并发布” -> 编辑标题/正文 -> 发布 -> 返回列表。
- 测试标记：`R21_DRAFT_EDIT_UI_1783553104446`
- 跨角色 API：teacher/student/admin 均可读发布版；student PUT=403；admin DELETE=403；teacher DELETE=200；清理后 student GET=404。
- 构建检查：`npm run lint`、`npx tsc --noEmit`、`npm run build` 均通过。
- code-review-graph：157 files / 667 nodes / 6279 edges，Last updated `2026-07-08T16:32:25`。

证据文件：

- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/prompt-draft-edit-publish-r21/logs/r21-browser-realuse-summary.json`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/prompt-draft-edit-publish-r21/logs/r21-api-cross-role-publish-cleanup.json`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/prompt-draft-edit-publish-r21/logs/manual-impact-review-r21.json`

## 残余风险

编辑页本轮没有复刻新建页的完整 AI 预览面板；本轮重点是草稿回流、编辑、保存、发布和权限闭环。后续可把“运行测试”能力抽成共享组件，在新建页和编辑页复用。
