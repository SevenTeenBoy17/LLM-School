# EduAI-Prism 真实用户内测问题清单 R50

时间：2026-07-09 16:30 PDT  
范围：班级学情页 `/class`、班级数据接口 `/api/class`、待批改作业到 `/chat` 的任务闭环

| 编号 | 问题 | 级别 | 状态 | 修复/处理 |
| --- | --- | --- | --- | --- |
| R50-CLASS-CACHE-001 | `/api/class` 返回班级实名诊断数据，但未显式设置 `Cache-Control: no-store` | P1 | 已修复 | 新增 `jsonNoStore()`，401 / 403 / 200 均返回 `no-store` |
| R50-CLASS-ACTION-001 | 待批改作业卡片跳转 `/chat?ref=...`，聊天页不消费 `ref`，按钮点击后没有正确任务上下文 | P1 | 已修复 | 改为 `/chat?seed=...`，预填标题、学科、对象与批改请求 |
| R50-RUNTIME-ENV-001 | 本地生产服务重启未继承 `EDUAI_SESSION_SECRET`，导致登录 500 | P2 | 已处理 | 使用本轮临时随机会话密钥启动本地服务；未写入源码和环境文件 |
| R50-TOOLING-PW-001 | Playwright runner 本地缺少 `@playwright/test`，初始测试无法收集 | P3 | 已处理 | 使用 `--no-save --no-package-lock` 补齐本地测试依赖，测试入口运行后已清理 |

## 回归证据

- API 契约：`.codex-supervisor/qa-12h-20260708/class-r50/logs/r50-class-api-summary.json`，verdict=`pass`
- 浏览器真实使用：`.codex-supervisor/qa-12h-20260708/class-r50/logs/r50-class-browser-summary.json`，verdict=`pass`
- 影响审阅：`.codex-supervisor/qa-12h-20260708/class-r50/logs/manual-impact-review-r50.json`，verdict=`pass`
- 截图：`r50-class-teacher-desktop.png`、`r50-class-teacher-mobile.png`、`r50-class-researcher.png`、`r50-class-student-redirect.png`

## 当前结论

本轮发现的问题已全部闭环。教师能从班级学情页进入真实 AI 批改建议流程；科研视图继续保持脱敏；学生无法获得班级诊断数据；桌面和移动端视觉基线通过。
