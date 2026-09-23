# EduAI-Prism 真实用户内测 R32：智能体审核策略语义修复报告

## 本轮目标

围绕 R31 遗留风险继续真实内测：教师在 `/agent/new` 创建智能体时，如果试图关闭“需要审核才能发布”，产品文案、按钮返回值、API 状态、管理员审批、学生可见性必须一致。判定必须等待测试面板 AI 内容返回，并对返回内容做质量评审。

## 基线复现

- 真实教师登录后进入 `/agent/new`，填写 R32 智能体信息。
- 运行右侧实时测试面板，等待 `/api/chat` 返回：`status=200`，`source=local-fallback`，`durationMs=8011`，回复长度 `1633`。
- 内容质量评审：包含生成式 AI 主题、课堂导入/活动、学生安全边界，未出现公开隐私、排名、惩罚、医学诊断等不当建议，`usable=true`。
- 切换到发布设置，产品允许关闭“需要审核才能发布”。
- 最终按钮文案变为“创建智能体”，但创建后教师 API 返回 `status=draft`，管理员侧仍是 `draft`，学生侧不可见。

结论：`R32-AGENT-AUDIT-001` 成立。问题不是 AI 内容质量，也不是清理/脚本问题，而是 UI 策略与后端治理状态不一致。

## 修复内容

修改文件：[page.tsx](D:/VB/LLM-School/app/app/(shell)/agent/new/page.tsx)

- 移除第 7 步可关闭的审核开关，改为只读“学校审核策略”。
- 明确提示：当前学校策略要求管理员审核后发布；若只是稍后提交，使用“暂存草稿”。
- 正式创建路径无条件创建后提交 `review`。
- 移除 `needAudit` 死分支，按钮文案固定为“创建并提交 / 创建并提交审核”。
- 保留“暂存草稿”作为明确的 draft-only 路径。

后端权限规则未改动：创建者仍只能 `draft -> review`，管理员负责 `review -> pub/disabled`。

## 最终复测结果

最终证据文件：

- `.codex-supervisor/qa-12h-20260708/admin-agents-r32/logs/r32-agent-audit-toggle-R32_AGENT_1783602016916.json`

关键结果：

- `switchOffAllowed=false`
- 点击按钮：`创建并提交审核`
- 教师创建后 API：`review`
- 管理员创建后 API：`review`
- 管理员审批后 API：`pub`
- 学生端 API：`pub`
- 清理：`DELETE 200`
- console：`0`
- AI 内容质量：`usable=true`
- 综合结论：`pass`

## 验证

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过
- 本地生产服务 `http://127.0.0.1:4920/login`：健康返回 200
- Playwright/Edge 真实三角色复测：通过
- code-review-graph：刷新通过，`159 files / 690 nodes / 6658 edges`，状态 `689 nodes / 6469 edges`
- 手工影响面审阅：通过

## 审阅结论

R32 修复合格。教师不再看到可误解的“免审核发布”开关，正式创建按钮、API 状态、管理员审批、学生可见性已对齐。该修复保持后端治理模型不变，只收紧前端语义和提交路径。
