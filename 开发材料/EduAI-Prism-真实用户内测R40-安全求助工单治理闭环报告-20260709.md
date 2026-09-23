# EduAI Prism 真实用户内测 R40：安全求助工单治理闭环报告

生成时间：2026-07-09 08:26 PDT  
轮次：R40 safety ticket governance real-use QA  
状态：通过

## 1. 本轮目标

本轮围绕“真实学生求助”和“真实后台治理”进行闭环验证，不以按钮存在、页面能打开或接口能调通作为合格标准，而是要求：

- 学生必须通过真实移动端 UI 打开“安全求助”，填写补充情况，点击“请老师联系我”。
- 必须等待 `/api/safety` POST 返回，读取 `ticketId`、`status` 和安全提示文案。
- 返回文案必须通过内容质量评审：不制造“已经有人马上处理”的错觉，同时包含安全 / 心理团队、老师 / 信任大人 / 热线等保护性引导。
- 管理员必须通过真实后台读取该工单，能看到学生补充情况，并确认隐私信息已经脱敏。
- 管理员必须通过真实按钮点击“跟进”“完成”，等待 PATCH 返回值，并复查状态持久化和审计记录。
- 学生不得读取或修改后台工单治理接口。
- 移动端安全弹窗和后台治理按钮必须满足严格触控目标检查。

## 2. 基线问题与修复

R40-SAFE-001：学生“我需要帮助”流程没有补充情况输入框，后台只能收到空工单，无法做真实分诊。  
修复：在 `app/components/common/SafetyHelp.tsx` 增加“补充情况”文本域，将非空内容随 `{ type: "help", detail }` 提交到 `/api/safety`，并显示持久化回执。

R40-SAFE-002：学生提交后的反馈依赖 toast，真实用户不一定能保留工单号。  
修复：改为弹窗内 `role="status"` 持久回执，显示返回 message 与 ticketId，避免学生错过返回值。

R40-SAFE-003：安全求助弹窗内多个移动端目标小于严格 40px 门槛。  
修复：提升关闭按钮、热线链接、返回按钮、提交按钮和菜单行目标尺寸；第二轮复测发现关闭按钮实际仍为 35px 后，进一步改为 `h-12 w-12`。

R40-QA-001：第一版触控扫描把遮罩后的页面链接/按钮也算入当前弹窗问题。  
修复：R40 Playwright 脚本的 `inspectTargets` 先定位当前 `[role="dialog"]`，只扫描当前可操作上下文，避免误判。

## 3. 最终真实内测路径

测试脚本：
`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/safety-ticket-r40/r40-safety-ticket-governance.js`

最终通过日志：
`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/safety-ticket-r40/logs/r40-safety-ticket-R40_SAFETY_1783610643422.json`

真实流程：

1. 学生账号 `student` 在 390 x 844 移动端登录。
2. 打开 `/learn`，关闭新手引导，打开“安全求助”。
3. 进入“我需要帮助”，填写包含唯一 token、邮箱、手机号、长编号的补充情况。
4. 点击“请老师联系我”，等待 `/api/safety` POST 返回。
5. 读取弹窗内持久回执，确认 ticketId 可见。
6. 用学生会话尝试 GET/PATCH `/api/safety/tickets`，验证均为 403。
7. 管理员账号 `admin` 登录桌面端，GET `/api/safety/tickets`，定位刚创建的工单。
8. 内容评审：确认唯一 token 存在，邮箱/电话/长编号已脱敏。
9. 在 `/admin/audit` 真实页面点击“跟进”，等待 PATCH 返回 `in_progress`，并等待页面显示“跟进中”。
10. 再点击“完成”，等待 PATCH 返回 `resolved`，并复查持久化状态。
11. 读取 `/api/audit`，确认 `ticket_status_update allow` 审计记录。
12. 扫描学生弹窗和后台治理 UI 的小目标、横向溢出、控制台错误。

## 4. 最终证据

- 最终 verdict：`pass`
- issues：`[]`
- 学生提交返回：`200`
- 返回体：`{ ticketId: "tkt_mrdnqagr_aof3", status: "received" }`
- 学生可见回执：包含返回工单号
- 学生 GET `/api/safety/tickets`：`403`
- 学生 PATCH `/api/safety/tickets`：`403`
- 管理员 GET 工单：`200`
- 工单初始状态：`received`
- 工单补充情况包含唯一 token：通过
- 脱敏：邮箱 `[email]`、电话 `[phone]`、长编号 `[number]` 全部通过
- 管理员非法状态 PATCH：`400`
- 管理员“跟进”按钮：PATCH `200`，返回状态 `in_progress`，页面显示“跟进中”
- 管理员“完成”按钮：PATCH `200`，返回状态 `resolved`，页面显示“已处理”
- 状态持久化：复查为 `resolved`
- 审计记录：`ticket_status_update allow` 数量 2
- 学生端小目标：`[]`
- 管理端小目标：`[]`
- 横向溢出：无
- 相关 console/page error：无

静态与构建：

- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- `npm run build` 通过

审阅门：

- `python -m code_review_graph build --repo D:\VB\LLM-School\app --skip-flows`
- 图谱状态：159 files / 692 nodes / 6515 edges
- 手工影响审阅：`D:/VB/LLM-School/.codex-supervisor/qa-12h-20260708/safety-ticket-r40/logs/manual-impact-review-r40.json`

## 5. 结论

R40 已按真实用户/真实学校内测标准通过。学生求助链路现在能提交可用于分诊的补充情况，返回值和工单号可见；后台能看到脱敏后的内容，并通过真实“跟进/完成”按钮形成状态、持久化和审计闭环。所有关键按钮均等待返回值后判定，返回内容经过质量评审后才算合格。

本轮属于整体 12 小时真实内测中的一个具体闭环；总目标仍保持激活，后续继续按“真实使用 -> 等待完整返回 -> 内容评审 -> 修复 -> 复测”的标准推进。
