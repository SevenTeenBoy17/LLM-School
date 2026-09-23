# EduAI-Prism 真实用户内测问题清单 R32

## 已修复

### R32-AGENT-AUDIT-001 P1：智能体“关闭审核”语义与实际返回状态冲突

- 真实路径：教师登录 -> `/agent/new` -> 填写智能体 -> 运行实时测试面板 -> 等待 AI 内容返回并审阅 -> 进入发布设置 -> 关闭“需要审核才能发布” -> 点击“创建智能体”。
- 基线结果：按钮文案暗示创建完成，但 API 返回 `draft`，管理员侧为 `draft`，学生侧不可见。
- 风险：教师会误以为智能体已发布或已进入可用流程，实际停留在草稿，造成教学工具配置中断。
- 修复：第 7 步改为只读“学校审核策略”；正式创建固定提交审核；草稿仅通过“暂存草稿”保存。
- 最终证据：`r32-agent-audit-toggle-R32_AGENT_1783602016916.json`
- 验收：`switchOffAllowed=false`，创建按钮返回 `review`，管理员通过后 `pub`，学生端可见 `pub`，内容质量合格，清理成功。

## 保留观察

- R32-R1：本地外部模型网关仍走 `local-fallback`，本轮内容质量可用且透明，但远程网关延迟仍是跨轮留存风险。
- R32-R2：当前工作区不是 git 仓库，无法做 git checkpoint、diff review 或 CodeRabbit PR 审阅；本轮使用 supervisor 账本、静态验证、Playwright 证据、code-review-graph 和手工影响面审阅替代。
