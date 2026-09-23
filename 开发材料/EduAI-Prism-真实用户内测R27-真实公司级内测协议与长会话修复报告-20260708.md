# EduAI-Prism R27 真实公司级内测协议与长会话修复报告

## 本轮目标

根据最新要求，纠正内测方法：不再用静态检查、路由状态、按钮数量或半截生成内容作为产品结论；必须模拟真实学校/公司用户完成真实业务任务，等待 UI/API/AI/保存/回读全部返回，阅读内容后再评价。

## 协议升级

已新增：

- `D:\VB\LLM-School\开发材料\EduAI-Prism-真实公司级内测协议-v2-20260708.md`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\real-user-protocol-r27\spec-light.md`

关键规则：

- `200 OK` 只是健康证据，不是产品通过。
- AI 内容必须等生成完成，并阅读完整返回内容。
- 保存/导出/权限必须有可见反馈和服务端回读。
- 管理后台必须以真实治理任务判断，不以样例表格判断。

## 真实使用链路

角色：教师 / 初中班主任。

任务：为七年级学生连续两周作业缺交、课堂走神、家校沟通困难生成班级支持与家校沟通方案，再压缩成可直接发给家长的微信文本。

执行路径：

1. 可见登录页登录 `teacher`。
2. 进入 `/chat`。
3. 处理首次进入的新手引导。
4. 可见界面发起新对话。
5. 发送真实班主任任务。
6. 等待 `/api/chat` 返回，并等待对应助手气泡 `data-chat-streaming=false`。
7. 阅读完整方案内容。
8. 发送真实追问：压缩成 150 字以内微信消息。
9. 再次等待 API、UI 完成并阅读内容。
10. 通过服务端会话回读确认持久化。

最终日志：

`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\real-user-protocol-r27\logs\r27-realuse-teacher-chat-R27_REAL_USER_1783572089944.json`

最终截图：

`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\real-user-protocol-r27\screenshots\r27-teacher-chat-final-R27_REAL_USER_1783572089944.png`

## 修复内容

代码修复：

- `D:\VB\LLM-School\app\app\(shell)\chat\page.tsx`
  - 新增 `buildApiHistory()`。
  - 历史最多 10 条。
  - 单条历史最多 2000 字。
  - 总历史最多 4000 字，给当前消息预留后端 6000 字预算。
- `D:\VB\LLM-School\app\components\chat\MessageBubble.tsx`
  - 增加无视觉影响的 `data-chat-role`、`data-message-id`、`data-chat-streaming`，用于真实 UI 完成态验证。

## 最终验证

- `npm run lint` 通过。
- `npx tsc --noEmit` 通过。
- `npm run build` 通过。
- 本地 `http://127.0.0.1:4920` 重启并加载新构建。
- Playwright + Edge 真实教师链路通过。
- code-review-graph 已刷新：159 files / 683 nodes / 6615 edges；状态读数 159 files / 682 nodes / 6429 edges。

最终真实链路摘要：

| 步骤 | 状态 | 来源 | 耗时 | 结论 |
| --- | --- | --- | --- | --- |
| 完整方案 | 200 | local-fallback | API 24.0s / UI 38.4s | 内容可用，等待偏长 |
| 微信压缩稿 | 200 | remote | API 8.6s / UI 9.8s | 内容可直接发送 |
| 持久化回读 | 200 | 服务端会话 | 4 条消息 | 包含本轮标记 |

## 内部研讨结论

教师视角：任务可以完成，完整方案有会议议程、学生谈话、家长沟通、协同清单、跟进表，能进入真实班主任工作流。

教务/管理视角：内容没有直接诊断、处分、药物等不当表达，安全边界可接受。

产品视角：长会话阻断问题已修复；但首轮 38.4s 的完整 UI 等待会影响留存，需要后续单独做网关稳定性优化。

本轮结论：R27 目标达成，长会话继续使用闭环已修复并通过真实复测；12 小时总内测目标仍继续。
