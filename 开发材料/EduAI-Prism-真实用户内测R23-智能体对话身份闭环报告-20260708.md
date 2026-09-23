# EduAI-Prism 真实用户内测 R23：智能体进入对话身份闭环报告

日期：2026-07-08 PDT  
范围：已发布智能体进入 `/chat` 后的身份保持、会话持久化、完整 AI 结果等待、刷新恢复、禁用边界与清理。

## 本轮方法纠偏

本轮按“真实用户 / 真实学校公司内测”的标准执行，不把路由 200、按钮存在、接口冒烟当作产品结论。评价顺序固定为：

1. 教师真实创建智能体并提交审核。
2. 管理员真实发布智能体。
3. 学生从已发布智能体进入对话。
4. 等待 `/api/chat` 完整返回后阅读结果。
5. 再判断身份、内容、持久化、刷新恢复和治理边界。

## 发现的问题

- `R23-AGENT-CHAT-001`：Chat 会话未保存 `agentId`，刷新或深链进入后会丢失智能体身份。
- `R23-AGENT-CHAT-002`：`/api/chat` 接受客户端传入的 `agentPreamble`，存在伪造智能体身份的风险。
- `R23-AGENT-CHAT-003`：外部网关降级到本地回复时，已选择的智能体身份没有体现在回答中。
- `R23-AGENT-CHAT-004`：初版本地智能体回复虽然带身份，但对“班会脚本”这种真实教师任务仍偏泛，需要给出可执行结构。

## 修复摘要

- 新增服务端智能体合同：只允许可用、可见、未禁用的智能体进入对话。
- `chat_sessions` 增加并映射 `agentId`，创建会话时持久化智能体绑定。
- `/api/chat/sessions` 创建会话前校验 `agentId`。
- `/api/chat` 不再信任客户端任意 `agentPreamble`，改由服务端根据数据库智能体生成前置身份。
- 会话已有 `agentId` 时，若请求体 `agentId` 不一致，返回 `409 agent_session_mismatch`。
- 无合法智能体但传入 `agentPreamble` 时，返回 `400 invalid_agent_contract`。
- 前端 `/chat` 在进入、发送、重试、切换会话、深链恢复时同步恢复智能体身份。
- 本地降级回复增加智能体身份与班会脚本结构：暖场、分组任务、复盘收束、安全尾注。

## 完整结果证据

- API 真实链路：`r23-final-api-realuse-agent-chat.json`
  - 教师登录 200，创建智能体 201。
  - 教师提交审核 200，管理员发布 200。
  - 学生使用入口 200。
  - 学生创建智能体会话 201，返回 `agentId=agt_mrcrn3nl_7vxf`。
  - `/api/chat` 完整等待约 `24038ms`，返回 `source=local-fallback`。
  - 回复包含智能体名称、trace、暖场、分组任务、复盘收束、安全与学术诚信尾注。
  - 会话回读 200，`session.agentId=agt_mrcrn3nl_7vxf`，消息数 2。
  - 伪造前置词被 `400 invalid_agent_contract` 拦截。
  - 会话智能体不匹配被 `409 agent_session_mismatch` 拦截。

- 浏览器真实使用：`r23-final-browser-realuse-agent-chat.json`
  - 学生通过可见登录页登录，移动端视口 `390x844`。
  - 跳过首登引导后进入 `/chat?agent=...`。
  - 智能体横幅可见。
  - 手动输入真实班会脚本任务并点击发送。
  - 等待约 `27386ms` 后完整结果出现。
  - UI 内容包含智能体身份、trace、暖场、分组任务、复盘收束、安全尾注、网关降级标识。
  - 控制台错误和页面错误均为 0。

- 浏览器会话恢复：`r23-final-browser-session-restore-readback.json`
  - 浏览器页面自身 `fetch('/api/chat/sessions')` 返回 200。
  - 找到会话 `ses_mrcrrwhi_3u8t`，`agentId=agt_mrcrn3nl_7vxf`。
  - `/api/chat/sessions/{id}` 回读 200，消息数 2，助手消息 `source=local-fallback`，`durationMs=24015`。
  - 重新打开 `/chat?session=ses_mrcrrwhi_3u8t` 后，智能体横幅、trace、暖场、分组任务、复盘收束均恢复。

- 禁用边界与清理：`r23-final-disabled-boundary-cleanup.json`
  - 管理员禁用智能体 200，状态为 `disabled`。
  - 学生使用禁用智能体入口 404。
  - 学生继续已绑定会话返回 `404 agent_not_found`。
  - 学生新建禁用智能体会话返回 `404 agent_not_found`。
  - 删除 R23 两个测试会话与测试智能体，最终残留 R23 会话数为 0。

## 质量验证

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过，44 个页面生成完成。
- `python -m code_review_graph build`：通过，158 files / 676 nodes / 6547 edges。
- `python -m code_review_graph status`：675 nodes / 6362 edges / 158 files。
- 手工影响审查：`manual-impact-review-r23-final.json`，结论 `pass_with_residual_risks`。

## 剩余风险

- 外部模型网关在本地测试中仍约 24 秒后降级，已透明显示来源与耗时，但延迟仍是留存风险。
- 本地智能体降级质量仍是关键词规则型，后续应继续覆盖更多智能体任务类型。
- 当前工作区不是 git 仓库，无法做 checkpoint commit、CodeRabbit PR 或 git diff 审阅；已用 supervisor 证据、代码图谱和人工审查替代。
- Browser 插件后端未直接暴露，本轮使用 Node REPL + Playwright + 系统 Edge 通道作为浏览器验证替代。

## 结论

R23 智能体进入对话的真实使用闭环已经修复并验证：已发布智能体身份可进入 Chat、随会话持久化、完整结果返回后能体现智能体定位、刷新深链可恢复、客户端伪造前置词被拦截、禁用后不能继续使用，且测试数据已清理。
