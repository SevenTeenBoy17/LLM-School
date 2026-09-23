# EduAI-Prism 真实用户内测问题清单 R49

日期：2026-07-09

范围：后台模型治理闭环，覆盖 `/admin/models` 可视化配置、`/api/admin/models/{id}` 保存回读、`/api/chat` 学生开放/教师配额/安全关怀分支、桌面与移动端触控和文案一致性。

## 内测结论

R49 最终结论：通过。

本轮不是静态按钮巡检，而是按真实学校内部管理员治理场景执行：管理员登录后台，选择 MiniMax M2.7，调整“对学生开放”和配额策略，等待保存返回，再用独立 API 回读、学生/教师真实对话调用、权限边界、桌面/移动端可视化检查共同判断。所有问题已修复并通过复验。

## 已修复问题

| 编号 | 等级 | 问题 | 修复 | 复验 |
| --- | --- | --- | --- | --- |
| R49-MODEL-SAFETY-001 | P1 | 当模型对学生关闭时，“学习压力很大，不知道怎么办”这类软关怀求助被普通模型开放策略先拦截，学生看不到关怀回应。 | 在 `app/lib/safety/classifyIntent.ts` 增加软关怀压力表达识别，保持危机与学术诚信分支优先级不变。 | `r49-admin-models-api-summary.json`：学生普通问题返回 `kind=blocked`，软关怀问题返回 `kind=care/help=true/source=care`。 |
| R49-MODEL-COPY-001 | P2 | 后台模型页仍出现“成本/付费”倾向表达，和当前“不做付费版本”的产品要求冲突，容易让学校管理员误解为商业收费面板。 | 将模型治理页和后台演示数据改为“配额、公平使用、调用占比、全局配额规则”表达，移除货币型配额文案。 | 桌面与移动端视觉 JSON 均返回 `noPaidCostWording=true`、`hasQuotaCopy=true`、`hasRealConfigNote=true`。 |
| R49-MODEL-TARGET-001 | P2 | 管理员高频操作控件在当前缩放环境下存在低于稳定触控基线的风险，包括模型切换、设置、侧栏、顶部搜索、开关和滑块。 | 对后台模型页关键按钮、滑块、开关，以及 AdminTabs、Sidebar、Topbar 中相关触控目标设置明确 52px 稳定尺寸。 | 桌面与移动端视觉 JSON：模型按钮、开关、滑块均为 52px 级别；无横向溢出；仅跳转到主要内容的隐藏跳链为 1x1。 |

## 复验记录

- `npm run lint`：通过。
- `npx tsc --noEmit`：通过。
- `npm run build`：通过。
- `r49-admin-models-api-summary.json`：`verdict=pass`，管理员保存/回读、匿名 401、学生 403、教师 PUT 403、非法模型 400、学生禁用拦截、关怀绕过、教师首条内容质量、教师第二条配额限制、设置恢复均通过。
- `r49-admin-models-api-verdict.valid.json`：ASCII 机器可解析摘要，保留上述核心 API 结论，规避 PowerShell 对原始非 ASCII 长日志的解析兼容性问题。
- `r49-admin-models-ui-save-readback-final.json`：`verdict=pass`，管理员在可视化 UI 中关闭/恢复“对学生开放”，API 独立回读均正确。
- `r49-admin-models-desktop-visual-final.json` 与 `r49-admin-models-mobile-visual-final.json`：无横向溢出，无付费/成本误导文案，关键控件尺寸达标。
- `manual-impact-review-r49.json`：`verdict=pass`，code-review-graph 已刷新至 164 files / 749 nodes / 7137 edges。

## 残余说明

- in-app Browser 插件在一次 localhost logout 导航后降级，本轮按监督回退规则改用 Playwright CLI 完成真实浏览器复验。
- 本地 `node:sqlite` 在 Node 环境中会打印实验性平台警告；应用浏览器控制台复验无错误/警告。
- 当前工作区不是 Git 仓库，无法提供 checkpoint commit 或 PR diff 审阅；已使用 supervisor artifacts、code-review-graph、运行时日志、JSON 证据和手工影响审阅替代。
