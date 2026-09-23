# EduAI Prism 真实用户内测 R9：中断恢复与会议材料兜底报告

生成时间：2026-07-08 12:26 PDT  
测试范围：教师真实登录 -> 发起长 AI 任务 -> 生成中离开页面 -> 等待完整结果 -> 返回查看 UI/API 一致性  
结论：中断恢复链路通过；初测发现“会议材料请求被本地兜底误套成教案模板”，已修复并复测通过。

## 1. 本轮方法纠偏

本轮不再把按钮可点、页面可跳转、接口 200 当作产品内测结论。执行口径改为：

1. 使用真实角色：教师账号 `teacher`，用户身份为王思远老师。
2. 使用真实任务：校内教研会跨学科分享材料，明确要求会议议程、开场发言、学生案例、风险提醒、跟进表、内测复盘指标。
3. 等待完整结果：先观察生成中与慢响应状态，再模拟老师离开 dashboard，等待后端完成，再返回评价。
4. 双证据判断：浏览器 UI 截图/控制台 + 同一教师账号 API 会话详情。

## 2. 初测发现

初测 token：`R9-interruption-1783538189871`

通过项：

- 页面发送后进入“正在生成/外部模型响应较慢”状态。
- 老师离开 dashboard 后，后端仍完成生成并落库。
- 返回 `/chat` 后 UI 能恢复结果，没有永久生成态。
- UI 展示 `网关降级` 与约 `24.0s` 耗时，控制台 0 条错误/警告。

失败项：

- 用户明确要“会议材料”，但本地兜底返回的是“二次函数补救课教案”模板。
- 缺失会议议程、教师开场发言稿、教研组跟进表、公司化内测复盘指标等关键结构。
- 判定：这是产品质量缺陷，不是通过。原因是结果完整返回后，内容意图与真实任务不匹配。

证据：

- `.codex-supervisor/qa-12h-20260708/interruption-recovery/logs/r9-04-api-final-session-detail.json`
- `.codex-supervisor/qa-12h-20260708/interruption-recovery/logs/r9-05-returned-chat-result.json`
- `.codex-supervisor/qa-12h-20260708/interruption-recovery/screenshots/r9-05-returned-chat-result.png`

## 3. 修复内容

修改文件：`D:\VB\LLM-School\app\lib\server\llm.ts`

修复点：

- 新增教师侧 `localTeacherMeetingPack` 本地兜底模板。
- 在教师本地兜底入口增加会议/教研/议程/发言稿/跟进表/复盘/内测等意图判断。
- 保持原有补救课兜底不变，避免影响已验证的课堂教案场景。
- 不改鉴权、会话、学生安全、学术诚信、管理员和科研角色分支。

## 4. 修复后复测

复测 token：`R9-fix-meeting-1783538625324`

流程：

1. 重启本地生产服务，确认 `http://127.0.0.1:4920/login` 返回 200。
2. 浏览器重新登录教师账号。
3. 从 dashboard 点击“发起新对话”，创建空白会话。
4. 输入同类会议材料长任务并发送。
5. 等待慢响应状态出现。
6. 切到 dashboard，等待后端完成。
7. API 读取同一教师会话详情。
8. 返回 `/chat` 查看前端恢复结果。

复测结果：

| 检查项 | 结果 |
| --- | --- |
| 后端消息落库 | 通过，2 条消息 |
| assistant source | `local-fallback`，诚实标注 |
| assistant durationMs | 约 24029ms |
| UI 是否仍在生成 | 否 |
| UI 是否显示网关降级 | 是 |
| 控制台错误/警告 | 0 |
| 会议议程 | 通过 |
| 教师开场发言稿 | 通过 |
| 学生案例 | 通过 |
| 未成年人保护风险提醒 | 通过 |
| 教研组后续跟进表 | 通过 |
| 公司化内测复盘指标 | 通过 |

复测证据：

- `.codex-supervisor/qa-12h-20260708/interruption-recovery/logs/r9-09-fix-api-final-session-detail.json`
- `.codex-supervisor/qa-12h-20260708/interruption-recovery/logs/r9-10-fix-returned-chat-result.json`
- `.codex-supervisor/qa-12h-20260708/interruption-recovery/logs/r9-10-fix-browser-console.json`
- `.codex-supervisor/qa-12h-20260708/interruption-recovery/screenshots/r9-10-fix-returned-chat-result.png`

## 5. 工程验证

已通过：

- `npm run lint`
- `npx tsc --noEmit`
- `npm run build`
- 本地生产服务重启：监听 PID `20916`，`/login` 健康检查 200
- `python -m code_review_graph build`
- `python -m code_review_graph status`
- 手工影响面审阅：通过

## 6. 残余风险

- 当前会议材料兜底仍是关键词意图识别，后续应继续用更多教师真实文档类型扩展：家长会材料、教研论文评审、公开课磨课、跨学科项目制学习方案等。
- 本轮仅关闭“教师长任务中断恢复 + 会议材料兜底”切片，总体 12 小时真实内测目标仍在继续。
- 当前验证为本地 `127.0.0.1:4920`，未执行生产部署。
