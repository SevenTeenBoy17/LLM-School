# EduAI-Prism 真实用户内测问题清单 - R45

生成时间：2026-07-09 11:24 PDT

本轮范围：学生 `/learn` 学习首页真实数据闭环、移动端来源读回、后端 `/api/learning`、全局安全求助触控尺寸。

## 已修复问题

| 编号 | 严重级别 | 状态 | 问题 | 修复 |
| --- | --- | --- | --- | --- |
| R45-LEARN-DATA-001 | P1 | 已修复 | 学生学习首页存在静态示例数据误导风险，作业/错题/排行类内容可能被当作真实功能。 | 新增 `/api/learning` 和 `getLearningSnapshot(user)`，页面展示当前账号真实学习足迹；未接入模块明确标注。 |
| R45-LEARN-TOUCH-002 | P2 | 已修复 | 移动端“安全求助”入口实测高度 40px，低于 44px 触控基线。 | `SafetyHelp` 浮动入口和弹窗内相关操作提升到 `min-h-[44px]`。 |
| R45-LEARN-MOBILE-003 | P2 | 已修复 | “来源读回”只在桌面右栏展示，移动端右栏隐藏后学生缺少后端来源证据。 | `/learn` 主内容新增移动端可见“来源读回”卡片，复用同一组后端来源计数和刷新动作。 |

## 最终回归证据

| 证据 | 路径 | 结果 |
| --- | --- | --- |
| API 读回 | `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-learning-summary-final.json` | pass |
| 浏览器桌面/移动证据 | `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-browser-ui-evidence-final.json` | pass |
| 桌面截图 | `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-learn-desktop-1440-final.png` | 已生成 |
| 移动截图 | `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\r45-learn-mobile-390-final.png` | 已生成 |
| 手工影响审阅 | `D:\VB\LLM-School\.codex-supervisor\qa-12h-20260708\learning-r45\logs\manual-impact-review-r45.json` | pass |

## 当前未阻断观察

| 编号 | 状态 | 说明 |
| --- | --- | --- |
| R45-RISK-001 | 已记录 | 学习覆盖度是基于会话、AI 回复、收藏反馈、知识库足迹的估算，不是正式测评成绩。 |
| R45-RISK-002 | 已记录 | 本轮是本地生产服务验证，未执行线上部署。 |
| R45-RISK-003 | 已记录 | 工作区不是 Git 仓库，无法做 checkpoint commit 或 PR diff 审阅；已用 supervisor 证据、code-review-graph 和手工审阅替代。 |

## 最终判定

R45 问题闭环完成，最终浏览器证据和 API 证据均为 `pass`。整体 12 小时真实用户内测目标仍保持 active，后续继续选择未闭环的高价值学生/教师/后台工作流。

