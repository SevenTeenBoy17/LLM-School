# EduAI-Prism 真实用户内测 R34：智能体删除后旧会话闭环修复报告

日期：2026-07-09  
范围：登录后界面 / 智能体中心 / 管理端审核 / 学生聊天 / 后端会话绑定  
结论：通过。R34 已完成真实教师、管理员、学生三角色闭环内测，并围绕失败点完成前后端修复、内容质量复审、静态验证和审阅门。

## 1. 本轮真实使用协议

1. 教师登录，通过可见 UI 创建课堂 AI 安全智能体。
2. 教师在创建页真实发送测试问题，等待 `/api/chat` 返回完整内容，再评审内容质量。
3. 管理员登录 `/admin/agents`，等待待审智能体出现，点击审核通过，并确认状态返回 `pub`。
4. 学生登录，确认智能体在列表、详情、`use=1`、聊天深链中可用。
5. 学生真实发送课堂任务，等待 AI 完整回复，并审查回复是否包含生成式 AI、安全边界、教师检查点、学生讨论等内容。
6. 教师通过可见菜单删除该智能体，等待删除按钮返回正确值。
7. 学生再次检查列表、详情、`use=1`、深链、既有会话和后续发送，确认已删除智能体不能继续被激活。
8. 对旧会话后续发送的返回内容做质量评审：必须不是静默失败，也不能继续以已删除智能体身份回答。

## 2. 初始失败与修复

### R34-FE/API-001：删除后旧会话继续发送返回 404

学生在智能体被教师删除前已经创建了会话；删除后打开旧会话并继续发送时，后端仍读取该 session 上的 `agentId`，但该智能体已不可用，最终返回 `404 agent_not_found`。真实用户体验是旧会话突然不能继续聊，且没有安全降级。

修复：

- 在 [app/app/api/chat/route.ts](D:/VB/LLM-School/app/app/api/chat/route.ts:85) 中区分两种情况：用户显式传入 `agentId` 时继续严格返回 `404 agent_not_found`；旧 session 隐式携带已失效 `agentId` 时清空 session 的 agent 绑定，然后作为普通对话继续。
- 在 [app/lib/server/db.ts](D:/VB/LLM-School/app/lib/server/db.ts:466) 新增 `clearSessionAgent(userId, id)`，使用 `userId + sessionId` 限定归属，避免跨用户修改。

### R34-AI-001：降级成普通对话后内容质量不足

旧会话安全降级后，后端能返回 200，但本地兜底内容变成通用学习建议，未回应“生成式 AI、安全边界、课堂活动、教师检查点、学生讨论”的真实任务。

修复：

- 在 [app/lib/server/llm.ts](D:/VB/LLM-School/app/lib/server/llm.ts:638) 增加 AI 安全课堂任务兜底。
- 在 [app/lib/server/llm.ts](D:/VB/LLM-School/app/lib/server/llm.ts:667) 对生成式 AI / 人工智能 + 安全 / 边界 / 课堂 / 活动 / 讨论 / 反思 / 检查点 / 学生意图做窄命中。

### R34-QA-001 / R34-QA-002：测试数据与判定口径修正

- 初始测试智能体名称超过后端 `max(40)`，创建返回 400。已将 runId 缩短，避免测试数据无效。
- 初始脚本把历史消息和侧栏中的旧智能体名称误判为仍激活。已改为检查“正在使用智能体”活跃标识和 session `agentId`，历史文本仅作为聊天记录保留，不作为激活依据。

## 3. 最终通过证据

最终主流程日志：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/agent-delete-r34/logs/r34-agent-delete-session-R34_AGENT_1783604768384.json`

| 检查项 | 结果 |
| --- | --- |
| 教师测试面板 `/api/chat` | `200`，`source=local-fallback`，内容质量通过 |
| 教师创建后状态 | `review` |
| 管理员审核后状态 | `pub` |
| 学生发布态详情 / use | `200 / 200` |
| 学生智能体会话 | 创建成功，`sessionId=ses_mrdk8xtw_4dr1` |
| 删除前 session 绑定 | `agentId=agt_mrdk8k8l_iabb` |
| 教师删除按钮 | `DELETE 200`，`ok=true` |
| 删除后学生列表 | 不再包含该 agent |
| 删除后学生详情 / use | `404 / 404` |
| 删除后聊天深链 | 不出现活跃智能体标识，出现不可用提示 |
| 删除后旧会话打开 | 不出现活跃智能体标识，出现不可用提示 |
| 删除后旧会话继续发送 | `200`，作为普通对话返回 |
| 旧会话回读 | `agentIdAfterFollowup=null`，`messageCount=4` |
| 显式传已删除 agentId | `404 agent_not_found` |

旧会话回读证据：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/agent-delete-r34/logs/r34-post-followup-session-readback.json`

显式后端边界证据：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/agent-delete-r34/logs/r34-explicit-deleted-agent-chat-guard.json`

人工影响面审阅：

`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/agent-delete-r34/logs/manual-impact-review-r34.json`

## 4. 验证与审阅门

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地服务：`http://127.0.0.1:4920` 正常运行。
- Playwright 真实用户流：最终 `verdict=pass`，`issues=[]`。
- code-review-graph：已刷新并通过状态检查，覆盖 159 个文件、691 个节点、6497 条边。
- 手工审阅：通过。重点确认显式 agentId 仍硬拒绝、旧 session 隐式失效 agentId 才安全清空、会话消息不丢失、跨用户会话不能被清空。

## 5. 产品体验结论

- 已删除智能体不会继续暴露给学生。
- 学生不能通过详情、use、深链或显式 API 继续使用已删除智能体。
- 已有历史会话不会被粗暴删除，保留学习记录。
- 学生在旧会话继续提问时，系统能安全降级为普通对话，并返回与教学任务相关的高质量内容。
- 前端提示和后端状态一致，不会出现看起来还在使用旧智能体的误导。

## 6. 剩余注意事项

- 历史聊天记录中出现旧智能体名称是保留上下文的正常行为，不代表该智能体仍处于活跃身份。
- 本地环境多次走 `local-fallback`，本轮重点验证产品闭环和兜底内容质量，不代表远程模型供应商稳定性已完全覆盖。
- 当前工作区不是 git 仓库，无法提供 git checkpoint 或 PR diff 审阅；本轮使用 supervisor timeline、日志、静态检查、code-review-graph 和人工影响面审阅替代。
