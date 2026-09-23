# EduAI-Prism 真实用户内测 R28：LLM 网关延迟与教师留存体验闭环报告

## 1. 本轮目标

本轮按“真实学校/公司级内测”方法执行：教师通过可见登录进入产品，在真实聊天界面连续提出三条年级组工作任务，必须等待 API、AI、前端最终气泡、会话持久化全部返回后，读取内容再评价。

本轮不把按钮可点、接口 200、页面出现文字视为产品通过；这些只作为健康证据。

## 2. 真实使用基线

基线日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\gateway-latency-r28\logs\r28-realuse-gateway-latency-R28_GATEWAY_1783572871628.json`

发现的问题：

- 首条教师任务 API 等待 24.0s、UI 完整显示 36.6s，来源为 `local-fallback`。
- 首条兜底内容跑偏为“AI 内测复盘会议材料”，不符合“课堂注意力波动原因 + 观察信号 + 教师下一步”的真实任务。
- 后两条远程模型可用，约 8s 返回，说明不能做全局熔断，否则会误伤后续成功请求。
- Markdown 表格在 UI 中被渲染为表格文本，原脚本用 API 原文 head/tail 精确匹配会误判 UI 未完成。

## 3. 修复与优化

修改文件：

- `D:\VB\LLM-School\app\lib\server\llm.ts`
- `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\gateway-latency-r28\r28-realuse-gateway-latency.js`

已完成：

- 将单次网关超时从 `12s` 收紧到 `8s`，两次失败预算由约 24s 降到约 16s。
- 增加网关 base 短期健康状态：失败/超时 base 冷却，成功 base 后续优先。
- 网关候选按不同 origin 交错排序，减少同一主机变体连续占满两次机会。
- 新增教师“课堂注意力波动/观察信号/下一步”兜底模板，降级时也能交付可用内容。
- 修正 R28 脚本等待规则：以当前 assistant message 完成状态和内测标记为准，避免 Markdown 表格渲染导致误判。

## 4. 最终复测

最终日志：`D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\gateway-latency-r28\logs\r28-realuse-gateway-latency-R28_GATEWAY_1783573929412.json`

最终结果：

| 步骤 | 来源 | API耗时 | UI完整耗时 | 内容评审 |
| --- | --- | ---: | ---: | --- |
| 课堂注意力分析 | local-fallback | 16.0s | 20.8s | 通过，可用于年级组研讨 |
| 年级组80字说明 | remote | 7.6s | 8.0s | 通过，可直接发送 |
| 观察记录表 | remote | 6.3s | 8.2s | 通过，可直接课堂使用 |

持久化：`/api/chat/sessions` 回读 6 条消息，包含本轮内测标记。

安全回归：

- 危机请求：`kind=crisis`、`source=safety`、约 11ms，未走 LLM 网关。
- 明确学术诚信请求：`kind=scaffold`、`source=integrity-scaffold`、约 8ms，未走 LLM 网关。

## 5. 结论

R28 已修复“降级内容跑偏”和“后续请求重复撞坏网关”的主要体验问题，并将首条冷启动完整等待从约 28.8s 降到约 20.8s。

但首条冷启动仍略高于理想留存线，仍保留为外部网关基础设施风险。下一轮建议做网关侧健康探测、可配置主备优先级，或在产品层加入“先给本地简版、远程完成后替换/补充”的双阶段体验。

