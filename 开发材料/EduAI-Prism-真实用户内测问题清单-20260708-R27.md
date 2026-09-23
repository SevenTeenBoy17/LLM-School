# EduAI-Prism 真实用户内测问题清单 R27

本轮按最新纠偏执行：真实角色完成真实业务任务，等待 UI/API/AI/持久化全部返回，阅读内容后再判断。

## 已修复

| 编号 | 严重度 | 问题 | 真实影响 | 修复 |
| --- | --- | --- | --- | --- |
| R27-QA-001 | P0 | 旧内测口径容易把接口 200、按钮存在、半截 UI 当成产品结论 | 会漏掉真实长会话失败、生成未完成、内容不可用等问题 | 写入《真实公司级内测协议 v2》，后续结论必须来自真实使用 + 完整返回 + 内容阅读 |
| R27-CHAT-001 | P1 | 前端发送最近 12 条历史，但 `/api/chat` 只允许最多 10 条 | 长会话教师继续提问会直接 `400 invalid_input` | `buildApiHistory()` 统一限制最多 10 条 |
| R27-CHAT-002 | P1 | 历史消息单条超过 2000 字时仍原样发送 | 长回答之后追问会 `400 invalid_input` | 每条历史裁剪到 2000 字以内 |
| R27-CHAT-003 | P1 | 即使条数和单条都合规，总历史仍可能超过 6000 字 | 多轮长会话会 `413 payload_too_large` | 总历史预算限制为 4000 字，给当前消息预留空间 |
| R27-QA-002 | P1 | 测试脚本用全页面文本判断回复尾部，可能误把用户问题当成助手回复 | 会在“正在生成”未结束时误判完成 | 给消息气泡增加稳定 `data-*` 标记，脚本绑定本次 `messageId` 等待 `streaming=false` |

## 残余风险

| 编号 | 严重度 | 观察 | 当前结论 | 建议 |
| --- | --- | --- | --- | --- |
| R27-LATENCY-001 | P2 | 最终真实链路中，第一轮教师完整方案 UI 完成耗时 38.4s，其中 API 为 24.0s 网关降级；第二轮远程模型 9.8s 完成 | 功能可用，但首轮等待时间会影响留存 | 单独开网关稳定性切片，分析 base URL 成功率、失败缓存、并发/重试策略；本轮不贸然加全局熔断，避免误伤后续远程成功 |

## 最终证据

- 真实链路日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\real-user-protocol-r27\logs\r27-realuse-teacher-chat-R27_REAL_USER_1783572089944.json`
- 真实 UI 截图：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\real-user-protocol-r27\screenshots\r27-teacher-chat-final-R27_REAL_USER_1783572089944.png`
- 审阅记录：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\real-user-protocol-r27\logs\manual-impact-review-r27.json`
