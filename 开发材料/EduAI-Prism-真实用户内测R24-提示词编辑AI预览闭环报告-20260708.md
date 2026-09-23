# EduAI-Prism 真实用户内测 R24：提示词草稿编辑 AI 预览闭环报告

日期：2026-07-08 PDT  
范围：教师提示词模板从新建预览、保存草稿、返回编辑页再次预览、发布、学生可见/使用、非 owner 边界与清理。

## 本轮真实使用口径

本轮继续遵守“真实用户 / 真实学校公司内测”方法：不以页面存在或接口 200 作为产品结论，而是让教师真实走完创建、预览、保存、编辑、再次预览和发布；AI 预览必须等待完整返回后，再判断体验是否可用。

## 基线复现

基线证据：`r24-baseline-edit-diagnostic.json`

- 教师在 `/prompts/new` 可以运行“实时测试”，等待约 24 秒后得到完整 AI 输出。
- 教师保存草稿后，草稿出现在自己的提示词列表。
- 打开 `/prompts/{id}/edit` 后，页面只有“发布前检查”，没有“实时测试 / 运行测试 / AI 输出预览”。
- 基线编辑页 `runButtonCount=0`，因此教师无法在修改草稿后再次验证 Prompt 效果。

## 修复摘要

- 新增共享组件 `app/components/prompts/PromptTestPanel.tsx`。
- 新建页 `/prompts/new` 改为复用 `PromptTestPanel`，保留原本真实 `/api/chat` 测试能力。
- 编辑页 `/prompts/[id]/edit` 接入同一个 `PromptTestPanel`。
- 预览面板现在统一显示：
  - 完整 AI 输出；
  - 来源；
  - 耗时；
  - 安全判定；
  - 服务端安全策略提示。

## 后置复测证据

主要真实链路：`r24-postfix-realuse-prompt-edit-preview.json`

- 教师可见登录并跳过引导。
- 新建页运行预览，等待 `24124ms` 后完整返回。
- 创建页预览包含 marker、来源、耗时、安全判定。
- 教师保存草稿后进入编辑页。
- 编辑页运行二次预览，等待 `24147ms` 后完整返回。
- 编辑页显示实时测试、AI 输出预览、来源、耗时。
- 教师发布模板后，服务端回读 `status=pub`。
- 学生登录后可在提示词中心看到该模板。
- 学生读取详情 200，使用入口 200，use count 增至 1。
- 学生尝试修改模板返回 `403 forbidden`。
- 测试模板删除成功。

聚焦编辑页证明：`r24-focused-edit-preview-proof-cleanup.json`

- 编辑页运行前 `buttonCountBefore=1`。
- 点击运行后等待 `24083ms` 完整返回。
- 页面包含“实时测试 / AI 输出预览 / 来源 / 耗时 / 安全判定”。
- 控制台错误为 0，页面错误为 0。
- R24 测试提示词最终残留数为 0。

## 质量验证

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过，44 个页面生成完成。
- `python -m code_review_graph build`：通过，159 files / 679 nodes / 6562 edges。
- `python -m code_review_graph status`：678 nodes / 6377 edges / 159 files。
- 手工影响审查：`manual-impact-review-r24.json`，结论 `pass_with_residual_risks`。

## 剩余风险

- 本地环境外部网关仍约 24 秒后降级；页面已显示来源和耗时，但延迟仍是留存风险。
- 输出格式要求字段仍未并入真实预览请求体，后续可把“输出格式要求”纳入模板数据模型。
- 工作区不是 git 仓库，无法做 checkpoint commit、CodeRabbit PR 或 git diff 审阅；本轮用 supervisor 证据、代码图谱和人工审查替代。

## 结论

R24 修复后，提示词草稿编辑页已经与新建页具备一致的真实 AI 预览能力。教师可以在编辑草稿时再次运行 Prompt 测试、等待完整结果、查看来源/耗时/安全判定，再发布给学生使用；发布后的学生可见/使用与非 owner 修改拦截均通过，测试数据已清理。
