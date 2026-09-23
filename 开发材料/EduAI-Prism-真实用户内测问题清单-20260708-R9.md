# EduAI Prism 真实用户内测问题清单 R9

## 已修复

| 编号 | 严重级别 | 问题 | 证据 | 修复 | 复测 |
| --- | --- | --- | --- | --- | --- |
| R9-P1 | P1 | 教师请求“教研会会议材料”时，本地兜底误返回通用补救课教案，缺失会议议程、开场发言、跟进表、内测指标。 | `r9-04-api-final-session-detail.json`、`r9-05-returned-chat-result.json` | 在 `lib/server/llm.ts` 新增 `localTeacherMeetingPack`，教师兜底入口优先识别会议/教研/复盘类意图。 | `r9-09-fix-api-final-session-detail.json` 与 `r9-10-fix-returned-chat-result.json` 显示 6 个结构项全部命中。 |

## 已验证通过

| 编号 | 场景 | 结论 | 证据 |
| --- | --- | --- | --- |
| R9-V1 | 教师长任务生成中离开页面，等待后返回 | 通过。后端完成并落库，前端返回后恢复最终结果，无永久生成态。 | `r9-10-fix-returned-chat-result.json` |
| R9-V2 | 降级透明度 | 通过。UI 显示网关降级，API `source=local-fallback`，耗时约 24s。 | `r9-09-fix-api-final-session-detail.json` |
| R9-V3 | 控制台稳定性 | 通过。返回结果页后 error/warn 为 0。 | `r9-10-fix-browser-console.json` |
| R9-V4 | 静态与构建 | 通过。lint、tsc、build 均通过。 | 终端验证记录 + supervisor timeline |
| R9-V5 | 审阅门禁 | 通过。code-review-graph 构建与手工影响面审阅通过。 | `manual-impact-review-r9.json` |

## 残余风险

| 编号 | 严重级别 | 风险 | 建议 |
| --- | --- | --- | --- |
| R9-R1 | P2 | 教师本地兜底的意图识别仍基于关键词，覆盖会议材料，但未覆盖所有教师文档类型。 | 后续真实内测继续补齐家长会、公开课磨课、教研论文评审、项目化学习方案等模板。 |
| R9-R2 | P3 | Browser 插件 `domSnapshot()` 仍存在环境能力降级，本轮改用 evaluate、截图、控制台日志和 API 旁证。 | 继续记录为工具能力问题，不作为产品缺陷；必要时使用独立 Playwright 浏览器补证。 |

## R9 结论

R9 通过“真实教师使用 + 等完整结果返回 + UI/API 双证据”的内测标准。已修复本轮发现的会议材料兜底意图偏差；总体 12 小时内测仍需继续推进其他真实角色与长时间流程。
