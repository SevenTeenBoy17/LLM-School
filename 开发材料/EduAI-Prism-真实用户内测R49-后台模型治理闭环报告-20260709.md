# EduAI-Prism 真实用户内测 R49：后台模型治理闭环报告

时间：2026-07-09 13:50 PDT

范围：`/admin/models` 后台模型治理、模型设置保存回读、`/api/admin/models/{id}` 权限边界、`/api/chat` 学生开放/教师配额/安全关怀分支、桌面与移动端视觉和触控目标。

## 本轮结论

R49 已完成并通过。最终版本满足：

- 管理员可以通过真实 UI 保存模型治理设置，页面保存状态与独立 API 回读一致。
- 学生在模型关闭开放时，普通问题会被正确拦截。
- 学生心理关怀类表达优先于模型开放策略，不再被误判为普通模型请求。
- 教师每日配额按真实用量执行：第一次正常返回完整教学内容，第二次达到配额后返回 `quota`。
- 配置最终恢复到原有效值，避免内测污染后续使用。
- 后台模型页不再出现付费、成本、人民币符号等误导文案，统一为非付费产品下的公平使用与配额治理。
- 桌面 1440x900 与移动端 390x844 均无横向溢出；模型按钮、设置按钮、Switch、Slider 均达到 52px 级可触控目标。

## 发现并修复的问题

1. `R49-MODEL-SAFETY-001`：学生说“学习压力很大，不知道怎么办”时，在模型对学生关闭的情况下被错误返回 `kind:"blocked"`。
   - 修复：在 `app/lib/safety/classifyIntent.ts` 增加软关怀压力表达识别。
   - 复测：学生普通问题返回 `blocked`，软关怀问题返回 `kind:"care"`、`help:true`、`source:"care"`。

2. `R49-MODEL-COPY-001`：模型治理页仍出现“成本规划 / 本月成本 / ¥”等付费暗示，与当前不做付费版本的产品方向冲突。
   - 修复：统一改为“全局配额规则 / 本月用量估算 / 公平使用 / 调用占比”，示例额度去掉金额符号。
   - 复测：桌面和移动端视觉检查均返回 `noPaidCostWording=true`、`hasQuotaCopy=true`。

3. `R49-MODEL-TARGET-001`：模型名按钮、设置按钮、Switch、Slider thumb、后台导航等存在低于稳定 44px 触控基线的风险。
   - 修复：后台模型页关键控件与相关 shell 导航目标改为显式 52px。
   - 复测：桌面和移动端视觉 JSON 均显示核心控件为 52px 级别，无横向溢出。

## 最终证据

- API 原始闭环：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/r49-admin-models-api-summary.json`
- API 稳定摘要：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/r49-admin-models-api-verdict.valid.json`
- UI 保存回读：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/r49-admin-models-ui-save-readback-final.json`
- 桌面视觉：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/r49-admin-models-desktop-visual-final.json`
- 移动视觉：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/r49-admin-models-mobile-visual-final.json`
- 桌面截图：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/r49-admin-models-desktop-final.png`
- 移动截图：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/r49-admin-models-mobile-final.png`
- 人工影响面审查：`.codex-supervisor/qa-12h-20260708/admin-models-r49/logs/manual-impact-review-r49.json`
- 问题清单：`开发材料/EduAI-Prism-真实用户内测问题清单-20260709-R49.md`

## 验证命令与结果

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- `python -m code_review_graph status --data-dir D:\VB\LLM-School\.codex-supervisor\code-review-graph`：通过，164 files / 749 nodes / 7137 edges。
- Node JSON parse：原始 API 日志与稳定摘要均返回 `pass`。
- Playwright CLI 控制台检查：0 errors / 0 warnings。
- Supervisor validate：55 OK / 0 WARN / 0 FAIL。

## 能力降级说明

本轮 in-app Browser 插件在访问本地 logout 后进入工具层错误页并阻止继续导航；已按监督规则降级到 Playwright CLI。降级不影响最终证据，因为 Playwright CLI 完成了真实可见登录、页面点击、UI 保存回读、桌面/移动视觉检查和截图归档。

## 残余风险

- 当前验证是本地 `http://127.0.0.1:4920`，没有进行生产部署。
- 本地 `node:sqlite` 会输出实验性平台警告；这不是应用浏览器控制台错误。
- 当前工作区不是 Git 仓库，无法提供 checkpoint commit 或 PR diff 审阅；本轮用 supervisor artifacts、code-review-graph、运行时日志、JSON 证据和人工影响审阅替代。
