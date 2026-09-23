# EduAI Prism 真实用户内测 R22：智能体生命周期治理闭环报告

时间：2026-07-08 16:38-16:54 PDT  
范围：教师创建智能体草稿、提交审核、管理员审批/停用、学生可见与可用边界  
方法：模拟真实学校内部使用，不以路由 200、按钮存在、静态截图作为结论；每一步均等待 UI/API 返回后再评价。

## 真实使用场景

1. 教师 `teacher` 创建智能体草稿 `R22_AGENT_LIFE_*`。
2. 学生 `student` 在教师未发布前读取列表、详情和 `?use=1` 使用入口。
3. 教师提交审核。
4. 管理员 `admin` 打开 `/admin/agents`，查看审核项并尝试治理。
5. 修复后重新创建 `R22_AGENT_POSTFIX_*`，完整复测草稿、审核、发布、停用、清理闭环。

## 基线结论

- P1：教师草稿智能体被学生看见，且学生可通过详情和 `?use=1` 使用。证据：`r22-baseline-agent-api.json` 中 `studentDraftVisibleInList=true`、`studentDraftGetStatus=200`、`studentDraftUseStatus=200`。
- P1：审核态智能体仍被学生看见。证据：`studentReviewVisibleInList=true`、`studentReviewGetStatus=200`。
- P1：管理员页面能看到待审核项，但没有真实审批动作；只有禁用的示例“处理”按钮。证据：浏览器 `/admin/agents` 返回 R22 标记上下文中无可用审批按钮。

## 修复内容

- `/api/agents`：非管理员、非创建者只返回 `pub` 智能体。
- `/api/agents/[id]`：详情和 `?use=1` 使用入口统一可见性门禁；停用态不可使用。
- `globalSearch` 智能体结果：只返回 `pub`，避免搜索绕过列表泄露草稿/审核项。
- `/agent`：非可启动状态禁用启动；创建者草稿/审核态保留预览测试语义。
- `/admin/agents`：新增真实治理动作：通过发布、退回草稿、停用、重新发布；等待 PATCH 返回后更新状态提示。
- 管理员治理按钮最小高度提升到 42px，满足真实触控/移动审核场景。

## 修复后验证

- 草稿态：学生列表不可见、详情 404、`?use=1` 404。
- 审核态：学生列表不可见、详情 404；管理员列表可见。
- 管理员 UI：真实点击“通过发布”，页面返回“已通过发布”。
- 发布后：学生列表可见、详情 200、`?use=1` 200 且调用数增加。
- 管理员 UI：真实点击“停用”，页面返回“已停用”。
- 停用后：学生列表不可见、详情 404、`?use=1` 404；学生 PATCH/DELETE 均 403；管理员仍可读取用于治理。
- 清理：教师删除 R22 测试智能体；最终教师/学生 API 与管理员页面均无 `R22_AGENT_` 残留。

## 质量门

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- 本地生产服务 `http://127.0.0.1:4920/admin/agents`：最终构建运行正常。
- 浏览器复核：治理按钮全部 42px；控制台错误 0；R22 测试数据残留 0。
- code-review-graph：157 files / 668 nodes / 6483 edges。
- 手工影响审查：通过，记录见 `manual-impact-review-r22.json`。

## 证据文件

- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\agent-lifecycle-r22\logs\r22-baseline-agent-api.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\agent-lifecycle-r22\logs\r22-postfix-api-setup.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\agent-lifecycle-r22\logs\r22-postfix-student-after-approve.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\agent-lifecycle-r22\logs\r22-postfix-disable-boundary-cleanup.json`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\agent-lifecycle-r22\logs\manual-impact-review-r22.json`

## 剩余风险

- 当前 workspace/app 不是 git 仓库，无法做 diff-based `review-changes`，已用代码图谱构建和人工影响审查兜底。
- 后台智能体看板仍是示例视图；本轮真实治理动作位于表格视图，已验证。
