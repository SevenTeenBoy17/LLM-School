# EduAI Prism 真实用户内测 R31

## 智能体创建审批闭环修复报告

时间：2026-07-09 PDT  
场景：教师创建智能体、真实测试系统提示词、提交审核、管理员审批、学生可见、清理  
结论：通过，且本轮继续执行“按钮/API 返回值 + 返回内容质量评审 + 前后端自我迭代”标准。

## 本轮真实使用协议

1. 教师通过可视登录进入系统。
2. 打开 `/agent/new`，填写真实智能体名称与简介。
3. 在右侧实时测试面板输入真实课堂问题，点击发送，等待 `/api/chat` 完整返回。
4. 阅读返回内容，评审是否适合教师使用、是否包含课堂目标/流程/安全边界。
5. 切到发布设置，点击创建按钮。
6. 读取 `/api/agents` 返回值，确认创建后状态。
7. 管理员通过可视登录进入 `/admin/agents`，等待该智能体出现在表格。
8. 管理员点击「通过发布」，等待按钮/API 返回。
9. 学生通过可视登录进入 `/agent`，验证发布后的智能体可见。
10. 教师通过 API 删除测试智能体，确认清理成功。

## 基线问题

编号：R31-AGENT-001  
等级：P1  
问题：第 7 步发布设置文案提示“配置完成，将发送给管理员审批”，但点击「创建智能体」后，按钮/API 返回的智能体状态是 `draft`，管理员看到的是草稿，不能审批，学生不可见。  
影响：真实教师以为已进入审批流，实际工作流卡在草稿，管理员无法完成治理，智能体无法上线。  
证据：`.codex-supervisor/qa-12h-20260708/admin-agents-r31/logs/r31-admin-agents-R31_AGENT_1783600866525.json`

## 修复内容

文件：`app/app/(shell)/agent/new/page.tsx`

- 引入 `apiSetAgentStatus`。
- 当用户点击主按钮并且「需要审核才能发布」开启时，先创建草稿，再立即 PATCH 为 `review`。
- 加载态覆盖创建 + 提交审核全流程，避免按钮过早恢复。
- 主按钮文案从模糊的「创建」调整为「创建并提交 / 创建并提交审核」。
- 「暂存草稿」仍保持只创建草稿，保留可恢复工作方式。

## 最终验证证据

最终通过日志：  
`.codex-supervisor/qa-12h-20260708/admin-agents-r31/logs/r31-admin-agents-R31_AGENT_1783601118397.json`

关键结果：

- 右侧实时测试 `/api/chat`：200
- 模型测试来源：`local-fallback`
- 模型测试耗时：8020ms 级别
- 返回内容质量：包含生成式 AI 主题、课堂导入/流程、学生安全边界，`usable=true`
- 教师点击创建后 API 状态：`review`
- 管理员页面读取状态：`review`
- 管理员审批后 API 状态：`pub`
- 学生端可见状态：`pub`
- 清理测试智能体：DELETE 200
- 控制台错误/警告：0
- 最终结论：`pass=true`

截图：

- 教师创建后工作台：`.codex-supervisor/qa-12h-20260708/admin-agents-r31/screenshots/r31-teacher-created-R31_AGENT_1783601118397.png`
- 管理员审批表格：`.codex-supervisor/qa-12h-20260708/admin-agents-r31/screenshots/r31-admin-created-R31_AGENT_1783601118397.png`

## 静态与审阅门

- `npm run lint`：通过
- `npx tsc --noEmit`：通过
- `npm run build`：通过
- 本地生产服务：`http://127.0.0.1:4920`，PID 49980
- code-review-graph：159 files / 690 nodes / 6659 build edges，状态 689 nodes / 6470 edges
- Git：当前目录不是 git 仓库，无法做 git diff/commit/CodeRabbit PR 审阅；已使用 code-review-graph + 手工影响审阅降级
- 手工影响审阅：`.codex-supervisor/qa-12h-20260708/admin-agents-r31/logs/manual-impact-review-r31.json`

## 质量结论

R31 合格。  
教师创建智能体时，按钮返回值、后端状态、管理员表格、审批动作、学生可见性和清理动作形成了真实闭环。此轮的合格依据不是页面可访问，而是完整业务链路在真实返回值和内容质量评审后通过。

## 后续观察

「需要审核才能发布」关闭时，当前系统仍不会让创建者直接发布，而是保留为草稿。后续可单独开一轮评审该开关的产品语义：是隐藏开关、改成“提交审核”，还是支持管理员策略配置。

