# EduAI-Prism 真实用户内测 R29：首条 AI 冷启动等待预算优化报告

生成时间：2026-07-08 PDT  
测试对象：本地生产构建 `http://127.0.0.1:4920`  
测试方法：真实教师账号可视化登录 -> 进入对话 -> 连续提交 3 条真实教研任务 -> 等待 API、AI 回答、UI 渲染、会话回读全部完成 -> 阅读返回内容后再评判。

## 1. 本轮结论

R29 修复通过。  

R28 暴露的真实留存风险是：教师首条消息虽然内容可用，但 UI 完整返回需要约 20.8 秒。R29 将每次请求的远程网关尝试预算收敛为 1 个候选 base，同时保留失败 base 冷却和成功 base 排名机制。真实复测显示首条消息 UI 完整返回降至 12.697 秒，后续两条仍成功走远程模型，未牺牲真实模型能力。

静态检查、构建和图谱只作为健康基线；本轮产品判断来自完整真实任务返回后的内容阅读与持久化回读。

## 2. 真实用户场景

角色：七年级班主任 / 年级组教研成员  
账号：`teacher`  
任务目标：在年级组研讨中解释课堂注意力波动，并继续压缩为通知与观察记录表。  

执行流程：

1. 打开登录页，使用真实表单登录教师账号。
2. 进入 `/chat`，开启新会话。
3. 发送首条课堂注意力分析任务，等待 API 返回、助手气泡停止流式状态、内容完整渲染。
4. 阅读首条内容，确认包含观察信号、教师下一步、可执行建议。
5. 发送第二条压缩说明任务，等待完整返回并阅读。
6. 发送第三条观察记录表任务，等待完整返回并阅读。
7. 调用会话列表和详情接口回读，确认 6 条消息持久化、最新预览包含本轮内测标记。

## 3. 关键数据

| 阶段 | R28 基线 | R29 结果 | 结论 |
| --- | ---: | ---: | --- |
| 首条 API 返回 | 16.0s | 8.044s | 明显改善 |
| 首条 UI 完整返回 | 20.8s | 12.697s | 留存风险下降 |
| 第二条 API 返回 | 7.6s | 7.450s | 远程模型仍可用 |
| 第二条 UI 完整返回 | 未作为风险 | 7.898s | 通过 |
| 第三条 API 返回 | 6.3s | 5.204s | 远程模型仍可用 |
| 第三条 UI 完整返回 | 未作为风险 | 6.932s | 通过 |
| 持久化回读 | 通过 | 6 条消息 | 通过 |
| Console error/warning | 0 | 0 | 通过 |

R29 三条结果来源：

- 首条：`local-fallback`，8.015s，内容可用且明确标注未调用外部模型。
- 第二条：`remote`，7.428s，内容简洁可用。
- 第三条：`remote`，5.184s，表格内容可用。

## 4. 修复内容

文件：`D:/VB/LLM-School/app/lib/server/llm.ts`

调整点：

- `MAX_GATEWAY_ATTEMPTS` 从 2 收敛为 1。
- 保留 `REQUEST_TIMEOUT_MS = 8_000`，避免首条消息在多个坏 base 上连续等待。
- 保留 `rankedBaseUrls()`、`rememberGatewayFailure()`、`rememberGatewaySuccess()`。
- 失败 base 进入 120 秒起的短冷却，后续请求优先尝试其他可用 base。
- API 响应结构不变，前端无需改动。

这不是全局熔断，也不是禁用远程模型。真实复测中后两条回答均为 `remote`，证明远程能力仍在。

## 5. 安全与诚信回归

回归协议：学生账号 API 登录 -> 发送危机消息和学术诚信消息 -> 等完整 JSON 返回后检查 `kind/source/help`。

结果：

- 危机消息：`kind=crisis`，`source=safety`，`help=true`，12ms。
- 学术诚信消息：`kind=scaffold`，`source=integrity-scaffold`，7ms。
- 两者均无 `durationMs`，说明未进入远程模型网关。

结论：R29 的网关预算优化没有破坏安全快路径。

## 6. 工程验证

已通过：

- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`
- `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`
- `python -m code_review_graph status --repo D:\VB\LLM-School\app --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`
- 手工影响审阅：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/gateway-coldstart-r29/logs/manual-impact-review-r29.json`

图谱状态：159 files / 688 nodes / 6461 edges。

## 7. 质量评判

通过标准：

- 教师真实任务在完整等待后返回可用内容。
- 首条冷启动等待低于 R28 20.8s。
- 后续请求仍能调用远程模型。
- 聊天记录真实持久化。
- 安全与诚信路径不进网关。
- 构建、类型、Lint、图谱和手工影响审阅均通过。

保留风险：

- 首条 12.697s 相比 20.8s 已明显改善，但对极低耐心用户仍可能偏慢。
- 网关健康状态当前为进程内存状态，进程重启后会重新学习。

下一轮建议：

1. 继续真实用户流程，而不是静态按钮巡检。
2. 针对“首条等待仍超过 10s”的体验，评估两阶段方案：先快速给本地结构化草稿，再在远程模型返回后提供“增强版可替换内容”。
3. 对弱网、移动端、班主任连续 10 分钟会话进行下一轮真实使用复测。

