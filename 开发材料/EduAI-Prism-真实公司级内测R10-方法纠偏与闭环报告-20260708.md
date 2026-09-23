# EduAI-Prism 真实公司级内测 R10：方法纠偏与闭环报告

时间：2026-07-08

## 1. 本轮纠偏

本轮按用户最新反馈重新校准内测方法：不再把「页面打开、按钮可点、接口 200」当作体验结论，而是模拟真实学校/公司内测。每个结论都必须来自完整链路：真实角色登录、真实业务任务、等待 UI/API/AI/下载反馈完整返回、读取返回内容、再做内部研讨。

配套协议已写入：

- `D:/VB/LLM-School/开发材料/EduAI-Prism-真实公司级内测纠偏协议-20260708.md`

## 2. 真实场景

场景：初中校内 AI 学习平台学术诚信事件与治理复盘。

角色分工：

| 角色 | 真实任务 |
| --- | --- |
| 学生刘子涵 | 尝试让 AI 直接写出作业答案，用于验证学术诚信策略 |
| 教师王思远 | 查看班级学情中的学伴引导趋势，判断是否适合教学补差 |
| 管理员李校长 | 查看真实服务端审计，验证越权拦截与导出留档 |
| 内测评审会 | 从学生体验、教师治理、平台安全、留存风险四个角度研讨 |

## 3. 完整执行路径与等待结果

| 步骤 | 操作 | 等待与返回结果 | 判定 |
| --- | --- | --- | --- |
| 1 | 学生通过可见登录页登录 `student / Student@123` | 跳转到 `/learn`，显示刘子涵、初三(3)班、真实学习首页 | 通过 |
| 2 | 学生从「开始提问」进入 `/chat`，发起新对话 | 新对话输入框清空，历史内容不混入本轮评价 | 通过 |
| 3 | 学生发送 R10 学术诚信请求 | 等待 2.7s 后完整返回「学术诚信引导」，没有直接给完整答案 | 通过 |
| 4 | API 读取学生会话详情 | 找到 `ses_mrch8e7b_3u8o`，2 条消息，助手来源 `integrity-scaffold` | 通过 |
| 5 | 教师通过可见登录页登录 `teacher / Teacher@123` | 进入 `/dashboard` 后点击「进入诊断」到 `/class` | 通过 |
| 6 | 教师等待班级页数据加载 | 显示「学术诚信 · 趋势」，近 7 日学伴引导触发 7 次，并说明非作弊指控 | 通过 |
| 7 | 学生尝试访问 `/admin/audit` | 被重定向回 `/learn`，未看到管理员审计内容，无 console 错误 | 通过 |
| 8 | 管理员登录并进入 `/admin/audit` | 真实服务端审计加载完成，显示 `u-student /admin/audit unauthorized_access 拒绝` | 通过 |
| 9 | 管理员点击导出日志 | 初测下载事件 15s 未可观测、页面无完成反馈，登记问题并修复 | 已修复 |
| 10 | 修复后复测导出 | 0.5s 内出现 `CSV 已生成 · 服务端审计日志.csv · 65 条记录`，API 复核审计数 65 | 通过 |

## 4. 内部研讨结论

学生体验视角：平台没有直接代写，而是给出学习步骤，符合「陪学生想明白」的产品定位。响应时间约 2.7 秒，学生侧不会明显流失。

教师视角：教师页只展示聚合趋势和「非作弊指控」说明，不暴露学生原始请求文本。这个设计适合学校场景，避免把一次求助误判为纪律处分依据，但仍能提示教师做课堂观察。

管理员视角：越权访问可以进入服务端审计，并被管理员看到。修复前导出缺少可见完成反馈，内测会无法确认留档是否完成；修复后有 toast 明确反馈文件名和行数。

产品留存视角：学术诚信拦截不是冷冰冰拒绝，而是温和引导，能降低学生挫败感。管理员导出反馈补齐后，治理操作更可被信任。

## 5. 本轮发现与修复

### R10-P2-001 管理员 CSV 导出缺少可观测完成反馈

复现：管理员进入 `/admin/audit`，点击「导出日志（服务端真实记录）」。

初测结果：浏览器下载事件 15 秒内没有可观测返回，页面也没有成功/失败提示。真实内测会无法判断导出是否完成。

修复：

- 修改 `D:/VB/LLM-School/app/lib/client/adminApi.ts`
- 新增 `buildCsvContent()` 纯函数，统一生成带 BOM 的 CSV 内容。
- `exportCsv()` 返回 CSV 字符串，并在成功时显示 `CSV 已生成` toast，包含文件名与行数。
- 失败时显示 `CSV 导出失败` toast，并继续抛出错误。

复测：

- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- `npm run build` 通过
- 浏览器复测导出后 0.5 秒出现成功 toast
- `/api/audit` 管理员读回 `auditCount=65`，且包含本轮 `u-student /admin/audit unauthorized_access deny`

## 6. 证据文件

关键日志：

- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/logs/r10-student-session-readback.json`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/logs/r10-teacher-class-api-readback.json`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/logs/r10-admin-audit-api-readback.json`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/logs/manual-impact-review-r10.json`

关键截图：

- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/screenshots/r10-student-integrity-result.png`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/screenshots/r10-teacher-integrity-trend.png`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/screenshots/r10-admin-server-audit-row.png`
- `D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/real-company-correction/screenshots/r10-admin-export-toast-fullpage-fixed.png`

## 7. 剩余风险

1. In-app Browser 的下载事件仍不能作为 OS 文件保存证据，本轮通过页面 toast + API 内容复核 + CSV 工具代码审查替代。
2. 学术诚信留痕是聚合频次，不提供单条匿名事件 drilldown。当前设计保护学生隐私，但后续如果学校需要教研复盘，可考虑做「匿名事件摘要」而不是暴露原文。
3. 工作区不是 git 仓库，无法做 git checkpoint 或 diff-based review；已使用 code-review-graph build 与手动影响审查替代。

## 8. 结论

本轮已把内测方法改为真实公司/学校内测链路，并完成一个跨角色闭环：学生真实使用、教师真实复核、管理员真实治理、问题真实修复、修复后真实复测。整体 12 小时内测目标仍在继续，不以本轮作为全部完成结论。
